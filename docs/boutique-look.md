# Storefront looks and the Karthika (Boutique) theme

## How a theme chooses how it is drawn

A **theme** (catalogue entry in the API repo, `src/modules/themes/catalogue`) is data: colours, fonts, section order and
copy. A **look** is the set of React section components that draw it. A theme picks a look with
`settings.brand.look`; a missing or unknown value is `standard`, which is the engine's own components.

- `lib/templates/looks.ts`: the list of look ids (plain data, read by the settings schema).
- `components/storefront/engine/looks/index.ts`: id -> components (`StorefrontLook.sections`).
- `components/storefront/engine/sections/index.tsx`: the only dispatch point. A look's component wins for a section
  type it lists; everything else falls back to the engine component.

Looks receive the same `RenderContext` as every section (store, collections, products, theme), so they never fetch
data and tenant isolation is unchanged.

## Adding another look

1. Add the id to `LOOK_IDS` and a label to `LOOK_LABELS` in `lib/templates/looks.ts`.
2. Create `looks/<id>/` with the section components it wants to change and an `index.ts` exporting a `StorefrontLook`.
3. Register it in `LOOKS` in `looks/index.ts`.
4. Add a theme in the API catalogue with `brand: { look: '<id>' }` and run `npm run db:seed:themes`.

`tests/unit/boutique-look.test.ts` fails if the id list and the registry drift apart.

## Boutique look

Draws: announcement bar, header, hero, collection list, featured collection (`tone: light | dark`), product grid
(sort, in-stock filter), related products, promotional banner. Other sections use the engine components with the
theme's colours and fonts (Cormorant Garamond headings, Jost body).

## Bag (cart)

A guest cart, kept in the browser per store (`localStorage` key `sf-cart:v1:<store slug>`), with no server state.

- `lib/cart/cart.ts`: pure rules (add, quantity 1-10, remove, totals, safe parsing of stored data, reconcile).
- `app/s/[slug]/cart/actions.ts`: re-checks lines against the store's live public products (sold out, deleted
  product or variant, changed price). Reads public data only, under the one store slug it is given.
- `components/storefront/cart/`: provider, drawer, toast, bag page, add-to-bag, quantity stepper.
- Entry points (header bag with count, add to bag on the product page) appear only for looks with `cart: true`.
  `/cart` works for every store. The editor and theme preview keep the bag in memory only.

The bag page and drawer were matched against `05-cart-drawer.jpg` and `06-cart-page.jpg` of the Karthika reference.

## Wishlist, hover "Add to bag", filters, reviews

- **Wishlist** (`lib/wishlist`, `components/storefront/wishlist`, `/wishlist`): a heart on every product card and a heart with a
  count in the header. Kept in the browser per store (`sf-wishlist:v1:<store slug>`); opening the page refreshes the saved
  products from the store's live data and drops deleted ones.
- **Add to bag on hover** (`looks/boutique/card-actions.tsx`): slides up on hover or keyboard focus, always shown on touch
  screens. It reads the live product (`quickAddAction`), so the price added is current; a product with variants opens its page,
  a sold-out one is refused.
- **Filters** (`looks/boutique/sortable-grid.tsx`): collection tabs (links, current one highlighted), price bands worked out
  from the list (`lib/storefront/price-bands.ts`), in-stock only, and sorting.
- **Reviews** (`looks/boutique/testimonials.tsx`): cards with stars, quote, name, place and product, built from the testimonials the
  merchant adds (new `rating` setting; place is "Author role", product is "Company / Location"). With none, shoppers see nothing.

Not included, and why:

- **Checkout and payment**: StoreForge has no order or payment API yet (see `docs/migration-status.md`, "Not in the product").
  The checkout button keeps its place but is disabled, with a visible note.
- **Move to wishlist (from the bag), customer account, free-shipping progress strip**: no customer account or shipping model exists.
- **Category/colour/price filters, pagination, mega menu, rotating announcements, second-image hover**:
  the engine has no data or settings for them yet.
