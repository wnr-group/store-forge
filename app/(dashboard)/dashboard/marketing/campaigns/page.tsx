import type { Metadata } from "next";
import { Megaphone, SearchX } from "lucide-react";
import { AddCampaignButton, CampaignRowActions } from "@/components/marketing/campaign-actions";
import type { CampaignDialogContext } from "@/components/marketing/campaign-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ListFilters } from "@/components/shared/list-filters";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/config/app";
import { can, canManageMarketing } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/format-date";
import { CAMPAIGN_PHASE } from "@/lib/marketing/labels";
import { formatMoney } from "@/lib/money";
import { requireWorkspaceCan } from "@/lib/tenant/context";
import { campaignListQuerySchema, flatten } from "@/lib/validations/commerce-lists";
import { listCollections, listProductOptions } from "@/services/collection.service";
import { listAllDiscountCodes, listCampaigns } from "@/services/marketing.service";

export const metadata: Metadata = { title: "Campaigns" };

const orEmpty = async <T,>(allowed: boolean, load: () => Promise<T[]>): Promise<T[]> => {
  if (!allowed) return [];
  try {
    return await load();
  } catch {
    return [];
  }
};

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = flatten(await searchParams);
  const query = campaignListQuerySchema.parse(raw);
  const { active, store } = await requireWorkspaceCan("marketing:view");
  const currency = store?.currency ?? "INR";
  const timeZone = store?.timezone ?? "Asia/Kolkata";
  const canManage = canManageMarketing(active);
  const catalogAccess = can(active, "catalog:view");

  const [result, products, collections, codes] = await Promise.all([
    listCampaigns(query),
    canManage ? orEmpty(catalogAccess, () => listProductOptions()) : [],
    canManage ? orEmpty(catalogAccess, async () => (await listCollections()).map((c) => ({ id: c.id, name: c.name }))) : [],
    canManage ? orEmpty(true, async () => (await listAllDiscountCodes()).map((d) => ({ id: d.id, name: d.code, note: d.campaignId ? "In a campaign" : undefined }))) : [],
  ]);
  const ctx: CampaignDialogContext = { timeZone, products, collections, discounts: codes, catalogAccess };
  const add = canManage ? <AddCampaignButton ctx={ctx} /> : null;
  const filtered = !!query.q || !!query.status;
  const when = (iso: string | null) => (iso ? formatDate(new Date(iso), timeZone) : null);

  return (
    <>
      <PageHeader title="Campaigns" description="Group discount codes into one promotion, run it for a set time, and see what it brought in." actions={result.total || filtered ? add : null} />
      {result.total === 0 && !filtered ? (
        <EmptyState icon={Megaphone} title="No campaigns yet" description="Create a campaign for a sale or an occasion, add its discount codes, and activate it when you are ready." action={add} />
      ) : (
        <>
          <ListFilters
            searchPlaceholder="Search campaigns"
            filters={[
              {
                key: "status",
                label: "Status",
                options: [
                  { value: "all", label: "All" },
                  { value: "draft", label: "Draft" },
                  { value: "active", label: "Active" },
                  { value: "paused", label: "Paused" },
                  { value: "completed", label: "Completed" },
                ],
              },
            ]}
            sortOptions={[
              { value: "created:desc", label: "Newest first" },
              { value: "name:asc", label: "Name A–Z" },
              { value: "start:desc", label: "Latest start" },
            ]}
          />
          {result.items.length === 0 ? (
            <EmptyState icon={SearchX} title="No campaigns match" description="Try a different search or status." />
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead>Campaign</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">Runs</TableHead>
                      <TableHead className="text-right">Codes</TableHead>
                      <TableHead className="text-right">Orders</TableHead>
                      <TableHead className="hidden text-right lg:table-cell">Discounted</TableHead>
                      <TableHead className="hidden text-right lg:table-cell">Net sales</TableHead>
                      <TableHead className="text-right">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.items.map((c) => {
                      const phase = CAMPAIGN_PHASE[c.phase];
                      return (
                        <TableRow key={c.id}>
                          <TableCell>
                            <span className="font-medium">{c.name}</span>
                            {c.description ? <span className="block max-w-xs truncate text-xs text-muted-foreground">{c.description}</span> : null}
                          </TableCell>
                          <TableCell>
                            <StatusBadge tone={phase.tone}>{phase.label}</StatusBadge>
                          </TableCell>
                          <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{c.startsAt || c.endsAt ? `${when(c.startsAt) ?? "Now"} to ${when(c.endsAt) ?? "no end"}` : "No dates set"}</TableCell>
                          <TableCell className="text-right tabular-nums">{c.performance.discountCodes}</TableCell>
                          <TableCell className="text-right tabular-nums">{c.performance.redemptions}</TableCell>
                          <TableCell className="hidden text-right tabular-nums lg:table-cell">{formatMoney(c.performance.discountTotalMinor, currency)}</TableCell>
                          <TableCell className="hidden text-right tabular-nums lg:table-cell">{formatMoney(c.performance.netSalesMinor, currency)}</TableCell>
                          <TableCell>
                            <CampaignRowActions id={c.id} name={c.name} status={c.status} canManage={canManage} ctx={ctx} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Results add up the orders that used any of the campaign&apos;s codes. “Net sales” is the item value after discount of paid or fulfilled orders, before refunds.</p>
              <Pagination page={result.page} pageSize={result.pageSize} total={result.total} basePath={ROUTES.campaigns} params={{ q: query.q, status: query.status, sort: raw.sort, dir: raw.dir }} />
            </>
          )}
        </>
      )}
    </>
  );
}
