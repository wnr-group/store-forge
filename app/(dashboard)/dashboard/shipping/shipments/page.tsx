import type { Metadata } from "next";
import Link from "next/link";
import { PackageSearch, SearchX } from "lucide-react";
import { SHIPMENT_STATUS_LABELS, ShipmentStatusBadge } from "@/components/orders/order-labels";
import { EmptyState } from "@/components/shared/empty-state";
import { ListFilters } from "@/components/shared/list-filters";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { ShippingNav } from "@/components/shipping/shipping-nav";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/config/app";
import { formatDateTime } from "@/lib/format-date";
import { requireWorkspaceCan } from "@/lib/tenant/context";
import { flatten, shipmentListQuerySchema } from "@/lib/validations/commerce-lists";
import { listShipments } from "@/services/shipping.service";

export const metadata: Metadata = { title: "Shipments" };

export default async function ShipmentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = shipmentListQuerySchema.parse(flatten(await searchParams));
  const { store } = await requireWorkspaceCan("orders:view");
  const result = await listShipments({ page: query.page, search: query.q || undefined, status: query.status, providerCode: query.carrier });
  const timezone = store?.timezone ?? "UTC";
  const filtered = Boolean(query.q || query.status || query.carrier);

  return (
    <>
      <PageHeader title="Shipping" description="Every parcel booked with a carrier. Book one from an order." />
      <ShippingNav />
      {result.total === 0 && !filtered ? (
        <EmptyState icon={PackageSearch} title="No shipments yet" description="Open a confirmed order and choose Book shipment." />
      ) : (
        <>
          <ListFilters
            searchPlaceholder="Search AWB or order number"
            filters={[
              { key: "status", label: "Status", options: Object.entries(SHIPMENT_STATUS_LABELS).map(([value, label]) => ({ value, label })) },
              { key: "carrier", label: "Carrier", options: [{ value: "shiprocket", label: "Shiprocket" }, { value: "delhivery", label: "Delhivery" }, { value: "bluedart", label: "Blue Dart" }] },
            ]}
          />
          {result.items.length === 0 ? (
            <EmptyState icon={SearchX} title="No shipments match" description="Try a different search or clear the filters." />
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead>Shipment</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">Payment</TableHead>
                      <TableHead className="hidden lg:table-cell">Booked</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.items.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <Link href={`${ROUTES.shipments}/${s.id}`} className="font-medium hover:text-primary hover:underline">
                            {s.awb ?? "Awaiting AWB"}
                          </Link>
                          <span className="block text-xs text-muted-foreground">{s.courierName ?? s.providerCode}</span>
                        </TableCell>
                        <TableCell>
                          <Link href={`${ROUTES.orders}/${s.orderId}`} className="hover:text-primary hover:underline">
                            #{s.orderNumber}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <ShipmentStatusBadge status={s.status} />
                          {s.failureReason ? <span className="mt-0.5 block max-w-xs truncate text-xs text-destructive">{s.failureReason}</span> : null}
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">{s.paymentMode === "cod" ? "Cash on delivery" : "Prepaid"}</TableCell>
                        <TableCell className="hidden text-muted-foreground lg:table-cell">{formatDateTime(new Date(s.createdAt), timezone)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination page={result.page} pageSize={result.pageSize} total={result.total} basePath={ROUTES.shipments} params={{ q: query.q, status: query.status, carrier: query.carrier }} />
            </>
          )}
        </>
      )}
    </>
  );
}
