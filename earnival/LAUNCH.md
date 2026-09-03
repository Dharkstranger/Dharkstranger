# Launch runbook

From a repository to your first paying users. Work through it in order — each
stage depends on the one before it.

Budget roughly **two weeks**, most of which is waiting on other people: domain
propagation, Paystack compliance, and email domain warm-up. The engineering
work is the short part.

| Stage | What it gets you | Elapsed |
|---|---|---|
| 1. Domain | A name people can type | 1 day |
| 2. Database | Somewhere for the money to live | 1 hour |
| 3. Hosting | The app on the internet | 2 hours |
| 4. Payments | Real money moving | 2–5 days (compliance) |
| 5. Email | Tickets that reach the inbox | 1–2 days (DNS) |
| 6. Scheduled jobs | Inventory released, vendors paid | 30 min |
| 7. Smoke test | Proof it works with real money | 1 day |
| 8. UAT | Proof it works for other people | 3–5 days |
| 9. First users | Revenue | ongoing |

---

## Stage 1 — Domain

**Buy it.** `earnival.app` is used throughout the screenshots and the deck.
Check availability before committing to it — if it is taken, decide now, because
the name appears in ticket emails, QR codes and the share cards.

Registrars that work fine for this: Namecheap, Porkbun, Cloudflare Registrar
(cheapest, no markup). Nigerian `.ng` domains go through
[NiRA](https://nira.org.ng) accredited registrars — worth owning `earnival.ng`
defensively even if you launch on `.app`.

> `.app` is on the HSTS preload list, which means browsers refuse to load it over
> plain HTTP. That is a security win and costs you nothing — your host issues the
> certificate automatically — but it does mean the site is unreachable until TLS
> is live. Do not panic during the first ten minutes.

**Put Cloudflare in front of it.** Point the domain's nameservers at Cloudflare
(free tier). This is not optional polish — the rate limiter keys on a client IP
header that can be spoofed without a trusted proxy in front, which is a live risk
in the register. Cloudflare fixes that and gives you DDoS protection on a night
when a link is being shared widely.

---

## Stage 2 — Database

You need **PostgreSQL 16** with a connection pooler. The pooler is not optional:
serverless functions each open their own connection, Postgres caps out around 100,
and a ticket drop will exhaust it at exactly the worst moment.

**Neon** (recommended — generous free tier, real branching):

1. Create a project in the `eu-central-1` or `aws-eu-west-2` region — closest to
   Lagos of the usual options, and keeps you inside a GDPR-adequate jurisdiction,
   which simplifies the NDPR story.
2. Copy **two** connection strings:
   - the **pooled** one → `DATABASE_URL`, with `?pgbouncer=true&connection_limit=1`
   - the **direct** one → `DIRECT_DATABASE_URL` (migrations cannot run through a pooler)

**Supabase** works equally well — use the `:6543` pooler port for `DATABASE_URL`
and `:5432` for `DIRECT_DATABASE_URL`.

Then run the migration from your machine:

```bash
cd earnival
npx prisma migrate deploy
```

Do **not** run `prisma db push` against production — it can drop columns without
warning. `migrate deploy` only applies committed migrations.

---

## Stage 3 — Hosting

**Vercel** is the path of least resistance for a Next.js app: push the branch,
import the repo, done. Deploy from `main` once this branch is merged.

### Generate the secrets

Three secrets must be generated once and then never changed:

```bash
openssl rand -hex 32   # AUTH_SECRET
openssl rand -hex 32   # QR_SECRET
openssl rand -hex 32   # KYC_SECRET
openssl rand -hex 32   # CRON_SECRET
```

> **`QR_SECRET` and `KYC_SECRET` can never be rotated without destroying data.**
> Every ticket QR ever issued is signed with `QR_SECRET` — change it and every
> outstanding ticket stops scanning. `KYC_SECRET` encrypts BVN and NIN at rest —
> change it and that data is unrecoverable. Put both in a password manager today.

### Environment variables

Set these in the host's dashboard, for the Production environment:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Pooled connection string |
| `DIRECT_DATABASE_URL` | Direct connection string |
| `APP_URL` | `https://earnival.app` — no trailing slash |
| `AUTH_SECRET` | Generated above |
| `QR_SECRET` | Generated above |
| `KYC_SECRET` | Generated above |
| `CRON_SECRET` | Generated above |
| `PAYSTACK_SECRET_KEY` | Stage 4 |
| `PAYSTACK_PUBLIC_KEY` | Stage 4 |
| `RESEND_API_KEY` | Stage 5 |
| `EMAIL_FROM` | `Earnival <tickets@earnival.app>` |
| `SENTRY_DSN` | Optional but take it — you want to know about errors |
| `ALERT_WEBHOOK_URL` | A Slack or Discord incoming webhook. Money failures go here |
| `TERMII_API_KEY` | Optional — SMS fallback for vendor alerts |
| `WHATSAPP_TOKEN` etc. | Optional — vendor sale alerts |

The application **refuses to start** if `AUTH_SECRET`, `QR_SECRET`, `KYC_SECRET`,
`DATABASE_URL`, `APP_URL`, `RESEND_API_KEY` or `CRON_SECRET` is missing in
production, or if any secret is shorter than 32 characters. That is deliberate —
a boot failure is cheaper than discovering on event night that tickets were never
being emailed. If the deploy fails, read the error; it names exactly what is missing.

It also refuses to run sandbox payments anywhere but localhost. There is no
configuration that lets a live deployment hand out free tickets.

### Point the domain at it

Add `earnival.app` as a custom domain in the host's dashboard, then add the DNS
records it gives you in Cloudflare. Set those records to **DNS only** (grey cloud)
during setup so the host can issue the certificate, then switch to proxied
(orange cloud) once TLS is live.

---

## Stage 4 — Payments

This is the longest pole. Start it on day one, not after everything else works.

1. **Create a Paystack business account** and complete compliance: CAC
   certificate, TIN, a director's BVN, and a settlement bank account. Approval
   takes 2–5 working days. Nothing below works until it clears.
2. **Get the live keys** from Settings → API Keys & Webhooks. Set
   `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY`.
3. **Register the webhook URL**: `https://earnival.app/api/webhooks/paystack`.
   A payment is only ever marked successful by a signature-verified webhook, so
   until this is registered, buyers will pay and receive nothing.
4. **Turn off OTP on Transfers.** Settings → Preferences → Transfers. This is the
   one that bites: with OTP enabled, `initiateTransfer` appears to succeed and
   then hangs indefinitely, so payouts silently never complete. Check it now, and
   check it again after the first real payout.
5. **Enable settlement to your bank account** and confirm the settlement cycle
   Paystack gives you — T+1 for most Nigerian businesses.

### Verify the webhook actually arrives

After the first test purchase, open Paystack's dashboard → Webhooks and confirm a
`200`. If you see timeouts, the endpoint is not reachable — check the domain, not
the code.

---

## Stage 5 — Email

**The ticket is the product.** If the email lands in spam, you have no business.
This stage matters more than it looks.

1. Create a [Resend](https://resend.com) account and add `earnival.app` as a domain.
2. Add the DNS records it gives you in Cloudflare — **SPF**, **DKIM**, and set the
   records to DNS-only. Propagation takes minutes to a few hours.
3. Add a **DMARC** record yourself; Resend will not do it for you:

   ```
   Type: TXT
   Name: _dmarc
   Value: v=DMARC1; p=none; rua=mailto:dmarc@earnival.app
   ```

   Start at `p=none` (monitor only). Move to `p=quarantine` after a few weeks of
   clean reports.
4. Set `RESEND_API_KEY` and `EMAIL_FROM`.
5. **Test deliverability properly.** Send a real ticket to a Gmail, a Yahoo and an
   Outlook address. All three must reach the inbox. Then run the address through
   [mail-tester.com](https://www.mail-tester.com) and fix anything below 8/10.

> Do not send your first hundred emails from a brand-new domain in one burst.
> Send a handful a day for the first week. A cold domain that suddenly emits two
> hundred messages looks exactly like a spammer.

---

## Stage 6 — Scheduled jobs

One cron job does four things every 15 minutes: releases expired reservations,
runs settlements, purges rate-limit counters, and purges analytics older than 24
months. **If it stops, inventory is never released and nobody gets paid.**

On Vercel, add `vercel.json` at the repository root:

```json
{
  "crons": [{ "path": "/api/cron/settle", "schedule": "*/15 * * * *" }]
}
```

Vercel's own cron authenticates itself. If you schedule it from anywhere else —
GitHub Actions, cron-job.org, a VPS — send the bearer token:

```bash
curl -X POST https://earnival.app/api/cron/settle \
  -H "Authorization: Bearer $CRON_SECRET"
```

**Then monitor it.** Point a free uptime checker (Better Stack, UptimeRobot) at
`https://earnival.app/api/health` every 5 minutes, alerting to the same channel as
`ALERT_WEBHOOK_URL`. The health endpoint returns 503 when the database is
unreachable, so this catches the outage that matters. A cron that quietly stops is
the failure mode you will not notice until a vendor asks where their money is.

---

## Stage 7 — Smoke test with real money

Do this yourself, alone, before anyone else sees the link. It is the single most
important step in this document, and it is the one thing that has never been done.

1. Create a free event. Publish it. Confirm the public page loads at the live domain.
2. Paste the link into WhatsApp. Confirm it unfurls with a preview image.
3. Create a **₦100** paid event. Buy a ticket **with a real card**.
4. Confirm: the money appears in Paystack, the webhook shows a `200`, and the
   ticket email arrives in your inbox — not spam.
5. Open the ticket on a second phone. Scan it from the first. Confirm the check-in.
6. Scan it again. Confirm it is refused as already checked in.
7. Refund the ticket. Confirm the money leaves your Paystack balance and the buyer
   is made whole.
8. Create a shop, connect it to the event, buy a ₦100 product, mark it ready,
   collect it with the pickup code.
9. Wait for the cron to run settlement. Confirm the payout lands in your bank
   account and the amount matches the app to the kobo.

If step 9 does not happen, go back to Stage 4 step 4. It is almost always the OTP
setting.

**Only when all nine pass does the product actually work.** Everything before this
was tested against sandbox stubs.

---

## Stage 8 — UAT

Open `docs/UAT-Earnival.xlsx`. It has 65 test cases, a bug log, the known issues
already triaged (so nobody re-reports them), and a launch gate.

Run it with **at least three people**: someone playing organiser, someone playing
vendor, and someone who has never seen the product. Use real phones, not a resized
desktop browser.

Do not launch until the Sign-off sheet reads YES on every line.

---

## Stage 9 — Getting your first users

The product is not the hard part now. Distribution is.

### Do not open the link publicly

An empty marketplace kills itself. Nobody buys from an event with no vendors, and
no vendor joins an event with no buyers. Seed the supply side by hand first.

### Week 1 — the three cohorts you already have

You have run three events already. That is your entire launch strategy.

1. **DDP** — >2,000 people, 6 vendors. **FSN Minileague** — 11 vendors.
   **Lere to the World** — 4 vendors. These people already trust you and have
   already used a cashless rail you operated manually.
2. Call the organisers, not message them. Offer to run their next event on
   Earnival with you standing beside them on the night.
3. Onboard each vendor **yourself**, in person or on a call. Create their shop
   with them. Do not send them a link and hope. Your first twenty vendors should
   each cost you an hour — that is the correct price.

### The one number that matters

**Vendors connected per event.** The organiser's revenue share is what makes the
loop compound, and it is worth nothing at zero vendors. An event with 6 connected
shops is a case study; an event with 1 is a ticketing tool.

### Week 2–4 — make the first event a story

Run one real event end to end. Then, the same week, produce:

- The organiser's actual numbers: ticket revenue, shop GMV, and their share.
  A real screenshot of a real console beats any pitch.
- A 60-second phone video of the door: someone scanning, the green pass, the
  counter moving. Post it where Lagos event organisers are — Instagram, X, and the
  WhatsApp groups you are already in.
- A written note from one vendor about getting paid without chasing anyone.

### Sequencing after that

- **Organisers first, always.** They bring vendors; vendors do not bring organisers.
- Every event page carries your branding and unfurls with a share card. That is
  the distribution surface — every ticket sold is an impression.
- Watch the funnel in the organiser console: opens → checkout started → purchased.
  If opens are high and purchases are low, the problem is the page. If opens are
  low, the problem is distribution. Do not guess; the numbers are on the screen.

### Fill in the metric baselines

Six of the nine success metrics in the PRD are `[TODO]` because telemetry did not
exist until now. After the first real event, populate them from the console. The
PRD stays in Draft until they are filled — that is the gate you set yourself.

---

## Before you share the link, check these

- [ ] Live Paystack keys set, webhook registered and observed returning `200`
- [ ] Transfers OTP confirmed off, and one real payout has landed
- [ ] Sending domain verified — SPF, DKIM, DMARC — and a ticket reached Gmail,
      Yahoo and Outlook inboxes
- [ ] Cron scheduled, observed running, with uptime monitoring alerting on failure
- [ ] `ALERT_WEBHOOK_URL` pointed at a channel a human actually reads
- [ ] Terms, privacy and refund policy live at the domain
- [ ] The DPIA is done, or Level 2 verification is switched off until it is
- [ ] Cloudflare in front of the domain
- [ ] `QR_SECRET` and `KYC_SECRET` in a password manager
- [ ] You have personally bought a ticket, scanned it, refunded it, and been paid

---

## When something breaks on the night

| Symptom | First thing to check |
|---|---|
| Buyers pay but get nothing | Paystack webhook deliveries. Replay failures from `/admin` |
| Nobody can check in | Is the person on the door team? Invitations grant nothing until accepted |
| Scanner shows a black box | Camera permission. Fall back to typing the check-in code — it always works |
| Tickets not arriving | Resend dashboard, then spam folders. The check-in code in the console still gets people in |
| Everything is slow | Database connections. Confirm `DATABASE_URL` is the **pooled** string |
| Nobody has been paid | The cron. Hit `/api/health`, then check Transfers OTP |

The admin console at `/admin` shows failed settlements, refunds needing attention,
and unprocessable webhooks — with replay. Keep it open on a phone during the event.
