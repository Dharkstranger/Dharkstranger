# Earnival

Commerce infrastructure for events. Sell tickets, run vendor shops, take cashless
payments, check people in, and settle everyone from one link.

This is the production implementation of the Earnival PRD v8.0 — Phase 1, cut to
the core loop:

> organiser creates event → shops connect → link travels → attendees buy tickets
> → attendees buy products → organiser checks people in → the ledger settles
> everyone

---

## What's built

| Capability | Status |
|---|---|
| Event creation, publish, shareable link + QR | ✅ |
| Public event microsite with OpenGraph previews | ✅ |
| Guest ticket checkout (no account required) | ✅ |
| Real Paystack payments, webhook-confirmed | ✅ |
| Vendor shops, products, permanent storefronts | ✅ |
| Shop→event connections with revenue-share terms | ✅ |
| Multi-shop basket, one group ref, per-shop orders | ✅ |
| Pay-at-event orders | ✅ |
| Order fulfilment with code-gated pickup | ✅ |
| Scannable QR tickets + camera check-in | ✅ |
| Offline-tolerant check-in queue | ✅ |
| Append-only money ledger with exact splits | ✅ |
| Passwordless email OTP auth + guest purchase claiming | ✅ |
| Verification ladder L0–L3 with caps and entitlements | ✅ |
| Admin approval queue for events and KYC | ✅ |
| Refunds — full, partial, and event cancellation | ✅ |
| Settlement engine with real Paystack transfers | ✅ |
| Event banners, product photos, generated OG cards | ✅ |
| Lost-ticket recovery by email | ✅ |
| WhatsApp / SMS vendor sale alerts | ✅ |
| Rate limiting and security headers | ✅ |
| Desktop console layouts | ✅ |

Deliberately **not** in this cut (Phase 2–3 in the PRD): plan tiers, wallet,
cohosts, series, booths, ad space, chatrooms, shop-to-shop transfer, Earnit,
group checkout.

---

## The five rules this codebase enforces

These are the failures that cost real money, and each is closed structurally
rather than by convention.

**1. Money is integer kobo, never floats.**
`src/lib/money.ts` is the only place fees are computed. Every split satisfies
`serviceFee + organiserShare + vendorNet === gross` exactly; rounding
remainders go to the vendor rather than evaporating. Verified by a ~300-case
sweep in `money.test.ts`.

**2. Prices come from the database, never from the client.**
`createTicketCheckout` and `createProductCheckout` accept only ids and
quantities. A client that posts a price is ignored.

**3. Inventory is reserved by conditional SQL, not read-then-write.**
```sql
UPDATE "TicketType" SET reserved = reserved + $n
WHERE id = $id AND sold + reserved + $n <= quantity
```
Postgres row-locks the type, so 40 buyers racing for 5 seats produce exactly 5
winners. Proved in `commerce.test.ts` against a real database.

**4. Only a verified webhook marks a payment successful.**
`/api/webhooks/paystack` verifies the HMAC-SHA512 signature against the raw
body before parsing anything, records every delivery under a unique key, and
`settlePayment` guards its status transition — so a Paystack retry is a no-op,
not a double credit.

**5. Order status is workflow; `LedgerEntry` is truth.**
The ledger is append-only. Balances are always the sum of entries, never a
stored number that can drift. Refunds append contra-entries rather than editing
history, and settlement claims entries with a `settlementId IS NULL` filter, so
no earning can be paid twice.

---

## Trust, refunds and money out

### The verification ladder

| Level | How | Cap per event | Unlocks | Settlement |
|---|---|---|---|---|
| L0 | Email verified | ₦500,000 | Free events publish instantly; paid events go to admin review | After the event |
| L1 | Phone verified | ₦1,000,000 | Paid events publish instantly; can open and connect a shop | After the event |
| L2 | BVN or NIN | ₦5,000,000 | — | Daily |
| L3 | CAC + TIN | Unlimited | Verified badge | Daily |

Caps are enforced inside the checkout transaction and count in-flight
reservations, so concurrent buyers cannot straddle the limit. The cap is
snapshot onto the event at publish, so a later level change never invalidates
sales already made.

**Sensitive data (VRF-07 / NDPR).** BVN, NIN and TIN are encrypted with
AES-256-GCM under `KYC_SECRET` — a key deliberately separate from
`AUTH_SECRET`, so a leaked session key cannot expose identity data. Only the
last four digits are stored in the clear; reviewers never see the full value.
`decryptSensitive` is the single audited path to plaintext.

### Refunds (PRD Decision #9, resolved)

**Policy: the buyer is made whole.** Earnival reverses its 7.5% service charge
and the organiser's connection share off whoever was credited. The payment
processor keeps its ~1.5% fee, so Earnival absorbs that — booked explicitly as
`PROCESSING_FEE_ABSORBED` rather than quietly written off.

