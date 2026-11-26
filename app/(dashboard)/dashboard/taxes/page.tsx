import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { TaxSettingsForm } from "@/components/taxes/tax-settings-form";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { canManageTax, canViewTaxReport } from "@/lib/auth/permissions";
import { formatMoney } from "@/lib/money";
import { rateLabel } from "@/lib/tax/rates";
import { requireWorkspaceCan } from "@/lib/tenant/context";
import { flatten, taxReportQuerySchema } from "@/lib/validations/commerce-lists";
import { getTaxReport, getTaxSettings } from "@/services/tax.service";
import { TaxReportRange } from "@/components/taxes/tax-report-range";

export const metadata: Metadata = { title: "Taxes" };

export default async function TaxesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const range = taxReportQuerySchema.parse(flatten(await searchParams));
  const { active, store } = await requireWorkspaceCan("tax:view");
  const currency = store?.currency ?? "INR";
  const settings = await getTaxSettings();
  const report = canViewTaxReport(active) ? await getTaxReport({ from: range.from, to: range.to }) : null;
  const money = (m: number) => formatMoney(m, currency);

  return (
    <>
      <PageHeader title="Taxes" description="Configure GST and see what you charged." />
      <div className="grid max-w-5xl gap-6">
        <TaxSettingsForm
          canManage={canManageTax(active)}
          settings={{ enabled: settings.enabled, gstin: settings.gstin ?? "", legalName: settings.legalName ?? "", stateName: settings.stateName, pricesIncludeTax: settings.pricesIncludeTax, defaultRateBps: settings.defaultRateBps, chargesTaxable: settings.chargesTaxable, chargesRateBps: settings.chargesRateBps }}
        />
        {report ? (
          <SectionCard title="GST report" description="Tax charged on orders that were not cancelled or failed, as saved on each order.">
            <TaxReportRange from={report.from} to={report.to} />
            <p className="text-sm text-muted-foreground">
              {report.orders} order{report.orders === 1 ? "" : "s"} in this period, {report.taxedOrders} with GST. Delivery and COD charges carried {money(report.chargesTaxMinor)} of the tax.
            </p>
            {report.byRate.length === 0 ? (
              <p className="text-sm text-muted-foreground">No GST was charged in this period.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rate</TableHead>
                      <TableHead className="text-right">Lines</TableHead>
                      <TableHead className="text-right">Taxable value</TableHead>
                      <TableHead className="text-right">CGST</TableHead>
                      <TableHead className="text-right">SGST / UTGST</TableHead>
                      <TableHead className="text-right">IGST</TableHead>
                      <TableHead className="text-right">Total tax</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.byRate.map((r) => (
                      <TableRow key={r.rateBps}>
                        <TableCell>{rateLabel(r.rateBps)}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.lines}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(r.taxableMinor)}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(r.cgstMinor)}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(r.sgstMinor)}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(r.igstMinor)}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(r.taxMinor)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-medium">Total</TableCell>
                      <TableCell className="text-right tabular-nums">{report.totals.lines}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(report.totals.taxableMinor)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(report.totals.cgstMinor)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(report.totals.sgstMinor)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(report.totals.igstMinor)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{money(report.totals.taxMinor)}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            )}
          </SectionCard>
        ) : null}
      </div>
    </>
  );
}
