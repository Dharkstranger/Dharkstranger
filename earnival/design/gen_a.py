"""Section A — public / buyer. 53 states."""
from lib import *

S = []
def add(sid, title, inner, kind="phone"):
    S.append(screen(sid, title, inner, kind))

TICKETS = (card(row('<div class="gr"><div class="h3">Regular</div><div class="sm">461 left</div></div>',
                    money("₦15,000"), '<div class="btn b-pri" style="padding:9px 17px;min-height:40px;font-size:14px">Get</div>')) +
           card(row('<div class="gr"><div class="h3">VIP</div><div class="sm">95 left</div></div>',
                    money("₦40,000"), '<div class="btn b-pri" style="padding:9px 17px;min-height:40px;font-size:14px">Get</div>')))

HERO = ('<div style="background:linear-gradient(135deg,#1C1030,#5B2A9E 55%,#FF5E1A);padding:22px 20px 26px;'
        'display:flex;flex-direction:column;gap:10px;flex:none">'
        '<div style="color:#fff;font-size:18px;font-weight:800">earn<span style="color:#FF5E1A">i</span>val</div>'
        '@@PILL@@<div style="color:#fff;font-size:26px;font-weight:800;line-height:1.1;letter-spacing:-.03em">'
        'Gidi Groove — Detty December Block Party</div></div>')

META = ('<div style="display:flex;flex-direction:column;gap:6px">'
        '<div class="p">🗓 Saturday, 19 December at 13:00</div>'
        '<div class="p">📍 Landmark Beach, Oniru, Lagos</div>'
        '<div class="p">🛡 By Emeka Ugochukwu · secured by Paystack</div></div>')

SHOP = card(row('<div style="width:42px;height:42px;border-radius:12px;background:#5B2A9E;color:#fff;'
                'display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px">AM</div>',
                '<div class="gr"><div class="h3">Amara\'s Grill</div><div class="sm">3 products · pay at event ok</div></div>',
                '<span style="color:#B9AFC6">›</span>'))

# ── A1 landing ────────────────────────────────────────────────────────
add("1.1", "Landing — events listed",
    hd("Earnival") + bd('<div class="h2">What\'s on</div>',
        card(row('<div class="gr"><div class="h3">Gidi Groove</div><div class="sm">19 Dec · Landmark Beach</div></div>', pill("live","warn"))),
        card(row('<div class="gr"><div class="h3">Lagos Art Week</div><div class="sm">4 Jan · Ikoyi</div></div>', pill("live","warn"))),
        card(row('<div class="gr"><div class="h3">Lere to the World</div><div class="sm">22 Dec · Surulere</div></div>', pill("live","warn")))))
add("1.2", "Landing — empty",
    hd("Earnival") + bd(empty("🎪","No events yet","When an organiser publishes, it shows up here.")))

# ── A2 event microsite ────────────────────────────────────────────────
add("2.1", "Event — live",
    (HERO.replace('@@PILL@@', ('<span class="pill" style="background:#FFF3D6;color:#8A5A00;align-self:flex-start">LIVE</span>'))) +
    bd(META, '<div class="h2">Tickets</div>', TICKETS, '<div class="h2">Shops at this event</div>', SHOP))
add("2.2", "Event — no tickets on sale",
    (HERO.replace('@@PILL@@', '')) + bd(META, '<div class="h2">Tickets</div>',
        empty("🎫","No tickets on sale yet","The organiser hasn't added ticket types.")))
add("2.3", "Event — no shops connected",
    (HERO.replace('@@PILL@@', '')) + bd(META, '<div class="h2">Tickets</div>', TICKETS, '<div class="h2">Shops at this event</div>',
        empty("🛍","No shops connected yet","Vendors can request to sell here.")))
add("2.4", "Event — sold out",
    HERO.replace('@@PILL@@', '<span class="pill" style="background:#F0EAE0;color:#6E6578;align-self:flex-start">SOLD OUT</span>') +
    bd(META, '<div class="h2">Tickets</div>',
        card(row('<div class="gr"><div class="h3">Regular</div><div class="sm">0 left</div></div>', pill("sold out"))),
        card(row('<div class="gr"><div class="h3">VIP</div><div class="sm">0 left</div></div>', pill("sold out"))),
        note("Every ticket type is sold out. Shops at this event are still open.","warn")))
