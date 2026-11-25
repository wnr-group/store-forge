import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { OrderTaxApi } from "@/lib/api/endpoints/checkout-api";
import { formatMoney } from "@/lib/money";

const rate = (bps: number) => `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`;
const KIND: Record<string, string> = { item: "Item", shipping: "Shipping", cod_fee: "COD charge" };

/** The GST exactly as it was charged when the order was placed (saved per line; later changes to tax settings never alter it). */
export function TaxBreakdownTable({ tax, currency }: { tax: OrderTaxApi; currency: string }) {
  if (tax.regime === "none" || tax.lines.length === 0) return <p className="text-sm text-muted-foreground">No GST was charged on this order.</p>;
  const state = tax.stateTaxKind === "utgst" ? "UTGST" : "SGST";
  const intra = tax.regime === "intra";
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {tax.inclusive ? "Prices included GST. " : "GST was added to prices. "}
        {tax.sellerGstin ? `Seller GSTIN ${tax.sellerGstin}. ` : ""}
        {intra ? `Seller and buyer are in the same state: CGST + ${state}.` : "Delivered to another state: IGST."}
      </p>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Line</TableHead>
              <TableHead className="hidden sm:table-cell">HSN</TableHead>
              <TableHead className="text-right">Taxable</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              {intra ? (
                <>
                  <TableHead className="text-right">CGST</TableHead>
                  <TableHead className="text-right">{state}</TableHead>
                </>
              ) : (
                <TableHead className="text-right">IGST</TableHead>
              )}
              <TableHead className="text-right">Tax</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tax.lines.map((l, i) => (
              <TableRow key={i}>
                <TableCell>
                  {l.description}
                  <span className="block text-xs text-muted-foreground">{KIND[l.kind] ?? l.kind}</span>
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">{l.hsnCode ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(l.taxableMinor, currency)}</TableCell>
                <TableCell className="text-right tabular-nums">{rate(l.rateBps)}</TableCell>
                {intra ? (
                  <>
                    <TableCell className="text-right tabular-nums">{formatMoney(l.cgstMinor, currency)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(l.sgstMinor, currency)}</TableCell>
                  </>
                ) : (
                  <TableCell className="text-right tabular-nums">{formatMoney(l.igstMinor, currency)}</TableCell>
                )}
                <TableCell className="text-right tabular-nums">{formatMoney(l.taxMinor, currency)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
