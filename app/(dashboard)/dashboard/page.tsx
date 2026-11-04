import type { Metadata } from "next";
import { Boxes, ExternalLink, Package, ShoppingCart, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { canManageStore, ROLE_LABELS } from "@/lib/auth/permissions";
import { requireWorkspace } from "@/lib/tenant/context";

export const metadata: Metadata = { title: "Dashboard" };

const UPCOMING = [
  { icon: Package, title: "Products", text: "Catalog, variants and categories." },
  { icon: Boxes, title: "Inventory", text: "Stock levels and adjustments." },
  { icon: ShoppingCart, title: "Orders", text: "Fulfilment and payments." },
  { icon: Users, title: "Customers", text: "Profiles and order history." },
];

export default async function DashboardPage() {
  const { active, store } = await requireWorkspace();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{active.tenant.name}</h1>
        <Badge variant="secondary">{ROLE_LABELS[active.role]}</Badge>
      </div>

      {store ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {store.name}
              <Badge variant={store.status === "active" ? "default" : "outline"} className="capitalize">
                {store.status}
              </Badge>
            </CardTitle>
            <CardDescription>{store.description ?? "No description yet."}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-muted-foreground">Store address</p>
              <p className="inline-flex items-center gap-1 font-medium">
                {store.slug}.storeforge.app <ExternalLink className="size-3 opacity-50" aria-hidden />
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Currency</p>
              <p className="font-medium">{store.currency}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Timezone</p>
              <p className="font-medium">{store.timezone}</p>
            </div>
            {canManageStore(active.role) ? null : (
              <p className="text-xs text-muted-foreground sm:col-span-3">You have read-only access to store settings.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No store yet</CardTitle>
            <CardDescription>This workspace does not have a store.</CardDescription>
          </CardHeader>
        </Card>
      )}

      <section aria-labelledby="coming-soon">
        <h2 id="coming-soon" className="mb-3 text-sm font-medium text-muted-foreground">
          Coming next
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {UPCOMING.map(({ icon: Icon, title, text }) => (
            <Card key={title} size="sm" className="border-dashed">
              <CardHeader>
                <Icon className="mb-1 size-5 text-muted-foreground" aria-hidden />
                <CardTitle>{title}</CardTitle>
                <CardDescription>{text}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
