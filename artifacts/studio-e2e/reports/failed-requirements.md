# Failed requirements

Reproduction for AC-EDT-05: open the Studio editor (`/dashboard/templates/editor`) at 1280x800, run axe-core with tags wcag2a, wcag2aa, wcag21aa, wcag22aa on the document. Expected: no serious violations. Actual: `color-contrast` (serious) on 7 nodes, both runs. Repo/file not established (editor UI in `components/themes/editor`). Severity: Medium.

| Requirement ID | Release | Criterion | Detail | Evidence |
|---|---|---|---|---|
| AC-EDT-05 | R1 | Editor controls keyboard-reachable; automated scan clean | axe-core 4.14 (WCAG 2.2 AA tags) on the Studio editor at 1280x800 reports 1 serious violation, color-contrast, on 7 nodes, in 2 of 2 runs (first run, rerun). The criterion requires an automated scan with no serious violations. Keyboard operation of the device switch was confirmed (focus + Space), which is only one control. | logs/journey-result.json (axe.editor-desktop); videos/; traces/owner-session-2.zip |
