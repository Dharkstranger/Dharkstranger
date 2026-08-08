import { describe, it, expect } from "vitest";
import {
  applyBps,
  allocate,
  buyerTotal,
  formatNaira,
  ledgerLinesForOrder,
  ledgerLinesForTickets,
  MoneyError,
  nairaToKobo,
  PLAN_SERVICE_FEE_BPS,
  splitSale,
  splitTicketSale,
} from "./money";

const N = nairaToKobo;

describe("PRD §8 worked example", () => {
  // "A buyer purchases a ₦10,000 product from Vendor V (Starter plan),
  //  connected to Organiser O's event with a 5% sales-fee share to O"
  const gross = N(10_000);

  it("charges the buyer ₦10,150 including the 1.5% processing fee", () => {
    const total = buyerTotal(gross, 150);
    expect(total.subtotalKobo).toBe(N(10_000));
    expect(total.processingFeeKobo).toBe(N(150));
    expect(total.totalKobo).toBe(N(10_150));
  });

  it("settles the vendor ₦8,750 on Starter", () => {
    const split = splitSale({
      grossKobo: gross,
      serviceFeeBps: PLAN_SERVICE_FEE_BPS.STARTER,
      revenueShareBps: 500,
    });
    expect(split.serviceFeeKobo).toBe(N(750));
    expect(split.organiserShareKobo).toBe(N(500));
    expect(split.vendorNetKobo).toBe(N(8_750));
  });

  it("settles ₦9,000 on Standard and ₦9,300 on Premium", () => {
    // The PRD states these as the vendor's upgrade incentive. Note both assume
    // no connection share, matching the prose in §8.
    const standard = splitSale({
      grossKobo: gross,
      serviceFeeBps: PLAN_SERVICE_FEE_BPS.STANDARD,
    });
    expect(standard.vendorNetKobo).toBe(N(9_500));

    const premium = splitSale({
      grossKobo: gross,
      serviceFeeBps: PLAN_SERVICE_FEE_BPS.PREMIUM,
    });
    expect(premium.vendorNetKobo).toBe(N(9_800));

    // With the same 5% organiser share applied, the PRD's stated figures hold.
    const standardWithShare = splitSale({
      grossKobo: gross,
      serviceFeeBps: PLAN_SERVICE_FEE_BPS.STANDARD,
      revenueShareBps: 500,
    });
    expect(standardWithShare.vendorNetKobo).toBe(N(9_000));

    const premiumWithShare = splitSale({
      grossKobo: gross,
      serviceFeeBps: PLAN_SERVICE_FEE_BPS.PREMIUM,
      revenueShareBps: 500,
    });
    expect(premiumWithShare.vendorNetKobo).toBe(N(9_300));
  });
});

describe("split invariant: nothing is created or destroyed", () => {
  it("always sums back to gross across a wide sweep of inputs", () => {
    const rates = [0, 200, 500, 750, 1000, 1234, 3333];
    const shares = [0, 100, 250, 500, 777, 1500];
    // Deliberately awkward amounts: primes, odd kobo, tiny values.
    const amounts = [1, 7, 99, 101, 333, 1_999, 12_345, 999_983, 1_000_000, 7_777_777];

    for (const grossKobo of amounts) {
      for (const serviceFeeBps of rates) {
        for (const revenueShareBps of shares) {
          const split = splitSale({ grossKobo, serviceFeeBps, revenueShareBps });
          expect(
            split.serviceFeeKobo + split.organiserShareKobo + split.vendorNetKobo,
          ).toBe(grossKobo);
          expect(split.vendorNetKobo).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(split.vendorNetKobo)).toBe(true);
        }
      }
    }
  });

  it("holds for ticket splits too", () => {
    for (const grossKobo of [1, 3, 17, 4_999, 1_500_000]) {
      for (const bps of [0, 200, 500, 750]) {
        const split = splitTicketSale(grossKobo, bps);
        expect(split.serviceFeeKobo + split.organiserNetKobo).toBe(grossKobo);
      }
    }
  });

  it("gives the rounding remainder to the vendor, never to the platform", () => {
    // 1 kobo at 7.5% rounds the fee to 0, so the vendor keeps the whole kobo.
    const split = splitSale({ grossKobo: 1, serviceFeeBps: 750 });
    expect(split.serviceFeeKobo).toBe(0);
    expect(split.vendorNetKobo).toBe(1);
  });
});

describe("rounding", () => {
  it("rounds half away from zero", () => {
    // 50 kobo at 1% = 0.5 kobo -> 1
    expect(applyBps(50, 100)).toBe(1);
    // 49 kobo at 1% = 0.49 -> 0
    expect(applyBps(49, 100)).toBe(0);
  });

  it("never lets combined fees exceed the sale", () => {
    expect(() =>
      splitSale({ grossKobo: N(100), serviceFeeBps: 6000, revenueShareBps: 5000 }),
    ).toThrow(MoneyError);
  });
});