On a ₦13,000 order that means: vendor nets 0, organiser nets 0, platform is out
₦195. Stock returns, seats return to the pool, and the order is marked
`REFUNDED`. Partial refunds work the same way, proportionally.

Refunds are blocked after check-in or collection — the goods were delivered.
Cancelling an event refunds every outstanding ticket and order in one action.

Policy lives in `REFUND_POLICY` at the top of `src/lib/refunds.ts` if any of
those calls need changing.

### Settlement

`runSettlements()` finds everyone owed money, works out which earnings are due
under their cadence, claims those ledger entries, and transfers via Paystack.

- **Post-event (L0–L1):** only earnings from events that have finished.
- **Daily (L2–L3):** everything from before today, so payouts cover whole days.
- Payouts land T+1 after the trigger. Minimum ₦100.
- A negative balance (refunds exceeding sales) is never paid out and carries
  forward.
- No verified bank account means no payout, and the earnings stay untouched.
- Failed or reversed transfers release their entries back into the payable pool
  for the next run.

Run it on a schedule:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://…/api/cron/settle
```

---

## Security posture

Attacks this codebase actively defends against, and how:

| Threat | Defence |
|---|---|
| **Inventory denial** — scripting checkouts to hold every seat for free | Per-IP rate limit on checkout (10 / 5 min), Postgres-backed so it holds across serverless instances; reservations auto-expire |
| **Free tickets via sandbox** | Sandbox runs only when serving from localhost or with an explicit opt-in; the process refuses to boot on a real domain without payment keys |
| **Credential leakage through logs** | Sign-in codes, ticket links and pickup codes are never logged outside local dev; a deployed instance without a mail provider fails loudly instead |
| **Forged payments** | Only a signature-verified webhook or server-side verify call can mark a payment successful |
| **Stored XSS via uploads** | Image format is sniffed from magic bytes, never from the caller's `Content-Type`; only JPEG/PNG/WebP are stored, served `nosniff` |
| **Clickjacking** | `frame-ancestors 'none'` + `X-Frame-Options: DENY` |
| **Ticket-link leakage via referrer** | `/t/*` sends `Referrer-Policy: no-referrer`, `no-store`, and is excluded from indexing |
| **Enumerating who bought tickets** | Lookup responds identically whether or not the address exists, and is rate limited |
| **Identity data exposure** | BVN/NIN/TIN encrypted with AES-256-GCM under a key separate from the session secret; only last-4 ever readable |
| **Order reference collisions** | Random 6-char suffix plus retry on constraint violation — the previous timestamp-derived scheme failed 198 of 200 same-millisecond orders |

Not yet covered, and worth knowing: there is no WAF or bot detection, rate limits key on a spoofable `x-forwarded-for`, and no admin action audit log exists.

## Accessibility

Targets WCAG 2.2 AA:

- Skip link and a single `main` landmark on every route
- Body text no smaller than 12px; secondary text meets 4.5:1 on the paper background
- Tap targets on quantity steppers meet the 24px minimum (they render at 36px)
- Errors use `role="alert"` and are tied to their input with `aria-describedby` / `aria-invalid`
- Scanner feedback is an assertive live region, plus sound and haptics
- Pinch-zoom is never blocked; `prefers-reduced-motion` is honoured
- Focus is always visible

## Running it

Requires Node 22+ and Postgres 16+.

```bash
npm install
cp .env.example .env      # then fill in the values below
npm run db:push
npm run db:seed
npm run dev
```

Open http://localhost:3000. The seed prints three sign-in identities; **the
6-digit sign-in code is printed to the server log** when no mail provider is
configured.

```
organiser@earnival.app   L2 · admin · owns both live events · bank on file
amara@earnival.app       L1 · vendor with a connected shop · bank on file
tunde@earnival.app       L1 · vendor with a pending connection request
rookie@earnival.app      L0 · paid event sitting in the admin queue
```

### Environment

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `APP_URL` | yes | Public origin; used in QR payloads and emails |
| `AUTH_SECRET` | yes | `openssl rand -hex 32` |
| `QR_SECRET` | yes | `openssl rand -hex 32`. **Rotating it invalidates every issued ticket QR.** |
| `KYC_SECRET` | yes | `openssl rand -hex 32`. Encrypts BVN/NIN/TIN. **Rotating it makes existing identity records undecryptable.** Keep it separate from `AUTH_SECRET`. |
| `PAYSTACK_SECRET_KEY` | production | Without it the app runs in sandbox mode |
| `PAYSTACK_PUBLIC_KEY` | production | |
| `CRON_SECRET` | production | Bearer token guarding `/api/cron/settle` |
| `RESEND_API_KEY` | production | Console transport is local-dev only; a deployed instance refuses to send codes without it |
| `EMAIL_FROM` | no | |
| `TERMII_API_KEY` | no | SMS for phone verification and alert fallback |
| `TERMII_SENDER_ID` | no | |
| `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` | no | Vendor sale alerts; falls back to SMS |
| `WHATSAPP_TEMPLATE_NAME` | no | Required by Meta for business-initiated messages |
| `EARNIVAL_ALLOW_SANDBOX` | no | Set to `1` only for a throwaway staging environment |

### Sandbox mode

With no Paystack key set and `NODE_ENV !== production`, checkout redirects to a
local page that simulates success or failure, so the whole loop is walkable
without credentials. It returns 404 in production — a production deploy without
payment keys is a broken deploy, not a simulated one.

### Tests

```bash
npm test
```

71 tests:

- **25 unit tests** on the money engine, including the PRD §8 worked example and
  a ~300-combination invariant sweep.
- **8 integration tests** on the commerce loop: oversell races, webhook
  idempotency, reservation expiry, QR forgery, connection enforcement.
- **19 integration tests** on trust and money-out: KYC encryption, level
  progression, revenue caps, refund reconciliation, stock and seat restoration,
  event cancellation, payout idempotency, negative-balance hold-back.
- **19 regression tests** on the hardening pass — each maps to a defect that was
  live, so a failure means a real vulnerability has returned: reference
  collisions, rate-limit exhaustion and isolation, lookup-token forgery and
  expiry, upload format spoofing, and the sandbox guard on a real domain.

---

## Deploying

1. Provision Postgres (Neon, Supabase, RDS — anything Postgres 16+).
2. Set every required env var above. Generate fresh secrets; don't reuse dev ones.
3. `npm run build && npm start`, or deploy to Vercel as-is.
4. Point your Paystack webhook at `https://<your-domain>/api/webhooks/paystack`
   and subscribe to `charge.success` and `charge.failed`.
5. Schedule `releaseExpiredReservations()` (exported from `src/lib/commerce.ts`)
   every few minutes so abandoned checkouts return their held inventory.

---

## Before this takes real money

Resolved and implemented:

- **Decision #8 — L2/L3 caps.** L2 ₦5m, L3 unlimited.
- **Decision #9 — refund policy.** Buyer made whole; Earnival absorbs the
  processor's fee.

Still open:

- **Decision #12 — split order of operations.** Implemented as configurable
  (`DEFAULT_SHARE_BASIS` in `money.ts`), currently `GROSS` to match the PRD's
  worked example. Flip the constant once Finance decides.
- **Decision #22 — commission when shops sell event tickets.** Not implemented;
  connected shops don't sell tickets yet.
- **Decision #13 — pre-event ticket payouts.** Post-event cadence sidesteps this
  for L0–L1, but daily settlement at L2+ pays out ticket revenue before the
  event happens. Confirm that is acceptable to the CBN before going live.

Also outstanding before launch:

- NDPR privacy policy, terms of service, and consent capture at sign-up. The
  encryption and access controls are built; the legal surface is not.
- A **DPIA before L2 ships**, per the PRD's own risk table — you will be
  collecting BVN and NIN.
- Truecaller is not wired for L1; phone OTP alone stands in for it.
- SMS has no provider configured (`TERMII_API_KEY`), so verification codes
  currently print to the server log.
- Paystack Transfers must be enabled on the account, and the balance must be
  funded, before settlements can actually pay out.

---

## Layout

```
prisma/schema.prisma      Data model; every money field is integer kobo
src/lib/money.ts          Fee and split maths — pure, exhaustively tested
src/lib/commerce.ts       Checkout, reservations, payment settlement, fulfilment
src/lib/refunds.ts        Refund policy and ledger contra-entries
src/lib/settlement.ts     Payout runs, transfers, bank accounts
src/lib/verification.ts   L0–L3 ladder, caps, KYC encryption
src/lib/paystack.ts       Payments, refunds, transfers, webhook signatures
src/lib/qr.ts             HMAC-signed ticket tokens and real QR rendering
src/lib/ledger.ts         Balance and reporting queries
src/lib/checkin-client.ts Offline-tolerant check-in queue
src/app/e/[slug]          Public event microsite
src/app/s/[slug]          Public shop storefront
src/app/t/[token]         Ticket badge with scannable QR
src/app/dashboard         Organiser console + scanner
src/app/shop              Vendor console
src/app/verify            Verification ladder
src/app/payouts           Bank account + settlement history
src/app/admin             Approval queues and money operations
src/app/find              Lost-ticket recovery by email
src/app/api/cron/settle   Scheduled payout + reservation cleanup
src/lib/rate-limit.ts     Postgres-backed per-client throttling
src/lib/media.ts          Image storage; swap this to move off Postgres
src/lib/notify.ts         WhatsApp / SMS vendor alerts
src/lib/lookup.ts         Signed, expiring ticket-recovery links
src/instrumentation.ts    Boot-time configuration guard
e/[slug]/opengraph-image  Generated share cards
```
