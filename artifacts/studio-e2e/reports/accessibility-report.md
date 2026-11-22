# Accessibility report

Automated: axe-core 4.14.1 (injected from a temp directory; not a repo dependency), tags wcag2a, wcag2aa, wcag21aa, wcag22aa, top document only (editor preview iframe content not scanned).
| Page | Violations | Needs manual review |
|---|---|---|
| Studio editor, desktop | color-contrast (serious) on 7 nodes — reproduced in 2 of 2 runs | color-contrast 45 nodes, aria-valid-attr-value 6 nodes |
| Storefront home, desktop | none | color-contrast 13 nodes |
| Storefront home, mobile 390 | none | color-contrast 11 nodes |
Manual: the device switch in the display-rule panel is keyboard-focusable and toggles with Space (verified). Not performed: full keyboard walkthrough, dialog focus management, reduced-motion, screen-reader checks, countdown announcements (component unavailable), rating text alternatives (reviews absent), contrast measurement of merchant colours beyond the readiness unit tests.
Result: AC-EDT-05 FAILED; AC-A11-01 PARTIAL; AC-A11-02 NOT VERIFIED. Automated scanning does not establish WCAG 2.2 AA compliance. **Accessibility verdict: NOT VERIFIED / one reproducible failure.**
