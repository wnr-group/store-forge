"""Generates the sample artwork shipped with the six themes (public/themes/<slug>/*.svg).

The pictures are illustrations in each theme's palette, not photography. Replace any file in public/themes/<theme>/ with a
licensed photo of the same name (or update the theme's catalogue) and nothing else changes.
Run from the repo root: python tools/generate-theme-art.py
"""
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "themes")
GRAIN = ('<filter id="n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/>'
         '<feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .09 0"/></filter>')
BLUR = lambda i, s: f'<filter id="{i}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="{s}"/></filter>'


def svg(w, h, defs, body, bg=None):
    grain = f'<rect width="{w}" height="{h}" filter="url(#n)"/>'
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" preserveAspectRatio="xMidYMid slice" role="img" aria-hidden="true">'
            f'<defs>{GRAIN}{defs}</defs>{bg or ""}{body}{grain}</svg>')


def lin(i, a, b, rot=90, stops=None):
    pts = stops or [(0, a), (1, b)]
    s = "".join(f'<stop offset="{o}" stop-color="{c}"/>' for o, c in pts)
    return f'<linearGradient id="{i}" gradientTransform="rotate({rot} .5 .5)">{s}</linearGradient>'


def write(theme, name, content):
    d = os.path.join(OUT, theme)
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, name), "w", encoding="utf-8") as f:
        f.write(content)


def shadow(cx, cy, rx, ry, op=0.25, blur="b1"):
    return f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="#000" opacity="{op}" filter="url(#{blur})"/>'


# ---------------------------------------------------------------- Atelier (fashion): warm editorial
def coat(x, top, h, w, fill, shade):
    return (f'<path d="M{x} {top} l-{w*0.55} {h*0.08} l-{w*0.12} {h*0.92} h{w*1.34} l-{w*0.12} -{h*0.92} z" fill="{fill}"/>'
            f'<path d="M{x} {top} l-{w*0.16} {h*0.18} l{w*0.16} {h*0.1} l{w*0.16} -{h*0.1} z" fill="{shade}" opacity=".28"/>'
            f'<line x1="{x}" y1="{top+h*0.28}" x2="{x}" y2="{top+h*0.92}" stroke="{shade}" stroke-opacity=".18" stroke-width="3"/>'
            f'<path d="M{x-w*0.15} {top-26} q{w*0.15} -34 {w*0.3} 0" fill="none" stroke="#a8a29e" stroke-width="5" stroke-linecap="round"/>')


def atelier():
    defs = lin("bg", "", "", 120, [(0, "#2b1a10"), (0.55, "#6b3a1c"), (1, "#c2691e")]) + lin("arch", "", "", 90, [(0, "#fbeed9"), (1, "#f0cf9f")]) + BLUR("b1", 22) + BLUR("b2", 80)
    rail = ''.join(coat(x, 360, 460, 90, c, "#000") for x, c in [(980, "#faf7f2"), (1100, "#9a3412"), (1220, "#1c1917"), (1340, "#e7e0d6")])
    body = (f'<circle cx="1560" cy="420" r="520" fill="#f59e0b" opacity=".22" filter="url(#b2)"/>'
            f'<path d="M1470 1080 V500 A190 190 0 0 1 1850 500 V1080 Z" fill="url(#arch)"/>'
            f'<circle cx="1660" cy="640" r="70" fill="#b45309" opacity=".9"/>'
            f'<path d="M1470 1080 V500 A190 190 0 0 1 1850 500 V1080 Z" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="3"/>'
            f'<line x1="900" y1="360" x2="1400" y2="360" stroke="#d6c9b8" stroke-width="7" stroke-linecap="round"/>{rail}'
            + shadow(1160, 1040, 420, 30, .35) +
            '<rect y="1000" width="1920" height="80" fill="#000" opacity=".28"/>')
    write("atelier", "hero.svg", svg(1920, 1080, defs, body, '<rect width="1920" height="1080" fill="url(#bg)"/>'))
    defs2 = lin("bg", "", "", 160, [(0, "#efe7da"), (1, "#d9c9b1")]) + lin("arch", "", "", 90, [(0, "#fffaf0"), (1, "#f2e2c8")]) + BLUR("b1", 20)
    body2 = (f'<path d="M260 1500 V560 A340 340 0 0 1 940 560 V1500 Z" fill="url(#arch)"/>'
             f'<circle cx="600" cy="640" r="120" fill="#9a3412" opacity=".9"/>'
             + coat(600, 520, 760, 260, "#1c1917", "#000") + shadow(600, 1440, 360, 34, .3) +
             '<rect y="1400" width="1200" height="100" fill="#8b6f4e" opacity=".22"/>')
    write("atelier", "story.svg", svg(1200, 1500, defs2, body2, '<rect width="1200" height="1500" fill="url(#bg)"/>'))
    write("atelier", "preview.svg", svg(1920, 1080, defs, body, '<rect width="1920" height="1080" fill="url(#bg)"/>'))


