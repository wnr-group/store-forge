# Market look and the Marketplace theme

The third look on the storefront engine (see `docs/boutique-look.md` for how looks work). A theme picks it with
`settings.brand.look = "market"`; the Marketplace theme in the API catalogue (`catalogue/marketplace.ts`) does.

Modelled on the `ecom-poc` marketplace: a dense, shop-first layout on a light grey page. Dark ink primary (`#0d1420`),
teal secondary (`#106762`, links and the primary button), orange accent (`#ff5a17`, the "buy" button), Plus Jakarta Sans
headings over Inter, 8 px corners, white bordered panels. Image wells are tinted with the secondary (`LOOK_TINT`).

## What it draws

| Section | Market version |
|---|---|
| Announcement bar | slim teal strip, small centred text |
| Header | dark bar: store mark (orange initial square), wide search field with an orange button, wishlist and cart with counts; a second dark row with "All categories", the store's collections and the call-to-action (first `button` block) in orange on the right; phones get a left drawer and a fixed tab bar |
| Hero | rounded banner on a deep teal gradient with faint rings (or the slide's picture under a dark fade), orange label, white headline, orange button; several `hero-slide` blocks rotate with dots |
| Collection list | `Automatic` = a row of small category tiles (picture or coloured initial) with no heading; `Grid` / `Editorial` = a white panel with a title, "See all" and square pictures |
| Featured collection | a "shelf": white bordered panel, title, "See all →", horizontally scrolling cards; `tone: dark` is the highlighted deal shelf (orange tint, bolt) |
| Product card | bordered card, square picture, sale / sold-out tag, heart, name, price with struck-through compare-at and green discount, full-width orange "Add to cart" |
| Product grid | filter panel (collections, price with quick bands, in stock), result count, sort, grid / list switch, removable filter chips |
| Product page | three columns: picture panel with thumbnails, details (the theme's blocks, info blocks in a rounded card) and a sticky buy box (price, stock, quantity, Add to cart, Buy now, wishlist, sold by); phones stack them |
| Related products | a shelf |
| Promotional banner | teal gradient panel; Column blocks become numbered glass cards |
| Collection banner, "All products" and search header | breadcrumbs, title, short line |
| Footer | the engine footer on the dark ink (a colour chosen in the editor wins) |

Everything else (testimonials, image with text, ...) is the engine's own and takes the theme's colours and fonts.

## Not included, and why

The marketplace original has data StoreForge does not hold, so none of it is drawn or invented:

- **Ratings, review counts, "bought recently", brands, sellers, delivery promises, EMI and bank offers, coupons**: no such data exists.
- **Search category menu**: search has no category scope; the field searches the store.
- **Trust row under the hero** ("Free delivery", "7-day returns"): these are business claims a merchant has to make themselves.
- **Account menu, orders, notifications, workspace switcher**: no customer account exists yet.
- **Photos**: the theme ships none; slides without a picture are drawn in the theme colours.
