# Earnival — Developer Handover

Everything you need to take ownership of this codebase.

**Read §3 before you change anything.** It documents five invariants that are
load-bearing for money correctness. Everything else in here is orientation;
that section is the part that will cost real money if it's broken.

---

## 1. What this is

Earnival is commerce infrastructure for events, built for the Nigerian market.
One link does the whole loop:

> An organiser creates an event → vendor shops connect to it → the link travels
> through WhatsApp and Instagram → attendees buy tickets → attendees buy food
> and merch from the vendors → guests are checked in at the gate → the ledger
> settles everyone: vendor, organiser, cohosts, and Earnival's fee.

It implements Phase 1 of the Earnival PRD v8.0, plus the trust and operational
layers needed to run a real event.

### Current status — read this honestly

The system is **feature-complete for a first real event and fully tested against
a sandbox. It has never processed a real naira.**

| | |
|---|---|
| Source | 108 files · ~17,600 lines TypeScript |
| Data model | 25 Prisma models · 24 enums |
| Surface | 24 pages · 13 API routes · 25 server actions |
| Tests | 82 passing across 5 suites |
| Deployed | **No.** Runs locally only |
| Real payments | **Never exercised.** Sandbox stubs only |

Every payment, refund and bank transfer has only ever run against a sandbox that
returns canned responses. Paystack's real behaviour — reference constraints,
transfer OTP requirements, settlement timing — is unverified. Treat the first
live transaction as a genuine integration test.

---

## 2. Stack and how to run it

**Next.js 15.5** (App Router, React 19) · **TypeScript** · **PostgreSQL 16** via
**Prisma 6** · **Tailwind 3.4** · **Vitest**. Node 22+.

There is no separate backend. Server Components and Route Handlers *are* the
backend; all business logic lives in `src/lib` and is called from the server.

```bash
npm install
cp .env.example .env        # then fill in the values from §7
npm run db:push             # create the schema
npm run db:seed             # realistic Lagos data
npm run dev                 # http://localhost:3000
```

Postgres must be running and reachable at `DATABASE_URL`.

The seed prints four sign-in identities. **Sign-in codes are printed to the
server log** when no mail provider is configured — that is a local-development
convenience only (see §3.5).

```
organiser@earnival.app   L2 · admin · owns both live events · bank on file
amara@earnival.app       L1 · vendor with a connected shop · bank on file
tunde@earnival.app       L1 · vendor with a pending connection request
rookie@earnival.app      L0 · paid event sitting in the admin queue
```

With no Paystack keys the app runs in **sandbox mode**: checkout redirects to a
local page that simulates success or failure, so the whole loop is walkable
without credentials.

```bash
npm test          # 82 tests; needs a reachable database
npm run build     # production build
npm run db:studio # browse the data
```

---

## 3. The five invariants

These are the rules the codebase is built around. Each closes a specific failure
that costs money. Each has regression tests. **If you change code near one, read
its test first.**

### 3.1 Money is integer kobo. Never floats.

Every monetary value — database column, function argument, API field — is an
integer number of kobo (₦1 = 100 kobo). `0.1 + 0.2 !== 0.3` is an accounting
bug waiting to happen, and Paystack transacts in kobo anyway, so there is no
conversion at the boundary.

All fee maths lives in **`src/lib/money.ts`** and nowhere else. Its guarantee:

```
serviceFee + organiserShare + vendorNet === gross     (exactly, always)
```

Rounding remainders go to the **vendor**, never evaporate. Verified by a
~300-combination sweep in `money.test.ts`.

> **Don't** compute a fee inline in a route or component. Add it to `money.ts`
> with a test.

### 3.2 Prices come from the database, never the client.

`createTicketCheckout` and `createProductCheckout` accept only IDs and
quantities. Anything a client sends about price is ignored outright. This is
why there is no "amount" field in the checkout API schemas — its absence is
deliberate.

### 3.3 Inventory is reserved by conditional SQL, not read-then-write.

```sql
UPDATE "TicketType" SET reserved = reserved + $n
WHERE id = $id AND sold + reserved + $n <= quantity
```