# ---------------------------------------------------------------- Voltage (electronics): dark tech
def voltage():
    defs = (lin("bg", "", "", 135, [(0, "#10234f"), (0.6, "#0b1330"), (1, "#050816")]) + lin("scr", "", "", 150, [(0, "#2563eb"), (1, "#06b6d4")])
            + lin("body", "", "", 120, [(0, "#e5e7eb"), (1, "#94a3b8")]) + BLUR("b2", 90) + BLUR("b1", 24)
            + '<pattern id="grid" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M64 0H0V64" fill="none" stroke="#38bdf8" stroke-opacity=".08"/></pattern>')
    rings = ''.join(f'<circle cx="800" cy="500" r="{r}" fill="none" stroke="#38bdf8" stroke-width="2" opacity="{o}"/>' for r, o in [(250, .5), (340, .32), (430, .2), (520, .1)])
    body = ('<rect width="1600" height="1000" fill="url(#grid)"/>'
            '<circle cx="800" cy="500" r="330" fill="#2563eb" opacity=".45" filter="url(#b2)"/>' + rings +
            shadow(800, 930, 220, 26, .5) +
            '<rect x="640" y="170" width="320" height="660" rx="52" fill="url(#body)"/>'
            '<rect x="652" y="182" width="296" height="636" rx="42" fill="#0b1220"/>'
            '<rect x="662" y="192" width="276" height="616" rx="34" fill="url(#scr)"/>'
            '<rect x="748" y="206" width="104" height="26" rx="13" fill="#0b1220"/>'
            '<circle cx="800" cy="470" r="92" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="10"/><circle cx="800" cy="470" r="46" fill="#fff" opacity=".9"/>'
            '<rect x="702" y="640" width="196" height="16" rx="8" fill="#fff" opacity=".7"/><rect x="722" y="676" width="156" height="12" rx="6" fill="#fff" opacity=".4"/>'
            '<path d="M662 192 L938 192 L662 560 Z" fill="#fff" opacity=".12"/>'
            '<rect x="250" y="340" width="230" height="130" rx="22" fill="#fff" opacity=".08" stroke="#fff" stroke-opacity=".25"/><rect x="278" y="372" width="120" height="14" rx="7" fill="#fff" opacity=".6"/><rect x="278" y="404" width="170" height="10" rx="5" fill="#fff" opacity=".3"/>'
            '<rect x="1120" y="560" width="230" height="130" rx="22" fill="#fff" opacity=".08" stroke="#fff" stroke-opacity=".25"/><circle cx="1166" cy="625" r="22" fill="#22d3ee" opacity=".8"/><rect x="1204" y="606" width="110" height="14" rx="7" fill="#fff" opacity=".6"/><rect x="1204" y="634" width="80" height="10" rx="5" fill="#fff" opacity=".3"/>')
    write("voltage", "hero.svg", svg(1600, 1000, defs, body, '<rect width="1600" height="1000" fill="url(#bg)"/>'))
    write("voltage", "preview.svg", svg(1600, 1000, defs, body, '<rect width="1600" height="1000" fill="url(#bg)"/>'))
    defs2 = (lin("bg", "", "", 150, [(0, "#16294f"), (1, "#050816")]) + lin("cup", "", "", 120, [(0, "#f1f5f9"), (1, "#64748b")]) + lin("pad", "", "", 90, [(0, "#1e293b"), (1, "#0f172a")]) + BLUR("b2", 80) + BLUR("b1", 22))
    body2 = ('<circle cx="600" cy="780" r="420" fill="#0891b2" opacity=".35" filter="url(#b2)"/>'
             + shadow(600, 1330, 330, 30, .5) +
             '<path d="M250 860 A350 480 0 0 1 950 860" fill="none" stroke="url(#cup)" stroke-width="56" stroke-linecap="round"/>'
             '<rect x="170" y="800" width="200" height="380" rx="100" fill="url(#cup)"/><rect x="200" y="840" width="140" height="300" rx="70" fill="url(#pad)"/>'
             '<rect x="830" y="800" width="200" height="380" rx="100" fill="url(#cup)"/><rect x="860" y="840" width="140" height="300" rx="70" fill="url(#pad)"/>'
             '<circle cx="270" cy="990" r="22" fill="#22d3ee"/><circle cx="930" cy="990" r="22" fill="#22d3ee"/>'
             '<path d="M120 520 H300 M900 520 H1080" stroke="#38bdf8" stroke-opacity=".4" stroke-width="3"/>')
    write("voltage", "spotlight.svg", svg(1200, 1500, defs2, body2, '<rect width="1200" height="1500" fill="url(#bg)"/>'))


