# Product PRD: Earnival

**Author:** Emeka Ugochukwu — Founder / Product
**Status:** Draft — as-built, for engineering, design, QA, compliance, ops and GTM review
**Updated:** 2026.08.10
**Source of truth:** codebase at commit `7cf3957` (`earnival/`)

| Role | Owner |
|------|-------|
| PM / Product | Emeka Ugochukwu |
| Engineering | [TODO: assign] |
| Design | [TODO: assign] |
| QA | [TODO: assign] |
| Payments / Compliance | [TODO: assign] |
| Legal (NDPR) | [TODO: assign] |
| Ops / Support | [TODO: assign] |

| Reviewer | Status |
|----------|--------|
| [TODO: name] | ☐ LGTM |
| [TODO: name] | ☐ LGTM |
| [TODO: name] | ☐ LGTM |

**Linked docs:** `earnival/README.md` · `earnival/HANDOVER.md` · Earnival PRD v8.0 (originating intent) · Paystack API docs · NDPR / Nigeria Data Protection Act

---

## About this document

This is an **as-built Product PRD**, reverse-engineered from a working codebase. It differs from a forward-looking PRD in three ways, deliberately:

1. **Every requirement carries a build status** — ✅ Built · ⚠️ Partial · ❌ Not built. A forward PRD says what should exist; this one also says what does.
2. **It is longer than the 6–8 page alignment standard.** That was an explicit instruction, and the genre justifies it: this document has to serve engineering handover, QA test derivation, compliance review, and investor diligence from one artifact. Where it exceeds the standard, §7 and the Appendix are the sections carrying the extra weight.
3. **Technical specificity is intentional in §7 and the Appendix.** Normally a PRD avoids implementation detail because it dates quickly. Here the implementation *is* the specification — and the money invariants in Appendix A are load-bearing constraints, not incidental choices.

**How to read it by role:**

| Role | Read |
|------|------|
| Executive / investor | §1, §2, §6, §10 — 5 minutes |
| Engineering | §5, §7, Appendix A–D — everything technical |
| QA | §7 (acceptance-shaped requirements), Appendix E (test coverage), §9 |
| Design | §3, §4, §5, §7 (journeys), Appendix F |
| Compliance / Legal | §8 in full — it is not an appendix item |
| Ops / Support | §7 ORD/OPS, Appendix D (runbook) |
| GTM / Marketing | §1–§4, §6, §11 |

---

## 1. Problem

Every event in Nigeria creates a temporary economy — and it runs on cash and fragmented, off-the-books transfers. Every trail dies when the gates close.

The pain lands differently on each side of the same transaction:

- **Organisers** create the footfall but capture only ticket revenue. The food, merch and art that sold *because of their event* is invisible to them and earns them nothing.
- **Vendors** lose revenue the moment a customer sends money to an unauthorised account, have no storefront that outlives the event, and no record of anyone who bought from them.
- **Attendees** queue to buy, settle for a second-choice item because the vendor silently ran out of the first, and lose every seller they discovered when the event ends.

No existing rail treats **the event as the organising unit of commerce** — ticketing, vendor storefronts, cashless payment, orders, pickup and settlement in one connected system.

**Evidence** — from three Earnival-run pilots:

| Pilot | Scale | Result |
|---|---|---|
| DDP — end-of-year party series (2023–2025) | >2,000 people · 6 vendors | **~80%** of in-event sales moved online; cash use almost eliminated |
| FSN Minileague (2025) | 4-month season · 11 vendors | **~75%** of payments processed online |
| Lere to the World (2025) | >1,000 people · 4 vendors | Non-ticketed, and the cashless rail still worked |

The pilots prove the behaviour change is achievable — including at a **non-ticketed** event. When a cashless rail exists, the majority of spend moves onto it.

> ⚠️ **Evidence caveat for external use.** These are founder-reported pilot figures without an instrumented dashboard behind them. §6 makes measurement a P0 precisely because the platform previously had no telemetry at all.

---

## 2. Vision & Opportunity

**Earnival is the payment, storefront and settlement layer for the economy that comes alive whenever people gather.** The event is the anchor; commerce sits underneath it.

**Why now:**

| Segment | Size | Relevance |
|---|---|---|
| Diaspora remittance | $21.8bn | Dollars seeking a trusted way to spend into events at home |
| Detty December festive spend | ₦39.6bn · ~3.6m participants | The seasonal peak of the event economy |
| Festive air travel | $384.5m | Travel demand tied to the event season |
| Live music / concerts | 71% of ticket-event revenue | The dominant ticketed category |
| Creative & entertainment economy | $14.8–15bn (2025) | Macro backdrop |

> ⚠️ **[ASSUMED: sourcing]** These figures come from founder field research and are **not yet re-sourced with citations and dates**. They must not appear in an external deck or data room until they are. Owner: PM. See Open Decision #16.

**Strategic rationale — the moat is the Connection object.** Ticketing tools stop at ticketing. Vendor-booth tools manage logistics but don't move money. Payment processors are event-blind. Earnival's defensibility is the governed link between a shop and an event that carries revenue-share terms — because that is what makes organisers recruit vendors, vendors recruit each other, and the loop compound.

---

## 3. Target Users & Use Cases

Prioritised by GTM sequence: **organisers first** (they create the footfall), then vendors, then attendees.

1. **Organiser** — runs an event and wants the commerce that happens *because of it* to be visible and to earn them something. Today they see only ticket money and have no idea what the food stalls took.
2. **Vendor (shop owner)** — sells at events and loses money to cash handling, unauthorised transfers, and having no storefront that survives the night.
3. **Attendee / buyer** — wants to buy a ticket in 30 seconds without an account, and to buy food and merch without queuing at an ATM.
4. **Door staff / cohost** — works the gate on the night. Needs check-in to be fast, glanceable, and to keep working when the venue's network drops.
5. **Shop staff** — serves a counter, takes orders and hands over goods, without access to the owner's money.
6. **Earnival admin** — reviews paid events from unverified organisers, processes KYC, and resolves money that didn't move.
7. **Sponsor** — funds an event and wants visibility and, per agreed terms, attendee data. *(Modelled in intent; not built — see §7.)*

