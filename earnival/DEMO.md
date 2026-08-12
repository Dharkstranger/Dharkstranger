# Deploying a demo you can share today

Yes — you can have a shareable link in about an hour, without Paystack
compliance, without a domain, and without a verified sending domain.

## First, the honest bit about "just the UI"

There is no UI-only layer to peel off. Every page is server-rendered from the
database: the event page reads ticket types and stock, the shop reads products,
the console reads the ledger. A static export would be a different, fake product
built from scratch.

What you get instead is **better than a UI demo**: the real application, with a
real database, taking *simulated* payments. People can click all the way through
— buy a ticket, get the email, open the badge, scan it at the door — and every
screen is the real thing. Only the money is pretend.

The app already supports this. `EARNIVAL_ALLOW_SANDBOX=1` exists precisely for a
throwaway environment, and without it a deployed instance refuses to run
simulated payments at all.

| | Demo | Production |
|---|---|---|
| Browse events and shops | Real | Real |
| Buy a ticket, get the badge | Real | Real |
| Check in at the door | Real | Real |
| Consoles, funnel, settlement maths | Real | Real |
| **Card payment** | **Simulated — one click, no card** | Paystack |
| **Payout to a bank** | Ledger only, no transfer | Real transfer |
| Emails | Resend test address, limited | Verified domain |

---

## Stage 1 — Database (10 minutes)

Netlify has no database, so use Neon's free tier.