# ---------------------------------------------------------------- Lumiere (beauty): blush, soft glass
def bottle(x, y, w, h, body, cap, label="#fff"):
    return (f'<rect x="{x+w*0.3}" y="{y}" width="{w*0.4}" height="{h*0.16}" rx="{w*0.06}" fill="{cap}"/>'
            f'<rect x="{x}" y="{y+h*0.14}" width="{w}" height="{h*0.86}" rx="{w*0.2}" fill="{body}"/>'
            f'<rect x="{x+w*0.14}" y="{y+h*0.4}" width="{w*0.72}" height="{h*0.24}" rx="{w*0.05}" fill="{label}" opacity=".85"/>'
            f'<rect x="{x+w*0.12}" y="{y+h*0.2}" width="{w*0.12}" height="{h*0.7}" rx="{w*0.06}" fill="#fff" opacity=".35"/>')


def lumiere():
    defs = (lin("bg", "", "", 120, [(0, "#fbe9e4"), (0.5, "#f1c9c6"), (1, "#d9959f")]) + lin("glass", "", "", 90, [(0, "#f9d9d4"), (1, "#c97b88")])
            + lin("amber", "", "", 90, [(0, "#e9c08e"), (1, "#a8733d")]) + BLUR("b1", 20) + BLUR("b2", 70))
    body = ('<circle cx="500" cy="300" r="380" fill="#fff" opacity=".35" filter="url(#b2)"/><circle cx="1500" cy="800" r="420" fill="#fff" opacity=".28" filter="url(#b2)"/>'
            '<circle cx="960" cy="560" r="300" fill="#fff" opacity=".18"/>'
            + shadow(330, 960, 170, 22, .25) + bottle(240, 480, 180, 460, "url(#glass)", "#fdf3ee") +
            shadow(1590, 960, 190, 22, .25) + '<rect x="1490" y="840" width="200" height="110" rx="26" fill="url(#amber)"/><rect x="1480" y="790" width="220" height="70" rx="22" fill="#fdf3ee"/><rect x="1500" y="850" width="14" height="80" rx="7" fill="#fff" opacity=".4"/>'
            + shadow(1450, 960, 120, 18, .22) + bottle(1390, 600, 110, 340, "url(#amber)", "#fdf3ee", "#fff"))
    write("lumiere", "hero.svg", svg(1920, 1080, defs, body, '<rect width="1920" height="1080" fill="url(#bg)"/>'))
    write("lumiere", "preview.svg", svg(1920, 1080, defs, body, '<rect width="1920" height="1080" fill="url(#bg)"/>'))
    defs2 = (lin("bg", "", "", 160, [(0, "#fdf3ee"), (1, "#efc9c5")]) + lin("glass", "", "", 90, [(0, "#f6cfcb"), (1, "#bd6877")]) + lin("amber", "", "", 90, [(0, "#ebc796"), (1, "#a8733d")]) + BLUR("b1", 20) + BLUR("b2", 60))
    leaf = lambda cx, cy, rot: f'<ellipse cx="{cx}" cy="{cy}" rx="38" ry="150" fill="#7d9a73" opacity=".85" transform="rotate({rot} {cx} {cy})"/>'
    body2 = ('<circle cx="600" cy="620" r="430" fill="#fff" opacity=".55"/>' + leaf(980, 1000, 24) + leaf(1040, 1080, 52) + leaf(930, 1100, -4) +
             shadow(600, 1380, 420, 30, .28) + bottle(330, 640, 200, 700, "url(#glass)", "#fdf3ee") + bottle(590, 860, 160, 480, "url(#amber)", "#fdf3ee") +
             '<rect x="790" y="1180" width="240" height="160" rx="34" fill="#fdf3ee"/><rect x="780" y="1130" width="260" height="70" rx="26" fill="#d9a7a3"/>')
    write("lumiere", "ritual.svg", svg(1200, 1500, defs2, body2, '<rect width="1200" height="1500" fill="url(#bg)"/>'))


