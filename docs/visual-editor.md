# Visual editor: element styles, adapters and history

Built on the existing theme editor (`components/themes/editor`): drafts, autosave, publish, versions, sections and blocks were already there. This layer adds per-element **style overrides**, a **theme adapter** contract, **undo/redo** and click-to-edit.

## Style overrides

Any section or block can carry `settings._style`:

```json
{ "base": { "color": "#112233", "fontSize": 40 }, "tablet": { "fontSize": 28 }, "mobile": { "fontSize": 20, "hidden": false } }
```

- `lib/editor/style.ts` is the single table of properties (`STYLE_FIELDS`). It generates the strict validation schema, the editor controls and the CSS. Colours are `#rrggbb`, numbers are range-checked, fonts come from the font registry; nothing typed by a merchant reaches CSS as text.
- Responsive: `tablet` applies to tablets and smaller, `mobile` to phones only (desktop-first cascade, same fallback as `resolveResponsiveValue`).
- Inheritance: `resolveStyleValue(layers, key, device)` returns the winning value and which layer set it. Removing an override returns to the inherited value (the Style tab's **Reset** and **Reset all**). Theme settings stay the base layer and are not copied into elements.
- Rendering: `lib/editor/render.ts` collects styled nodes; `TemplateRenderer` emits one `<style>` (plain text, no raw HTML). Blocks carry `data-sf-ov` through `blockMarkers()`; styled sections are wrapped in a box by `renderSectionComponent` (the sticky header is never wrapped).
- Storage and validation: `_style` lives in the node's settings, so it uses the existing draft, publish and version pipeline. The frontend validator checks it with `elementStyleSchema` (`validate.ts`); the NestJS validator is structural (it checks every setting value, including colours by key name) and needs no change.

## Theme adapters

`lib/editor/adapter.ts` is the contract; the editor core never names a theme. An adapter says, per section type and per block type inside a section type, which capabilities (typography, text colour, background, spacing, size, border, opacity, visibility) are supported, or `null` for none. Adapters register for storefront looks (`settings.brand.look`):

| Adapter | Looks | File |
|---|---|---|
| engine | standard | `adapters/index.ts` |
| maison | boutique | `adapters/index.ts` |
| marketplace | market | `adapters/index.ts` |
| stride | sport | `adapters/stride.ts` |

A look that draws a section itself, reading its blocks as plain data, cannot style those blocks; its adapter leaves that section out of `blockSections` and the editor shows no style controls there instead of controls that do nothing. To make more of a look styleable, put `blockMarkers(id, isPreview, node)` on the block's root element and add the section to the adapter's `blockSections`.

A new theme: implement `ThemeEditorAdapter` (or call `createEngineAdapter`) and `registerEditorAdapter` it.

## Undo and redo

`lib/themes/editor/history.ts`: snapshots of the open documents taken before each edit (documents are immutable, so a snapshot is a set of references). Edits with the same key within 900 ms (a slider drag, typing) are one step; 100 steps are kept. Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z, Ctrl+Y, and toolbar buttons. Restoring a published version clears the history.

## Click to edit

Clicking text or a picture in the preview selects its section or block and jumps to the content setting whose value it shows (`lib/editor/locate.ts`). Hover and selection outlines work for blocks as well as sections; the path above the preview selects a parent; the preview has Fit/50/75/100/125% zoom.

## Known limits

- Style controls exist only where the look puts the style hook on the element (see the adapter table above). In Stride that is the hero buttons, product-page blocks, multi-column cards, and every section as a whole except the header.
- Text drawn from a section's own settings (for example a hero headline inside a slide) is edited under Content and has no separate typography override.
- Style ids are unique per document; a shared header or footer section with the same id as a page section would share overrides.
