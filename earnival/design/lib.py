"""Shared tokens and component helpers for the Earnival screen set.

Every screen is real HTML/CSS using the product's actual brand tokens, laid out
at device size. Figma's html.to.design plugin turns each frame into editable
auto-layout with real text layers — not a flattened image.
"""

T = dict(
    night="#1C1030", flame="#FF5E1A", marigold="#FFB020", plum="#5B2A9E",
    paper="#FAF6EF", line="#E9E2D6", mute="#6E6578", leaf="#1F6F44",
    haze="#F0EAE0", fog="#B9AFC6", white="#FFFFFF",
    gap="#9E1B32", gapwash="#F8E6E9", leafwash="#E4F1E9", warnwash="#FFF3D6",
    warnink="#8A5A00",
)

CSS = """
*{box-sizing:border-box;margin:0;padding:0}
body{background:#2A2438;font-family:'Instrument Sans',system-ui,sans-serif;padding:60px 40px}
.sec{margin:0 0 56px}
.sec>h2{color:#fff;font-size:26px;font-weight:800;letter-spacing:-.02em;margin:0 0 6px}
.sec>p{color:#B9AFC6;font-size:14px;margin:0 0 26px;max-width:80ch}
.grid{display:flex;flex-wrap:wrap;gap:34px;align-items:flex-start}
.frame{display:flex;flex-direction:column;gap:9px}
.cap{color:#B9AFC6;font-size:12px;font-weight:600;letter-spacing:.04em}
.cap b{color:#FF9E6B;font-family:ui-monospace,monospace;font-weight:700;margin-right:7px}
.scr{background:%(paper)s;overflow:hidden;position:relative;
     display:flex;flex-direction:column;flex:none}
.phone{width:390px;height:844px;border-radius:26px}
.desk{width:1100px;height:760px;border-radius:14px}
.hd{display:flex;align-items:center;gap:12px;padding:17px 20px;
    border-bottom:1px solid %(line)s;flex:none}
.hd .bk{font-size:19px;color:%(night)s}
.hd h1{font-size:17px;font-weight:800;color:%(night)s;letter-spacing:-.02em}
.bd{padding:18px 20px;display:flex;flex-direction:column;gap:14px;overflow:hidden}
.bd.dk{padding:26px 34px;gap:18px}
.h2{font-size:19px;font-weight:800;color:%(night)s;letter-spacing:-.02em}
.h3{font-size:15px;font-weight:700;color:%(night)s}
.p{font-size:14px;color:%(mute)s;line-height:1.5}
.sm{font-size:12.5px;color:%(mute)s;line-height:1.45}
.card{background:%(white)s;border:1px solid %(line)s;border-radius:14px;padding:14px 16px;
      display:flex;flex-direction:column;gap:9px}
.row{display:flex;align-items:center;gap:12px}
.gr{flex:1;min-width:0}
.mono{font-family:'Space Mono',ui-monospace,monospace;font-weight:700;color:%(night)s}
.btn{border-radius:18px;padding:15px 22px;font-size:15px;font-weight:600;text-align:center;
     min-height:48px;display:flex;align-items:center;justify-content:center}
.b-pri{background:%(flame)s;color:#fff}
.b-sec{background:%(marigold)s;color:%(night)s}
.b-qui{background:%(haze)s;color:%(night)s}
.b-dis{background:%(haze)s;color:%(fog)s}
.pill{display:inline-flex;padding:5px 10px;border-radius:999px;font-size:12px;font-weight:700;
      letter-spacing:.06em}
.fld{display:flex;flex-direction:column;gap:6px}
.fld label{font-size:12px;font-weight:700;color:%(mute)s;letter-spacing:.08em}
.fld .in{background:#fff;border:1px solid %(line)s;border-radius:14px;padding:15px 16px;
         font-size:15px;color:%(fog)s;min-height:52px;display:flex;align-items:center}
.fld .in.fill{color:%(night)s}
.fld .in.err{border-color:%(gap)s}
.fld .er{font-size:12.5px;color:%(gap)s;font-weight:600}
.dark{background:%(night)s;border-radius:14px;padding:18px;display:flex;flex-direction:column;gap:4px}
.dark .lb{font-size:12.5px;color:%(fog)s}
.dark .vl{font-family:'Space Mono',monospace;font-size:26px;font-weight:700;color:#fff}
.note{border-radius:12px;padding:12px 14px;font-size:13px;line-height:1.45}
.n-warn{background:%(warnwash)s;color:%(warnink)s}
.n-err{background:%(gapwash)s;color:%(gap)s}
.n-ok{background:%(leafwash)s;color:%(leaf)s}
.empty{display:flex;flex-direction:column;align-items:center;gap:9px;padding:46px 20px;text-align:center}
.empty .ic{width:52px;height:52px;border-radius:16px;background:%(haze)s;
           display:flex;align-items:center;justify-content:center;font-size:22px}
.empty .t{font-size:15px;font-weight:700;color:%(night)s}
.empty .s{font-size:13px;color:%(mute)s;max-width:30ch;line-height:1.45}
.stat{background:#fff;border:1px solid %(line)s;border-radius:14px;padding:13px 15px;flex:1;
      display:flex;flex-direction:column;gap:3px}
.stat .k{font-size:11.5px;font-weight:700;color:%(mute)s;letter-spacing:.08em}
.stat .v{font-size:23px;font-weight:800;color:%(night)s}
.stat .n{font-size:12px;color:%(mute)s}
.skel{background:%(haze)s;border-radius:8px;height:14px}
.qr{width:150px;height:150px;background:
    repeating-conic-gradient(%(night)s 0 25%%, #fff 0 50%%) 0 0/16px 16px;
    align-self:center;border-radius:4px}
""" % T


