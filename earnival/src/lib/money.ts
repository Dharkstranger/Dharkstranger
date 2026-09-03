/**
 * Earnival money engine.
 *
 * Every value here is an integer number of kobo. Floats are never used for
 * money: `0.1 + 0.2 !== 0.3` is an accounting bug waiting to happen, and
 * Paystack transacts in kobo anyway.
 *
 * The single invariant this module guarantees:
 *
 *     serviceFee + organiserShare + vendorNet === gross    (exactly, always)
 *
 * Rounding remainders are absorbed by the vendor's net rather than being
 * dropped, so no kobo is ever created or destroyed by a split.
 */

export const KOBO_PER_NAIRA = 100;

/** Basis points. 750 bps = 7.5%. Integer rates avoid float rate math. */
export type Bps = number;

export const PLAN_SERVICE_FEE_BPS = {
  STARTER: 750, // 7.5%
  STANDARD: 500, // 5%
  PREMIUM: 200, // 2%
} as const;

export type Plan = keyof typeof PLAN_SERVICE_FEE_BPS;

export const DEFAULT_PROCESSING_FEE_BPS = 150; // 1.5%, passed to the buyer

/**
 * PRD Decision #12 is still open: does a connection's share compute on gross,
 * or on gross net-of-service-charge? Both are implemented; the default matches
 * the worked example in PRD §8. Changing this constant changes every future
 * split — existing orders are unaffected because they snapshot their own terms.
 */
export type ShareBasis = "GROSS" | "NET_OF_SERVICE";
export const DEFAULT_SHARE_BASIS: ShareBasis = "GROSS";

export class MoneyError extends Error {}

function assertValidMoney(value: number, label: string): void {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new MoneyError(`${label} must be an integer number of kobo, got ${value}`);
  }
  if (value < 0) {
    throw new MoneyError(`${label} may not be negative, got ${value}`);
  }
}

function assertValidBps(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 10_000) {
    throw new MoneyError(`${label} must be an integer 0..10000 bps, got ${value}`);
  }
}

/** Applies a basis-point rate, rounding half away from zero. */
export function applyBps(amountKobo: number, bps: Bps): number {
  assertValidMoney(amountKobo, "amount");
  assertValidBps(bps, "rate");
  return Math.round((amountKobo * bps) / 10_000);
}

export function nairaToKobo(naira: number): number {
  return Math.round(naira * KOBO_PER_NAIRA);
}

export function koboToNaira(kobo: number): number {
  return kobo / KOBO_PER_NAIRA;
}

/** Formats kobo for display, e.g. 1500000 -> "₦15,000". */
export function formatNaira(kobo: number, opts: { showKobo?: boolean } = {}): string {
  const negative = kobo < 0;
  const abs = Math.abs(kobo);
  const whole = Math.floor(abs / KOBO_PER_NAIRA);
  const remainder = abs % KOBO_PER_NAIRA;
  const showKobo = opts.showKobo ?? remainder !== 0;
  const body = showKobo
    ? `${whole.toLocaleString("en-NG")}.${String(remainder).padStart(2, "0")}`
    : whole.toLocaleString("en-NG");
  return `${negative ? "-" : ""}₦${body}`;
}

// ------------------------------------------------------------------
// Buyer-side totals
// ------------------------------------------------------------------

export interface BuyerTotal {
  subtotalKobo: number;
  processingFeeKobo: number;
  totalKobo: number;
}

/**
 * What the buyer is charged. Processing fees are passed to the buyer
 * (PRD PAY-03), so they sit on top of the subtotal and never reduce what the
 * seller receives.
 */
export function buyerTotal(
  subtotalKobo: number,
  processingFeeBps: Bps = DEFAULT_PROCESSING_FEE_BPS,
): BuyerTotal {
  assertValidMoney(subtotalKobo, "subtotal");
  const processingFeeKobo = applyBps(subtotalKobo, processingFeeBps);
  return {
    subtotalKobo,
    processingFeeKobo,
    totalKobo: subtotalKobo + processingFeeKobo,
  };
}

// ------------------------------------------------------------------
// Seller-side splits
// ------------------------------------------------------------------

export interface SaleSplit {
  /** Value of the goods sold. */
  grossKobo: number;
  /** Earnival's plan-based service charge. */
  serviceFeeKobo: number;
  /** The organiser's connection share of this vendor's sale. */
  organiserShareKobo: number;
  /** What the vendor is owed. Absorbs any rounding remainder. */
  vendorNetKobo: number;
  /**
   * Extra charged to the buyer when the connection passes its fee through
   * (PRD CON-04) instead of deducting it from the vendor.
   */
  buyerSurchargeKobo: number;
}

export interface SplitSaleInput {
  grossKobo: number;
  serviceFeeBps: Bps;
  revenueShareBps?: Bps;
  shareBasis?: ShareBasis;
  /** CON-04 pass-to-customer toggle. */
  passShareToCustomer?: boolean;
}

/**
 * Splits a vendor's product sale between Earnival, the organiser and the vendor.
 *
 * Order of operations (PRD §8): service charge first, then the connection
 * share, then whatever remains settles to the vendor.
 */
