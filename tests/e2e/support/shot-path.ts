const AC = /^(AC-[A-Z]+-\d+)_(.+)$/;
const clean = (s: string) => s.replace(/\.png$/i, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/\.\.+/g, "-");

/** AC-prefixed names go to `artifacts/qa/screenshots/<AC-ID>/<rest>.png`; anything else keeps the ticket folder. */
export function shotPath(name: string, ticket: string): { dir: string; file: string } {
  const m = AC.exec(name);
  if (m) return { dir: `artifacts/qa/screenshots/${m[1]}`, file: `${clean(m[2])}.png` };
  return { dir: `artifacts/qa/screenshots/${clean(ticket)}`, file: `${clean(name)}.png` };
}