add("2.5", "Event — free entry",
    HERO.replace('@@PILL@@', '<span class="pill" style="background:#E4F1E9;color:#1F6F44;align-self:flex-start">FREE</span>') +
    bd(META, '<div class="h2">Tickets</div>',
        card(row('<div class="gr"><div class="h3">General entry</div><div class="sm">Unlimited</div></div>',
                 money("₦0"), '<div class="btn b-pri" style="padding:9px 17px;min-height:40px;font-size:14px">Get</div>')),
        '<div class="sm">Free events skip payment entirely — no processing fee.</div>'))
add("2.6", "Event — cancelled",
    HERO.replace('@@PILL@@', '<span class="pill" style="background:#F8E6E9;color:#9E1B32;align-self:flex-start">CANCELLED</span>') +
    bd(note("This event has been cancelled. Every ticket and paid order has been refunded in full — the money is on its way back to the card you paid with.","err"),
       META))
add("2.7", "Event — ended",
    HERO.replace('@@PILL@@', '<span class="pill" style="background:#F0EAE0;color:#6E6578;align-self:flex-start">ENDED</span>') +
    bd(note("This event is over. Thanks for coming.","warn"), META,
       '<div class="sm">Shops you bought from stay open — their storefronts outlive the event.</div>', SHOP))
add("2.8", "Event — awaiting review",
    HERO.replace('@@PILL@@', '<span class="pill" style="background:#FFF3D6;color:#8A5A00;align-self:flex-start">IN REVIEW</span>') +
    bd(note("This event is awaiting review and isn't on sale yet. Paid events from new organisers get a quick check first.","warn"), META))
add("2.9", "Event — not found",
    hd("Not found") + bd(empty("🔍","We can't find that event","The link may be wrong, or the organiser may have taken it down."),
        btn("Browse events","qui")))

# ── A3 basket ─────────────────────────────────────────────────────────
SUM = card(row('<div class="gr p">2 × Regular</div>', money("₦30,000")),
           row('<div class="gr p">Processing fee</div>', money("₦450")),
           row('<div class="gr h3">Total</div>', money("₦30,450")))
add("3.1", "Basket — tickets",
    hd("Your basket") + bd(field("YOUR NAME","Bolu Adeyemi"), field("YOUR EMAIL","bolu@mail.com"),
        field("PHONE","+234 802 000 0000"), SUM,
        '<div class="sm">Refunds: you are made whole. We return our fee; the processor keeps theirs and we absorb it.</div>',
        btn("Pay ₦30,450")))
add("3.2", "Basket — empty",
    hd("Your basket") + bd(empty("🧺","Your basket is empty","Pick a ticket or add something from a shop."), btn("Back to the event","qui")))
add("3.3", "Basket — multi-shop",
    hd("Your basket") + bd(
        '<div class="sm">Two shops — you pay once, each gets its own order to fulfil.</div>',
        card('<div class="h3">Amara\'s Grill</div>', row('<div class="gr p">Suya Platter ×1</div>', money("₦6,500"))),
        card('<div class="h3">Lagos Threads</div>', row('<div class="gr p">Tee ×1</div>', money("₦12,000"))),
        card(row('<div class="gr p">Processing fee</div>', money("₦278")),
             row('<div class="gr h3">Total</div>', money("₦18,778"))),
        btn("Pay ₦18,778")))
add("3.4", "Basket — pay at event",
    hd("Your basket") + bd(field("YOUR NAME","Bolu Adeyemi"), field("YOUR EMAIL","bolu@mail.com"),
        card(row('<div class="gr p">Suya Platter ×1</div>', money("₦6,500")),
             row('<div class="gr h3">Due at the counter</div>', money("₦6,500"))),
        note("Every shop in this basket accepts pay-at-event. Bring the code — you settle when you collect.","ok"),
        btn("Place order","sec")))
add("3.5", "Basket — validation errors",
    hd("Your basket") + bd(field("YOUR NAME","", "Your name", error="Tell us who the ticket is for"),
        field("YOUR EMAIL","bolu@","", error="That doesn't look like an email address"),
        field("PHONE","0802","", error="That doesn't look like a valid phone number"), SUM, btn("Pay ₦30,450","dis")))