describe("share basis — PRD Decision #12", () => {
  const grossKobo = N(10_000);

  it("computes on gross by default", () => {
    const split = splitSale({ grossKobo, serviceFeeBps: 750, revenueShareBps: 500 });
    expect(split.organiserShareKobo).toBe(N(500)); // 5% of 10,000
  });

  it("can compute net-of-service-charge instead", () => {
    const split = splitSale({
      grossKobo,
      serviceFeeBps: 750,
      revenueShareBps: 500,
      shareBasis: "NET_OF_SERVICE",
    });
    // 5% of (10,000 - 750) = 462.50 -> 462.5 naira = 46250 kobo
    expect(split.organiserShareKobo).toBe(46_250);
    expect(split.vendorNetKobo).toBe(grossKobo - N(750) - 46_250);
  });
});

describe("pass-fee-to-customer (CON-04)", () => {
  it("surcharges the buyer and leaves the vendor whole after service charge", () => {
    const split = splitSale({
      grossKobo: N(10_000),
      serviceFeeBps: 750,
      revenueShareBps: 500,
      passShareToCustomer: true,
    });
    expect(split.buyerSurchargeKobo).toBe(N(500));
    expect(split.vendorNetKobo).toBe(N(9_250)); // only the service charge deducted
    expect(split.organiserShareKobo).toBe(N(500));
  });
});

describe("allocate", () => {
  it("distributes exactly, with no lost kobo", () => {
    expect(allocate(100, [1, 1, 1]).reduce((a, b) => a + b, 0)).toBe(100);
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
  });

  it("weights proportionally", () => {
    expect(allocate(1000, [750, 250])).toEqual([750, 250]);
  });

  it("handles zero weights", () => {
    expect(allocate(500, [0, 0])).toEqual([500, 0]);
  });

  it("survives adversarial remainders", () => {
    for (const total of [1, 2, 7, 99, 1234, 100_001]) {
      for (const weights of [[1, 1], [1, 2, 3], [5, 5, 5, 5, 5, 5, 5]]) {
        const parts = allocate(total, weights);
        expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
        expect(parts.every((p) => p >= 0)).toBe(true);
      }
    }
  });
});

describe("input validation", () => {
  it("rejects float kobo", () => {
    expect(() => buyerTotal(100.5)).toThrow(MoneyError);
  });
  it("rejects negative money", () => {
    expect(() => buyerTotal(-100)).toThrow(MoneyError);
  });
  it("rejects out-of-range rates", () => {
    expect(() => applyBps(100, 10_001)).toThrow(MoneyError);
    expect(() => applyBps(100, -1)).toThrow(MoneyError);
  });
  it("rejects NaN", () => {
    expect(() => buyerTotal(Number.NaN)).toThrow(MoneyError);
  });
});

describe("formatNaira", () => {
  it("formats whole naira with separators", () => {
    expect(formatNaira(N(15_000))).toBe("₦15,000");
    expect(formatNaira(N(1_234_567))).toBe("₦1,234,567");
  });
  it("shows kobo only when present", () => {
    expect(formatNaira(46_250)).toBe("₦462.50");
    expect(formatNaira(N(10))).toBe("₦10");
  });
  it("handles negatives and zero", () => {
    expect(formatNaira(-N(500))).toBe("-₦500");
    expect(formatNaira(0)).toBe("₦0");
  });
});

describe("ledger lines", () => {
  it("produces payable lines that reconcile against the split", () => {
    const split = splitSale({
      grossKobo: N(10_000),
      serviceFeeBps: 750,
      revenueShareBps: 500,
    });
    const lines = ledgerLinesForOrder({
      split,
      vendorUserId: "vendor-1",
      organiserUserId: "organiser-1",
      orderReference: "EA-1043-1",
    });

    const sum = lines.reduce((a, l) => a + l.amountKobo, 0);
    expect(sum).toBe(split.grossKobo);

    const platform = lines.filter((l) => l.partyId === null);
    expect(platform).toHaveLength(1);
    expect(platform[0].amountKobo).toBe(N(750));
  });

  it("omits the organiser line when there is no connection share", () => {
    const split = splitSale({ grossKobo: N(5_000), serviceFeeBps: 750 });
    const lines = ledgerLinesForOrder({
      split,
      vendorUserId: "vendor-1",
      organiserUserId: "organiser-1",
      orderReference: "EA-1",
    });
    expect(lines.find((l) => l.account === "ORGANISER_SHARE")).toBeUndefined();
    expect(lines.reduce((a, l) => a + l.amountKobo, 0)).toBe(N(5_000));
  });

  it("reconciles ticket ledger lines", () => {
    const split = splitTicketSale(N(15_000), 750);
    const lines = ledgerLinesForTickets({
      split,
      organiserUserId: "organiser-1",
      eventName: "Gidi Groove",
    });
    expect(lines.reduce((a, l) => a + l.amountKobo, 0)).toBe(N(15_000));
  });
});
