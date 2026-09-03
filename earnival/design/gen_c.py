"""Sections D–F — vendor, admin, legal, system. 33 states."""
from lib import *
S = []
def add(sid, title, inner, kind="phone"):
    S.append(screen(sid, title, inner, kind))
def dk(*p): return bd(*p, dark=True)

GROSS = darkbox("Gross sales","₦196,500","Awaiting settlement ₦171,937.50")
VSPLIT = card(row('<div class="gr h3">Gross sales</div>', money("₦196,500")),
    row('<div class="gr p">Earnival service charge (7.5%)</div>', money("−₦14,737.50")),
    row('<div class="gr p">Organiser share (connection)</div>', money("−₦9,825")),
    '<div style="height:2px;background:#1C1030"></div>',
    row('<div class="gr" style="color:#1F6F44;font-weight:700;font-size:12px;letter-spacing:.06em">YOUR NET</div>',
        '<span class="mono" style="color:#1F6F44;font-size:16px">₦171,937.50</span>'))
PRODS = "".join(card(row(f'<div class="gr"><div class="h3">{n}</div><div class="sm">{s} left · {p}</div></div>',
    '<div class="sm" style="color:#5B2A9E;font-weight:600">Edit</div>'))
    for n,s,p in [("Asun Tacos (3)","35","₦4,000"),("Chilled Zobo","90","₦1,500"),("Suya Platter","29","₦6,500")])

# ── D1 shop console (11) ──────────────────────────────────────────────
add("19.1","Vendor console — populated", hd("Amara's Grill") + dk(GROSS,
    '<div class="h3">Your sales, split</div>', VSPLIT, '<div class="h3">Products</div>', PRODS), "desk")
add("19.2","Vendor — no shop yet", hd("Your shop") + dk(
    empty("🏪","You don't have a shop yet","A shop is permanent — its own link and QR, and it survives every event it connects to."),
    btn("Create a shop")), "desk")
add("19.3","Vendor — blocked below L1", hd("Your shop") + dk(
    note("Verify your phone number to open a shop. It takes about a minute and unlocks connecting to events too.","warn"),
    btn("Verify my phone")), "desk")
add("19.4","Vendor — no products", hd("Amara's Grill") + dk(darkbox("Gross sales","₦0","Nothing sold yet"),
    '<div class="h3">Products</div>',
    empty("📦","No products listed yet","Your shop goes live the moment you add the first one.", ), btn("Add a product")), "desk")
add("19.5","Vendor — no orders", hd("Amara's Grill") + dk(GROSS, '<div class="h3">Orders</div>',
    empty("🧾","No orders yet — connect to an event and they land here","Ask an organiser, or request a connection yourself.")), "desk")
add("19.6","Vendor — draft shop", hd("Amara's Grill") + dk(row(pill("draft","mute")),
    note("Your shop is in draft. Add one product and it goes live with its own link and QR.","warn"),
    btn("Add your first product")), "desk")
add("19.7","Vendor — connection request", hd("Amara's Grill") + dk('<div class="h3">Connect to an event</div>',
    field("EVENT","Rooftop Sundowner"),
    '<div class="k sm" style="font-weight:700;letter-spacing:.08em">SHARE YOU OFFER THE ORGANISER: 5%</div>',
    '<div style="height:8px;border-radius:999px;background:#E9E2D6;position:relative">'
    '<div style="width:28%;height:8px;border-radius:999px;background:#5B2A9E"></div></div>',
    note("On a ₦10,000 sale you keep ₦8,750 after the 7.5% service charge and this share.","ok"),
    btn("Send connection request")), "desk")
def ordercard(status, tone, action):
    return card(row(money("EA-3XQY-CTLWTP"), '<div class="gr"></div>', pill(status, tone)),
        '<div class="sm">Kelechi Obi · Suya Platter ×1 · ₦6,597.50</div>', action)