add("3.6", "Basket — quantity capped",
    hd("Your basket") + bd(
        card(row('<div class="gr"><div class="h3">Regular</div><div class="sm">Only 3 left</div></div>',
                 '<div class="row" style="gap:8px"><span class="btn b-qui" style="width:36px;height:36px;min-height:36px;padding:0">−</span>'
                 '<span class="mono">3</span><span class="btn b-dis" style="width:36px;height:36px;min-height:36px;padding:0">+</span></div>')),
        note("You've taken every remaining Regular ticket.","warn"), btn("Pay ₦45,675")))
add("3.7", "Basket — 20 ticket limit",
    hd("Your basket") + bd(field("YOUR NAME","Bolu Adeyemi"),
        note("Maximum 20 tickets per checkout. Split the rest into a second purchase.","err"), SUM, btn("Pay","dis")))
add("3.8", "Basket — revenue cap reached",
    hd("Your basket") + bd(
        note("This event has reached its sales limit for now. The organiser needs to verify their identity to raise it. Nothing has been charged.","err"),
        '<div class="sm">₦12,500 of headroom remains — your basket is ₦30,450.</div>', btn("Reduce basket","qui")))
add("3.9", "Basket — reservation expired",
    hd("Your basket") + bd(note("Your 20-minute hold expired, so those tickets went back on sale. Nothing was charged.","warn"),
        card(row('<div class="gr"><div class="h3">Regular</div><div class="sm">12 left</div></div>', money("₦15,000"),
                 '<div class="btn b-pri" style="padding:9px 17px;min-height:40px;font-size:14px">Get</div>')), btn("Start again","qui")))

# ── A4 payment ────────────────────────────────────────────────────────
add("4.1", "Payment — redirecting",
    hd("Payment") + bd('<div style="padding:70px 0;display:flex;flex-direction:column;align-items:center;gap:14px">'
        '<div style="width:44px;height:44px;border-radius:50%;border:4px solid #E9E2D6;border-top-color:#FF5E1A"></div>'
        '<div class="h3">Taking you to Paystack…</div><div class="sm">Do not close this page.</div></div>'))
add("4.2", "Payment — sandbox stand-in",
    hd("Sandbox payment") + bd(note("Sandbox mode. No Paystack keys are configured, so this stands in for the real thing. No money moves.","warn"),
        card(row('<div class="gr p">Reference</div>', money("EA-3XQY-CTLWTP")), row('<div class="gr h3">Amount</div>', money("₦30,450"))),
        btn("Simulate success"), btn("Simulate failure","qui")))
add("4.3", "Payment — success",
    hd("Payment") + bd('<div class="empty"><div class="ic" style="background:#E4F1E9">✅</div>'
        '<div class="t">Paid — you\'re going</div><div class="s">Your ticket is on its way to bolu@mail.com.</div></div>',
        card(row('<div class="gr p">Reference</div>', money("EA-3XQY-CTLWTP")), row('<div class="gr p">Paid</div>', money("₦30,450"))),
        btn("Open my ticket")))
add("4.4", "Payment — failed",
    hd("Payment") + bd('<div class="empty"><div class="ic" style="background:#F8E6E9">✕</div>'
        '<div class="t">That payment didn\'t go through</div>'
        '<div class="s">Your bank declined it. Nothing was charged and your tickets are still held for 14 more minutes.</div></div>',
        btn("Try again"), btn("Use a different card","qui")))
add("4.5", "Payment — reconciling",
    hd("Payment") + bd('<div style="padding:60px 0;display:flex;flex-direction:column;align-items:center;gap:14px">'
        '<div style="width:44px;height:44px;border-radius:50%;border:4px solid #E9E2D6;border-top-color:#FFB020"></div>'
        '<div class="h3">Confirming with Paystack…</div>'
        '<div class="s" style="text-align:center;max-width:30ch">Your bank has approved it. We are waiting for Paystack to confirm — usually a few seconds.</div></div>'))
add("4.6", "Payment — no reference",
    hd("Payment") + bd(empty("❓","No payment reference supplied","This page needs a reference to look anything up."), btn("Back to the event","qui")))

