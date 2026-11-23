"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Download, Loader2, Upload } from "lucide-react";
import { importProductsAction } from "@/app/(dashboard)/dashboard/products/import/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/config/app";
import { buildErrorReportCsv } from "@/lib/import/error-report";
import { importDetailsSchema, type ImportDetails } from "@/lib/import/import-result";
import { ALL_COLUMNS, LIMITS, REQUIRED_COLUMNS, buildTemplateCsv } from "@/lib/import/product-columns";
import { cn } from "@/lib/utils";

type Outcome = { kind: "success"; count: number } | { kind: "failed"; message: string; details: ImportDetails | null };

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function ProductImport() {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [pending, start] = useTransition();

  const choose = (f: File | null) => {
    setOutcome(null);
    setClientError(null);
    if (!f) return setFile(null);
    const ext = f.name.toLowerCase().match(/\.[^.]+$/)?.[0];
    if (ext === ".xls") setClientError("Legacy .xls files are not supported. Save the file as .xlsx or CSV and upload it again.");
    else if (ext !== ".csv" && ext !== ".xlsx") setClientError("Upload a .csv or .xlsx file.");
    else if (f.size > LIMITS.fileBytes) setClientError("The file is larger than 1 MB. Remove unused rows or split it into smaller files.");
    setFile(f);
  };
  const reset = () => { setFile(null); setOutcome(null); setClientError(null); if (input.current) input.current.value = ""; };

  const submit = () => {
    if (!file || clientError) return;
    start(async () => {
      const body = new FormData();
      body.set("file", file);
      const res = await importProductsAction(body);
      if (res.ok) {
        setOutcome({ kind: "success", count: res.data?.count ?? 0 });
        setFile(null);
        if (input.current) input.current.value = "";
        return;
      }
      const parsed = importDetailsSchema.safeParse(res.details);
      setOutcome({ kind: "failed", message: res.error, details: parsed.success ? parsed.data : null });
    });
  };

  const rowDetails = outcome?.kind === "failed" && outcome.details?.kind === "rows" ? outcome.details : null;
  const fileErrors = outcome?.kind === "failed" && outcome.details?.kind === "file" ? outcome.details.errors : [];
  const canSubmit = Boolean(file) && !clientError && !pending;

  return (
    <div className="space-y-4">
      <section className="rounded-lg border bg-card p-4 text-sm" aria-labelledby="import-help">
        <h2 id="import-help" className="mb-2 font-medium">Before you start</h2>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Upload a .csv or .xlsx file, up to 1 MB and {LIMITS.rows} products. Only the first sheet of an Excel file is read.</li>
          <li>Required columns: {REQUIRED_COLUMNS.join(" and ")} (price must be greater than zero). Optional: {ALL_COLUMNS.filter((c) => !(REQUIRED_COLUMNS as readonly string[]).includes(c)).join(", ")}.</li>
          <li>category and subcategory must already exist; match them by name or handle. A subcategory must belong to the category on the same row.</li>
          <li>Products are created as drafts unless the status column says active. Variants, options, images and collections are added afterwards in the product editor.</li>
          <li>If any row has a problem, nothing is imported. SKUs in Excel that need leading zeros must be formatted as text.</li>
          <li>Uploading the same file again creates the products again. SKUs prevent duplicates only for rows that have one.</li>
          <li>Products created by one import share the same creation time, so their order by creation time within that import is not guaranteed.</li>
        </ul>
        <Button type="button" variant="outline" className="mt-3" onClick={() => download("product-import-template.csv", buildTemplateCsv())}>
          <Download aria-hidden /> Download template
        </Button>
      </section>

      {outcome?.kind === "success" ? (
        <section role="status" className="rounded-lg border bg-card p-4">
          <p className="font-medium">{outcome.count} {outcome.count === 1 ? "product" : "products"} imported.</p>
          <div className="mt-3 flex gap-2">
            <Link href={ROUTES.products} className={buttonVariants()}>View products</Link>
            <Button type="button" variant="outline" onClick={reset}>Import another file</Button>
          </div>
        </section>
      ) : (
        <section className="rounded-lg border bg-card p-4">
          <label htmlFor="import-file" className="mb-2 block text-sm font-medium">Choose a CSV or XLSX file</label>
          <input id="import-file" ref={input} type="file" accept=".csv,.xlsx" disabled={pending} onChange={(e) => choose(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
          {file ? <p className="mt-2 text-sm text-muted-foreground">Selected: {file.name}</p> : null}
          {clientError ? <p role="alert" className="mt-2 text-sm text-error">{clientError}</p> : null}
          <Button type="button" className="mt-3" onClick={submit} disabled={!canSubmit}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />} {pending ? "Importing…" : "Import products"}
          </Button>
        </section>
      )}

      {outcome?.kind === "failed" ? (
        <section role="alert" className="rounded-lg border border-error bg-card p-4 text-sm">
          <p className="font-medium text-error">No products were imported.</p>
          {fileErrors.length ? <ul className="mt-2 list-disc space-y-1 pl-5">{fileErrors.map((e) => <li key={e.message}>{e.message}</li>)}</ul> : null}
          {!rowDetails && !fileErrors.length ? <p className="mt-2">{outcome.message}</p> : null}
          {rowDetails ? (
            <>
              <p className="mt-2">
                {rowDetails.total > rowDetails.errors.length ? `Showing the first ${rowDetails.errors.length} of ${rowDetails.total} errors. Fix these and re-upload to see the rest.` : `${rowDetails.total} ${rowDetails.total === 1 ? "problem" : "problems"} found. Fix them and upload the file again.`}
              </p>
              <div className={cn("mt-3 max-h-96 overflow-auto rounded-md border")}>
                <Table>
                  <TableHeader><TableRow><TableHead>Row</TableHead><TableHead>Column</TableHead><TableHead>Message</TableHead><TableHead className="hidden sm:table-cell">Value</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {rowDetails.errors.map((e) => (
                      <TableRow key={`${e.row}:${e.column}`}>
                        <TableCell className="tabular-nums">{e.row}</TableCell>
                        <TableCell className="font-mono text-xs">{e.column}</TableCell>
                        <TableCell>{e.message}</TableCell>
                        <TableCell className="hidden max-w-48 truncate text-muted-foreground sm:table-cell">{e.value}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button type="button" variant="outline" className="mt-3" onClick={() => download("product-import-errors.csv", buildErrorReportCsv(rowDetails.errors))}>
                <Download aria-hidden /> Download error report
              </Button>
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
