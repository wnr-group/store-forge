# Performance report

Lab only. Environment: Windows, local dev server (`next dev`, not a production build), Chromium via Playwright, viewport 390x844 mobile emulation, device scale 2, no CPU or network throttling, URL http://localhost:3100/s/urban-nest-demo, commit 9cf1440, 5 cold loads.
| Run | LCP ms | CLS | load ms |
|---|---:|---:|---:|
| 1 | 452 | 0 | 810 |
| 2 | 444 | 0 | 801 |
| 3 | 320 | 0 | 698 |
| 4 | 428 | 0 | 814 |
| 5 | 284 | 0 | 666 |

Lab p75 (nearest-rank of 5): LCP 444 ms, CLS 0. Studio editor initial load (one run): 4342 ms.
This is a dev-server lab measurement on an unthrottled desktop machine, a different thing from the specification's real-user mobile p75, so it does not show compliance with LCP <= 2.5 s, CLS <= 0.1, INP <= 200 ms. INP was not measured. The web-vitals collection and speed indicator (PRF-001..004) do not exist: status Insufficient data. Not measured: component insertion, autosave, readiness duration, large documents, production build. **Performance verdict: NOT VERIFIED.**