Postgres row-locks the type, so 40 buyers racing for 5 seats produce exactly 5
winners. A read-then-write in application code loses that race — the original
prototype did exactly that.

Reservations expire after 20 minutes and are reclaimed by the cron sweep (§9).

> **Don't** replace these with Prisma `update` calls. The predicate must be
> inside the statement.

### 3.4 Only a verified webhook marks a payment successful.

`/api/webhooks/paystack` verifies the HMAC-SHA512 signature **against the raw
request body** before parsing anything. Every delivery is recorded under a
unique `(provider, externalId)` key, and `settlePayment` guards its status
transition with a conditional update — so a Paystack retry is a no-op, not a
double credit.

`/pay/callback` also verifies server-side as a backstop, because the buyer's
redirect can outrun the webhook. Whichever arrives second does nothing.

> **Don't** add a client-callable route that sets `Payment.status = SUCCESS`.

### 3.5 The ledger is append-only. Order status is workflow, not truth.

`LedgerEntry` rows are **never updated or deleted**. Refunds append negative
contra-entries. A party's balance is always the sum of their rows — never a
stored number that can drift.

Settlement claims entries with a `settlementId IS NULL` filter, which is what
makes two concurrent payout runs safe.

> **Don't** add a `balance` column to `User`. The sum is the balance.

### Bonus: permissions fail closed

`src/lib/permissions.ts` resolves every capability to "owner, or an accepted
member with that capability mapped". An unknown event, a pending invitation or
a revoked member grants nothing. Never check `organiserId === userId` directly
in new code — call `eventAccess` / `shopAccess`.

---

## 4. Data model

25 models. The ones that matter, and how they relate:

### Identity and trust

- **`User`** — one account, no roles. What you can do comes from ownership,
  membership, and `verificationLevel`.
- **`VerificationLevel`** L0→L3 — the trust ladder. Raises the per-event revenue
  cap, unlocks shops, and speeds settlement. See §6.
- **`VerificationSubmission`** — KYC evidence. BVN/NIN/TIN are **encrypted at
  rest** (AES-256-GCM under `KYC_SECRET`); only `last4` is readable.
- **`EventMember` / `ShopMember`** — cohosts, door staff and shop staff, with
  per-capability flags. Invitations are addressed to an *email* so someone can
  be added before they have an account.
- **`ConsentRecord`** — demonstrable NDPR consent, with a hashed IP.

### The event side

- **`Event`** → **`TicketType`** → **`Ticket`**
- Fee rates and the revenue cap are **snapshot onto the Event at publish**.
  Historical money is never recomputed from current config.
- `Ticket` carries a human `code` and an HMAC-signed `qrToken`.

### The commerce side

- **`Shop`** → **`Product`**
- **`Connection`** — the marketplace primitive: a governed shop↔event link
  carrying the revenue-share terms. A shop is only purchasable through an event
  it has an `ACTIVE` connection with.
- **`Order`** → **`OrderItem`**. A multi-shop basket creates **one order per
  shop** sharing a `groupRef`; each shop sees only its own items.
- Order terms (`serviceFeeBps`, `revenueShareBps`) are snapshot at creation, so
  editing a connection later cannot rewrite an existing order's split.

### The money side

- **`Payment`** — one charge against a buyer.
- **`LedgerEntry`** — append-only financial truth (§3.5).
- **`Refund`** — reversal record; the ledger holds the contra-entries.
- **`Settlement`** — a payout run; claims ledger entries and moves cash.
- **`PayoutAccount`** — bank account, name-verified before it can receive money.

### Infrastructure

`WebhookEvent` (dedupe + replay) · `IdempotencyKey` · `RateLimitCounter` ·
`MediaAsset` (images, stored in Postgres) · `AnalyticsEvent`.

---

## 5. Codebase map