---

## 4. Current Journeys & Landscape

**What an organiser does today**

1. Sells tickets through a ticketing tool, or by bank transfer into a personal account
2. Recruits vendors over WhatsApp; terms are verbal
3. On the night, stands at the gate with a printed list or their own phone
4. Vendors take cash, or give out their own account numbers
5. After the event, the organiser has a ticket total and no idea what else was sold
6. Every customer relationship the vendors made evaporates

**Friction points:** verbal terms with no enforcement · one person on the gate · no shared record of in-event spend · no way to pay vendors except by hand.

**Landscape**

| Category | Example class | Where they stop |
|---|---|---|
| Ticketing-first | Eventbrite-class | Ticketing, guest lists, promotion. Never sees in-event spend |
| Vendor-booth tools | Marketspread-class | Manages vendor logistics but doesn't move money |
| Payment processors | Paystack / Flutterwave | Powers payment but is event-blind — no tickets, no pickup, no organiser share |

**Regulatory context (Nigeria):** CBN governs wallets, virtual accounts and the timing of payouts. NDPR / the Nigeria Data Protection Act governs BVN, NIN and marketing consent. Both are treated as first-class requirements in §8, not constraints in a footnote.

---

## 5. Proposed Solution

Earnival gives an organiser one link. That link sells tickets, hosts the vendors' shops, takes cashless payment for both, gets everyone through the gate, and pays every party what they're owed — automatically, with the split agreed in advance and visible to both sides before anyone accepts.

**Top 3 MVP value props**

1. **The vitamin (table stakes):** tickets that work — bought without an account, delivered by email, scannable at a gate that keeps working offline.
2. **The painkiller (real pain, right now):** vendors sell cashless from a permanent storefront, and get paid automatically without chasing anyone.
3. **The steroid (magic moment):** the organiser earns a share of every vendor sale their event created — a revenue line that simply did not exist for them before.

### Conceptual model

Fifteen objects the user must understand. The five that carry the product:

- **Event** — the anchor. Has dates, a venue, ticket types, and its own public microsite. Owned by one organiser.
- **Shop** — a vendor's **permanent** storefront with its own URL and QR. Exists independently of any event and survives all of them.
- **Connection** — the governed link between a shop and an event, carrying revenue-share terms. **A shop is only purchasable through an event it has an ACTIVE connection with.** This is the moat.
- **Order / Ticket** — what a buyer walks away with. One multi-shop basket produces one order *per shop*, sharing a group reference.
- **Ledger** — append-only financial truth. Every party's balance is the sum of their entries, never a stored number.

```
Organiser ──owns──> Event <──Connection──> Shop <──owns── Vendor
                      │                      │
                   Ticket                 Product
                      │                      │
                      └──────> Order <───────┘
                                 │
                            LedgerEntry ──> Settlement ──> Bank
```

**Supporting objects:** EventMember / ShopMember (teams and permissions) · VerificationSubmission (the trust ladder) · Payment · Refund · PayoutAccount · ConsentRecord · AnalyticsEvent · WebhookEvent · MediaAsset.

---

## 6. Goals & Measurable Outcomes

### Goals

1. **Digitise in-event spend** — hold ≥80% of in-event sales on the rail at scale, matching the DDP pilot.
2. **Make the organiser's share real** — every event that connects a shop produces a settled organiser share, not a promise.
3. **Get one real event through end to end** — including money actually landing in a bank account. This is the gate before anything else matters.

### Non-goals (explicitly out of scope for this cut)

Plan tiers and subscription pricing · two-balance wallet · event series · spatial booths and event maps · ad space · chatrooms · shop-to-shop transfer · Earnit game · group checkout · in-event navigation · insurance · POS hardware. All Phase 2–3 in the originating PRD, and deliberately not built — "shallow everything" is the top delivery risk.

### Success metrics

| Goal | Signal | Metric | Baseline | Target |
|---|---|---|---|---|
| Digitise spend | Buyers use the rail | % of in-event sales taken online | ~80% (DDP, self-reported) | Hold ≥80% |
| Payments move online | Cash displaced | % of payments processed online | ~75% (FSN, self-reported) | Improve on 75% |
| Link converts | Distribution works | Event page open → ticket purchased | **None — now instrumented** | [TODO: set after first event] |
| Checkout completes | No drop-off at pay | Checkout started → purchased | **None — now instrumented** | [TODO] |
| Organiser adoption | Supply side grows | Events created / month | [TODO: from first cohort] | [TODO] |
| Trust ladder climbs | Sellers verify | % of sellers reaching L1 / L2 within 30 days | [TODO] | [TODO] |
| Money actually moves | Settlement works | % of settlements PAID without manual intervention | **0 — never run live** | >95% |
| Gate throughput | Check-in doesn't queue | Median scan-to-confirm latency | [TODO] | <2s |
| Revenue depth | Loop compounds | Average revenue per event | [TODO] | ₦5m modelled |

> **Approval gate.** Every `[TODO]` baseline must be filled from the first real event before this PRD moves from Draft to Approved. Funnel telemetry (`event.viewed` → `ticket.checkout_started` → `ticket.purchased`) is now instrumented and surfaced in the organiser console, so these are measurable for the first time.

---

## 7. Requirements

Bucketed by critical user journey. Every requirement is prioritised **and** carries build status.

**Priority:** `[P0]` MVP — target users cannot adopt without it · `[P1]` min-delightful · `[P2]` nice-to-have
**Status:** ✅ Built · ⚠️ Partial · ❌ Not built

---

### CUJ-1 — Account, identity and trust (ACC / VRF)

> Why prioritised: nothing else can be gated without it. The verification ladder is the product's fraud ceiling and its settlement-speed lever.

**Signing in**

