"""Sections B–F — auth, organiser, vendor, admin, system. 83 states."""
from lib import *
S = []
def add(sid, title, inner, kind="phone"):
    S.append(screen(sid, title, inner, kind))
def dk(*p): return bd(*p, dark=True)

# ── B1 sign in (7) ────────────────────────────────────────────────────
def signin(*extra):
    return hd("Sign in") + bd(*extra)
add("10.1","Sign in — email", signin('<div class="h2">Sign in</div>',
    '<div class="p">We email you a six-digit code. No passwords, ever.</div>',
    field("EMAIL","","you@mail.com"), btn("Send me a code")))
add("10.2","Sign in — code entry", signin('<div class="h2">Check your email</div>',
    '<div class="p">We sent a code to bolu@mail.com. It expires in 10 minutes.</div>',
    field("SIX-DIGIT CODE","","••••••"), btn("Sign in"), btn("Use a different email","qui")))
add("10.3","Sign in — wrong code", signin('<div class="h2">Check your email</div>',
    field("SIX-DIGIT CODE","418322","",error="That code isn't right. 4 attempts left."), btn("Sign in")))
add("10.4","Sign in — code expired", signin('<div class="h2">Check your email</div>',
    note("That code expired. Codes last 10 minutes.","err"), btn("Send a new code")))
add("10.5","Sign in — too many attempts", signin('<div class="h2">Check your email</div>',
    note("Too many attempts. Request a new code.","err"), btn("Send a new code")))
add("10.6","Sign in — too many codes", signin('<div class="h2">Sign in</div>',
    note("Too many codes requested. Try again in a few minutes.","err"),
    field("EMAIL","bolu@mail.com"), btn("Send me a code","dis")))
add("10.7","Sign in — send failed", signin('<div class="h2">Sign in</div>',
    note("We couldn't send that code. Try again shortly — if it keeps happening, tell us.","err"),
    field("EMAIL","bolu@mail.com"), btn("Try again")))

# ── B2 invitations (2) ────────────────────────────────────────────────
add("11.1","Invitations — pending", hd("Invitations") + bd(
    card(row('<div class="gr"><div class="h3">Gidi Groove</div><div class="sm">Door staff · check guests in</div></div>', pill("pending","warn")),
         row('<div class="btn b-qui gr" style="min-height:42px;font-size:14px">Decline</div>',
             '<div class="btn b-pri gr" style="min-height:42px;font-size:14px">Accept</div>'))))
add("11.2","Invitations — none", hd("Invitations") + bd(
    empty("✉️","No invitations","When an organiser adds you to an event, it appears here.")))

# ── C1 dashboard (3) ──────────────────────────────────────────────────
add("12.1","Organiser console — events", hd("Your events") + dk('<div class="h2">Your events</div>',
    card(row('<div class="gr"><div class="h3">Gidi Groove</div><div class="sm">19 Dec · 44/600 sold</div></div>',
             money("₦726,125"), pill("live","warn"))),
    card(row('<div class="gr"><div class="h3">Lagos Art Week</div><div class="sm">4 Jan · 0/200 sold</div></div>',
             money("₦0"), pill("live","warn"))),
    btn("Create an event")), "desk")
add("12.2","Organiser console — empty", hd("Your events") + dk(
    empty("🎪","No events yet","Create one and you get a link that sells tickets and hosts your vendors."),
    btn("Create an event")), "desk")
add("12.3","Organiser console — door staff", hd("Gidi Groove") + dk(
    note("You're on the door team for this event. Head to the scanner — revenue is only visible to the organiser.","warn"),
    btn("Open the scanner")), "desk")

# ── C2 create event (4) ───────────────────────────────────────────────
FORM = (field("EVENT NAME","Gidi Groove — Detty December Block Party") +
        field("VENUE","Landmark Beach, Oniru, Lagos") + field("STARTS","19 December 2026, 13:00"))
add("13.1","Create event — form", hd("New event") + dk('<div class="h2">Create an event</div>', FORM,
    '<div class="h3">Ticket types</div>',
    card(row(field("NAME","Regular"), field("PRICE","₦15,000"), field("QUANTITY","500"))),
    btn("Publish")), "desk")
add("13.2","Create event — validation", hd("New event") + dk('<div class="h2">Create an event</div>',
    field("EVENT NAME","","Name your event", error="Give the event a name"),
    field("VENUE","Landmark Beach, Oniru, Lagos"),
    field("STARTS","","Pick a date", error="Events need a start date"), btn("Publish","dis")), "desk")
add("13.3","Create event — pending review", hd("New event") + dk(
    note("Paid events from new organisers get a quick check first. We'll email you the moment it's approved — usually within a few hours.","warn"),
    FORM, btn("Submit for review","sec")), "desk")
