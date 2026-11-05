/**
 * Server-safe theme constants and the pre-paint script. No React imports here: the root
 * layout (a Server Component) inlines THEME_INIT_SCRIPT, and the client store reads the rest.
 */
export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];
export type ResolvedTheme = "light" | "dark";

export const THEME_KEY = "sf_theme";
export const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Runs in <head> BEFORE first paint (inlined by the root layout) so a dark-mode user never
 * sees a white flash. Keep it dependency-free and defensive: storage can throw.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_KEY}')||'system';var d=t==='dark'||(t!=='light'&&matchMedia('${DARK_QUERY}').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light'}catch(e){}})()`;