# ── A5 ticket badge ───────────────────────────────────────────────────
def badge(status_pill, extra="", dim=False):
    op = 'opacity:.45;' if dim else ''
    return ('<div style="border:2px solid #FFB020;border-radius:18px;overflow:hidden;background:#fff;'+op+'">'
            '<div style="background:linear-gradient(120deg,#5B2A9E,#FF5E1A);padding:15px 18px">'
            '<div style="color:#FFB020;font-size:12px;font-weight:700;letter-spacing:.08em">EVENT BADGE</div>'
            '<div style="color:#fff;font-size:16px;font-weight:800;line-height:1.25">Gidi Groove — Detty December Block Party</div></div>'
            '<div style="padding:20px;display:flex;flex-direction:column;align-items:center;gap:11px">'
            '<div class="qr"></div>'
            '<div style="font-size:12px;font-weight:700;color:#6E6578;letter-spacing:.08em">CHECK-IN CODE</div>'
            '<div class="mono" style="font-size:25px;letter-spacing:.14em">GI-5BLA</div>'
            + status_pill +
            '<div style="height:1px;background:#E9E2D6;width:100%;margin:4px 0"></div>'
            '<div class="h3">Bolu Adeyemi</div><div class="sm">bolu@mail.com</div></div></div>') + extra

add("5.1", "Ticket — valid", hd("Event badge") + bd(badge(pill("valid","ok")),
    '<div class="sm">Screenshot this or keep the link — it\'s your entry.</div>'))
add("5.2", "Ticket — checked in", hd("Event badge") + bd(badge(pill("checked in","ok")),
    note("You were checked in at 14:12 on 19 December.","ok")))
add("5.3", "Ticket — refunded", hd("Event badge") + bd(badge(pill("refunded","bad"), dim=True),
    note("This ticket was refunded on 12 December. ₦15,000 went back to the card you paid with. It will not scan at the gate.","err")))
add("5.4", "Ticket — cancelled", hd("Event badge") + bd(badge(pill("cancelled","bad"), dim=True),
    note("The organiser cancelled this event. You have been refunded in full.","err")))
add("5.5", "Ticket — awaiting payment", hd("Event badge") + bd(badge(pill("unpaid","warn"), dim=True),
    note("This ticket isn't paid for yet, so it won't scan. If you were charged, it can take a moment to confirm.","warn"), btn("Complete payment")))
add("5.6", "Ticket — invalid code",
    hd("Event badge") + bd(empty("🚫","This badge isn't valid","The code is malformed or has been altered. Ask the organiser to resend your ticket."),
        btn("Find my ticket","qui")))

# ── A6 shop storefront ────────────────────────────────────────────────
PRODUCTS = "".join(card(row('<div style="width:38px;height:38px;border-radius:10px;background:#F0EAE0"></div>',
    f'<div class="gr"><div class="h3">{n}</div><div class="sm">{s} left</div></div>', money(p),
    '<div class="btn b-qui" style="padding:8px 14px;min-height:38px;font-size:13px">Add</div>'))
    for n,s,p in [("Asun Tacos (3)","35","₦4,000"),("Chilled Zobo","90","₦1,500"),("Suya Platter","29","₦6,500")])
add("6.1", "Shop — active",
    hd("Amara's Grill") + bd(row(pill("open","ok"), pill("pay at event ok")),
        '<div class="p">Suya, asun and cold drinks. Twelve years on the Lagos circuit.</div>', PRODUCTS,
        card('<div class="k sm" style="font-weight:700;letter-spacing:.08em">SELLING AT</div>',
             '<div class="h3" style="color:#5B2A9E">Gidi Groove — Detty December Block Party</div>')))
add("6.2", "Shop — no products",
    hd("Amara's Grill") + bd(row(pill("draft","mute")),
        empty("📦","No products listed yet","This shop goes live as soon as the vendor adds something to sell.")))
add("6.3", "Shop — deactivated",
    hd("Amara's Grill") + bd(row(pill("closed","mute")),
        note("This shop is closed. Existing orders are unaffected and will still be fulfilled.","warn"),
        '<div style="opacity:.45">' + PRODUCTS + '</div>'))
add("6.4", "Shop — not connected here",
    hd("Amara's Grill") + bd(note("This shop isn't connected to any live event right now, so you can't buy from it yet.","warn"),
        '<div class="p">Suya, asun and cold drinks. Twelve years on the Lagos circuit.</div>',
        '<div style="opacity:.5">' + PRODUCTS + '</div>'))