add("13.4","Create event — shop blocked below L1", hd("New shop") + dk(
    note("Verify your phone number to open a shop. It takes about a minute.","warn"),
    '<div class="p">Level 1 unlocks shops, connecting to events, and instant publishing on paid events.</div>',
    btn("Verify my phone")), "desk")

# ── C3 event detail (7) ───────────────────────────────────────────────
REV = darkbox("Ticket revenue (net)","₦726,125","21/44 checked in · Shop GMV ₦196,500 · 44/600 sold")
FUNNEL = row(stat("OPENED","431","217 people"), stat("STARTED","94","21.8% of opens"), stat("BOUGHT","44","10.2% of opens"))
SPLIT = card('<div style="background:#1C1030;margin:-14px -16px 0;padding:13px 16px;border-radius:14px 14px 0 0">'
    '<div style="color:#FFB020;font-size:12px;font-weight:700;letter-spacing:.08em">SETTLEMENT SPLIT</div>'
    '<div style="color:#fff;font-size:15px;font-weight:700">If they sell a ₦12,000 item</div></div>',
    row('<div class="gr h3">Sale</div>', money("₦12,000")),
    row('<div class="gr p">Service charge (7.5%)</div>', money("−₦900")),
    row('<div class="gr p">Your share (7%)</div>', money("₦840")),
    row('<div class="gr" style="color:#1F6F44;font-weight:700;font-size:12px;letter-spacing:.06em">VENDOR SETTLES T+1</div>',
        '<span class="mono" style="color:#1F6F44">₦10,260</span>'))
add("14.1","Event — populated", hd("Gidi Groove") + dk(REV, '<div class="h3">How your link is doing</div>', FUNNEL), "desk")
add("14.2","Event — no traffic yet", hd("Gidi Groove") + dk(darkbox("Ticket revenue (net)","₦0","0/600 tickets sold"),
    '<div class="h3">How your link is doing</div>',
    empty("📈","Nobody has opened your event page yet","Share the link and this fills in.")), "desk")
add("14.3","Event — no guests", hd("Gidi Groove") + dk(REV, '<div class="h3">Guests</div>',
    empty("👥","No guests yet — share your link and watch this fill up","Every ticket sold appears here with a check-in code.")), "desk")
add("14.4","Event — no shops", hd("Gidi Groove") + dk(REV, '<div class="h3">Shops</div>',
    empty("🛍","No shops connected yet","Vendors request a connection; you set the revenue share before accepting.")), "desk")
add("14.5","Event — connection request", hd("Gidi Groove") + dk(REV, '<div class="h3">Connection requests</div>',
    card(row('<div class="gr h3">Lagos Threads → your event</div>', pill("request","warn")), SPLIT,
         row('<div class="btn b-qui gr" style="min-height:44px">Decline</div>',
             '<div class="btn b-pri gr" style="min-height:44px">Accept</div>'))), "desk")
add("14.6","Event — lone door staff warning", hd("Gidi Groove") + dk(
    note("You're the only one who can scan tickets. On the night that means one phone on the gate — and check-in stops if there's a second entrance.","warn"),
    REV, btn("Add door staff","sec")), "desk")
add("14.7","Event — cancelled", hd("Gidi Groove") + dk(
    note("You cancelled this event on 12 December. 44 tickets and 31 orders were refunded, totalling ₦923,062.50.","err"),
    darkbox("Refunded","₦923,062.50","All buyers were emailed")), "desk")

# ── C4 edit event (4) ─────────────────────────────────────────────────
add("15.1","Edit event — form", hd("Edit event") + dk('<div class="h2">Edit event</div>', FORM, btn("Save changes")), "desk")
add("15.2","Edit event — capacity blocked", hd("Edit event") + dk(
    card(field("QUANTITY","40","",error="44 tickets are already sold or held. Capacity can't go below that.")),
    btn("Save changes","dis")), "desk")
add("15.3","Edit event — reprice", hd("Edit event") + dk(card(field("PRICE","₦18,000")),
    note("Repricing applies to future sales only. The 44 tickets already sold keep the price they were bought at.","ok"),
    btn("Save changes")), "desk")
add("15.4","Edit event — notify holders", hd("Edit event") + dk(
    '<div class="h2">Tell your ticket holders?</div>',
    '<div class="p">You changed the venue. 44 people are holding tickets.</div>',
    field("ADD A NOTE (OPTIONAL)","","We've moved to a bigger space — same time."),
    row('<div class="btn b-qui gr">Skip</div>','<div class="btn b-pri gr">Email 44 people</div>')), "desk")