```
prisma/
  schema.prisma          Data model. Every money field is integer kobo
  seed.ts                Realistic Lagos seed data

src/lib/                 ALL business logic lives here
  money.ts               Fee and split maths — pure, exhaustively tested
  commerce.ts            Checkout, reservations, settlement, fulfilment, check-in
  refunds.ts             Refund policy and ledger contra-entries
  settlement.ts          Payout runs, Paystack transfers, bank accounts
  verification.ts        L0–L3 ladder, revenue caps, KYC encryption
  permissions.ts         Capability resolution — call this, not ownership checks
  paystack.ts            Payments, refunds, transfers, signature verification
  qr.ts                  HMAC-signed ticket tokens and real QR rendering
  ledger.ts              Balance and reporting queries
  legal.ts               Consent recording and policy versions
  observability.ts       Error capture and money alerting
  analytics.ts           Funnel telemetry
  media.ts               Image storage — swap this to move off Postgres
  notify.ts              WhatsApp / SMS vendor alerts
  rate-limit.ts          Postgres-backed throttling
  lookup.ts              Signed ticket-recovery links
  auth.ts, mail.ts, db.ts, ids.ts, cart.ts, checkin-client.ts

src/app/
  page.tsx               Discovery
  e/[slug]/              Public event microsite (+ opengraph-image, basket)
  s/[slug]/              Public shop storefront
  t/[token]/             Ticket badge with scannable QR
  orders/[reference]/    Order tracking
  find/                  Lost-ticket recovery
  dashboard/             Organiser console (+ edit, team, scan, invitations)
  shop/                  Vendor console
  verify/  payouts/      Verification ladder · bank + settlement history
  admin/                 Approval queues, money ops, webhook replay
  terms/  privacy/       Legal
  actions.ts             25 server actions (all mutations)
  api/                   13 route handlers

src/components/          UI. `ui.tsx` holds shared primitives + brand tokens
src/instrumentation.ts   Boot-time config guard — refuses to start if misconfigured
```

**Where to make a change:**

| You want to… | Go to |
|---|---|
| Change a fee or split | `lib/money.ts` (+ test) |
| Change checkout behaviour | `lib/commerce.ts` |
| Change who can do what | `lib/permissions.ts` |
| Add a mutation | `app/actions.ts` |
| Change payout logic | `lib/settlement.ts` |
| Change the look | `components/ui.tsx`, `tailwind.config.ts` |

---

## 6. Key flows

### Ticket purchase

1. Buyer picks tickets on `/e/[slug]` → `POST /api/checkout/tickets`
2. Rate limit → validate → **`createTicketCheckout`** in one transaction:
   prices read from DB, inventory reserved atomically, `Payment` created
   (`PENDING`, 20-min expiry), `Ticket` rows created (`PENDING_PAYMENT`)
3. Consent recorded → Paystack transaction initialised → buyer redirected
4. Buyer pays → **webhook** (authoritative) → `settlePayment`:
   tickets become `VALID`, `sold` incremented, `reserved` released, ledger
   entries written, cohost shares applied, emails sent
5. Abandoned checkouts are reclaimed by the cron sweep

### Product order

Same shape, plus: the basket is **split per shop**, each order snapshots its own
terms, and the buyer-paid processing fee is spread across shops with
largest-remainder allocation so the parts sum to exactly what was charged.
Pay-at-event orders skip payment entirely and alert the vendor immediately.

### Check-in

QR encodes a signed URL. The scanner extracts the token; the **signature is
verified before any database lookup**, so a forged code never reaches a query.
A conditional update means a double-scan can't register twice. Scans queue
locally when offline and sync with an idempotency key.

### Refund (policy: buyer made whole)

Earnival reverses its service charge and the organiser's share off whoever was
credited. The processor keeps its fee, so **Earnival absorbs that** — booked
explicitly as `PROCESSING_FEE_ABSORBED`, not written off quietly.

On a ₦13,000 order: vendor nets 0, organiser nets 0, platform is out ₦195.
Stock and seats return to their pools. Blocked after check-in or collection.

Policy knobs live in `REFUND_POLICY` at the top of `lib/refunds.ts`.

### Settlement

`runSettlements()` finds everyone owed money, works out what's due under their
cadence, claims those ledger entries, and transfers via Paystack.

- **Post-event (L0–L1):** only earnings from events that have finished
- **Daily (L2–L3):** everything from before today
- Negative balances (refunds exceeding sales) carry forward, never pay out
- No verified bank account → skip, earnings untouched
- Failed transfers release their entries back for the next run

### The verification ladder