1. Sign up at [neon.tech](https://neon.tech), create a project.
2. Copy **two** connection strings from the dashboard:
   - the **pooled** one → `DATABASE_URL` (append `?pgbouncer=true&connection_limit=1`)
   - the **direct** one → `DIRECT_DATABASE_URL`
3. From your machine, create the schema and fill it with demo content:

   ```bash
   cd earnival
   DATABASE_URL="<pooled>" DIRECT_DATABASE_URL="<direct>" npx prisma migrate deploy
   DATABASE_URL="<pooled>" npm run db:seed
   DATABASE_URL="<pooled>" npx tsx scripts/demo-activity.ts
   ```

   The last line matters. `db:seed` gives you three events and two shops, but
   every number reads zero. `demo-activity.ts` runs 40 ticket sales and 31 shop
   orders through the real checkout and settlement code, so the consoles show a
   populated funnel, a real organiser revenue share, and a settlement breakdown
   that actually reconciles. A demo where every figure is ₦0 sells nothing.

---

## Stage 2 — Netlify (15 minutes)

1. Push this branch, then at [app.netlify.com](https://app.netlify.com) choose
   **Add new site → Import an existing project → GitHub** and pick the repo.
2. Set **Base directory** to `earnival`. Netlify reads `netlify.toml` from there
   and picks up the build command and the Next.js plugin on its own.
3. Add these environment variables under **Site configuration → Environment
   variables**, before the first deploy:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Neon pooled string |
   | `DIRECT_DATABASE_URL` | Neon direct string |
   | `APP_URL` | Your Netlify URL, e.g. `https://earnival-demo.netlify.app` — no trailing slash |
   | `EARNIVAL_ALLOW_SANDBOX` | `1` |
   | `NEXT_PUBLIC_DEMO_MODE` | `1` |
   | `AUTH_SECRET` | `openssl rand -hex 32` |
   | `QR_SECRET` | `openssl rand -hex 32` |
   | `KYC_SECRET` | `openssl rand -hex 32` |
   | `CRON_SECRET` | `openssl rand -hex 32` |
   | `RESEND_API_KEY` | See Stage 3 |
   | `EMAIL_FROM` | `Earnival Demo <onboarding@resend.dev>` |

   Leave `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY` **unset**. That is what
   puts the app in sandbox mode.

   > Use **different** secrets from the ones you will use in production. A demo
   > URL gets pasted into group chats; treat it as compromised by default.

4. Deploy. If the build fails on a missing variable, read the message — the boot
   guard names exactly which one, by design.
5. Rename the site to something presentable under **Site configuration → Change
   site name**, e.g. `earnival-demo` → `earnival-demo.netlify.app`.

`netlify.toml` already sets `X-Robots-Tag: noindex` across the whole site, so the
demo will not turn up in search results competing with your real one.

---

## Stage 3 — Email (5 minutes)

Sign up at [resend.com](https://resend.com) and take the API key. On the free
tier, without verifying a domain, you send from `onboarding@resend.dev`.

**Know this limitation before you demo to anyone:** that test address can only
deliver to *your own* verified email address. Nobody else receives anything.

That splits the demo into two halves:

- **The buyer journey works for everyone.** No sign-in is needed to buy, and the
  confirmation screen shows the ticket link directly. Anyone can click through it.
- **The consoles need sign-in, which needs an email code.** So either drive that
  part yourself on a screen-share, or verify a domain in Resend (a few DNS
  records, an hour) and then anyone can sign in.

For a first round of sharing, the first option is usually enough.

---

## Stage 4 — Check it before you share it

```bash
curl -s https://<your-site>.netlify.app/api/health
```

Expect `"status": "ok"` and the database reachable. Then, in a browser:

1. Open the site. The dark **Demo** banner should sit at the top of every page.
2. Open `/e/gidi-groove`. Buy a ticket. At the payment step you land on a sandbox
   page — click to simulate success.
3. Confirm you reach the ticket badge with a working QR.
4. Paste the event link into WhatsApp and confirm the preview card unfurls.

If the banner is missing, `NEXT_PUBLIC_DEMO_MODE` did not get set. Fix it before
sharing — a demo that looks like production is how someone ends up believing
they bought a real ticket.

---

## Stage 5 — What to send people

Send the **event page**, not the homepage. It is the strongest screen and it
unfurls with a preview card.

```
https://<your-site>.netlify.app/e/gidi-groove
```

Suggested message:

> This is Earnival — the thing I have been building. It is a live demo, so the
> payment is simulated; you will not be charged and you do not need a card.
> Buy a ticket and you will get the badge you would get at a real event.
> Tell me where it feels slow or confusing.

### A three-minute walkthrough, in order

1. **The event page** — tickets and the vendor shops in one place.
2. **Buy a ticket** — no account, no app. This is the whole pitch.
3. **The badge** — the QR and the human-readable code.
4. **The shop** — add something to a basket from two different vendors.
5. **The organiser console** *(you drive this)* — revenue, the funnel, and the
   organiser's share of vendor sales. This is the number nobody else offers.
6. **The connection request** — the settlement split shown before anyone accepts.
7. **The door scanner** — type a check-in code and watch the counter move.

Finish on the split, not the scanner. The split is the business.

---

## What to watch while it is live

The demo database is real, so people poking at it will leave traces. After a
round of sharing, look at:

- **The funnel in the organiser console** — how many opened the link versus
  reached checkout. That is genuine signal about your page, even on a demo.
- **Where people stopped.** Every drop-off in a demo is a drop-off you would have
  paid for in production.

Collect the feedback somewhere. The bug log in `docs/UAT-Earnival.xlsx` works
fine for this and means demo findings and UAT findings live in one place.

---

## When you are ready for the real thing

Follow `LAUNCH.md`. The demo does not upgrade into production — deliberately:

- Production needs a **different** set of secrets. Never promote demo secrets.
- Production needs live Paystack keys and a registered webhook.
- Production must **not** have `EARNIVAL_ALLOW_SANDBOX` or `NEXT_PUBLIC_DEMO_MODE`
  set. Both are absent by default; do not copy them across.
- Production needs the settlement cron scheduled, and a verified sending domain.
- Point the real domain at the production deployment. Keep the demo on its
  `netlify.app` subdomain so the two can never be confused.

Keep the demo running afterwards. A link you can send an organiser mid-conversation
is worth more than a deck.