export function splitSale(input: SplitSaleInput): SaleSplit {
  const {
    grossKobo,
    serviceFeeBps,
    revenueShareBps = 0,
    shareBasis = DEFAULT_SHARE_BASIS,
    passShareToCustomer = false,
  } = input;

  assertValidMoney(grossKobo, "gross");
  assertValidBps(serviceFeeBps, "serviceFeeBps");
  assertValidBps(revenueShareBps, "revenueShareBps");

  const serviceFeeKobo = applyBps(grossKobo, serviceFeeBps);

  const shareBase = shareBasis === "GROSS" ? grossKobo : grossKobo - serviceFeeKobo;
  const organiserShareKobo = applyBps(Math.max(0, shareBase), revenueShareBps);

  if (passShareToCustomer) {
    // The buyer covers the organiser's share on top of the ticket price, so the
    // vendor only carries the service charge.
    return {
      grossKobo,
      serviceFeeKobo,
      organiserShareKobo,
      vendorNetKobo: grossKobo - serviceFeeKobo,
      buyerSurchargeKobo: organiserShareKobo,
    };
  }

  const vendorNetKobo = grossKobo - serviceFeeKobo - organiserShareKobo;
  if (vendorNetKobo < 0) {
    throw new MoneyError(
      `Split would leave the vendor negative: gross=${grossKobo}, service=${serviceFeeKobo}, share=${organiserShareKobo}. ` +
        `Combined rates exceed 100%.`,
    );
  }

  return {
    grossKobo,
    serviceFeeKobo,
    organiserShareKobo,
    vendorNetKobo,
    buyerSurchargeKobo: 0,
  };
}

export interface TicketSplit {
  grossKobo: number;
  serviceFeeKobo: number;
  organiserNetKobo: number;
}

/** Ticket sales carry the same plan service charge, with no connection share. */
export function splitTicketSale(grossKobo: number, serviceFeeBps: Bps): TicketSplit {
  assertValidMoney(grossKobo, "gross");
  assertValidBps(serviceFeeBps, "serviceFeeBps");
  const serviceFeeKobo = applyBps(grossKobo, serviceFeeBps);
  return {
    grossKobo,
    serviceFeeKobo,
    organiserNetKobo: grossKobo - serviceFeeKobo,
  };
}

// ------------------------------------------------------------------
// Proportional allocation
// ------------------------------------------------------------------

/**
 * Distributes `totalKobo` across `weights` using the largest-remainder method,
 * so the parts always sum to exactly the total. Used to spread one buyer-paid
 * processing fee across the shops in a multi-shop basket.
 */
export function allocate(totalKobo: number, weights: number[]): number[] {
  assertValidMoney(totalKobo, "total");
  if (weights.length === 0) return [];
  if (weights.some((w) => w < 0)) {
    throw new MoneyError("weights may not be negative");
  }

  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum === 0) {
    // Nothing to weight by: give it all to the first bucket.
    return weights.map((_, i) => (i === 0 ? totalKobo : 0));
  }

  const exact = weights.map((w) => (totalKobo * w) / weightSum);
  const floors = exact.map(Math.floor);
  let remainder = totalKobo - floors.reduce((a, b) => a + b, 0);

  const order = exact
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac);

  const result = [...floors];
  for (let i = 0; remainder > 0; i = (i + 1) % order.length) {
    result[order[i].index] += 1;
    remainder -= 1;
  }
  return result;
}

// ------------------------------------------------------------------
// Ledger construction
// ------------------------------------------------------------------

export interface LedgerLine {
  account:
    | "GROSS_SALES"
    | "PROCESSING_FEE"
    | "PLATFORM_SERVICE_FEE"
    | "ORGANISER_SHARE"
    | "VENDOR_NET"
    | "ORGANISER_TICKET_NET"
    | "APPLICATION_FEE"
    | "BOOTH_FEE"
    | "REFUND";
  amountKobo: number;
  /** null means the Earnival platform. */
  partyId: string | null;
  description: string;
}

/**
 * Turns a product-sale split into the ledger lines it must produce.
 * Payable lines (VENDOR_NET, ORGANISER_SHARE) must always net to the gross
 * minus Earnival's take.
 */
export function ledgerLinesForOrder(params: {
  split: SaleSplit;
  vendorUserId: string;
  organiserUserId: string | null;
  orderReference: string;
}): LedgerLine[] {
  const { split, vendorUserId, organiserUserId, orderReference } = params;
  const lines: LedgerLine[] = [
    {
      account: "VENDOR_NET",
      amountKobo: split.vendorNetKobo,
      partyId: vendorUserId,
      description: `Net proceeds from order ${orderReference}`,
    },
    {
      account: "PLATFORM_SERVICE_FEE",
      amountKobo: split.serviceFeeKobo,
      partyId: null,
      description: `Service charge on order ${orderReference}`,
    },
  ];

  if (split.organiserShareKobo > 0 && organiserUserId) {
    lines.push({
      account: "ORGANISER_SHARE",
      amountKobo: split.organiserShareKobo,
      partyId: organiserUserId,
      description: `Connection share from order ${orderReference}`,
    });
  }

  return lines;
}

export function ledgerLinesForTickets(params: {
  split: TicketSplit;
  organiserUserId: string;
  eventName: string;
}): LedgerLine[] {
  const { split, organiserUserId, eventName } = params;
  return [
    {
      account: "ORGANISER_TICKET_NET",
      amountKobo: split.organiserNetKobo,
      partyId: organiserUserId,
      description: `Ticket proceeds — ${eventName}`,
    },
    {
      account: "PLATFORM_SERVICE_FEE",
      amountKobo: split.serviceFeeKobo,
      partyId: null,
      description: `Service charge on tickets — ${eventName}`,
    },
  ];
}
