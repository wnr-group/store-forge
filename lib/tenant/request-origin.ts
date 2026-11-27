/**
 * The origin the BROWSER used (`http://urban-abc123.lvh.me:3000`). In a route handler `request.nextUrl` / `request.url` can carry the
 * server's own address (`http://localhost:3000` in development), so a redirect built from them would leave the store host, and with it
 * the session cookie that was just set there. The Host header is what the browser asked for; the proxy has already tied it to a store.
 */
export function browserOrigin(request: { headers: Headers; url: string }): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host || !/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return new URL(request.url).origin;
  const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const local = /^(localhost|[^.]+\.localhost|lvh\.me|127\.0\.0\.1)(:\d+)?$/i.test(host) || /\.lvh\.me(:\d+)?$/i.test(host);
  return `${forwarded === "http" || forwarded === "https" ? forwarded : local ? "http" : "https"}://${host}`;
}