# ── A7 order tracking ─────────────────────────────────────────────────
def order(status, tone, msg, extra=""):
    return hd("Your order") + bd(
        card(row(money("EA-3XQY-CTLWTP"), '<div class="gr"></div>', pill(status, tone)),
             '<div class="sm">Amara\'s Grill</div>', f'<div class="sm">{esc(msg)}</div>'),
        card(row('<div class="gr p">Suya Platter ×1</div>', money("₦6,500")),
             row('<div class="gr p">Processing</div>', money("₦97.50")),
             row('<div class="gr h3">Total</div>', money("₦6,597.50"))), extra)

add("7.1","Order — created", order("created","mute","We're holding your items. Complete payment to confirm.", btn("Pay ₦6,597.50")))
add("7.2","Order — pending payment", order("pending","warn","Waiting for your bank to confirm.", note("If you were charged, this clears by itself within a minute.","warn")))
add("7.3","Order — paid", order("paid","ok","Paid. The shop has been told.",""))
add("7.4","Order — preparing", order("preparing","warn","The shop is getting it ready.",""))
add("7.5","Order — ready", order("ready","ok","Ready for collection.",
    '<div class="dark" style="align-items:center"><div class="lb">SHOW THIS AT THE COUNTER</div>'
    '<div class="vl" style="letter-spacing:.14em">PK-4417</div></div>'))
add("7.6","Order — completed", order("completed","ok","Collected. Enjoy.", note("Collected at 15:40 on 19 December.","ok")))
add("7.7","Order — cancelled", order("cancelled","bad","The shop could not fulfil this.", note("You have been refunded ₦6,597.50 in full.","err")))
add("7.8","Order — partially refunded", order("partially refunded","warn","One item was unavailable.",
    card(row('<div class="gr p">Refunded</div>', money("₦1,500")), row('<div class="gr h3">You keep</div>', money("₦5,097.50")))))
add("7.9","Order — refunded", order("refunded","bad","Fully refunded.", note("₦6,597.50 is on its way back to the card you paid with.","err")))
add("7.10","Order — pay at event", order("due at counter","warn","Pay when you collect.",
    '<div class="dark" style="align-items:center"><div class="lb">DUE AT THE COUNTER</div>'
    '<div class="vl">₦6,500</div></div>'))
add("7.11","Order — no access",
    hd("Your order") + bd(empty("🔒","You don't have access to that order","Orders are only visible to the person who placed them."),
        btn("Find my orders","qui")))

# ── A8 / A9 recovery ──────────────────────────────────────────────────
add("8.1","Find my ticket — form",
    hd("Find my ticket") + bd('<div class="p">Enter the email you bought with and we\'ll send you a link.</div>',
        field("EMAIL USED AT CHECKOUT","","you@mail.com"), btn("Send me the link")))
add("8.2","Find my ticket — submitted",
    hd("Find my ticket") + bd('<div class="empty"><div class="ic" style="background:#E4F1E9">📬</div>'
        '<div class="t">Check your inbox</div>'
        '<div class="s">If we have tickets for that address, a link is on its way. It expires in 30 minutes.</div></div>'))
add("8.3","Find my ticket — rate limited",
    hd("Find my ticket") + bd(note("Too many requests. Try again in a few minutes.","err"),
        field("EMAIL USED AT CHECKOUT","bolu@mail.com"), btn("Send me the link","dis")))
add("9.1","Recovery — tickets found",
    hd("Your tickets") + bd('<div class="h2">2 tickets</div>',
        card(row('<div class="gr"><div class="h3">Gidi Groove</div><div class="sm">Regular · GI-5BLA</div></div>', pill("valid","ok"))),
        card(row('<div class="gr"><div class="h3">Gidi Groove</div><div class="sm">VIP · GI-K9MU</div></div>', pill("checked in","ok"))),
        '<div class="h2">1 order</div>',
        card(row('<div class="gr"><div class="h3">Amara\'s Grill</div><div class="sm">EA-3XQY-CTLWTP</div></div>', pill("ready","ok")))))
add("9.2","Recovery — nothing found",
    hd("Your tickets") + bd(empty("🎫","No tickets on this address","You may have bought with a different email.")))
add("9.3","Recovery — link expired",
    hd("Your tickets") + bd(empty("⏳","That link has expired","Recovery links last 30 minutes for your safety."), btn("Send a new link")))

open("out_a.html","w").write("".join(S))
print(f"section A: {len(S)} screens")