# ── C5 team (5) ───────────────────────────────────────────────────────
CAPS = card(*[row(f'<div class="gr p">{c}</div>',
    '<div style="width:22px;height:22px;border-radius:6px;background:%s"></div>' % ("#5B2A9E" if i==0 else "#fff;border:1px solid #E9E2D6"))
    for i,c in enumerate(["Check guests in","Edit the event","Accept and manage shops","Issue refunds"])])
add("16.1","Team — nobody else", hd("Event team") + dk(
    '<div class="p">One phone at the gate isn\'t enough. Add door staff so more than one person can check guests in, and cohosts if someone earns a share.</div>',
    card(row('<div class="gr"><div class="k sm" style="letter-spacing:.08em;font-weight:700">ORGANISER</div>'
             '<div class="h3">Emeka Ugochukwu</div><div class="sm">Full access · owns the event</div></div>')),
    '<div class="h3">On the team</div>',
    empty("🚪","Nobody else yet","On the night, only you can scan tickets.")), "desk")
add("16.2","Team — members listed", hd("Event team") + dk('<div class="h3">On the team</div>',
    card(row('<div class="gr"><div class="h3">Seyi Bankole</div><div class="sm">Door staff · check in</div></div>', pill("accepted","ok"))),
    card(row('<div class="gr"><div class="h3">Ify Okonkwo</div><div class="sm">Cohost · 5% of ticket revenue</div></div>', pill("pending","warn"))),
    card(row('<div class="gr" style="opacity:.55"><div class="h3">Chidera Umeh</div><div class="sm">Door staff</div></div>', pill("revoked","bad")))), "desk")
add("16.3","Team — invite form", hd("Event team") + dk('<div class="h3">Add someone</div>',
    field("THEIR EMAIL","","doorstaff@mail.com"),
    row('<div class="btn b-pri" style="padding:9px 18px;min-height:38px;font-size:13px">Door staff</div>',
        '<div class="btn b-qui" style="padding:9px 18px;min-height:38px;font-size:13px">Cohost</div>'),
    '<div class="k sm" style="font-weight:700;letter-spacing:.08em">WHAT THEY CAN DO</div>', CAPS,
    btn("Send invitation")), "desk")
add("16.4","Team — cohost share", hd("Event team") + dk('<div class="h3">Cohost share</div>',
    row('<div class="btn b-pri" style="padding:9px 18px;min-height:38px;font-size:13px">Percentage</div>',
        '<div class="btn b-qui" style="padding:9px 18px;min-height:38px;font-size:13px">Flat fee</div>'),
    field("SHARE","5%"),
    note("Cohost earnings come out of your line, never the vendor's. Several cohosts can share that line but never overdraw it.","ok"),
    btn("Save")), "desk")
add("16.5","Team — revoke confirm", hd("Event team") + dk(
    card('<div class="h2">Remove Seyi Bankole?</div>',
         '<div class="p">They lose the ability to check anyone in, immediately. Scans they already made are unaffected.</div>',
         row('<div class="btn b-qui gr">Keep them</div>',
             '<div class="btn gr" style="background:#9E1B32;color:#fff">Remove</div>'))), "desk")

# ── C6 scanner (11) ───────────────────────────────────────────────────
COUNT = ('<div class="dark" style="flex-direction:row;align-items:center">'
    '<div class="gr"><div class="lb">Checked in</div>'
    '<div style="font-size:28px;font-weight:800;color:#fff">21<span style="color:#B9AFC6;font-size:17px"> / 44</span></div></div>'
    '<div style="text-align:right"><div class="lb">This session</div>'
    '<div style="font-size:21px;font-weight:800;color:#FFB020">1</div></div></div>')
VIEW = '<div style="background:#1C1030;border-radius:16px;height:200px;display:flex;align-items:center;justify-content:center;color:#6E6578;font-size:13px">Camera preview</div>'
def scan(result):
    return hd("Scan tickets") + bd(COUNT, '<div class="sm">Gidi Groove — Detty December Block Party</div>', result, VIEW)
def res(bg, border, icon, title, sub):
    return (f'<div style="background:{bg};border:2px solid {border};border-radius:16px;padding:20px;'
            'display:flex;flex-direction:column;align-items:center;gap:7px;text-align:center">'
            f'<div style="width:46px;height:46px;border-radius:12px;background:{border};color:#fff;'
            f'display:flex;align-items:center;justify-content:center;font-size:22px">{icon}</div>'
            f'<div class="h2">{esc(title)}</div><div class="sm">{esc(sub)}</div></div>')
add("17.1","Scanner — ready", hd("Scan tickets") + bd(COUNT,
    '<div class="sm">Gidi Groove — Detty December Block Party</div>',
    '<div class="card" style="align-items:center;padding:22px"><div class="p">Ready to scan</div></div>', VIEW, btn("Start camera")))
