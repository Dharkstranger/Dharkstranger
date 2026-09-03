# What Earnival takes from Hoo Socials

Eight repositories were reviewed: `hoo-api`, `hoo-socials-api`, `hoo-socials-client`,
`hoo-socials-web-client`, `hoo-admin-client`, `hoo-socials-infra`, `Hoo-Website`,
and `paystack-payment-client-test`.

Hoo is the direct predecessor: a NestJS/TypeORM events product with tickets,
vendors, transactions, user verification and Paystack. Roughly the same domain
Earnival occupies, built on a different stack.

The useful question was not "what can we copy" but "what does Earnival not
already have". Most of the overlap turned out to run the other way.

---

## 1. Take it: the deployment stack

**This is the one unambiguous win, and it solves a live blocker.**

`hoo-socials-infra` contains a working self-hosted deployment:

| File | What it does |
|---|---|
| `ansible/setup_vps.yml` | Provisions a VPS: PostgreSQL 16 from the PGDG repo, Nginx, generated DB password persisted locally |
| `ansible/setup_servers.yml` | Multi-server variant |
| `scripts/nginx_scripts/setup-backend-domain.bash` | Nginx reverse-proxy vhost + Let's Encrypt SSL |
| `scripts/nginx_scripts/setup-client-domain.bash` | Static client vhost + SSL |
| `scripts/deploy_scripts/deploy_staging_*.bash` | Deploy runners |
| `docker/db.Dockerfile`, `scripts/infra_setup_scripts/db_init.sql` | Containerised Postgres with an init script |

**Why this matters more than it looks.** Earnival's hosting plan was Netlify or
Vercel. Both are serverless, and the PRD risk register already flags the
consequence: *"Connection pooling misconfigured. Serverless exhausts Postgres
connections at ~100. Total outage at exactly peak load."* Earnival also needs a
15-minute cron sweep, which serverless platforms charge for or cap.

A VPS removes both problems. One box runs Next.js, Postgres and cron, with no
pooler to misconfigure and no per-invocation billing on the sweep. For a product
whose peak load is a ticket drop, that is the safer shape.

Ported to `earnival/deploy/` and adapted for Next.js.

---

## 2. Take it: the transactional email set

`hoo-socials-api/templates/` has eight designed HTML emails:

`welcome` · `email.verification` · `reset.password` · `ticket.confirmation` ·
`checked.in` · `event.approved` · `event.declined` · `review`

Earnival already builds branded HTML through the `shell()` helper in
`src/lib/mail.ts`, so the markup is not needed. **The list is.** Three of Hoo's
templates correspond to Earnival flows that currently send nothing:

| Hoo template | Earnival gap |
|---|---|
| `event.approved` | ADM-01 approves an L0 paid event — the organiser is never emailed |
| `event.declined` | Rejection with a reason is stored but never delivered |
| `checked.in` | No arrival confirmation to the attendee |

`welcome` is also worth adding: Earnival has no first-run email at all.

---

## 3. Do not take: Paystack

Earnival's integration is the more complete of the two.

| | Hoo | Earnival |
|---|---|---|
| Resolve account name | ✅ | ✅ |
| Create transfer recipient | ✅ | ✅ |
| Initiate transfer | ✅ | ✅ |
| List banks | ❌ | ✅ |
| Initialize transaction | ❌ | ✅ |
| Verify transaction | ❌ | ✅ |
| Refunds | ❌ | ✅ |
| Sandbox mode | ❌ | ✅ |

Hoo does confirm one thing worth knowing: the
`createTransferRecipient` → `transferFunds` sequence is the correct shape for
Nigerian payouts, and Earnival already implements it, caching the
`recipientCode` on the payout account.

### Three defects in Hoo's webhook handling — do not copy, and fix in Hoo

`hoo-socials-api/src/webhook/webhook.controller.ts` does verify the signature,
but:

1. **It hashes `JSON.stringify(body)`, not the raw request body.** Paystack signs
   the exact bytes it sent. Re-serialising the parsed object can produce
   different bytes — key order, unicode escaping, number formatting — so
   verification is correct only by luck and fails on the first payload that
   round-trips differently. Earnival hashes the raw body, which is why PAY-09 is
   written the way it is.
2. **`hash !== signature` is a non-constant-time comparison**, so it leaks timing.
   Earnival uses `timingSafeEqual`.
3. **`webhook.service.ts` calls `this.handleChargeSuccess(body)` without
   `await`.** The HTTP response returns before the work happens, and any failure
   inside is swallowed — a payment can be acknowledged and never processed.

Hoo also handles exactly one event, `ticket.payment.success`, and warns on
everything else. Earnival stores every delivery and makes failures replayable.

---

## 4. Do not take: virtual accounts

`vendor.entity.ts` has a `paystack_virtual_account_details` column and a
`PaystackVirtualAccountDetails` DTO — but nothing anywhere creates a dedicated
account. It is storage for a response Hoo never requests.

Earnival's SHP-11 is marked ⚠️ Partial for the same reason. **This does not close
that gap.** Both products would still need Paystack's Dedicated Virtual Account
API, which requires business verification first.

---

## 5. Do not take: the domain model

Hoo's model is `event / ticket / transaction / vendor / user / user.verification`.
Earnival's is 25 models including an append-only `LedgerEntry`, `Connection` with
snapshot terms, `Settlement`, `Refund`, `EventMember`, `ShopMember` and
`ConsentRecord`.

The material difference is that Hoo has a `transaction` table and Earnival has a
**ledger**. A transaction row records that money moved. A ledger entry records
who is owed what, and balances are sums of entries rather than stored numbers.
Everything in Earnival's settlement engine depends on that, so adopting Hoo's
shape would be a regression.

Hoo has no equivalent of the Connection object at all — the governed shop↔event
link carrying revenue-share terms, which is the thing that makes an organiser
recruit vendors. That is Earnival's differentiator and it does not exist upstream.

---

## 6. Security findings in the uploaded repositories

These are about the Hoo repos as they stand, not about Earnival.

| Severity | Finding |
|---|---|
| **High** | `hoo-socials-api/cloud.key.json` is a committed Google Cloud service-account private key. If those repos are or ever were pushed to a host, treat the key as compromised: revoke it in the GCP console, rotate, and purge it from git history (`git filter-repo`) rather than deleting it in a new commit. |
| Medium | `vendor.entity.ts` stores `manager_password` as a plain `text` column. Worth confirming it holds a hash and not a password. |
| Medium | The three webhook defects in §3. |
| Low | `paystack-payment-client-test` commits `pk_test_…`. Public keys are meant to be public and this one is test-mode, so the exposure is minimal — but it should not be in source. |
| Low | `ansible/setup_vps.yml` pins `hosts:` to a bare IP and reads `GITHUB_TOKEN` from the environment. Fine for a private repo; move the host to an inventory file before sharing. |

---

## 7. What Hoo confirms about the product

Reading the predecessor is useful for more than code.

- **The approve/decline loop is real.** Hoo built `event.approved` and
  `event.declined` emails, which means events genuinely queued for review often
  enough to warrant templates. Earnival's ADM-01 is not speculative.
- **Check-in mattered enough to email about.** Hoo sends `checked.in`.
- **Vendors were modelled as first-class from the start** — name, logo, website,
  manager contact, payout details. Earnival's Shop is the same idea with a
  permanent storefront attached.

The through-line is that Earnival is the same product with the money model
rebuilt underneath it. Nothing in Hoo suggests a change of direction; the parts
worth carrying forward are operational, not architectural.
