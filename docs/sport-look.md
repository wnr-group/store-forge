# Sport look and the Stride theme

The second look on the storefront engine (see `docs/boutique-look.md` for how looks work). A theme picks it with
`settings.brand.look = "sport"`; the Stride theme in the API catalogue (`catalogue/stride.ts`) does.

Design: white page, navy primary, yellow accent, indigo secondary, Archivo headlines (heavy, slanted capitals) over Plus Jakarta
Sans body text, pill controls, rounded 4:5 product cards. Soft panels are tinted with the secondary colour (`LOOK_TINT` in
`lib/templates/looks.ts`), so bands are lavender rather than yellow.

## What it draws

| Section | Sport version |
|---|---|
| Announcement bar | slim navy strip, centred semi-bold text |
| Header | logo, spaced-capital menu with underline on the current page, pill search, wishlist, bag with count, dark call-to-action (the first `button` block); hover on **Shop** opens a mega menu built from the store's collections |
| Hero | full-screen cross-fading slides (`hero-slide` blocks), two-tone headline (first sentence white, the rest yellow), counter with progress line, pause / previous / next |
| Collection list | `Automatic` = compact rounded tiles; `Grid` = tall cards with the name over the picture; `Editorial` = staggered square pictures with a ruled caption. Grid and Editorial show as many cards as the section has columns |
| Featured collection | tinted band (light) or navy band (dark), rounded product cards |
| Image with text | `Panel` (tinted panel, picture to the edge) or `Plain` (rounded picture, optional label) |
| Multi-column | square picture, bold capital title, short text |
| Collapsible content | two-column FAQ with a button |
| Promotional banner | indigo band; Column blocks become numbered cards |
| Collection banner, "All products" and search header | dark rounded banner with a two-tone title |
| Product grid | filter sidebar (collections, price range, in stock), search field, sort menu |
| Product page | vertical thumbnails, big rounded picture with counter, buy row with wishlist |

The footer is the engine's own in LESPARO's deep indigo (`#12164c`) when it is still on the theme's stock navy; a colour chosen in the editor wins. Everything else (testimonials, ...) is the engine's own and takes the theme's colours and fonts.

## Text conventions in "Image with text"

Because the engine has no list or icon blocks, the Sport look reads a few plain conventions in **Text** blocks:

- `• item` is a ruled bullet row.
- `Value | text` is a big-number row (value up to 14 characters, for example `1979 | Our first shop`).
- `Title :: text` is a row with an icon tile.
- `{{words}}` in a **Heading** are coloured.

## Not included

- **Enquiry list / wholesale pricing:** no such feature exists. The header's call-to-action is a link (default `/contact`).
- **Size filter and category tree:** product data has no sizes or nested categories; the sidebar offers collections, price and stock.
- **Photos:** the theme ships original stripe artwork instead of photographs. Merchants add their own pictures.
