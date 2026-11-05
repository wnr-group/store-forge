import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { buttonVariants } from "@/components/ui/button";
import { APP_NAME, ROUTES } from "@/config/app";

/** Only capabilities that exist in the dashboard today. Each maps to a real route. */
const WORKSPACE_PARTS = [
  { name: "Catalog", text: "Products with variants and images, organised into categories and collections." },
  { name: "Inventory", text: "Stock per product and variant, with a low-stock view." },
  { name: "Customers", text: "A customer list with a detail page for each person." },
  { name: "Analytics", text: "Sales for the last 30 days, top products and stock alerts." },
  { name: "Team", text: "Owner, manager and staff roles. Only owners add members; deleting is limited to owners and managers." },
  { name: "Store", text: "A public storefront for each company at its own subdomain." },
];

// Sign-in links are plain anchors: /login redirects signed-in users to /dashboard, and a redirected client-side
// <Link> navigation fails in React's Flight client ("chunk.reason.enqueueModel is not a function").
export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav aria-label="Main" className="flex items-center gap-5 text-sm">
            <a href="#workspace" className="hidden text-muted-foreground transition-colors hover:text-foreground sm:inline">
              What is included
            </a>
            <a href="#isolation" className="hidden text-muted-foreground transition-colors hover:text-foreground sm:inline">
              Security
            </a>
            <a href={ROUTES.login} className={buttonVariants({ size: "default" })}>
              Sign in
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-14 lg:py-24">
          <div>
            <h1 className="max-w-xl text-3xl font-semibold text-balance sm:text-5xl sm:leading-[1.1]">
              One workspace for running your online store
            </h1>
            <p className="mt-5 max-w-lg text-base text-pretty text-muted-foreground sm:text-lg">
              {APP_NAME} gives each company its own catalog, inventory, customers and team, and a public store at its own subdomain.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a href={ROUTES.login} className={buttonVariants({ size: "lg", className: "px-4" })}>
                Sign in <ArrowRight aria-hidden />
              </a>
              <a href="#workspace" className="text-sm font-medium text-foreground underline-offset-4 hover:underline">
                See what is included
              </a>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Accounts are created by the {APP_NAME} team, so there is no public registration.</p>
          </div>

          <WorkspacePreview />
        </section>

        <section id="workspace" className="border-t bg-card">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
            <h2 className="max-w-md text-2xl font-semibold text-balance sm:text-3xl">What each company workspace includes</h2>
            <dl className="mt-10 grid gap-x-12 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {WORKSPACE_PARTS.map((part) => (
                <div key={part.name} className="border-t pt-4">
                  <dt className="font-mono text-xs text-muted-foreground">{part.name}</dt>
                  <dd className="mt-2 text-sm text-pretty">{part.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section id="isolation" className="border-t">
          <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-14">
            <h2 className="max-w-md text-2xl font-semibold text-balance sm:text-3xl">Every company&apos;s data stays its own</h2>
            <div className="space-y-4 text-muted-foreground">
              <p className="text-pretty">
                Workspaces are isolated in the database itself with row level security, not only in the interface. A signed-in user can reach only the companies they belong to.
              </p>
              <p className="text-pretty">Sign in to manage your catalog, stock and team, or open your store at its subdomain.</p>
              <a href={ROUTES.login} className={buttonVariants({ variant: "outline", className: "mt-2" })}>
                Sign in
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">© {new Date().getFullYear()} {APP_NAME}</footer>
    </div>
  );
}

/** Static illustration of the product list. Rows are placeholders, not store data. */
function WorkspacePreview() {
  const rows = [
    { name: "Canvas tote", sku: "TOTE-01", stock: "In stock", tone: "bg-success" },
    { name: "Ceramic mug", sku: "MUG-02", stock: "Low stock", tone: "bg-warning" },
    { name: "Linen apron", sku: "APR-03", stock: "In stock", tone: "bg-success" },
    { name: "Enamel pin set", sku: "PIN-04", stock: "Out of stock", tone: "bg-error" },
    { name: "Notebook", sku: "NTB-05", stock: "In stock", tone: "bg-success" },
  ];
  const nav = ["Overview", "Products", "Categories", "Collections", "Inventory", "Customers"];
  return (
    <figure aria-label="Illustration of the products page" className="min-w-0">
      <div className="overflow-hidden rounded-lg border bg-card" aria-hidden>
        <div className="flex h-9 items-center gap-1.5 border-b bg-muted/60 px-3">
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
        </div>
        <div className="grid grid-cols-[9rem_minmax(0,1fr)] sm:grid-cols-[10rem_minmax(0,1fr)]">
          <div className="hidden border-r bg-sidebar p-3 sm:block">
            <ul className="space-y-0.5 text-xs text-sidebar-foreground">
              {nav.map((n) => (
                <li key={n} className={n === "Products" ? "rounded-md bg-sidebar-accent px-2 py-1.5 font-medium text-sidebar-accent-foreground" : "px-2 py-1.5"}>
                  {n}
                </li>
              ))}
            </ul>
          </div>
          <div className="col-span-2 p-4 sm:col-span-1 sm:p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Products</p>
              <span className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">Add product</span>
            </div>
            <ul className="mt-4 divide-y rounded-lg border">
              {rows.map((r) => (
                <li key={r.sku} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="size-8 shrink-0 rounded-md bg-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.name}</span>
                    <span className="block font-mono text-[11px] text-muted-foreground">{r.sku}</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={`size-1.5 rounded-full ${r.tone}`} />
                    {r.stock}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-xs text-muted-foreground">Illustration with placeholder products.</figcaption>
    </figure>
  );
}