| Level | How | Cap/event | Unlocks | Settlement |
|---|---|---|---|---|
| L0 | Email | ₦500,000 | Free events publish; paid events reviewed | Post-event |
| L1 | Phone | ₦1,000,000 | Paid events publish; can open a shop | Post-event |
| L2 | BVN or NIN | ₦5,000,000 | — | Daily |
| L3 | CAC + TIN | Unlimited | Verified badge | Daily |

Caps are checked **inside** the checkout transaction and count in-flight
reservations, so concurrent buyers can't straddle the limit.

---

## 7. Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | **Must be pooled in production** — see §8 |
| `DIRECT_DATABASE_URL` | yes | Unpooled; migrations only |
| `APP_URL` | yes | Public origin; used in QR payloads and emails |
| `AUTH_SECRET` | yes | `openssl rand -hex 32` |
| `QR_SECRET` | yes | ⚠️ Rotating **invalidates every issued ticket QR** |
| `KYC_SECRET` | yes | ⚠️ Rotating makes identity records **undecryptable**. Keep separate from `AUTH_SECRET` |
| `PAYSTACK_SECRET_KEY` | production | Without it, sandbox mode |
| `PAYSTACK_PUBLIC_KEY` | production | |
| `CRON_SECRET` | production | Guards `/api/cron/settle` |
| `RESEND_API_KEY` | production | Deployed instances refuse to send codes without it |
| `EMAIL_FROM` | no | |
| `TERMII_API_KEY` | no | SMS for phone verification and alert fallback |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | no | Vendor sale alerts |
| `WHATSAPP_TEMPLATE_NAME` | no | Meta requires this for business-initiated messages |
| `SENTRY_DSN` | no | Error capture |
| `ALERT_WEBHOOK_URL` | no | Slack/Discord — money failures push here |
| `EARNIVAL_ALLOW_SANDBOX` | no | `1` for a throwaway staging env only |

**Generate the three secrets fresh for production and back them up properly.**
`QR_SECRET` and `KYC_SECRET` can never be rotated without destroying data.

`src/instrumentation.ts` validates all of this at boot and **refuses to start**
a deployed instance that is misconfigured.

---

## 8. Deployment

1. **Postgres** — Neon, Supabase or RDS. Get *both* connection strings.
2. **Connection pooling is not optional.** Serverless functions each open their
   own connection and Postgres caps out near 100; a ticket drop exhausts it and
   everything 500s at exactly the wrong moment.
   ```
   DATABASE_URL="postgresql://…@host:6543/db?pgbouncer=true&connection_limit=1"
   DIRECT_DATABASE_URL="postgresql://…@host:5432/db"
   ```
3. **Host** — Vercel; import the repo with root directory `earnival/`.
4. **Secrets** — all of §7. Fresh values.
5. **Paystack** — live keys; webhook at `https://<domain>/api/webhooks/paystack`
   subscribed to `charge.success`, `charge.failed`, `refund.processed`,
   `refund.failed`, `transfer.success`, `transfer.failed`, `transfer.reversed`.
   **Enable Transfers and fund the balance**, or settlements cannot pay out.
6. **Resend** — verify the sending domain (SPF/DKIM). Non-negotiable: an
   unverified domain sends tickets to spam, and the ticket *is* the product.
7. **Cron** — `vercel.json` hitting `/api/cron/settle` every 15 minutes with
   `Authorization: Bearer $CRON_SECRET`.
8. **Bootstrap an admin** — one SQL update setting `isAdmin = true`.
9. Check `/api/health`.

### ⚠️ Paystack Transfers require OTP by default

On most accounts every transfer waits on an OTP confirmation. If that setting is
on, `initiateTransfer` will *appear* to succeed and then hang forever. Verify
this in the Paystack dashboard before relying on payouts. **Untested by us.**

---

## 9. Operations

### The cron sweep — `POST /api/cron/settle`

Every 15 minutes, protected by `CRON_SECRET`. Does four things, all idempotent:

1. Releases expired checkout reservations
2. Runs settlements
3. Purges stale rate-limit counters
4. Purges analytics older than 24 months

**If this stops running, held inventory is never released and nobody gets paid.**
It's the single most important scheduled job.