# ---------------------------------------------------------------- Haven (home): calm interiors
def plant(cx, base, s=1.0):
    leaves = ''.join(f'<ellipse cx="{cx+dx*s}" cy="{base-dy*s}" rx="{34*s}" ry="{120*s}" fill="#5f7f60" opacity="{o}" transform="rotate({r} {cx+dx*s} {base-dy*s})"/>' for dx, dy, r, o in [(0, 170, 0, .95), (-60, 140, -28, .9), (60, 140, 28, .9), (-110, 100, -50, .8), (110, 100, 50, .8)])
    return leaves + f'<path d="M{cx-60*s} {base-70*s} h{120*s} l-{14*s} {70*s} h-{92*s} z" fill="#c9a27a"/>'


def haven():
    defs = lin("wall", "", "", 100, [(0, "#efe7d9"), (1, "#e2d6c2")]) + lin("floor", "", "", 90, [(0, "#c7b08d"), (1, "#a98f68")]) + lin("sofa", "", "", 90, [(0, "#4d7355"), (1, "#3f5d45")]) + BLUR("b1", 24) + BLUR("b2", 60)
    room = ('<rect width="1920" height="1080" fill="url(#wall)"/><rect y="800" width="1920" height="280" fill="url(#floor)"/>'
            '<circle cx="1280" cy="380" r="360" fill="#fff" opacity=".35" filter="url(#b2)"/>'
            '<rect x="1060" y="210" width="360" height="280" rx="6" fill="#f8f2e6" stroke="#c9b79c" stroke-width="10"/><path d="M1090 460 L1180 340 L1250 410 L1310 330 L1390 460 Z" fill="#9a7b56" opacity=".7"/><circle cx="1330" cy="290" r="26" fill="#c08552" opacity=".9"/>'
            '<ellipse cx="1320" cy="930" rx="620" ry="70" fill="#e9dfcc" opacity=".9"/>'
            + shadow(1310, 905, 520, 26, .3) +
            '<rect x="960" y="650" width="700" height="210" rx="40" fill="url(#sofa)"/><rect x="930" y="690" width="110" height="200" rx="40" fill="#3f5d45"/><rect x="1580" y="690" width="110" height="200" rx="40" fill="#3f5d45"/>'
            '<rect x="990" y="560" width="640" height="160" rx="46" fill="#4d7355"/><rect x="1010" y="720" width="280" height="110" rx="30" fill="#5c8564" opacity=".7"/><rect x="1320" y="720" width="280" height="110" rx="30" fill="#5c8564" opacity=".7"/>'
            '<rect x="1060" y="600" width="130" height="130" rx="26" fill="#c08552"/><rect x="1450" y="610" width="120" height="120" rx="26" fill="#f1e6d2"/>'
            '<rect x="920" y="880" width="30" height="40" rx="6" fill="#6b4f33"/><rect x="1660" y="880" width="30" height="40" rx="6" fill="#6b4f33"/>'
            '<path d="M1790 840 V420 q0 -60 -90 -60" fill="none" stroke="#6b4f33" stroke-width="9" stroke-linecap="round"/><path d="M1620 360 q60 -40 120 0 l-18 70 h-84 z" fill="#f4dcae"/>'
            + plant(830, 880, 1.15))
    write("haven", "living-room.svg", svg(1920, 1080, defs, room))
    write("haven", "preview.svg", svg(1920, 1080, defs, room))
    defs2 = lin("wall", "", "", 100, [(0, "#efe7d9"), (1, "#dccdb4")]) + lin("wood", "", "", 90, [(0, "#b98b5a"), (1, "#8d6338")]) + BLUR("b1", 22)
    craft = ('<rect width="1200" height="1500" fill="url(#wall)"/><rect y="1180" width="1200" height="320" fill="#c9b08a"/>' + shadow(600, 1190, 460, 28, .3) +
             '<rect x="200" y="760" width="800" height="70" rx="12" fill="url(#wood)"/><rect x="250" y="830" width="64" height="360" rx="10" fill="#8d6338"/><rect x="886" y="830" width="64" height="360" rx="10" fill="#8d6338"/>'
             '<path d="M470 760 q-30 -110 30 -190 h110 q60 80 30 190 z" fill="#f4ece0"/><path d="M570 570 q-10 -130 -70 -220 M580 570 q40 -150 130 -210 M575 570 q-6 -170 24 -270" stroke="#6b7f55" stroke-width="8" fill="none" stroke-linecap="round"/>'
            '<circle cx="500" cy="350" r="22" fill="#c08552"/><circle cx="712" cy="360" r="20" fill="#c08552"/><circle cx="600" cy="300" r="22" fill="#c08552"/>'
            '<rect x="760" y="670" width="170" height="90" rx="14" fill="#3f5d45"/><rect x="290" y="690" width="140" height="70" rx="12" fill="#e7dac3"/>')
    write("haven", "craft.svg", svg(1200, 1500, defs2, craft))
    defs3 = lin("wall", "", "", 100, [(0, "#e9e1d2"), (1, "#d6c7ad")]) + lin("wood", "", "", 90, [(0, "#b98b5a"), (1, "#8d6338")]) + BLUR("b1", 22)
    studio = ('<rect width="1200" height="1500" fill="url(#wall)"/>'
              '<rect x="150" y="260" width="900" height="26" rx="6" fill="url(#wood)"/><rect x="150" y="700" width="900" height="26" rx="6" fill="url(#wood)"/><rect x="150" y="1140" width="900" height="26" rx="6" fill="url(#wood)"/>'
              '<rect x="190" y="130" width="150" height="130" rx="10" fill="#3f5d45"/><rect x="360" y="170" width="110" height="90" rx="10" fill="#c08552"/><rect x="490" y="90" width="90" height="170" rx="40" fill="#f4ece0"/>'
              '<circle cx="860" cy="170" r="88" fill="#e7dac3"/><circle cx="860" cy="170" r="46" fill="#c9b08a"/>'
              '<rect x="200" y="540" width="200" height="160" rx="14" fill="#f4ece0"/><rect x="430" y="480" width="150" height="220" rx="20" fill="#3f5d45"/><path d="M780 700 v-170 q0 -50 60 -50 q60 0 60 50 v170 z" fill="#c9a27a"/>'
              + plant(930, 700, 0.55) +
              '<rect x="200" y="980" width="260" height="160" rx="14" fill="#d8c9ad"/><rect x="480" y="900" width="120" height="240" rx="50" fill="#f4ece0"/><rect x="640" y="1000" width="330" height="140" rx="14" fill="#8d6338" opacity=".8"/>')
    write("haven", "studio.svg", svg(1200, 1500, defs3, studio))


