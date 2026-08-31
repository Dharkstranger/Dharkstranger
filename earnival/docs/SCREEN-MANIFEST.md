# Screen manifest — every screen, every state

Derived from the code, not from memory: the route list comes from
`src/app/**/page.tsx`, the states from the Prisma enums, the failures from every
`throw new *Error("…")` in `src/lib`, and the empty states from the strings in
the components themselves.

This is the checklist the design file is measured against. If a state is listed
here and not drawn, the design is incomplete.

**Totals: 26 surfaces · 136 distinct states.**

Legend — ✅ drawn in Figma · ⬜ not yet drawn

---

## A. Public / buyer — phone, 390×844

### A1. Landing `/` — 2 states
| # | State | |
|---|---|---|
| 1.1 | Events listed | ⬜ |
| 1.2 | Empty — "No events yet" | ⬜ |

### A2. Event microsite `/e/[slug]` — 9 states
| # | State | |
|---|---|---|
| 2.1 | Live: tickets + connected shops | ✅ |
| 2.2 | Empty — "No tickets on sale yet" | ⬜ |
| 2.3 | Empty — "No shops connected yet" | ⬜ |
| 2.4 | Every ticket type sold out | ⬜ |
| 2.5 | Free event (₦0, no processing fee) | ⬜ |
| 2.6 | `CANCELLED` — sale closed, refunds issued | ⬜ |
| 2.7 | `ENDED` — event is over | ⬜ |
| 2.8 | `PENDING_REVIEW` — L0 paid event, not on sale | ⬜ |
| 2.9 | Not found (404) | ⬜ |

### A3. Basket / checkout `/e/[slug]/basket` — 9 states
| # | State | |
|---|---|---|
| 3.1 | Tickets in basket, fee shown separately | ✅ |
| 3.2 | Empty basket | ⬜ |
| 3.3 | Multi-shop basket → one order per shop | ⬜ |
| 3.4 | Pay-at-event selected | ⬜ |
| 3.5 | Field validation: name / email / phone | ⬜ |
| 3.6 | Quantity capped at remaining stock | ⬜ |
| 3.7 | "Maximum 20 tickets per checkout" | ⬜ |
| 3.8 | Revenue cap hit — blocked, headroom named | ⬜ |
| 3.9 | Reservation expired (20 min), items released | ⬜ |

### A4. Payment — 6 states
| # | State | |
|---|---|---|
| 4.1 | Redirecting to Paystack | ⬜ |
| 4.2 | Sandbox pay `/sandbox/pay/[reference]` | ⬜ |
| 4.3 | Callback success `/pay/callback` | ⬜ |
| 4.4 | Callback failed — retry offered | ⬜ |
| 4.5 | Reconciling (redirect outran the webhook) | ⬜ |
| 4.6 | "No payment reference supplied" | ⬜ |

### A5. Ticket badge `/t/[token]` — 6 states
| # | State | |
|---|---|---|
| 5.1 | `VALID` — QR + check-in code | ✅ |
| 5.2 | `CHECKED_IN` — with timestamp | ⬜ |
| 5.3 | `REFUNDED` | ⬜ |
| 5.4 | `CANCELLED` | ⬜ |
| 5.5 | `PENDING_PAYMENT` | ⬜ |
| 5.6 | Invalid or forged token — rejected | ⬜ |

### A6. Shop storefront `/s/[slug]` — 4 states
| # | State | |
|---|---|---|
| 6.1 | `ACTIVE` with products | ✅ |
| 6.2 | Empty — "No products listed yet" | ⬜ |
| 6.3 | `DRAFT` / `DEACTIVATED` | ⬜ |
| 6.4 | No ACTIVE connection — not purchasable here | ⬜ |

### A7. Order tracking `/orders/[reference]` — 11 states
| # | State | |
|---|---|---|
| 7.1 | `CREATED` | ⬜ |
| 7.2 | `PENDING_PAYMENT` | ⬜ |
| 7.3 | `PAID` | ⬜ |
| 7.4 | `PREPARING` | ✅ |
| 7.5 | `READY` — pickup code issued | ⬜ |
| 7.6 | `COMPLETED` | ⬜ |
| 7.7 | `CANCELLED` | ⬜ |
| 7.8 | `PARTIALLY_REFUNDED` | ⬜ |
| 7.9 | `REFUNDED` | ⬜ |
| 7.10 | Pay-at-event — due at the counter | ⬜ |
| 7.11 | Not found / "You don't have access to that order" | ⬜ |

