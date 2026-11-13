/**
 * Writes the illustrated placeholder pictures the themes reference ({ "asset": "<theme>/<file>" } -> /themes/<theme>/<file>).
 * They are artwork in each theme's palette, not photography: replace any file in public/themes/<theme>/ with a
 * licensed photo of the same name (keep the .svg name or update the theme's catalogue) and nothing else changes.
 * Run: node tools/generate-theme-art.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const W = 1600;
const H = 900;
const svg = (body, defs = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" role="img" aria-hidden="true"><defs>${defs}</defs>${body}</svg>\n`;
const grad = (id, a, b, angle = 135) =>
  `<linearGradient id="${id}" gradientTransform="rotate(${angle} .5 .5)"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;

const themes = {
  atelier: {
    hero: svg(
      `<rect width="${W}" height="${H}" fill="url(#g)"/>
       <path d="M980 900 V420 a200 200 0 0 1 400 0 V900Z" fill="#faf7f2" opacity=".92"/>
       <path d="M1090 900 V470 a90 90 0 0 1 180 0 V900Z" fill="#e7e0d6"/>
       <circle cx="1180" cy="360" r="52" fill="#9a3412"/>
       <path d="M1120 900 q60-260 120 0" fill="none" stroke="#1c1917" stroke-width="3" opacity=".5"/>
       <path d="M0 780 H760" stroke="#faf7f2" stroke-width="2" opacity=".5"/>
       <rect x="120" y="250" width="14" height="300" fill="#faf7f2" opacity=".35"/>`,
      grad("g", "#b45309", "#44190a", 120),
    ),
    story: svg(
      `<rect width="${W}" height="${H}" fill="#e7e0d6"/>
       <path d="M300 900 L520 260 L740 900Z" fill="#9a3412" opacity=".85"/>
       <path d="M560 900 L800 160 L1040 900Z" fill="#1c1917" opacity=".9"/>
       <path d="M880 900 L1060 380 L1240 900Z" fill="#faf7f2"/>
       <circle cx="1300" cy="220" r="90" fill="#faf7f2" opacity=".8"/>`,
    ),
    preview: svg(
      `<rect width="${W}" height="${H}" fill="url(#g)"/><rect x="120" y="120" width="620" height="40" fill="#faf7f2" opacity=".9"/><rect x="120" y="200" width="420" height="20" fill="#faf7f2" opacity=".5"/><path d="M980 900 V420 a200 200 0 0 1 400 0 V900Z" fill="#faf7f2" opacity=".9"/>`,
      grad("g", "#b45309", "#44190a", 120),
    ),
  },
  voltage: {
    hero: svg(
      `<rect width="${W}" height="${H}" fill="url(#g)"/>
       <g stroke="#38bdf8" stroke-width="2" opacity=".25" fill="none"><path d="M0 700 H500 L560 640 H1000"/><path d="M0 760 H420 L480 820 H900"/><path d="M1600 200 H1200 L1140 260 H800"/></g>
       <rect x="1010" y="130" width="330" height="640" rx="46" fill="#0b1220" stroke="#38bdf8" stroke-width="4"/>
       <rect x="1034" y="160" width="282" height="580" rx="28" fill="url(#s)"/>
       <circle cx="1175" cy="190" r="9" fill="#0b1220"/>
       <circle cx="1175" cy="470" r="110" fill="none" stroke="#e0f2fe" stroke-width="10" opacity=".8"/>
       <circle cx="1175" cy="470" r="56" fill="#e0f2fe" opacity=".9"/>`,
      grad("g", "#1e3a8a", "#020617", 140) + grad("s", "#2563eb", "#0891b2", 160),
    ),
    spotlight: svg(
      `<rect width="${W}" height="${H}" fill="#0f172a"/>
       <path d="M420 560 a380 380 0 0 1 760 0" fill="none" stroke="#2563eb" stroke-width="70" stroke-linecap="round"/>
       <rect x="340" y="500" width="150" height="260" rx="60" fill="#e2e8f0"/>
       <rect x="1110" y="500" width="150" height="260" rx="60" fill="#e2e8f0"/>
       <circle cx="800" cy="260" r="12" fill="#0891b2"/>
       <g fill="none" stroke="#0891b2" opacity=".5" stroke-width="3"><circle cx="800" cy="260" r="60"/><circle cx="800" cy="260" r="120"/><circle cx="800" cy="260" r="200"/></g>`,
    ),
    preview: svg(
      `<rect width="${W}" height="${H}" fill="url(#g)"/><rect x="1010" y="130" width="330" height="640" rx="46" fill="#0b1220" stroke="#38bdf8" stroke-width="4"/><rect x="120" y="180" width="640" height="46" fill="#e0f2fe" opacity=".9"/><rect x="120" y="260" width="440" height="22" fill="#e0f2fe" opacity=".5"/>`,
      grad("g", "#1e3a8a", "#020617", 140),
    ),
  },
  lumiere: {
    hero: svg(
      `<rect width="${W}" height="${H}" fill="url(#g)"/>
       <circle cx="1120" cy="450" r="330" fill="#fdf8f6" opacity=".55"/>
       <circle cx="1120" cy="450" r="220" fill="#f3dfd9" opacity=".8"/>
       <rect x="1050" y="250" width="140" height="330" rx="26" fill="#fdf8f6"/>
       <rect x="1085" y="190" width="70" height="80" rx="14" fill="#9d4a5b"/>
       <rect x="1050" y="400" width="140" height="70" fill="#9d4a5b" opacity=".15"/>
       <circle cx="1330" cy="640" r="70" fill="#b9855a" opacity=".85"/>
       <circle cx="860" cy="660" r="46" fill="#9d4a5b" opacity=".6"/>`,
      grad("g", "#e8b4b8", "#9d4a5b", 130),
    ),
    ritual: svg(
      `<rect width="${W}" height="${H}" fill="#f3dfd9"/>
       <circle cx="560" cy="460" r="300" fill="#fdf8f6"/>
       <rect x="500" y="300" width="120" height="300" rx="22" fill="#9d4a5b"/>
       <rect x="530" y="250" width="60" height="70" rx="12" fill="#3b2a2a"/>
       <rect x="840" y="380" width="180" height="220" rx="90" fill="#b9855a"/>
       <rect x="1100" y="340" width="110" height="260" rx="20" fill="#fdf8f6" stroke="#9d4a5b" stroke-width="6"/>`,
    ),
    preview: svg(
      `<rect width="${W}" height="${H}" fill="url(#g)"/><circle cx="1120" cy="450" r="260" fill="#fdf8f6" opacity=".6"/><rect x="120" y="260" width="600" height="40" fill="#fdf8f6" opacity=".9"/>`,
      grad("g", "#e8b4b8", "#9d4a5b", 130),
    ),
  },
  haven: {
    "living-room": svg(
      `<rect width="${W}" height="${H}" fill="url(#g)"/>
       <rect y="660" width="${W}" height="240" fill="#b89b78" opacity=".6"/>
       <rect x="700" y="450" width="660" height="210" rx="34" fill="#3f5d45"/>
       <rect x="700" y="380" width="660" height="110" rx="34" fill="#4d7355"/>
       <rect x="680" y="470" width="70" height="200" rx="30" fill="#2f4634"/>
       <rect x="1320" y="470" width="70" height="200" rx="30" fill="#2f4634"/>
       <rect x="1480" y="260" width="10" height="420" fill="#2b2a28"/>
       <path d="M1420 260 h130 l-30 -110 h-70Z" fill="#c08552"/>
       <rect x="300" y="200" width="260" height="340" fill="#f6f3ee" opacity=".75"/>
       <path d="M300 370 H560 M430 200 V540" stroke="#a39e92" stroke-width="6"/>`,
      grad("g", "#e4ded3", "#c9bfae", 100),
    ),
    craft: svg(
      `<rect width="${W}" height="${H}" fill="#e4ded3"/>
       <rect x="300" y="300" width="1000" height="70" fill="#8a6a45"/>
       <rect x="340" y="370" width="60" height="330" fill="#6f5436"/>
       <rect x="1200" y="370" width="60" height="330" fill="#6f5436"/>
       <g stroke="#a98456" stroke-width="3" opacity=".7"><path d="M320 320 H1280"/><path d="M320 345 H1280"/></g>
       <circle cx="800" cy="250" r="44" fill="#3f5d45"/><rect x="788" y="250" width="24" height="50" fill="#3f5d45"/>`,
    ),
    studio: svg(
      `<rect width="${W}" height="${H}" fill="#f6f3ee"/>
       <rect x="260" y="180" width="1080" height="560" fill="none" stroke="#2b2a28" stroke-width="6"/>
       <path d="M260 460 H800 V180 M800 460 V740 M1060 180 V460 H1340" fill="none" stroke="#2b2a28" stroke-width="4"/>
       <rect x="300" y="520" width="200" height="160" fill="#3f5d45" opacity=".8"/>
       <rect x="860" y="230" width="150" height="190" fill="#c08552" opacity=".8"/>
       <circle cx="1200" cy="620" r="70" fill="#a39e92" opacity=".6"/>`,
    ),
    preview: svg(
      `<rect width="${W}" height="${H}" fill="url(#g)"/><rect x="700" y="450" width="660" height="210" rx="34" fill="#3f5d45"/><rect x="700" y="380" width="660" height="110" rx="34" fill="#4d7355"/><rect x="120" y="250" width="520" height="40" fill="#2b2a28" opacity=".8"/>`,
      grad("g", "#e4ded3", "#c9bfae", 100),
    ),
  },
  freshly: {
    hero: svg(
      `<rect width="${W}" height="${H}" fill="url(#g)"/>
       <circle cx="1060" cy="520" r="190" fill="#ea580c"/>
       <path d="M1060 330 q40 -90 120 -100 q-10 90 -120 100Z" fill="#15803d"/>
       <circle cx="1380" cy="600" r="130" fill="#dc2626"/>
       <path d="M1380 470 q30 -70 90 -76 q-8 66 -90 76Z" fill="#15803d"/>
       <ellipse cx="780" cy="640" rx="100" ry="230" fill="#4d7c0f" transform="rotate(-18 780 640)"/>
       <ellipse cx="900" cy="720" rx="90" ry="200" fill="#65a30d" transform="rotate(14 900 720)"/>
       <rect y="780" width="${W}" height="120" fill="#14231a" opacity=".25"/>`,
      grad("g", "#dcfce7", "#86efac", 120),
    ),
    preview: svg(
      `<rect width="${W}" height="${H}" fill="url(#g)"/><circle cx="1060" cy="520" r="190" fill="#ea580c"/><circle cx="1380" cy="600" r="130" fill="#dc2626"/><rect x="120" y="260" width="560" height="44" fill="#14231a" opacity=".85"/>`,
      grad("g", "#dcfce7", "#86efac", 120),
    ),
  },
  plain: {
    preview: svg(
      `<rect width="${W}" height="${H}" fill="#f9fafb"/><rect x="120" y="140" width="560" height="44" fill="#111827"/><g fill="#e5e7eb"><rect x="120" y="360" width="340" height="340"/><rect x="500" y="360" width="340" height="340"/><rect x="880" y="360" width="340" height="340"/><rect x="1260" y="360" width="220" height="340"/></g>`,
    ),
  },
};

for (const [theme, files] of Object.entries(themes)) {
  const dir = join("public", "themes", theme);
  mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, `${name}.svg`), content);
}
console.log("Wrote", Object.values(themes).reduce((n, f) => n + Object.keys(f).length, 0), "pictures to public/themes/");
