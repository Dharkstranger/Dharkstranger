import type { SettlementCadence } from "./verification";

import { db } from "./db";
import { entitlementsFor } from "./verification";
import { formatNaira } from "./money";
import {
  createTransferRecipient,
  initiateTransfer,
  resolveAccount,
} from "./paystack";
import { sendEmail } from "./mail";
import { alertSettlementFailed, captureError } from "./observability";

/**
 * Settlement — turning ledger balances into money in people's bank accounts.
 *
 * Two rules govern this file:
 *
 *  1. A ledger entry belongs to at most one settlement. Entries are claimed by
 *     a conditional UPDATE filtered on `settlementId IS NULL`, so two
 *     concurrent runs cannot pay the same earnings twice.
 *
 *  2. A party's payable balance is the sum of their *unclaimed* entries.
 *     Refund contra-entries are negative, so a refunded sale reduces the next
 *     payout automatically rather than needing a clawback.
 *
 * Cadence follows the seller's verification level (PRD VRF-06): post-event at
 * L0–L1, daily at L2–L3. The payout itself lands T+1 after the trigger.
 */

export class SettlementError extends Error {}

/** Paystack will not transfer trivial amounts; below this we roll forward. */
export const MINIMUM_PAYOUT_KOBO = 10_000; // ₦100

export interface SettlementRunResult {
  considered: number;
  settled: number;
  skipped: { partyId: string; reason: string }[];
  totalKobo: number;
}

/**
 * Finds everyone owed money, works out which of their earnings are due under
 * their cadence, and pays them.
 *
 * Safe to run repeatedly — anything already claimed by a previous run is
 * invisible to this one.
 */