| ID | Pri | Status | Requirement |
|---|---|---|---|
| ACC-01 | P0 | ✅ | User can sign in with an email one-time code. No passwords anywhere in the system. |
| ACC-02 | P0 | ✅ | Codes expire in 10 minutes, allow 5 attempts, and are superseded when a new one is requested. |
| ACC-03 | P0 | ✅ | Buying a ticket never requires an account. |
| ACC-04 | P0 | ✅ | A guest's prior purchases attach to their account the first time they sign in with the same email. |
| ACC-05 | P0 | ✅ | Team invitations addressed to an email bind to the account when that person first proves control of the address. |
| ACC-06 | P0 | ✅ | Sign-in responses are identical whether or not the account exists — no enumeration. |
| ACC-07 | P0 | ✅ | Telemetry: sign-in requests and verification outcomes are recorded. |
| ACC-08 | P1 | ❌ | Sign in with Google. *(Prototype had it; not carried into the build.)* |
| ACC-09 | P1 | ❌ | Profile setup with name, picture, banner, about, DOB — and gating event creation on completion. |

**The verification ladder**

| ID | Pri | Status | Requirement |
|---|---|---|---|
| VRF-01 | P0 | ✅ | L0 (email): unlimited free events publish instantly; **paid** events require admin approval; cannot create or connect a shop; ₦500,000 revenue cap per event; post-event settlement. |
| VRF-02 | P0 | ✅ | L1 (phone OTP): all event types publish instantly; may create and connect shops; ₦1,000,000 cap; post-event settlement. |
| VRF-03 | P0 | ✅ | L2 (BVN or NIN): ₦5,000,000 cap; daily settlement unlocked. |
| VRF-04 | P1 | ✅ | L3 (CAC + TIN): verification badge; unlimited revenue; daily settlement. |
| VRF-05 | P0 | ✅ | Caps are enforced **per event**, inside the checkout transaction, counting in-flight reservations — so concurrent buyers cannot straddle the limit. Breaching flows are blocked with a message naming the remaining headroom. |
| VRF-06 | P0 | ✅ | Settlement cadence is a level entitlement; payout lands T+1 after the trigger. |
| VRF-07 | P0 | ✅ | BVN, NIN and TIN are encrypted at rest (AES-256-GCM) under a key held separately from the session secret. Only the last four digits are readable — to the owner or a reviewer. |
| VRF-08 | P0 | ✅ | Levels are strictly sequential: identity evidence without a verified phone does not grant L2. |
| VRF-09 | P0 | ✅ | The cap is snapshot onto the event at publish, so a later level change cannot retroactively invalidate sales already made. |
| VRF-10 | P1 | ❌ | Truecaller check at L1. Phone OTP alone currently stands in for it. |

---

### CUJ-2 — Create and run an event (EVT)

| ID | Pri | Status | Requirement |
|---|---|---|---|
| EVT-01 | P0 | ✅ | Organiser can create an event with name, category, date/time, venue, description, banner image and multiple ticket types with independent prices and quantities. |
| EVT-02 | P0 | ✅ | Publishing generates a public microsite at a stable URL, plus a QR code and share links. |
| EVT-03 | P0 | ✅ | The microsite renders server-side with OpenGraph metadata and a **generated share card**, so a link shared into WhatsApp or Instagram unfurls into a real preview. |
| EVT-04 | P0 | ✅ | Organiser can edit a published event — name, venue, time, banner, description, organiser note — without invalidating tickets already sold. |
| EVT-05 | P0 | ✅ | Editing prompts the organiser to email everyone holding a ticket, with an optional note. |
| EVT-06 | P0 | ✅ | Ticket types can be added, renamed, repriced and hidden after publish. **Capacity can never drop below what is already sold or held.** Repricing applies to future sales only. |
| EVT-07 | P0 | ✅ | Organiser note is shown after purchase and included in the ticket email. |
| EVT-08 | P0 | ✅ | Fee rates are snapshot onto the event at publish; historical money is never recomputed from current config. |
| EVT-09 | P0 | ✅ | Organiser console shows ticket revenue (net), share of shop sales, GMV, tickets sold vs capacity, and check-in progress. |
| EVT-10 | P0 | ✅ | Telemetry: event page opens, unique visitors, checkout starts and purchases, surfaced as a funnel in the console. |
| EVT-11 | P0 | ✅ | Organiser can cancel an event, which refunds every outstanding ticket and paid order in one action. |
| EVT-12 | P1 | ❌ | Series / recurring-event container with shared media. |
| EVT-13 | P1 | ❌ | Invite-only events with pre-populated invitee details. |
| EVT-14 | P1 | ❌ | Location visibility control (before vs. after payment). |
| EVT-15 | P1 | ❌ | Embeddable widget for the organiser's own website. |
| EVT-16 | P2 | ❌ | Event↔event connections rendering a cross-selling series microsite. |

---

### CUJ-3 — Teams: more than one person can run the night (TEAM)

> Why prioritised P0: without it, exactly one person can check guests in. On the night that means the organiser standing at the gate holding their own phone, and check-in stopping if there is a second entrance. This is the single most operationally load-bearing journey in the document.

| ID | Pri | Status | Requirement |
|---|---|---|---|
| TEAM-01 | P0 | ✅ | Organiser can invite door staff and cohosts by email, with capabilities mapped individually: check in · edit event · manage shops · issue refunds. |
| TEAM-02 | P0 | ✅ | An invitation grants nothing until accepted. A revoked member loses access immediately. |
| TEAM-03 | P0 | ✅ | Door staff can check guests in **without** being able to see revenue — the console redirects them to the scanner. |
| TEAM-04 | P0 | ✅ | Invitees can be added before they have an account; the invitation binds on first sign-in. |
| TEAM-05 | P0 | ✅ | The console warns an organiser who has nobody else on the door. |
| TEAM-06 | P1 | ✅ | Cohosts can earn a mapped revenue share — flat or percentage, against ticket revenue or the organiser's shop share. |
| TEAM-07 | P0 | ✅ | **Cohost earnings come out of the organiser's line, never the vendor's.** Several cohosts can share that line but never overdraw it. |
| TEAM-08 | P0 | ✅ | A flat cohost fee is paid once per event, not on every ticket sold. |
| TEAM-09 | P0 | ✅ | Vendor can invite shop staff with capabilities mapped: take orders · fulfil orders · edit products · issue refunds. |
| TEAM-10 | P1 | ❌ | Sponsorship: apply via link, upload agreement, sponsor visibility, consent-gated attendee data. |