add("19.8","Vendor — order lifecycle", hd("Amara's Grill") + dk('<div class="h3">Orders · 3 open</div>',
    ordercard("paid","ok",'<div class="btn b-pri" style="min-height:42px;font-size:14px">Start preparing</div>'),
    ordercard("preparing","warn",'<div class="btn b-pri" style="min-height:42px;font-size:14px">Mark ready — send pickup code</div>'),
    ordercard("ready","ok",'<div class="btn b-qui" style="min-height:42px;font-size:14px">Enter pickup code to complete</div>')), "desk")
add("19.9","Vendor — pickup code mismatch", hd("Amara's Grill") + dk(
    card(row(money("EA-3XQY-CTLWTP"), '<div class="gr"></div>', pill("ready","ok")),
         field("BUYER'S PICKUP CODE","PK-1111","",error="That pickup code doesn't match"),
         '<div class="btn b-dis" style="min-height:44px">Complete order</div>')), "desk")
add("19.10","Vendor — refund an order", hd("Amara's Grill") + dk(
    card('<div class="h2">Refund this order?</div>',
         '<div class="sm">EA-3XQY-CTLWTP · Kelechi Obi · ₦6,597.50</div>',
         row('<div class="btn b-pri gr" style="min-height:42px;font-size:14px">Full — ₦6,597.50</div>',
             '<div class="btn b-qui gr" style="min-height:42px;font-size:14px">Partial</div>'),
         note("The buyer is made whole. We return our service charge and the organiser's share; the processor keeps its fee and Earnival absorbs it. Stock returns to your shelf.","ok"),
         row('<div class="btn b-qui gr">Cancel</div>',
             '<div class="btn gr" style="background:#9E1B32;color:#fff">Refund</div>'))), "desk")
add("19.11","Vendor — low stock alert", hd("Amara's Grill") + dk(
    note("Suya Platter is down to 4 — below your alert threshold of 5.","warn"),
    card(row('<div class="gr"><div class="h3">Suya Platter</div><div class="sm">4 left · ₦6,500</div></div>',
             '<div class="btn b-sec" style="padding:9px 16px;min-height:38px;font-size:13px">Restock</div>'))), "desk")

# ── D2 verification (10) ──────────────────────────────────────────────
def ladder(cur):
    rows = [("L0 · Email verified","Unlimited free events · paid events reviewed","#E4F1E9","DONE"),
            ("L1 · Phone verified","Paid events publish instantly · open a shop · ₦1m","#E4F1E9","DONE"),
            ("L2 · Identity verified","₦5m per event · daily settlement","#FFF3D6","NEXT"),
            ("L3 · Business verified","Unlimited revenue · verified badge","#F0EAE0","")]
    out = []
    for i,(n,d,bg,tag) in enumerate(rows):
        done = i < cur
        nxt = i == cur
        b = "#E4F1E9" if done else ("#FFF3D6" if nxt else "#F0EAE0")
        t = "DONE" if done else ("NEXT" if nxt else "")
        tg = f'<div class="sm" style="font-weight:700;letter-spacing:.08em">{t}</div>' if t else ""
        out.append(f'<div style="background:{b};border-radius:14px;padding:13px 16px;display:flex;align-items:center;gap:12px">'
                   f'<div class="gr"><div class="h3">{esc(n)}</div><div class="sm">{esc(d)}</div></div>{tg}</div>')
    return "".join(out)
for lvl, name, cap in [(0,"L0 · Email verified","₦500,000"),(1,"L1 · Phone verified","₦1,000,000"),
                        (2,"L2 · Identity verified","₦5,000,000"),(3,"L3 · Business verified","Unlimited")]:
    add(f"20.{lvl+1}", f"Verification — {name}",
        hd("Verification") + dk(darkbox("Your level", name, f"Revenue per event: {cap}"), ladder(lvl+1)), "desk")