def esc(s):
    return (str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def screen(sid, title, inner, kind="phone"):
    return (f'<div class="frame"><div class="cap"><b>{esc(sid)}</b>{esc(title)}</div>'
            f'<div class="scr {kind}">{inner}</div></div>')


def hd(t):
    return f'<div class="hd"><span class="bk">‹</span><h1>{esc(t)}</h1></div>'


def bd(*parts, dark=False):
    return f'<div class="bd{" dk" if dark else ""}">' + "".join(parts) + "</div>"


def pill(text, tone="mute"):
    tones = dict(
        ok=(T["leafwash"], T["leaf"]), warn=(T["warnwash"], T["warnink"]),
        bad=(T["gapwash"], T["gap"]), mute=(T["haze"], T["mute"]),
        plum=("#EFE8FA", T["plum"]),
    )
    b, f = tones[tone]
    return f'<span class="pill" style="background:{b};color:{f}">{esc(text.upper())}</span>'


def btn(label, kind="pri"):
    return f'<div class="btn b-{kind}">{esc(label)}</div>'


def field(label, value="", placeholder="", error=None):
    cls = "in fill" if value else "in"
    if error:
        cls += " err"
    txt = value or placeholder
    er = f'<div class="er">{esc(error)}</div>' if error else ""
    return (f'<div class="fld"><label>{esc(label)}</label>'
            f'<div class="{cls}">{esc(txt)}</div>{er}</div>')


def note(text, tone="warn"):
    return f'<div class="note n-{tone}">{text}</div>'


def empty(icon, title, sub):
    return (f'<div class="empty"><div class="ic">{icon}</div>'
            f'<div class="t">{esc(title)}</div><div class="s">{esc(sub)}</div></div>')


def stat(k, v, n=""):
    return (f'<div class="stat"><div class="k">{esc(k)}</div><div class="v">{esc(v)}</div>'
            f'<div class="n">{esc(n)}</div></div>')


def card(*inner):
    return '<div class="card">' + "".join(inner) + "</div>"


def row(*inner):
    return '<div class="row">' + "".join(inner) + "</div>"


def money(v):
    return f'<span class="mono">{esc(v)}</span>'


def darkbox(label, value, sub=""):
    s = f'<div class="lb">{esc(sub)}</div>' if sub else ""
    return (f'<div class="dark"><div class="lb">{esc(label)}</div>'
            f'<div class="vl">{esc(value)}</div>{s}</div>')