---

### CUJ-4 — Vendor: open a shop and connect it (SHP / CON)

| ID | Pri | Status | Requirement |
|---|---|---|---|
| SHP-01 | P0 | ✅ | Vendor can create a permanent shop with name, category, description, WhatsApp number and pay-at-event preference. Requires L1+. |
| SHP-02 | P0 | ✅ | Shop stays in draft until its first product is added, then goes active with its own public URL and QR. |
| SHP-03 | P0 | ✅ | Products carry name, price, stock, photo, emoji, SKU and a low-stock threshold. |
| SHP-04 | P0 | ✅ | Products can be edited, repriced, restocked and hidden. Stock cannot drop below what in-flight checkouts are holding. |
| SHP-05 | P0 | ✅ | SKUs are generated automatically for every product. |
| SHP-06 | P0 | ✅ | Vendor console shows gross sales, unsettled balance, live orders and a settlement breakdown. |
| SHP-07 | P1 | ✅ | Low-stock alerts fire to the vendor's phone at a configurable threshold. |
| SHP-08 | P1 | ❌ | Bulk product upload with a downloadable format. |
| SHP-09 | P1 | ❌ | Printable menu with shop and event branding. |
| SHP-10 | P1 | ❌ | Shop deactivation. |
| SHP-11 | P0 | ⚠️ | Sales accounts per shop with mapped notification numbers. **Alerts are built; per-shop virtual accounts are not.** |
| CON-01 | P0 | ✅ | Vendor can request a connection to a live event, offering a revenue share; the split is shown before sending. |
| CON-02 | P0 | ✅ | Organiser reviews the request with a worked example showing exactly what each party receives on a sample sale — no blind accepts. |
| CON-03 | P0 | ✅ | Accepting activates the financial terms; a shop is **not purchasable** through an event without an ACTIVE connection. |
| CON-04 | P0 | ✅ | Connection terms are snapshot onto each order at creation, so later edits cannot rewrite an existing order's split. |
| CON-05 | P1 | ❌ | Negotiate / counter-offer flow. Currently accept or decline only. |
| CON-06 | P1 | ❌ | Application fees and booth assignment at acceptance. |
| CON-07 | P1 | ❌ | Pass-the-fee-to-customer toggle. *(Implemented in the money engine; not exposed in the UI.)* |
| CON-08 | P1 | ❌ | Disengage a connection with open-order handling. |
| CON-09 | P2 | ❌ | Shop↔shop connections and transfer orders. |

---

### CUJ-5 — Buy a ticket (DSC)

| ID | Pri | Status | Requirement |
|---|---|---|---|
| DSC-01 | P0 | ✅ | Anyone can buy a ticket with name, email and phone. No account, no password. |
| DSC-02 | P0 | ✅ | Prices are read from the database at checkout. Nothing the client sends about price is trusted. |
| DSC-03 | P0 | ✅ | Sold-out ticket types cannot be bought, and quantity steppers cap at remaining stock. |
| DSC-04 | P0 | ✅ | Inventory is held for 20 minutes during checkout and released automatically if the buyer walks away. |
| DSC-05 | P0 | ✅ | **Concurrent buyers can never oversell.** Verified: 40 simultaneous buyers competing for 5 seats produce exactly 5 winners. |
| DSC-06 | P0 | ✅ | Payment is taken through Paystack; the processing fee is shown separately and paid by the buyer. |
| DSC-07 | P0 | ✅ | On payment, the buyer receives an email with a scannable QR, a human check-in code, venue details and the organiser's note. |
| DSC-08 | P0 | ✅ | The buyer sees the refund policy before they pay. |
| DSC-09 | P0 | ✅ | Buyer can recover lost tickets by entering their email and following a signed link valid for 30 minutes. |
| DSC-10 | P0 | ✅ | The recovery response is identical whether or not the address has tickets. |
| DSC-11 | P0 | ✅ | Telemetry: page opens, unique visitors, checkout starts, completed purchases. |
| DSC-12 | P1 | ❌ | Ticket transfer and resale. |
| DSC-13 | P1 | ❌ | Promo codes. |
| DSC-14 | P1 | ❌ | Reviews, star ratings and the event wall. |
| DSC-15 | P1 | ❌ | Cart-abandonment and continuation emails. |
| DSC-16 | P1 | ❌ | Add to calendar. |
| DSC-17 | P1 | ❌ | Search and filtering on discovery. |
| DSC-18 | P2 | ❌ | Earnit purchase-time game. |

---

### CUJ-6 — Buy from vendors (ORD)

| ID | Pri | Status | Requirement |
|---|---|---|---|
| ORD-01 | P0 | ✅ | Buyer can browse connected shops from an event page and build a basket across several of them. |
| ORD-02 | P0 | ✅ | A multi-shop basket creates **one order per shop** under a shared group reference. Each vendor sees only their own items. |
| ORD-03 | P0 | ✅ | The single buyer-paid processing fee is allocated across shops so the parts sum to exactly what was charged. |
| ORD-04 | P0 | ✅ | Buyer can pay now, or create a pay-at-event order where every shop in the basket allows it. |
| ORD-05 | P0 | ✅ | Product stock is reserved atomically; concurrent buyers cannot oversell. |
| ORD-06 | P0 | ✅ | Order states: created → preparing → ready → completed, plus cancelled and refunded. Orders lock on payment. |
| ORD-07 | P0 | ✅ | Marking an order ready issues a pickup code to the buyer; **collection is gated on that code being presented and matched.** |
| ORD-08 | P0 | ✅ | A pay-at-event order settles at the counter on collection, writing its ledger entries at that point. |
| ORD-09 | P0 | ✅ | Each shop fulfils independently — one finishing does not complete the others. |
| ORD-10 | P0 | ✅ | Order references cannot collide under load. |
| ORD-11 | P0 | ✅ | Buyer receives an emailed receipt and can track order status by reference. |
| ORD-12 | P0 | ✅ | Vendor is alerted on their phone for every new order, with SMS fallback. |
| ORD-13 | P0 | ✅ | Telemetry: order volume, state distribution, per-shop settlement. |
| ORD-14 | P1 | ❌ | Counter sale — staff-created walk-up order. *(In the prototype; not carried into the build.)* |
| ORD-15 | P1 | ❌ | Printable invoice/receipt carrying the checkout code. |
| ORD-16 | P1 | ❌ | Product QR that opens that product's checkout directly. |
| ORD-17 | P2 | ❌ | Group checkout via shared link. |
| ORD-18 | P2 | ❌ | Delivery states — MVP is pickup-only. |