add("17.2","Scanner — pass", scan(res("#E4F1E9","#1F6F44","✓","Kelechi Obi","Regular · GI-7CFT")))
add("17.3","Scanner — already in", scan(res("#FFF3D6","#8A5A00","!","Already checked in","Kelechi Obi came through at 14:12")))
add("17.4","Scanner — not found", scan(res("#F8E6E9","#9E1B32","✕","Ticket not found","No ticket matches that code")))
add("17.5","Scanner — wrong event", scan(res("#F8E6E9","#9E1B32","✕","That ticket is for a different event","Lagos Art Week, 4 January")))
add("17.6","Scanner — never paid", scan(res("#F8E6E9","#9E1B32","✕","That ticket was never paid for","Payment was abandoned at checkout")))
add("17.7","Scanner — not on door team", hd("Scan tickets") + bd(
    empty("🔒","You're not on the door team for this event","Ask the organiser to add you, then accept the invitation.")))
add("17.8","Scanner — offline queued", hd("Scan tickets") + bd(COUNT,
    note("No signal. 3 scans are queued on this phone and will sync the moment you're back online. Keep scanning.","warn"),
    res("#E4F1E9","#1F6F44","✓","Nneka Eze","Regular · GI-WB45 · queued"), VIEW))
add("17.9","Scanner — syncing", hd("Scan tickets") + bd(COUNT,
    note("Back online — syncing 3 queued scans…","ok"), VIEW))
add("17.10","Scanner — manual entry", hd("Scan tickets") + bd(COUNT, VIEW,
    field("OR TYPE THE CHECK-IN CODE","GI-7CFT"),
    '<div class="sm">It\'s printed on the attendee\'s ticket email.</div>', btn("Check in")))
add("17.11","Scanner — guest search", hd("Scan tickets") + bd(COUNT,
    field("SEARCH","Ade"),
    empty("🔍","No guest matches that","Try a surname, or the code on their ticket.")))

# ── C7 payouts (7) ────────────────────────────────────────────────────
BANK = card(row('<div class="gr"><div class="h3">EMEKA UGOCHUKWU</div>'
    '<div class="sm mono" style="font-weight:400">Guaranty Trust Bank · ••••6789</div></div>', pill("verified","ok")))
add("18.1","Payouts — history", hd("Payouts") + dk(darkbox("Awaiting settlement","₦0","Daily · payouts land T+1. Minimum ₦100."),
    '<div class="h3">Where your money goes</div>', BANK, '<div class="h3">Settlement history</div>',
    card(row('<div class="gr"><span class="mono" style="font-size:17px">₦735,950</span>'
             '<div class="sm">10 Aug – 13 Aug · paid 11 Aug</div></div>', pill("paid","ok")))), "desk")
add("18.2","Payouts — no bank account", hd("Payouts") + dk(darkbox("Awaiting settlement","₦171,937.50","Post-event"),
    note("No bank account yet. Your earnings are safe and waiting — add an account and the next run pays out.","warn"),
    btn("Add a bank account")), "desk")
add("18.3","Payouts — no history", hd("Payouts") + dk(darkbox("Awaiting settlement","₦171,937.50","Post-event"),
    BANK, '<div class="h3">Settlement history</div>',
    empty("💸","No payouts yet","Once your first event finishes, settlements appear here.")), "desk")
add("18.4","Payouts — negative balance", hd("Payouts") + dk(darkbox("Awaiting settlement","−₦4,200","Carried forward"),
    note("Refunds exceeded earnings this period. The shortfall carries forward and is deducted from your next settlement — nothing is owed to us directly.","warn"),
    BANK), "desk")
add("18.5","Payouts — transfer failed", hd("Payouts") + dk(darkbox("Awaiting settlement","₦735,950","Returned to the pool"),
    note("A payout of ₦735,950 was returned by the bank. Your earnings went straight back to the payable pool and a human has been alerted. Check the account details below.","err"),
    BANK, card(row('<div class="gr"><span class="mono" style="font-size:17px">₦735,950</span>'
        '<div class="sm">Attempted 11 Aug</div></div>', pill("failed","bad")))), "desk")
add("18.6","Payouts — add account", hd("Payouts") + dk('<div class="h2">Add a bank account</div>',
    field("BANK","Guaranty Trust Bank"), field("ACCOUNT NUMBER","0123456789"),
    note("We confirm the name with your bank before it can receive anything.","ok"), btn("Verify and add")), "desk")
add("18.7","Payouts — name mismatch", hd("Payouts") + dk('<div class="h2">Add a bank account</div>',
    field("BANK","Guaranty Trust Bank"),
    field("ACCOUNT NUMBER","0123456789","",error="That account belongs to ADEBAYO T. — it must match your own name"),
    btn("Verify and add","dis")), "desk")

open("out_b.html","w").write("".join(S))
print(f"sections B–C: {len(S)} screens")
