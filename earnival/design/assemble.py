from lib import CSS

A = open("out_a.html").read()
B = open("out_b.html").read()
C = open("out_c.html").read()

SECTIONS = [
    ("A · Public and buyer", "53 states. Everything a person who has never signed in can reach — including every way it can go wrong.", A),
    ("B and C · Auth, and the organiser", "50 states. Sign-in failures, the team, and all eleven states of the door scanner.", B),
    ("D, E and F · Vendor, admin, legal and system", "33 states. The shop console, the verification ladder, the admin queue, and the pages nobody plans for.", C),
]

body = "".join(
    f'<div class="sec"><h2>{t}</h2><p>{d}</p><div class="grid">{html}</div></div>'
    for t, d, html in SECTIONS
)

page = f"""<title>Earnival — All Screens</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>{CSS}
.intro{{color:#fff;max-width:74ch;margin:0 0 46px}}
.intro h1{{font-size:34px;font-weight:800;letter-spacing:-.03em;margin:0 0 10px}}
.intro h1 i{{color:#FF5E1A;font-style:normal}}
.intro p{{color:#B9AFC6;font-size:15px;line-height:1.6;margin:0 0 12px}}
.intro code{{background:#1C1030;padding:2px 7px;border-radius:5px;font-size:13px;color:#FFB020}}
.intro ol{{color:#B9AFC6;font-size:15px;line-height:1.7;padding-left:20px}}
.intro b{{color:#fff}}
</style>

<div class="intro">
  <h1>earn<i>i</i>val — every screen</h1>
  <p><b>136 states across 26 surfaces.</b> Not just the happy path: every failure, every empty
  state, every way a payment, a scan or a payout can go wrong. Derived from the codebase —
  routes from the app, states from the database enums, failure copy from the actual thrown errors.</p>
  <p>These are real HTML frames at device size using the product's own brand tokens, not images.</p>
  <p><b>To get them into Figma, editable:</b></p>
  <ol>
    <li>Install the <b>html.to.design</b> plugin in Figma (free tier covers this)</li>
    <li>Run it, choose <b>Import from URL</b>, and paste this page's URL</li>
    <li>Every frame arrives as auto-layout with live text layers, real colours and real type —
    editable, not flattened</li>
  </ol>
  <p>Phone frames are 390×844. Console frames are 1100×760.</p>
</div>

{body}
"""
open("all-screens.html", "w").write(page)
print(f"assembled: {len(page)/1024:.0f} KB")