---

### CUJ-7 — Event day: check-in (OPS)

| ID | Pri | Status | Requirement |
|---|---|---|---|
| OPS-01 | P0 | ✅ | Staff can check a guest in by scanning the QR on their badge with a phone camera. |
| OPS-02 | P0 | ✅ | QR payloads are cryptographically signed; a forged or edited code is rejected **before any database lookup**. |
| OPS-03 | P0 | ✅ | Staff can check in by typing the guest's code, or by searching the guest list — for dead batteries and cracked screens. |
| OPS-04 | P0 | ✅ | A double-scan cannot check the same person in twice, and reports when and that they were already in. |
| OPS-05 | P0 | ✅ | **Check-in works offline.** Scans queue on the device and sync when connectivity returns, each carrying an idempotency key so replay cannot double-register. |
| OPS-06 | P0 | ✅ | The scanner shows a running count, a recent-scan list, and pass/fail feedback readable at arm's length, backed by sound and haptics. |
| OPS-07 | P0 | ✅ | Only people the organiser put on the door team can check anyone in. |
| OPS-08 | P0 | ✅ | An unpaid, cancelled or refunded ticket is refused at the gate with the reason. |
| OPS-09 | P1 | ❌ | Vendor check-in at an assigned booth. |
| OPS-10 | P2 | ❌ | Spatial booth layer, event map, in-event navigation. |

---

### CUJ-8 — Money: fees, refunds and settlement (PAY)

> Why this bucket is written more tightly than the rest: these requirements are the ones where a defect is a financial loss rather than a bad experience. Appendix A states the invariants they rest on.

**Fees and splits**

| ID | Pri | Status | Requirement |
|---|---|---|---|
| PAY-01 | P0 | ✅ | All money is handled as an integer number of kobo. No floating-point arithmetic anywhere in the money path. |
| PAY-02 | P0 | ✅ | A service charge of 7.5% is deducted from the seller per transaction. |
| PAY-03 | P0 | ✅ | Processing fees are added to the buyer's total and shown before payment. No listing fee. |
| PAY-04 | P0 | ✅ | The organiser's connection share is deducted from the vendor's proceeds per the terms snapshot on the order. |
| PAY-05 | P0 | ✅ | **Every split sums exactly to the gross.** Rounding remainders go to the vendor, never evaporate. |
| PAY-06 | P0 | ✅ | Worked example holds end to end: ₦10,000 product on a 5% connection → buyer pays ₦10,150 · platform ₦750 · organiser ₦500 · vendor ₦8,750. |
| PAY-07 | P0 | ⚠️ | Whether the connection share computes on gross or net-of-service-charge is **configurable**, currently gross. Open Decision #12. |
| PAY-08 | P0 | ❌ | Plan tiers (Standard 5% / Premium 2%). Only the 7.5% Starter rate is live. |

**Payments**

| ID | Pri | Status | Requirement |
|---|---|---|---|
| PAY-09 | P0 | ✅ | A payment becomes successful **only** via a signature-verified provider webhook or a server-side verification call. Nothing client-supplied can move payment state. |
| PAY-10 | P0 | ✅ | Repeated webhook deliveries cannot double-credit anyone. |
| PAY-11 | P0 | ✅ | Payment state is reconciled on the buyer's return as a backstop, because the redirect can outrun the webhook. |
| PAY-12 | P0 | ✅ | Every webhook delivery is stored; failures are alerted and replayable by an admin. |

