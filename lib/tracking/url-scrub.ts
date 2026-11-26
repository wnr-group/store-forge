/**
 * Keeps a cart recovery token out of the page address before ANY analytics script can read it.
 *
 * A recovery link is `/cart?recover=TOKEN`. Google's tag and Meta's script both report the full address of the page by default, so a
 * token left in the address would be sent to them with the first page view, and the token shows who the shopper is and what is in
 * their bag. The storefront layout takes the token out of the address first thing (in a layout effect, which runs before every normal
 * effect, including the ones that load and call those scripts) and keeps it for the cart page in this tab only.
 */
const PARAM = "recover";
const KEY = "sf-recover-token:v1";
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

type Loc = { pathname: string; search: string; hash: string };

/**
 * Removes `?recover=` from the address (leaving any other parameters and the hash alone) and, when it held a well-formed token, keeps
 * the token for this tab only. Returns that token, or null. A malformed value is removed from the address and thrown away.
 */
export function scrubRecoveryToken(loc: Loc, replace: (url: string) => void, session: Pick<Storage, "setItem"> | null): string | null {
  const params = new URLSearchParams(loc.search);
  if (!params.has(PARAM)) return null;
  const value = params.get(PARAM) ?? "";
  params.delete(PARAM);
  const rest = params.toString();
  replace(`${loc.pathname}${rest ? `?${rest}` : ""}${loc.hash}`);
  if (!TOKEN.test(value)) return null;
  try {
    session?.setItem(KEY, value);
  } catch {
    // Not kept: the link has to be opened again.
  }
  return value;
}

/** The token saved for this tab, if any and well formed. */
export function pendingRecoveryToken(session: Pick<Storage, "getItem"> | null): string | null {
  try {
    const v = session?.getItem(KEY) ?? null;
    return v && TOKEN.test(v) ? v : null;
  } catch {
    return null;
  }
}

/** Forgets it once it has been used. */
export function clearRecoveryToken(session: Pick<Storage, "removeItem"> | null): void {
  try {
    session?.removeItem(KEY);
  } catch {
    // Nothing to do.
  }
}