add("20.5","Verification — pending review", hd("Verification") + dk(
    darkbox("Your level","L1 · Phone verified","Revenue per event: ₦1,000,000"),
    note("Your BVN is with our reviewers. Most decisions land within a few hours and we'll email you either way.","warn"),
    card(row('<div class="gr"><div class="h3">BVN ••••5678</div><div class="sm">Submitted 10 Aug</div></div>', pill("pending","warn")))), "desk")
add("20.6","Verification — rejected", hd("Verification") + dk(
    darkbox("Your level","L1 · Phone verified","Revenue per event: ₦1,000,000"),
    note("We couldn't verify that BVN. The name didn't match the one on your account. Check it and submit again.","err"),
    card(row('<div class="gr"><div class="h3">BVN ••••5678</div><div class="sm">Reviewed 11 Aug</div></div>', pill("rejected","bad"))),
    btn("Submit again")), "desk")
add("20.7","Verification — BVN form", hd("Verification") + dk('<div class="h2">Verify your identity</div>',
    '<div class="p">Raises your limit to ₦5m per event and switches you to daily settlement.</div>',
    row('<div class="btn b-pri" style="padding:9px 18px;min-height:38px;font-size:13px">BVN</div>',
        '<div class="btn b-qui" style="padding:9px 18px;min-height:38px;font-size:13px">NIN</div>'),
    field("BVN (11 DIGITS)","","12345678901"),
    card(row('<div style="width:22px;height:22px;border-radius:6px;border:1px solid #E9E2D6;background:#fff"></div>',
             '<div class="gr sm">I agree to Earnival processing my BVN to verify my identity, as described in the privacy policy.</div>')),
    btn("Submit for review"),
    '<div class="sm">Encrypted before storage with a key held separately from the database. Only the last four digits are ever displayed.</div>'), "desk")
add("20.8","Verification — CAC + TIN", hd("Verification") + dk('<div class="h2">Verify your business</div>',
    field("REGISTERED BUSINESS NAME","Amara Foods Ltd"), field("CAC REGISTRATION NUMBER","RC 1234567"),
    field("TIN","01234567-0001"), btn("Submit for review")), "desk")
add("20.9","Verification — phone OTP", hd("Verification") + dk('<div class="h2">Verify your phone</div>',
    '<div class="p">We sent a code to +234 802 000 0000.</div>', field("SIX-DIGIT CODE","","••••••"),
    btn("Verify"), btn("Send again","qui")), "desk")
add("20.10","Verification — sequential block", hd("Verification") + dk(
    note("Verify your phone first. The levels are sequential — identity evidence without a verified phone doesn't grant L2.","warn"),
    ladder(1), btn("Verify my phone")), "desk")

# ── E admin (7) ───────────────────────────────────────────────────────
add("21.1","Admin — queue", hd("Admin") + dk('<div class="h2">Needs review</div>',
    card(row('<div class="gr"><div class="h3">Rooftop Sundowner</div><div class="sm">Paid event · L0 organiser · ₦8,000 tickets</div></div>', pill("pending","warn"))),
    '<div class="h3">KYC submissions</div>',
    card(row('<div class="gr"><div class="h3">BVN ••••5678</div><div class="sm">Amara Nwosu · submitted 10 Aug</div></div>', pill("pending","warn"))),
    '<div class="h3">Money needing attention</div>',
    card(row('<div class="gr"><div class="h3">Refund reversed, cash did not move</div><div class="sm">EA-3XQY · ₦6,597.50</div></div>', pill("critical","bad")))), "desk")
add("21.2","Admin — empty queue", hd("Admin") + dk(
    empty("✅","Nothing needs review","Paid events from new organisers and KYC submissions land here.")), "desk")
add("21.3","Admin — approve or reject", hd("Admin") + dk(
    card('<div class="h2">Rooftop Sundowner</div>',
         '<div class="sm">L0 organiser · 200 tickets at ₦8,000 · 4 January, Ikoyi</div>',
         field("REASON (IF DECLINING)","","Tell them what to fix"),
         row('<div class="btn gr" style="background:#9E1B32;color:#fff">Decline</div>',
             '<div class="btn b-pri gr">Approve</div>'),
         note("Either way the organiser is emailed straight away, with your reason if you decline.","ok"))), "desk")