# ---------------------------------------------------------------- Freshly (grocery): fresh produce
def freshly():
    defs = (lin("bg", "", "", 130, [(0, "#f0fdf4"), (0.6, "#bbf7d0"), (1, "#4ade80")]) + '<radialGradient id="o" cx=".35" cy=".3"><stop offset="0" stop-color="#fdba74"/><stop offset="1" stop-color="#ea580c"/></radialGradient>'
            '<radialGradient id="a" cx=".35" cy=".3"><stop offset="0" stop-color="#fca5a5"/><stop offset="1" stop-color="#dc2626"/></radialGradient>'
            '<radialGradient id="l" cx=".35" cy=".3"><stop offset="0" stop-color="#fef08a"/><stop offset="1" stop-color="#eab308"/></radialGradient>'
            '<radialGradient id="g" cx=".35" cy=".3"><stop offset="0" stop-color="#bef264"/><stop offset="1" stop-color="#4d7c0f"/></radialGradient>' + BLUR("b1", 20) + BLUR("b2", 70))
    leaf = lambda cx, cy, rot, c="#15803d": f'<path d="M{cx} {cy} q60 -150 160 -170 q-10 140 -160 170 z" fill="{c}" transform="rotate({rot} {cx} {cy})"/>'
    body = ('<circle cx="800" cy="440" r="380" fill="#fff" opacity=".55"/><circle cx="800" cy="440" r="270" fill="#fff" opacity=".4"/>' + shadow(800, 900, 560, 40, .22)
            + leaf(520, 520, -40) + leaf(1080, 520, 220, "#16a34a") + leaf(800, 360, -90, "#22c55e")
            + '<circle cx="620" cy="700" r="170" fill="url(#o)"/><path d="M620 530 q20 -50 60 -60" stroke="#15803d" stroke-width="10" fill="none" stroke-linecap="round"/>'
            '<circle cx="980" cy="700" r="160" fill="url(#a)"/><path d="M980 545 q10 -60 50 -80" stroke="#7c4a1d" stroke-width="10" fill="none" stroke-linecap="round"/><path d="M1000 520 q70 -50 120 -10 q-50 50 -120 10z" fill="#16a34a"/>'
            '<ellipse cx="800" cy="760" rx="150" ry="110" fill="url(#l)"/><circle cx="800" cy="540" r="105" fill="url(#g)"/><ellipse cx="780" cy="515" rx="26" ry="14" fill="#fff" opacity=".5" transform="rotate(-30 780 515)"/>'
            '<circle cx="1180" cy="780" r="92" fill="url(#a)"/><circle cx="430" cy="790" r="86" fill="url(#o)"/>')
    write("freshly", "hero.svg", svg(1600, 1000, defs, body, '<rect width="1600" height="1000" fill="url(#bg)"/>'))
    write("freshly", "preview.svg", svg(1600, 1000, defs, body, '<rect width="1600" height="1000" fill="url(#bg)"/>'))


# ---------------------------------------------------------------- Plain (minimal)
def plain():
    defs = lin("bg", "", "", 135, [(0, "#f9fafb"), (1, "#e5e7eb")])
    body = '<circle cx="1180" cy="420" r="260" fill="#111827" opacity=".06"/><rect x="420" y="320" width="520" height="520" rx="26" fill="#fff" opacity=".9"/><circle cx="680" cy="580" r="130" fill="#111827" opacity=".9"/>'
    write("plain", "preview.svg", svg(1600, 1000, defs, body, '<rect width="1600" height="1000" fill="url(#bg)"/>'))


for fn in (atelier, voltage, lumiere, haven, freshly, plain):
    fn()
print("ok")