### A8. Find my ticket `/find` — 3 states
| # | State | |
|---|---|---|
| 8.1 | Email entry form | ⬜ |
| 8.2 | Submitted — response identical whether or not it exists | ⬜ |
| 8.3 | Rate limited (5 per 15 min) | ⬜ |

### A9. Recovery link `/find/[token]` — 3 states
| # | State | |
|---|---|---|
| 9.1 | Tickets and orders listed | ⬜ |
| 9.2 | "No tickets on this address" | ⬜ |
| 9.3 | Link expired (30 min) or invalid | ⬜ |

---

## B. Authentication — 8 states

### B1. Sign in `/signin` — 7 states
| # | State | |
|---|---|---|
| 10.1 | Email entry | ⬜ |
| 10.2 | Six-digit code entry | ⬜ |
| 10.3 | "That code isn't right" (5 attempts) | ⬜ |
| 10.4 | "That code expired" (10 min) | ⬜ |
| 10.5 | "Too many attempts. Request a new code." | ⬜ |
| 10.6 | "Too many codes requested" (8 per 15 min) | ⬜ |
| 10.7 | "We couldn't send that code" | ⬜ |

### B2. Invitations `/dashboard/invitations` — 2 states
| # | State | |
|---|---|---|
| 11.1 | Pending invitations to accept | ⬜ |
| 11.2 | "No invitations" | ⬜ |

---

## C. Organiser — console, 1200px

### C1. Dashboard `/dashboard` — 3 states
| # | State | |
|---|---|---|
| 12.1 | Events listed | ⬜ |
| 12.2 | "No events yet" | ⬜ |
| 12.3 | Door staff — redirected to scanner, revenue hidden | ⬜ |

### C2. Create event `/dashboard/events/new` — 4 states
| # | State | |
|---|---|---|
| 13.1 | Form: details, ticket types, banner | ⬜ |
| 13.2 | Validation errors | ⬜ |
| 13.3 | L0 + paid → "awaiting review" notice | ⬜ |
| 13.4 | Below L1 → shop creation blocked | ⬜ |

### C3. Event detail `/dashboard/events/[id]` — 7 states
| # | State | |
|---|---|---|
| 14.1 | Populated: revenue, funnel, guests | ✅ |
| 14.2 | "Nobody has opened your event page yet" | ⬜ |
| 14.3 | "No guests yet — share your link" | ⬜ |
| 14.4 | "No shops connected yet" | ⬜ |
| 14.5 | Connection request + settlement split | ✅ |
| 14.6 | Lone-door-staff warning | ⬜ |
| 14.7 | Cancelled event — refunds summarised | ⬜ |

### C4. Edit event `/dashboard/events/[id]/edit` — 4 states
| # | State | |
|---|---|---|
| 15.1 | Edit form | ⬜ |
| 15.2 | Capacity below sold → refused | ⬜ |
| 15.3 | Reprice → applies to future sales only | ⬜ |
| 15.4 | "Email ticket holders?" prompt | ⬜ |

### C5. Team `/dashboard/events/[id]/team` — 5 states
| # | State | |
|---|---|---|
| 16.1 | "Nobody else yet" | ⬜ |
| 16.2 | Members: accepted / pending / revoked | ⬜ |
| 16.3 | Invite form — role + capability checkboxes | ⬜ |
| 16.4 | Cohost revenue share (flat or percent) | ⬜ |
| 16.5 | Revoke confirmation | ⬜ |

### C6. Door scanner `/dashboard/events/[id]/scan` — 11 states
| # | State | |
|---|---|---|
| 17.1 | Idle — "Ready to scan" | ⬜ |
| 17.2 | Pass — guest confirmed | ✅ |
| 17.3 | "Already checked in" + when | ⬜ |
| 17.4 | "Ticket not found" | ⬜ |
| 17.5 | "That ticket is for a different event" | ⬜ |
| 17.6 | "That ticket was never paid for" | ⬜ |
| 17.7 | "You're not on the door team for this event" | ⬜ |
| 17.8 | Offline — scans queued | ⬜ |
| 17.9 | Syncing queued scans | ⬜ |
| 17.10 | Manual code entry | ⬜ |
| 17.11 | Guest search / "No guest matches that" | ⬜ |

