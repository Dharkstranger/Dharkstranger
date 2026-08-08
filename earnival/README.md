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

Deliberately **not** in this cut (Phase 2–3 in the PRD): verification ladder
L0–L3, plan tiers, wallet, cohosts, series, booths, ad space, chatrooms,
shop-to-shop transfer, Earnit, group checkout.

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
stored number that can drift.

---

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
organiser@earnival.app   organiser, owns both seeded events
amara@earnival.app       vendor with a connected shop
tunde@earnival.app       vendor with a pending connection request
```

### Environment

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string |
| `APP_URL` | yes | Public origin; used in QR payloads and emails |
| `AUTH_SECRET` | yes | `openssl rand -hex 32` |
| `QR_SECRET` | yes | `openssl rand -hex 32`. **Rotating it invalidates every issued ticket QR.** |
| `PAYSTACK_SECRET_KEY` | production | Without it the app runs in sandbox mode |
| `PAYSTACK_PUBLIC_KEY` | production | |
| `RESEND_API_KEY` | no | Falls back to logging emails to the console |
| `EMAIL_FROM` | no | |

### Sandbox mode

With no Paystack key set and `NODE_ENV !== production`, checkout redirects to a
local page that simulates success or failure, so the whole loop is walkable
without credentials. It returns 404 in production — a production deploy without
payment keys is a broken deploy, not a simulated one.

### Tests

```bash
npm test
```

33 tests: 25 unit tests on the money engine (including the PRD §8 worked
example) and 8 integration tests against a real Postgres covering oversell
races, webhook idempotency, reservation expiry, QR forgery and connection
enforcement.

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

Three PRD decisions are still open and block correct payouts. The code is
written so each is a small, localised change:

- **Decision #9 — refund policy.** There is no refund path at all. Everything
  else assumes money only flows forward.
- **Decision #12 — split order of operations.** Implemented as configurable
  (`DEFAULT_SHARE_BASIS` in `money.ts`), currently `GROSS` to match the PRD's
  worked example. Flip the constant once Finance decides.
- **Decision #22 — commission when shops sell event tickets.** Not implemented;
  connected shops don't sell tickets yet.

Also outstanding before launch: NDPR privacy policy and consent capture, terms of
service, and a real settlement/payout job that pays the `Settlement` table out
to bank accounts (the table and balances exist; the disbursement call does not).

---

## Layout

```
prisma/schema.prisma      Data model; every money field is integer kobo
src/lib/money.ts          Fee and split maths — pure, exhaustively tested
src/lib/commerce.ts       Checkout, reservations, settlement, fulfilment
src/lib/paystack.ts       Payment provider + webhook signature verification
src/lib/qr.ts             HMAC-signed ticket tokens and real QR rendering
src/lib/ledger.ts         Balance and reporting queries
src/lib/checkin-client.ts Offline-tolerant check-in queue
src/app/e/[slug]          Public event microsite
src/app/s/[slug]          Public shop storefront
src/app/t/[token]         Ticket badge with scannable QR
src/app/dashboard         Organiser console + scanner
src/app/shop              Vendor console
```