add("21.4","Admin — KYC review", hd("Admin") + dk(
    card('<div class="h2">Identity review</div>',
         row('<div class="gr p">Submitted</div>','<span class="mono">BVN ••••5678</span>'),
         row('<div class="gr p">Account name</div>','<div class="h3">Amara Nwosu</div>'),
         note("Only the last four digits are ever shown — to you as much as to them. The full identifier is encrypted under a key held separately from the database.","ok"),
         row('<div class="btn gr" style="background:#9E1B32;color:#fff">Reject</div>',
             '<div class="btn b-pri gr">Approve</div>'))), "desk")
add("21.5","Admin — failed webhooks", hd("Admin") + dk('<div class="h3">Unprocessable webhooks</div>',
    card(row('<div class="gr"><span class="mono">charge.success</span>'
             '<div class="sm">EA-3XQY-CTLWTP · failed twice · 11 Aug 14:02</div></div>',
             '<div class="btn b-sec" style="padding:9px 16px;min-height:38px;font-size:13px">Replay</div>')),
    note("Replay is safe: settlement is idempotent, so a delivery that already succeeded is a no-op rather than a double credit.","ok")), "desk")
add("21.6","Admin — refunds needing attention", hd("Admin") + dk(
    note("A refund reversed in the ledger but the cash did not move. Someone is owed money and does not have it — this is the highest-priority state in the product.","err"),
    card(row('<div class="gr"><span class="mono">EA-3XQY-CTLWTP</span>'
             '<div class="sm">₦6,597.50 · Kelechi Obi · flagged 11 Aug</div></div>', pill("critical","bad")))), "desk")
add("21.7","Admin — access refused", hd("Admin") + dk(
    empty("🔒","Not authorised","This console is for Earnival staff.")), "desk")

# ── F legal & system (5) ──────────────────────────────────────────────
LEGAL = lambda t, s: hd(t) + bd(f'<div class="h2">{esc(t)}</div>',
    '<div class="sm">Version 1.0 · last updated 10 August 2026</div>',
    *[f'<div class="h3">{esc(h)}</div><div class="p">{esc(b)}</div>' for h,b in s])
add("22.1","Terms of service", LEGAL("Terms of service", [
    ("What we charge","A service charge of 7.5% is deducted from the seller on each transaction. Processing fees are added to the buyer's total and shown before payment. No listing fee."),
    ("Refunds","The buyer is made whole. We return our service charge and the organiser's share; the processor keeps its fee and Earnival absorbs it."),
    ("Seller obligations","You are responsible for fulfilling what you sell, and for the accuracy of what you list.")]))
add("23.1","Privacy policy", LEGAL("Privacy policy", [
    ("What we collect","Name, email and phone at checkout. For sellers reaching Level 2, a BVN or NIN."),
    ("How identity data is held","Encrypted at rest under a key held separately from the database. Only the last four digits are ever displayed — to you or to our reviewers."),
    ("Your rights","Under the NDPR you may request access to, correction of, or erasure of your personal data.")]))
add("24.1","404 — not found", hd("Not found") + bd(
    empty("🔍","We can't find that page","The link may be wrong, or the thing it pointed at may have been taken down."),
    btn("Go to Earnival","qui")))
add("25.1","500 — server error", hd("Something broke") + bd(
    empty("⚠️","Something went wrong on our side","We've been told automatically. Nothing you were doing has been charged or lost."),
    btn("Try again"), btn("Find my ticket","qui")))
add("26.1","Offline", hd("Offline") + bd(
    empty("📡","You're offline","Your ticket still works — the QR and code are stored on this phone. Show them at the gate."),
    note("If you're on the door: keep scanning. Scans queue on this phone and sync when signal returns.","warn")))

open("out_c.html","w").write("".join(S))
print(f"sections D–F: {len(S)} screens")