### C7. Payouts `/payouts` — 7 states
| # | State | |
|---|---|---|
| 18.1 | Balance + settlement history | ✅ |
| 18.2 | "No bank account yet" | ⬜ |
| 18.3 | "No payouts yet" | ⬜ |
| 18.4 | Negative balance carried forward, held back | ⬜ |
| 18.5 | Transfer `FAILED` — returned to pool, human alerted | ⬜ |
| 18.6 | Add bank account form | ⬜ |
| 18.7 | Name mismatch → refused before it can receive money | ⬜ |

---

## D. Vendor

### D1. Shop console `/shop` — 11 states
| # | State | |
|---|---|---|
| 19.1 | Populated: sales, split, products, orders | ✅ |
| 19.2 | No shop yet — create | ⬜ |
| 19.3 | Below L1 — blocked with the reason | ⬜ |
| 19.4 | "No products listed yet" | ⬜ |
| 19.5 | "No orders yet — connect to an event" | ⬜ |
| 19.6 | `DRAFT` — needs a first product to go live | ⬜ |
| 19.7 | Connection request form + share slider | ⬜ |
| 19.8 | Order card: paid → preparing → ready → completed | ⬜ |
| 19.9 | "That pickup code doesn't match" | ⬜ |
| 19.10 | Refund an order (full / partial) | ⬜ |
| 19.11 | Low-stock alert | ⬜ |

### D2. Verification `/verify` — 10 states
| # | State | |
|---|---|---|
| 20.1 | L0 — email only | ⬜ |
| 20.2 | L1 — phone verified | ✅ |
| 20.3 | L2 — identity verified | ⬜ |
| 20.4 | L3 — business verified, badge | ⬜ |
| 20.5 | Submission `PENDING` review | ⬜ |
| 20.6 | Submission `REJECTED` + reason | ⬜ |
| 20.7 | BVN / NIN form + explicit KYC consent | ⬜ |
| 20.8 | CAC + TIN form | ⬜ |
| 20.9 | Phone OTP entry | ⬜ |
| 20.10 | Sequential block — identity refused without phone | ⬜ |

---

## E. Admin `/admin` — 7 states
| # | State | |
|---|---|---|
| 21.1 | Queue populated | ⬜ |
| 21.2 | Empty queue | ⬜ |
| 21.3 | Approve / reject a paid event, with reason | ⬜ |
| 21.4 | KYC review — last four digits only | ⬜ |
| 21.5 | Failed webhooks + replay | ⬜ |
| 21.6 | Refunds needing attention (`critical`) | ⬜ |
| 21.7 | Non-admin — access refused | ⬜ |

---

## F. Legal & system — 5 states
| # | State | |
|---|---|---|
| 22.1 | Terms `/terms` | ⬜ |
| 23.1 | Privacy `/privacy` | ⬜ |
| 24.1 | 404 not found | ⬜ |
| 25.1 | 500 server error | ⬜ |
| 26.1 | Offline / no connectivity | ⬜ |

---

## Cross-cutting states to draw once, as components

These recur on nearly every surface and should be variants rather than
one-offs:

| State | Where it appears |
|---|---|
| Button: default / pressed / loading / disabled | Everywhere |
| Field: default / focused / filled / error / disabled | Every form |
| Inline error message | Every form |
| Toast: success / error / info | Every action |
| Skeleton / loading | Every data screen |
| Empty state (icon + line + action) | 14 surfaces |
| Confirm dialog (destructive) | Cancel event, revoke, refund |
| Pill: 9 order states + 5 ticket states + 4 connection states | Lists everywhere |

---

## Coverage today

| | Count |
|---|---|
| States enumerated | 136 |
| Drawn in Figma | 11 |
| Remaining | 125 |

The 11 drawn are the happy path end to end, across 10 artboards — the event
console carries two states (14.1 and 14.5) on one board.

What is missing is almost entirely **failure and emptiness**: 125 of 136 states.
That is where products are actually judged, and where a designer needs the most
guidance, so it is the opposite of a rounding error.

### Suggested build order

1. **Cross-cutting components first** (the table above). Roughly 40 of the 125
   states are variants of a shared button, field, pill, toast or empty state.
   Drawing them once as variants collapses the remaining work by about a third.
2. **Money and identity failures** — A3.8 revenue cap, A4.4 payment failed,
   C7.5 transfer failed, C7.7 name mismatch, D2.10 sequential block. These are
   the states where a wrong design costs money or breaks compliance.
3. **The door** — C6, all eleven. It is the only surface used under time
   pressure by someone who is not the account holder.
4. **Emptiness** — the fourteen "nothing here yet" states. Every one is a new
   user's first impression.
5. **Everything else.**