export async function runSettlements(options: { now?: Date; dryRun?: boolean } = {}): Promise<SettlementRunResult> {
  const now = options.now ?? new Date();

  const parties = await db.ledgerEntry.groupBy({
    by: ["partyId"],
    where: { partyId: { not: null }, settlementId: null },
    _sum: { amountKobo: true },
  });

  const result: SettlementRunResult = {
    considered: parties.length,
    settled: 0,
    skipped: [],
    totalKobo: 0,
  };

  for (const party of parties) {
    const partyId = party.partyId!;
    try {
      const outcome = await settleParty(partyId, now, options.dryRun ?? false);
      if (outcome.settled) {
        result.settled += 1;
        result.totalKobo += outcome.amountKobo;
      } else {
        result.skipped.push({ partyId, reason: outcome.reason! });
      }
    } catch (error) {
      result.skipped.push({
        partyId,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

interface PartyOutcome {
  settled: boolean;
  amountKobo: number;
  reason?: string;
}

async function settleParty(
  partyId: string,
  now: Date,
  dryRun: boolean,
): Promise<PartyOutcome> {
  const user = await db.user.findUnique({
    where: { id: partyId },
    include: {
      payoutAccounts: { where: { verified: true }, orderBy: { isDefault: "desc" } },
    },
  });
  if (!user) return { settled: false, amountKobo: 0, reason: "User not found" };

  const cadence = entitlementsFor(user.verificationLevel).settlementCadence;
  const eligibleIds = await eligibleEntryIds(partyId, cadence, now);

  if (eligibleIds.length === 0) {
    return { settled: false, amountKobo: 0, reason: "Nothing due yet" };
  }

  const due = await db.ledgerEntry.aggregate({
    where: { id: { in: eligibleIds } },
    _sum: { amountKobo: true },
  });
  const amountKobo = due._sum.amountKobo ?? 0;

  if (amountKobo <= 0) {
    // Refunds have wiped out these earnings. Leave the entries unclaimed so
    // the negative carries into the next run against future sales.
    return { settled: false, amountKobo, reason: "Balance is zero or negative" };
  }
  if (amountKobo < MINIMUM_PAYOUT_KOBO) {
    return {
      settled: false,
      amountKobo,
      reason: `Below minimum payout of ${formatNaira(MINIMUM_PAYOUT_KOBO)}`,
    };
  }

  const account = user.payoutAccounts[0];
  if (!account) {
    return { settled: false, amountKobo, reason: "No verified bank account on file" };
  }
  if (dryRun) return { settled: true, amountKobo };

  const periodStart = await earliestEntryDate(eligibleIds);

  // Create the settlement and claim its entries in one transaction. The
  // `settlementId: null` filter is what makes a concurrent run a no-op.
  const claimed = await db.$transaction(async (tx) => {
    const settlement = await tx.settlement.create({
      data: {
        reference: `stl_${partyId.slice(-6)}_${now.getTime().toString(36)}`,
        partyId,
        amountKobo,
        status: "PENDING",
        payoutAccountId: account.id,
        periodStart,
        periodEnd: now,
      },
    });

    const linked = await tx.ledgerEntry.updateMany({
      where: { id: { in: eligibleIds }, settlementId: null },
      data: { settlementId: settlement.id },
    });

    if (linked.count === 0) {
      throw new SettlementError("Entries were claimed by a concurrent run");
    }

    // Another run may have taken some entries between our read and this
    // update — re-total from what we actually claimed.
    const actual = await tx.ledgerEntry.aggregate({
      where: { settlementId: settlement.id },
      _sum: { amountKobo: true },
    });
    const actualKobo = actual._sum.amountKobo ?? 0;

    if (actualKobo !== amountKobo) {
      await tx.settlement.update({
        where: { id: settlement.id },
        data: { amountKobo: actualKobo },
      });
    }

    return { settlementId: settlement.id, amountKobo: actualKobo };
  });

  if (claimed.amountKobo < MINIMUM_PAYOUT_KOBO) {
    await releaseSettlement(claimed.settlementId, "Fell below minimum after claiming");
    return { settled: false, amountKobo: claimed.amountKobo, reason: "Below minimum" };
  }

  await payOut(claimed.settlementId);
  return { settled: true, amountKobo: claimed.amountKobo };
}

/**
 * Which of a party's unclaimed entries are due.
 *
 * Post-event: only earnings from events that have finished. Daily: everything
 * from before today, so a payout covers whole days rather than partial ones.
 */
async function eligibleEntryIds(
  partyId: string,
  cadence: SettlementCadence,
  now: Date,
): Promise<string[]> {
  if (cadence === "DAILY") {
    const cutoff = new Date(now);
    cutoff.setHours(0, 0, 0, 0);
    const entries = await db.ledgerEntry.findMany({
      where: { partyId, settlementId: null, createdAt: { lt: cutoff } },
      select: { id: true },
    });
    return entries.map((e) => e.id);
  }

  // POST_EVENT — the event must be over, and not still awaiting review.
  const entries = await db.ledgerEntry.findMany({
    where: {
      partyId,
      settlementId: null,
      event: {
        approvalStatus: { in: ["AUTO_APPROVED", "APPROVED"] },
        OR: [{ endsAt: { lt: now } }, { endsAt: null, startsAt: { lt: now } }],
      },
    },
    select: { id: true },
  });
  return entries.map((e) => e.id);
}

async function earliestEntryDate(ids: string[]): Promise<Date> {
  const first = await db.ledgerEntry.findFirst({
    where: { id: { in: ids } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  return first?.createdAt ?? new Date();
}

/** Unlinks a settlement's entries so they return to the payable pool. */
async function releaseSettlement(settlementId: string, reason: string): Promise<void> {
  const settlement = await db.settlement.findUnique({
    where: { id: settlementId },
    include: { party: { select: { name: true, email: true } } },
  });

  await db.$transaction([
    db.ledgerEntry.updateMany({
      where: { settlementId },
      data: { settlementId: null },
    }),
    db.settlement.update({
      where: { id: settlementId },
      data: { status: "FAILED", failureReason: reason },
    }),
  ]);

  // Money that failed to move must reach a human, not just a log file.
  if (settlement) {
    await alertSettlementFailed({
      reference: settlement.reference,
      partyLabel: settlement.party.name ?? settlement.party.email,
      amountKobo: settlement.amountKobo,
      reason,
    });
  }
}

/**
 * Sends the transfer. The settlement reference doubles as the provider
 * reference, so a retry of an already-submitted transfer is rejected by
 * Paystack rather than paying twice.
 */
async function payOut(settlementId: string): Promise<void> {
  const settlement = await db.settlement.findUnique({
    where: { id: settlementId },
    include: { party: true, payoutAccount: true },
  });
  if (!settlement || !settlement.payoutAccount) return;

  const claimed = await db.settlement.updateMany({
    where: { id: settlementId, status: "PENDING" },
    data: { status: "PROCESSING" },
  });
  if (claimed.count === 0) return; // Someone else is already paying this out.

  try {
    let recipientCode = settlement.payoutAccount.recipientCode;
    if (!recipientCode) {
      const created = await createTransferRecipient({
        name: settlement.payoutAccount.accountName,
        accountNumber: settlement.payoutAccount.accountNumber,
        bankCode: settlement.payoutAccount.bankCode,
      });
      recipientCode = created.recipientCode;
      await db.payoutAccount.update({
        where: { id: settlement.payoutAccount.id },
        data: { recipientCode },
      });
    }

    const transfer = await initiateTransfer({
      amountKobo: settlement.amountKobo,
      recipientCode,
      reference: settlement.reference,
      reason: `Earnival settlement ${settlement.reference}`,
    });

    // Paystack may settle immediately or asynchronously; the transfer webhook
    // confirms either way.
    await db.settlement.update({
      where: { id: settlementId },
      data: {
        providerTransferCode: transfer.transferCode,
        status: transfer.status === "success" ? "PAID" : "PROCESSING",
        paidAt: transfer.status === "success" ? new Date() : null,
      },
    });

    if (transfer.status === "success") {
      await notifyPaid(settlementId);
    }
  } catch (error) {
    await releaseSettlement(
      settlementId,
      error instanceof Error ? error.message : String(error),
    );
    await captureError(error, {
      scope: "settlement.payout",
      severity: "critical",
      detail: { settlementId, amountKobo: settlement.amountKobo },
    });
  }
}

async function notifyPaid(settlementId: string): Promise<void> {
  const settlement = await db.settlement.findUnique({
    where: { id: settlementId },
    include: { party: true, payoutAccount: true },
  });
  if (!settlement?.party.email) return;

  const account = settlement.payoutAccount;
  const masked = account ? `••••${account.accountNumber.slice(-4)}` : "your bank account";

  await sendEmail({
    to: settlement.party.email,
    subject: `${formatNaira(settlement.amountKobo)} is on its way`,
    text: `Your Earnival settlement of ${formatNaira(
      settlement.amountKobo,
    )} has been sent to ${masked}. Reference ${settlement.reference}.`,
    html: `<p>Your settlement of <b>${formatNaira(
      settlement.amountKobo,
    )}</b> has been sent to ${masked}.</p><p style="color:#6E6578">Reference ${settlement.reference}</p>`,
  }).catch(() => {});
}

// ------------------------------------------------------------------
// Transfer webhooks
// ------------------------------------------------------------------

export async function markTransferOutcome(
  reference: string,
  outcome: "PAID" | "FAILED",
  failureReason?: string,
): Promise<void> {
  const settlement = await db.settlement.findUnique({ where: { reference } });
  if (!settlement) return;

  if (outcome === "PAID") {
    await db.settlement.updateMany({
      where: { reference, status: { in: ["PENDING", "PROCESSING"] } },
      data: { status: "PAID", paidAt: new Date() },
    });
    await notifyPaid(settlement.id);
    return;
  }

  // A failed or reversed transfer returns the earnings to the payable pool so
  // the next run retries them.
  await releaseSettlement(settlement.id, failureReason ?? "Transfer failed");
}

// ------------------------------------------------------------------
// Payout accounts
// ------------------------------------------------------------------

/**
 * Adds a bank account, confirming the account name with the bank before it can
 * ever receive money (PRD SHP-07).
 */
export async function addPayoutAccount(params: {
  userId: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
}): Promise<{ accountName: string }> {
  const accountNumber = params.accountNumber.replace(/\D/g, "");
  if (accountNumber.length !== 10) {
    throw new SettlementError("A Nigerian account number is 10 digits");
  }

  const { accountName } = await resolveAccount({
    accountNumber,
    bankCode: params.bankCode,
  });

  const existing = await db.payoutAccount.count({ where: { userId: params.userId } });

  await db.payoutAccount.create({
    data: {
      userId: params.userId,
      bankCode: params.bankCode,
      bankName: params.bankName,
      accountNumber,
      accountName,
      verified: true,
      isDefault: existing === 0,
    },
  });

  return { accountName };
}