**Refunds** *(Decision #9 — resolved 2026-08-08)*

| ID | Pri | Status | Requirement |
|---|---|---|---|
| PAY-13 | P0 | ✅ | **Policy: the buyer is made whole.** Earnival reverses its service charge and the organiser's share; the processor keeps its fee, so **Earnival absorbs it** — recorded explicitly, not written off. |
| PAY-14 | P0 | ✅ | Full and partial refunds are supported. Refunding more than was paid is impossible. |
| PAY-15 | P0 | ✅ | A full refund returns product stock and ticket seats to their pools for resale. |
| PAY-16 | P0 | ✅ | Refunds are blocked after a ticket is scanned or an order collected — the goods were delivered. |
| PAY-17 | P0 | ✅ | Cancelling an event refunds every outstanding ticket and paid order, each payment independently so one failure cannot strand the rest. |
| PAY-18 | P0 | ✅ | A refund that reverses in the ledger but whose cash does not move is flagged **critical** to a human. |
| PAY-19 | P0 | ✅ | The refund policy is shown to buyers before they pay and published in the terms. |

**Settlement**

| ID | Pri | Status | Requirement |
|---|---|---|---|
| PAY-20 | P0 | ✅ | A party's balance is the sum of their ledger entries. There is no stored balance that can drift. |
| PAY-21 | P0 | ✅ | Settlement claims ledger entries atomically, so two concurrent runs cannot pay the same earnings twice. |
| PAY-22 | P0 | ✅ | Post-event cadence settles only earnings from events that have finished; daily cadence settles whole days. |
| PAY-23 | P0 | ✅ | A negative balance from refunds carries forward and never pays out. |
| PAY-24 | P0 | ✅ | No verified bank account means no payout, and the earnings stay untouched. |
| PAY-25 | P0 | ✅ | Bank account names are confirmed with the bank before an account can receive anything. |
| PAY-26 | P0 | ✅ | A failed or reversed transfer returns its earnings to the payable pool and alerts a human. |
| PAY-27 | P0 | ✅ | Payouts below a ₦100 minimum roll forward rather than being attempted. |
| PAY-28 | P0 | ❌ | **Verified against live Paystack Transfers.** Never exercised. See §9. |
| PAY-29 | P1 | ❌ | Two-balance wallet (earnings vs. spend). |
| PAY-30 | P1 | ❌ | Diaspora currency / FX acceptance. Open Decision #18. |
| PAY-31 | P2 | ❌ | Commission when connected shops sell event tickets. Open Decision #22. |

---

### CUJ-9 — Admin and platform operations (ADM)

| ID | Pri | Status | Requirement |
|---|---|---|---|
| ADM-01 | P0 | ✅ | Admin reviews paid events from L0 organisers and approves or rejects with a reason. Unapproved paid events cannot sell and do not appear in discovery. |
| ADM-02 | P0 | ✅ | Admin reviews KYC submissions seeing only the last four digits, never the full identifier. |
| ADM-03 | P0 | ✅ | Admin sees recent settlements, refunds needing attention, and failed webhooks — with replay. |
| ADM-04 | P0 | ✅ | Non-admins cannot reach the admin console at all. |
| ADM-05 | P0 | ✅ | A health endpoint reports database reachability and which integrations are configured. |
| ADM-06 | P0 | ✅ | Failed settlements, failed refunds and unprocessable webhooks alert to an external channel. |
| ADM-07 | P0 | ✅ | The service refuses to start if misconfigured in a way that would lose money or leak data. |
| ADM-08 | P1 | ❌ | **Audit log of admin actions.** Approvals, KYC decisions and refunds leave no trail beyond the row they change. *Recommended P0 before external admins are onboarded.* |
| ADM-09 | P1 | ❌ | Feature flags for price control without a release. |
| ADM-10 | P1 | ❌ | Admin bootstrap UI — `isAdmin` is settable only by direct SQL. |

---

### CUJ-10 — Notifications (NTF)

| ID | Pri | Status | Requirement |
|---|---|---|---|
| NTF-01 | P0 | ✅ | Transactional email: sign-in code, ticket delivery, order receipt, pickup ready, refund confirmation, settlement paid. |
| NTF-02 | P0 | ✅ | Vendor sale alerts to WhatsApp with SMS fallback. |
| NTF-03 | P0 | ✅ | Event-change notification to ticket holders. |
| NTF-04 | P0 | ✅ | Credential-bearing messages are never written to logs outside local development. |
| NTF-05 | P1 | ❌ | Push notifications and home-screen install prompt. |
| NTF-06 | P1 | ❌ | Automated event reminders. |

---

## 8. Compliance & Regulatory

> Per PRD Rule 6, this is not an appendix item. Earnival handles Nigerian financial transactions and government identity documents; these requirements are as binding as the functional ones.

### 8.1 NDPR / Nigeria Data Protection Act

| ID | Pri | Status | Requirement |
|---|---|---|---|
| LEG-01 | P0 | ✅ | A privacy policy states what is collected, the lawful basis, who sees it, retention periods and data-subject rights. |
| LEG-02 | P0 | ✅ | Terms of service state fees, refund rules, seller obligations and liability. |
| LEG-03 | P0 | ✅ | Consent is **demonstrable**: who agreed, to what, to which document version, when. |
| LEG-04 | P0 | ✅ | Consent is captured at sign-in, at checkout, and separately before any identity document is processed. |
| LEG-05 | P0 | ✅ | IP addresses in consent records are hashed, never stored raw — an IP is personal data in its own right. |
| LEG-06 | P0 | ✅ | Identity documents are encrypted at rest under a key separate from the session secret. |
| LEG-07 | P0 | ✅ | Only the last four digits of an identity document are ever displayed, including to internal reviewers. |
| LEG-08 | P0 | ✅ | Ticket badges are excluded from search indexing and send no referrer, because they are bearer credentials containing attendee details. |
| LEG-09 | P0 | ❌ | **DPIA completed before L2 ships.** This is where BVN/NIN collection begins. **Launch-blocking.** |
| LEG-10 | P0 | ❌ | Data-subject access and erasure request handling — process and tooling. |
| LEG-11 | P1 | ❌ | Automated retention enforcement. Policy states 7 years for financial records and deletion of identity documents after decision; **only analytics purging is automated.** |
| LEG-12 | P1 | ❌ | Marketing consent capture and a working unsubscribe path. |
| LEG-13 | P1 | ❌ | Sponsor access to attendee data, consent-gated. Open Decision #10. |

### 8.2 CBN and financial conduct

| ID | Pri | Status | Requirement |
|---|---|---|---|
| LEG-14 | P0 | ⚠️ | **Pre-event ticket payouts.** Daily settlement at L2+ pays out ticket revenue before the event happens. Requires CBN comfort. Open Decision #13. |
| LEG-15 | P0 | ✅ | Revenue caps bound exposure from sellers whose identity has not been verified. |
| LEG-16 | P0 | ✅ | Bank accounts are name-verified with the bank before receiving funds. |
| LEG-17 | P0 | ✅ | Every money movement produces an immutable, attributable ledger entry — an audit trail by construction. |
| LEG-18 | P1 | ❌ | Sanctions / PEP screening on sellers. |
| LEG-19 | P1 | ❌ | Suspicious-activity monitoring and reporting workflow. |
| LEG-20 | P1 | ❌ | Formal chargeback and dispute-handling process. |

### 8.3 Accessibility

| ID | Pri | Status | Requirement |
|---|---|---|---|
| LEG-21 | P1 | ✅ | Targets WCAG 2.2 AA: skip link, single main landmark, 12px text floor, 4.5:1 contrast on body text, 36px tap targets, errors tied to inputs, live regions for scanner feedback, pinch-zoom never blocked, reduced-motion honoured. |
| LEG-22 | P1 | ❌ | Independent accessibility audit. Self-assessed only. |

---

## 9. Risks & Dependencies

| Risk / Dependency | Impact | Mitigation / Owner |
|---|---|---|
| **Never tested against live Paystack.** All payments, refunds and transfers exercised only against sandbox stubs. | Payment or payout path fails at the first real event | Run one small real event end to end before any external launch. **Eng + PM** |
| **Paystack Transfers require OTP by default.** If enabled, `initiateTransfer` appears to succeed then hangs indefinitely. | Nobody gets paid, silently | Verify the dashboard setting before relying on payouts. **Eng** |
| **DPIA not done.** L2 collects BVN/NIN. | Regulatory penalty; NDPC exposure | Complete before L2 is enabled. **Legal** — launch-blocking |
| **CBN treatment of pre-event payouts** unresolved. | Settlement model may need rework | Confirm before enabling daily cadence broadly. **Compliance** |
| **Cron sweep is a single point of failure.** If it stops, inventory is never released and nobody is paid. | Silent, compounding | Uptime monitoring on `/api/health`; alert on missed runs. **Ops** |
| **Connection pooling misconfigured.** Serverless exhausts Postgres connections at ~100. | Total outage at exactly peak load | Pooled connection string mandatory; load-test before a drop. **Eng** |
| **Rate limits key on a spoofable header.** | Inventory-denial by a determined attacker | Put Cloudflare or equivalent in front. **Eng** |
| **No admin audit log.** | Cannot investigate an internal dispute | ADM-08 before external admins. **Eng** |
| **Email deliverability.** An unverified sending domain sends tickets to spam. | The ticket *is* the product | Verify SPF/DKIM before launch. **Ops** |
| **Single-vendor dependency on Paystack** for payments, refunds, transfers and bank verification. | Total commerce outage if they degrade | Accept for MVP; abstraction already isolated in one module. **Eng** |
| **Organiser-first adoption stalls.** | Empty marketplace | Onboard the three pilot cohorts by hand before opening the link. **PM / GTM** |
| **Scope breadth.** | Shallow everything | Phase gates; the non-goals in §6 are enforced. **PM** |

---

## 10. Open Decisions

| # | Decision | Options | Owner | Target |
|---|---|---|---|---|
| 12 | Connection share computed on gross or net-of-service-charge | Gross *(current)* vs. net | PM + Finance + Eng | Pre-launch |
| 13 | Pre-event ticket payouts | Allow at L2+ *(current)* vs. hold to event end | Compliance | **Pre-launch, blocking** |
| 14 | Standard and Premium plan prices | — | PM | Pre-Phase-2 |
| 18 | Diaspora currency and FX model | USD acceptance · conversion point · settlement currency | PM + Finance | Pre-Phase-2 |
| 22 | Default commission when connected shops sell event tickets | — | PM | Pre-build |
| 23 | Marketing consent model for cart recovery | — | Legal | Pre-Phase-2 |
| 17 | Product name — "Earnival" retained, rename deferred | — | Founder | Post-first-event |
| 32 | **New:** Is ADM-08 (admin audit log) P0 before external admins? | Yes vs. accept the gap | PM + Compliance | Pre-onboarding |
| 33 | **New:** Refund window — is there a time limit after which a buyer cannot request one? | Unlimited *(current)* vs. bounded | PM + Compliance | Pre-launch |
| 34 | **New:** Who bears a chargeback — platform, organiser or vendor? | — | PM + Finance | Pre-launch |

**Resolved since PRD v8.0:** #8 revenue caps (L2 ₦5m, L3 unlimited) · #9 refund policy (buyer made whole, platform absorbs the processor fee).

---

## Appendix A — The five money invariants *(engineering)*

Load-bearing constraints. Each closes a specific failure that costs money; each has regression tests.

1. **Money is integer kobo.** All fee maths lives in one module. Guarantee: `serviceFee + organiserShare + vendorNet === gross`, exactly, always. Remainders go to the vendor.
2. **Prices come from the database.** Checkout accepts only IDs and quantities.
3. **Inventory is reserved by conditional SQL** — the predicate lives inside the `UPDATE`, so Postgres row-locking makes concurrent oversell impossible.
4. **Only a verified webhook marks a payment successful** — signature checked against the raw body, deliveries deduplicated, status transition guarded.
5. **The ledger is append-only.** Balances are sums, never stored numbers. Settlement claims entries with a null-settlement filter.

**Plus:** permissions fail closed — capability resolves to "owner, or accepted member with that capability", and unknown / pending / revoked grants nothing.

## Appendix B — Data model *(engineering, QA)*

25 models · 24 enums. Key state machines:

- **Ticket:** `PENDING_PAYMENT → VALID → CHECKED_IN`, plus `CANCELLED` / `REFUNDED`
- **Order:** `CREATED → PENDING_PAYMENT → PAID → PREPARING → READY → COMPLETED`, plus `CANCELLED` / `PARTIALLY_REFUNDED` / `REFUNDED`
- **Payment:** `PENDING → SUCCESS | FAILED | ABANDONED`
- **Settlement:** `PENDING → PROCESSING → PAID | FAILED`
- **Connection:** `PENDING → ACTIVE | REJECTED | ENDED`
- **Event approval:** `AUTO_APPROVED | PENDING_REVIEW → APPROVED | REJECTED`
- **Member:** `PENDING → ACCEPTED | REJECTED | REVOKED`

**Ledger accounts:** `GROSS_SALES` · `PROCESSING_FEE` · `PLATFORM_SERVICE_FEE` · `ORGANISER_SHARE` · `COHOST_SHARE` · `VENDOR_NET` · `ORGANISER_TICKET_NET` · `APPLICATION_FEE` · `BOOTH_FEE` · `REFUND` · `PROCESSING_FEE_ABSORBED` · `PAYOUT`

## Appendix C — Architecture & surface *(engineering)*

**Stack:** Next.js 15.5 (App Router, React 19) · TypeScript · PostgreSQL 16 via Prisma 6 · Tailwind 3.4 · Vitest · Node 22+. No separate backend — Server Components and Route Handlers are the backend; business logic lives in `src/lib`.

**Size:** 108 files · ~17,600 lines · 24 pages · 13 API routes · 25 server actions.

**External dependencies:** Paystack (payments, refunds, transfers, bank verification) · Resend (email) · Termii (SMS) · WhatsApp Cloud API (alerts) · Sentry (errors, optional).

**Non-functional posture:** rate limits — checkout 10/5min, OTP 8/15min, lookup 5/15min, check-in 600/min, upload 30/hr · CSP with `frame-ancestors 'none'` · HSTS · no-store on ticket badges · boot-time configuration guard.

## Appendix D — Operations runbook *(ops, support)*

- **Cron sweep** every 15 min: release expired reservations · run settlements · purge rate-limit counters · purge analytics >24 months. All idempotent. **Most important scheduled job.**
- **Health endpoint** reports database reachability and integration configuration; 503 when the database is down.
- **Alerting** on failed settlements, failed refunds and unprocessable webhooks. A refund reversed in the ledger whose cash did not move is `critical`.
- **Webhook replay** from the admin console — safe, because settlement is idempotent.

## Appendix E — Test coverage *(QA)*

82 tests across 5 suites. Integration tests run against a real database, because the failures that matter are concurrency problems.

| Suite | Tests | Covers |
|---|---|---|
| `money.test.ts` | 25 | Worked example; ~300-combination invariant sweep; rounding; validation |
| `commerce.test.ts` | 8 | Oversell races (40→5), webhook idempotency, reservation expiry, QR forgery, connection enforcement |
| `trust.test.ts` | 19 | KYC encryption, level progression, revenue caps, refund reconciliation, payout idempotency, negative-balance hold-back |
| `hardening.test.ts` | 19 | Regressions — each maps to a defect that was live |
| `team.test.ts` | 11 | Door access, cohost settlement, capability gating, consent |

**Not covered:** end-to-end browser tests · live Paystack integration · load testing · accessibility automation.

## Appendix F — Design *(design)*

Mobile-first; buying is a phone activity. Console routes widen to a desktop layout because organisers work guest lists on laptops. Brand tokens in `tailwind.config.ts`. Every event gets a generated OpenGraph share card — the distribution surface the growth thesis depends on.

**Not built:** design system documentation · Figma source of truth · dark mode.

---

# PRD Review — Proposed Improvements

**PRD Type:** Product
**Template compliance:** 9 of 9 sections filled, plus a Compliance section (Rule 6) and six appendices.

### Strengths

- **Build status on every requirement** makes this usable as a gap analysis, not just an aspiration. A reader can compute the delta between intent and reality without opening the code.
- **The money bucket (CUJ-8) is written to a genuinely higher standard** than the rest, correctly — those are the requirements where a defect is a loss rather than an annoyance.
- **Compliance is specified at requirement grain** with IDs and priorities, not a paragraph in constraints. LEG-09 (DPIA) is correctly marked launch-blocking.
- **Non-goals are unusually explicit**, which is the right defence against the originating PRD's own stated top risk.

### Issues Found

#### Critical (blocks development or launch)

1. **§6 Success Metrics — six of nine metrics have no baseline.** → **Fix:** These cannot be filled from historical data because telemetry did not exist. Run the first real event, then populate from `AnalyticsEvent`. Do not move this PRD to Approved with `[TODO]` baselines; that is the gate.

2. **§7 PAY-28 is the only P0 marked ❌ that has no owner or date.** → **Fix:** Add to §10 as a dated decision, or convert to a launch checklist item with a named owner. "Never tested live" is currently a risk without a work item attached.

3. **§8 LEG-09 (DPIA) is launch-blocking but has no target date.** → **Fix:** Assign Legal and a date. L2 cannot be enabled without it, which means the ₦5m cap and daily settlement are both gated on a task nobody owns.

#### Important (weakens the PRD)

4. **ADM-08 (admin audit log) is marked P1 but reads P0.** A financial platform where approvals and refunds leave no trail cannot investigate an internal dispute. → **Fix:** Raised as Open Decision #32 rather than silently reprioritised — but the recommendation is P0 before any admin other than the founder is onboarded.

5. **§7 CUJ-8 has no requirement for reconciling Earnival's own bank balance** against the ledger. The ledger is internally consistent but nothing checks it against reality. → **Fix:** Add `PAY-32 [P1]`: "Operator can reconcile the platform's ledger position against the Paystack balance for a given period."

6. **Refund has no time bound.** A buyer can request one indefinitely, which is unusual for events. → **Fix:** Raised as Open Decision #33.

7. **No chargeback ownership.** The system has no concept of a chargeback at all, and Paystack will pass them through. → **Fix:** Raised as Open Decision #34; needs a requirement bucket once decided.

#### Minor (polish)

8. **§2 market sizing carries an `[ASSUMED]` flag but sits in a prominent table** — a reader skimming for a data room will lift it. → **Fix:** Keep the flag adjacent to the table, as done, and do not export §2 until Decision #16 closes.

9. **CUJ-4 SHP-11 is marked ⚠️ but conflates two things** — alerts (built) and per-shop virtual accounts (not). → **Fix:** Split into SHP-11 (alerts, ✅) and SHP-12 (virtual accounts, ❌ P1).

10. **Length exceeds the 6–8 page standard.** → **Fix:** Accepted deliberately and declared up front. If it needs to shrink, §7 CUJ-8 and Appendix A–B should become a separate *Feature PRD: Money, Ledger & Settlement*, leaving a one-liner and a link.

### Suggested Additions

- **A "first real event" launch checklist** as a separate doc — the operational sequence is currently spread across §9, §10 and Appendix D.
- **Feature PRDs** for the three areas complex enough to warrant them: *Money, Ledger & Settlement* · *Verification Ladder & KYC* · *Check-in & Event Day Operations*.
- **A rollback plan.** Nothing in this document says what happens if the first real event goes badly mid-event.

### Questions for the PM

1. **PAY-08 (plan tiers) is P0 in the originating PRD but ❌ here.** Is the 7.5% flat rate the launch position, or is this a gap? It changes the revenue model materially.
2. **Is ORD-14 (counter sale) really P1?** A vendor with a queue and no walk-up flow may be a worse experience than cash — this was in the prototype and got dropped.
3. **Who is the admin on day one?** ADM-10 means `isAdmin` is set by SQL only. If it is you, that is fine; if it is a hire, ADM-08 and ADM-10 both become blocking.
4. **What is the intended behaviour when an organiser cancels an event that has already partially checked in?** PAY-16 blocks refunds after scan, PAY-17 refunds everything on cancellation — these two conflict, and the code resolves it by skipping scanned tickets. Is that the intended policy?