### Health — `GET /api/health`

Reports database reachability and latency, and which integrations are
configured. Returns 503 when the database is unreachable. Point uptime
monitoring here.

### When something fails

Failed settlements, failed refunds and unprocessable webhooks push to Sentry and
`ALERT_WEBHOOK_URL`. A **refund that reversed in the ledger but whose cash
didn't move** is flagged `critical` — that divergence needs a person.

Failed webhooks are replayable from `/admin`. Replay is safe: settlement is
idempotent, so replaying one that already succeeded does nothing.

### Admin console — `/admin`

Paid-event approval queue (L0 organisers) · KYC review · recent settlements ·
refunds needing attention · webhook replay. Requires `User.isAdmin`.

---

## 10. Testing

```bash
npm test
```

82 tests, 5 suites. Integration tests hit a **real database** — the failures
that matter (overselling under load, double-paying) are concurrency problems
that unit tests cannot catch.

| Suite | Covers |
|---|---|
| `money.test.ts` (25) | PRD §8 worked example; ~300-combination invariant sweep |
| `commerce.test.ts` (8) | Oversell races, webhook idempotency, reservation expiry, QR forgery, connection enforcement |
| `trust.test.ts` (19) | KYC encryption, level progression, revenue caps, refund reconciliation, payout idempotency, negative-balance hold-back |
| `hardening.test.ts` (19) | Regressions — each maps to a defect that was live |
| `team.test.ts` (11) | Door access, cohost settlement, per-capability gating, consent |

The hardening suite is a **regression net**: a failure there means a real
vulnerability has come back, not that a style preference was violated.

---

## 11. Known gaps

### Blocking a real launch

- **Never tested against real Paystack** (§8). Transfer OTP is the likely trap.
- **DPIA not done.** The PRD's own risk table requires one before L2 ships,
  because that is where BVN/NIN collection starts.
- **Truecaller not wired** for L1 — phone OTP alone stands in for it.

### Open PRD decisions

- **#12 — split order of operations.** Configurable via `DEFAULT_SHARE_BASIS`
  in `money.ts`, currently `GROSS` to match the PRD's worked example. Flip the
  constant when Finance decides.
- **#13 — pre-event ticket payouts.** Daily settlement at L2+ pays out ticket
  revenue *before* the event happens. Confirm this is acceptable to the CBN.
- **#22 — ticket commission for connected shops.** Not implemented.

### Known limitations

- Rate limits key on a **spoofable** `x-forwarded-for`. A speed bump for casual
  abuse, not a defence against a proxy pool. Put Cloudflare in front.
- **No admin action audit log.** Approvals, KYC decisions and refunds leave no
  trail beyond the row they change.
- **Images live in Postgres.** Correct for launch — zero extra services — but
  `lib/media.ts` is the single file to change when volume outgrows it.
- No WAF or bot detection.

### Deliberately not built

Plan tiers, wallet, series, booths, ad space, chatrooms, shop-to-shop transfer,
Earnit, group checkout. All Phase 2–3 in the PRD. Scope discipline was
deliberate — the PRD names "shallow everything" as its top delivery risk.

---

## 12. Working on this

**Conventions**

- Business logic goes in `src/lib`, never in a component or route handler
- Mutations go through `src/app/actions.ts` (server actions), not custom APIs,
  unless the caller is external (webhooks) or non-form (beacons)
- Every money change needs a test in `money.test.ts`
- Every permission change needs a test in `team.test.ts`
- Comments explain *why*, not *what* — the existing ones are worth reading

**Before you push**

```bash
npx tsc --noEmit && npm test && npm run build
```

**Things that will bite you**

- Prisma client needs regenerating after any schema change: `npx prisma generate`
- `instrumentation.ts` is compiled for the edge runtime too — importing anything
  that reaches for `node:crypto` there breaks the build
- Satori (OG image generation) needs explicit `display: flex` on any element
  with more than one child, and can't render `₦` without a bundled font
- The root layout owns the single `<main>` landmark; don't nest another

---

*Generated from the codebase at commit `7cf3957`. If this document and the code
disagree, the code is right — and this document needs a fix.*
