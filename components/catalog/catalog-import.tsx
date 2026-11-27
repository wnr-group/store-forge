"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, Download, Loader2, Upload, X } from "lucide-react";
import { importCatalogChunkAction, parseCatalogFileAction } from "@/app/(dashboard)/dashboard/catalog/actions";
import { FormField } from "@/components/shared/form-field";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/config/app";
import { cn } from "@/lib/utils";
import { type CatalogImportError, type CatalogImportLevelRow, type CatalogImportResult, type CatalogImportRow, type CatalogImportSummary, type CatalogStatus } from "@/lib/catalog/types";
import { buildErrorReportCsv } from "@/lib/import/error-report";
import { buildCatalogTemplateCsv, buildLevelsTemplateCsv, CATALOG_FILE_LIMITS, chunkImportRows } from "@/lib/import/catalog-columns";
import { aggregateImport, type ImportAggregate } from "@/lib/import/catalog-aggregate";

type Parsed = { rows: CatalogImportRow[]; levels: CatalogImportLevelRow[] | null; depth: number };
type FileProblem = { code?: string; message: string };
type Phase = "idle" | "reading" | "checking" | "preview" | "importing" | "done" | "failed";

/** The native file input, with its "Choose file" button drawn like the app's outline buttons (the CSS reset removes the browser's own look). */
const FILE_INPUT_CLASS =
  "block w-full cursor-pointer rounded-md border border-input bg-card text-sm text-foreground outline-none transition-colors file:mr-3 file:h-8 file:cursor-pointer file:border-0 file:border-r file:border-border file:bg-muted file:px-3 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/70 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive";

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([`\uFEFF${text}`], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const clientCheck = (f: File | null): string | null => {
  if (!f) return null;
  const ext = f.name.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (ext === ".xls") return "Legacy .xls files are not supported. Save the file as .xlsx or CSV and upload it again.";
  if (ext !== ".csv" && ext !== ".xlsx") return "Upload a .csv or .xlsx file.";
  if (f.size > CATALOG_FILE_LIMITS.fileBytes) return "The file is larger than 1 MB. Split it into smaller files.";
  return null;
};

const SUMMARY_LABELS: [keyof CatalogImportSummary, string][] = [
  ["levelsCreated", "Levels to create"],
  ["levelsUpdated", "Levels to update"],
  ["nodesCreated", "Items to create"],
  ["nodesUpdated", "Items to update"],
  ["nodesUnchanged", "Items already as in the file"],
  ["assignmentsCreated", "Product placements to add"],
  ["assignmentsExisting", "Placements that already exist"],
];

/**
 * Import levels, items and product placements from a CSV or Excel file. The file is read on the server (never sent to the API as a
 * file): the rows go to the API in requests of at most 2000 rows. First a dry run reports exactly what would happen and every
 * problem; only then can the import run. A real import with any problem changes nothing (the API refuses it as a whole).
 */
export function CatalogImport({ hierarchyExists, levelNames }: { hierarchyExists: boolean; levelNames: string[] }) {
  const itemsInput = useRef<HTMLInputElement>(null);
  const levelsInput = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<File | null>(null);
  const [levelsFile, setLevelsFile] = useState<File | null>(null);
  const [name, setName] = useState("Catalog");
  const [defaultStatus, setDefaultStatus] = useState<CatalogStatus>("draft");
  const [phase, setPhase] = useState<Phase>("idle");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [preview, setPreview] = useState<ImportAggregate | null>(null);
  const [result, setResult] = useState<ImportAggregate | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [fileProblems, setFileProblems] = useState<FileProblem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<{ total: number; errors: CatalogImportError[] } | null>(null);
  const [, startTransition] = useTransition();

  const itemsError = clientCheck(items);
  const levelsError = clientCheck(levelsFile);
  const busy = phase === "reading" || phase === "checking" || phase === "importing";

  const reset = () => {
    setItems(null);
    setLevelsFile(null);
    setPhase("idle");
    setParsed(null);
    setPreview(null);
    setResult(null);
    setFileProblems([]);
    setMessage(null);
    setRowErrors(null);
    if (itemsInput.current) itemsInput.current.value = "";
    if (levelsInput.current) levelsInput.current.value = "";
  };

  /** Drops what an earlier check or failure left on screen. A new check always reads the files again, so nothing stale can be imported. */
  const clearStale = () => {
    setPhase("idle");
    setParsed(null);
    setPreview(null);
    setMessage(null);
    setFileProblems([]);
    setRowErrors(null);
  };

  /** Removes one file: its state and its native input (so the same file can be chosen again). The other file and the form choices stay. */
  const clearFile = (which: "items" | "levels") => {
    if (busy || phase === "preview") return;
    if (which === "items") {
      setItems(null);
      if (itemsInput.current) itemsInput.current.value = "";
    } else {
      setLevelsFile(null);
      if (levelsInput.current) levelsInput.current.value = "";
    }
    clearStale();
  };

  /** The same request for every chunk: the levels go with each one, so any chunk stands on its own (the API is idempotent). */
  const requestFor = (rows: CatalogImportRow[], dryRun: boolean, from: Parsed) => ({
    dryRun,
    ...(hierarchyExists ? {} : { hierarchyName: name.trim() || "Catalog" }),
    defaultStatus,
    ...(from.levels ? { levels: from.levels } : {}),
    rows,
  });

  /** Sends every chunk in order; stops at the first one that fails. */
  const sendAll = async (from: Parsed, dryRun: boolean): Promise<{ ok: true; aggregate: ImportAggregate } | { ok: false; message: string; rows: { total: number; errors: CatalogImportError[] } | null }> => {
    const chunks = chunkImportRows(from.rows);
    const parts: CatalogImportResult[] = [];
    setProgress({ done: 0, total: chunks.length });
    for (const chunk of chunks) {
      const res = await importCatalogChunkAction(requestFor(chunk, dryRun, from));
      if (!res.ok) {
        const d = res.details as { kind?: string; total?: number; errors?: CatalogImportError[] } | undefined;
        return { ok: false, message: res.error, rows: d?.kind === "rows" && d.errors ? { total: d.total ?? d.errors.length, errors: d.errors } : null };
      }
      parts.push(res.data as CatalogImportResult);
      setProgress({ done: parts.length, total: chunks.length });
    }
    return { ok: true, aggregate: aggregateImport(parts) };
  };

  const check = () => {
    if (!items || itemsError || levelsError) return;
    setFileProblems([]);
    setMessage(null);
    setRowErrors(null);
    setPreview(null);
    setPhase("reading");
    startTransition(async () => {
      const body = new FormData();
      body.set("file", items);
      if (levelsFile) body.set("levels", levelsFile);
      const read = await parseCatalogFileAction(body);
      if (!read.ok || !read.data) {
        const details = !read.ok ? (read.details as { kind?: string; errors?: FileProblem[] } | undefined) : undefined;
        setFileProblems(details?.kind === "file" && details.errors ? details.errors : []);
        setMessage(read.ok ? "The file could not be read." : read.error);
        return setPhase("failed");
      }
      const from: Parsed = { rows: read.data.rows, levels: read.data.levels, depth: read.data.depth };
      setParsed(from);
      setPhase("checking");
      const outcome = await sendAll(from, true);
      if (!outcome.ok) {
        setMessage(outcome.message);
        setRowErrors(outcome.rows);
        return setPhase("failed");
      }
      setPreview(outcome.aggregate);
      setPhase("preview");
    });
  };

  const commit = () => {
    if (!parsed) return;
    setMessage(null);
    setRowErrors(null);
    setPhase("importing");
    startTransition(async () => {
      const outcome = await sendAll(parsed, false);
      if (!outcome.ok) {
        setMessage(outcome.message);
        setRowErrors(outcome.rows);
        return setPhase("failed");
      }
      setResult(outcome.aggregate);
      setPhase("done");
    });
  };

  const shownErrors = preview?.errors ?? rowErrors?.errors ?? [];
  const totalErrors = preview ? preview.totalErrors : (rowErrors?.total ?? 0);

  return (
    <div className="space-y-4">
      <section className="rounded-lg border bg-card p-4 text-sm" aria-labelledby="catalog-import-help">
        <h2 id="catalog-import-help" className="mb-2 font-medium">
          Before you start
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          <li>
            Upload a .csv or .xlsx file of up to 1 MB and {CATALOG_FILE_LIMITS.rows.toLocaleString("en-US")} rows. Only the first sheet of an Excel file holds the items.
          </li>
          <li>
            One row is one item: fill <code>level_1</code> (the top level), <code>level_2</code> below it, and so on, with the item&apos;s name. The row is about the last filled level. Parents you do not list are created.
          </li>
          <li>
            To place a product on the item add <code>product_sku</code>, <code>product_slug</code> or <code>product_id</code>. A part number alone never identifies a product (it is not unique). One product can appear on many rows, so it can sit on many items.
          </li>
          <li>
            Optional columns: <code>status</code>, <code>description</code>, <code>position</code>, <code>product_position</code>. An empty cell never clears anything.
          </li>
          <li>
            Levels: they must already exist, or come from a second sheet named <strong>Levels</strong> (columns <code>name</code>, <code>can_hold_products</code>), or from the optional levels file below. An import never renames, reorders or deletes levels.
          </li>
          <li>Importing the same file again changes nothing. If any row has a problem, nothing is imported.</li>
          {levelNames.length > 0 ? <li>Your levels now: {levelNames.join(" → ")}.</li> : null}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => download("catalog-import-template.csv", buildCatalogTemplateCsv(levelNames))}>
            <Download aria-hidden /> Items template
          </Button>
          <Button type="button" variant="outline" onClick={() => download("catalog-levels-template.csv", buildLevelsTemplateCsv(levelNames))}>
            <Download aria-hidden /> Levels template
          </Button>
          {hierarchyExists ? (
            <a href={`${ROUTES.catalog}/export?format=xlsx`} download className={buttonVariants({ variant: "outline" })}>
              <Download aria-hidden /> Export current catalog (Excel)
            </a>
          ) : null}
        </div>
      </section>

      {phase === "done" && result ? (
        <section role="status" className="rounded-lg border bg-card p-4">
          <p className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="size-5 text-success" aria-hidden /> Import finished
          </p>
          <SummaryList summary={result.summary} />
          <div className="mt-3 flex gap-2">
            <Link href={ROUTES.catalog} className={buttonVariants()}>
              View catalog
            </Link>
            <Button type="button" variant="outline" onClick={reset}>
              Import another file
            </Button>
          </div>
        </section>
      ) : (
        <section className="space-y-4 rounded-lg border bg-card p-4">
          <FormField id="catalog-file" label="Items file (CSV or Excel)" required error={itemsError ?? undefined}>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="catalog-file"
                ref={itemsInput}
                type="file"
                accept=".csv,.xlsx"
                disabled={busy || phase === "preview"}
                onChange={(e) => {
                  setItems(e.target.files?.[0] ?? null);
                  clearStale();
                }}
                className={cn(FILE_INPUT_CLASS, "w-auto min-w-0 flex-1 basis-60")}
                aria-invalid={Boolean(itemsError)}
                aria-describedby="catalog-file-msg"
              />
              {items && !busy && phase !== "preview" ? (
                <Button type="button" variant="outline" size="sm" onClick={() => clearFile("items")}>
                  <X aria-hidden /> Remove file
                  <span className="sr-only">: items file {items.name}</span>
                </Button>
              ) : null}
            </div>
          </FormField>
          <FormField id="catalog-levels-file" label="Levels file" optional error={levelsError ?? undefined} hint="Only needed to create or set levels from a CSV. An Excel workbook can carry a sheet named Levels instead.">
            <div className="flex flex-wrap items-center gap-2">
              <input id="catalog-levels-file" ref={levelsInput} type="file" accept=".csv,.xlsx" disabled={busy || phase === "preview"} onChange={(e) => { setLevelsFile(e.target.files?.[0] ?? null); clearStale(); }} className={cn(FILE_INPUT_CLASS, "w-auto min-w-0 flex-1 basis-60")} aria-invalid={Boolean(levelsError)} aria-describedby="catalog-levels-file-msg" />
              {levelsFile && !busy && phase !== "preview" ? (
                <Button type="button" variant="outline" size="sm" onClick={() => clearFile("levels")}>
                  <X aria-hidden /> Remove file
                  <span className="sr-only">: levels file {levelsFile.name}</span>
                </Button>
              ) : null}
            </div>
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            {!hierarchyExists ? (
              <FormField id="catalog-import-name" label="Catalog name" hint="The catalog does not exist yet; the import creates it.">
                <Input id="catalog-import-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} disabled={busy || phase === "preview"} />
              </FormField>
            ) : null}
            <FormField id="catalog-import-status" label="New items start as" hint="A draft is hidden from shoppers. Rows with their own status keep it.">
              <NativeSelect id="catalog-import-status" value={defaultStatus} onChange={(e) => setDefaultStatus(e.target.value as CatalogStatus)} disabled={busy || phase === "preview"}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
              </NativeSelect>
            </FormField>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {phase !== "preview" ? (
              <Button type="button" onClick={check} disabled={!items || Boolean(itemsError) || Boolean(levelsError) || busy}>
                {phase === "reading" || phase === "checking" ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />} {phase === "reading" ? "Reading file…" : phase === "checking" ? "Checking…" : "Check file"}
              </Button>
            ) : (
              <>
                <Button type="button" onClick={commit} disabled={!preview?.valid}>
                  <Upload aria-hidden /> Import
                </Button>
                <Button type="button" variant="outline" onClick={reset}>
                  Choose another file
                </Button>
              </>
            )}
          </div>
          {phase === "checking" || phase === "importing" ? (
            <div role="status" aria-live="polite" className="space-y-1.5">
              <p className="text-sm text-muted-foreground">
                {phase === "checking" ? "Checking" : "Importing"} request {Math.min(progress.done + 1, progress.total)} of {progress.total}…
              </p>
              <progress className="h-2 w-full" value={progress.done} max={Math.max(1, progress.total)} aria-label="Import progress" />
            </div>
          ) : null}
        </section>
      )}

      {phase === "preview" && preview ? (
        <section className={`rounded-lg border bg-card p-4 text-sm ${preview.valid ? "" : "border-error"}`} aria-labelledby="catalog-preview">
          <h2 id="catalog-preview" className="font-medium">
            {preview.valid ? "Ready to import" : "This file has problems, so nothing can be imported yet"}
          </h2>
          <p className="mt-1 text-muted-foreground">
            {parsed?.rows.length.toLocaleString("en-US")} rows in {preview.requests} {preview.requests === 1 ? "request" : "requests"}.
            {preview.requests > 1 ? " Because the file is sent in several requests, the counts below can count a shared parent more than once; the import itself is exact." : ""}
          </p>
          {parsed && parsed.depth > levelNames.length && !parsed.levels ? <p className="mt-1 text-muted-foreground">The file uses {parsed.depth} levels and your catalog has {levelNames.length}; levels it does not have are reported below.</p> : null}
          <SummaryList summary={preview.summary} hierarchyCreated={preview.summary.hierarchyCreated} />
        </section>
      ) : null}

      {phase === "failed" || (phase === "preview" && preview && !preview.valid) ? (
        <section role="alert" className="rounded-lg border border-error bg-card p-4 text-sm">
          <p className="font-medium text-error">{phase === "failed" ? "Nothing was imported." : "Fix these and check the file again."}</p>
          {fileProblems.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {fileProblems.map((e) => (
                <li key={e.message}>{e.message}</li>
              ))}
            </ul>
          ) : null}
          {message && fileProblems.length === 0 && shownErrors.length === 0 ? <p className="mt-2">{message}</p> : null}
          {shownErrors.length > 0 ? (
            <>
              <p className="mt-2">{totalErrors > shownErrors.length ? `Showing the first ${shownErrors.length} of ${totalErrors} problems.` : `${totalErrors} ${totalErrors === 1 ? "problem" : "problems"}.`}</p>
              <div className="mt-3 max-h-96 overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Column</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead className="hidden sm:table-cell">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shownErrors.map((e, i) => (
                      <TableRow key={`${e.row}:${e.column}:${i}`}>
                        <TableCell className="tabular-nums">{e.row === 0 ? "File" : e.row}</TableCell>
                        <TableCell className="font-mono text-xs">{e.column}</TableCell>
                        <TableCell>{e.message}</TableCell>
                        <TableCell className="hidden max-w-48 truncate text-muted-foreground sm:table-cell">{e.value}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button type="button" variant="outline" className="mt-3" onClick={() => download("catalog-import-errors.csv", buildErrorReportCsv(shownErrors))}>
                <Download aria-hidden /> Download error report
              </Button>
            </>
          ) : null}
          {phase === "failed" ? (
            <Button type="button" variant="outline" className="mt-3 ml-2" onClick={reset}>
              Start again
            </Button>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function SummaryList({ summary, hierarchyCreated }: { summary: CatalogImportSummary; hierarchyCreated?: boolean }) {
  return (
    <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
      {hierarchyCreated ? (
        <div className="flex justify-between gap-3 sm:col-span-2">
          <dt className="text-muted-foreground">Catalog</dt>
          <dd className="font-medium">Will be created</dd>
        </div>
      ) : null}
      {SUMMARY_LABELS.map(([key, label]) => (
        <div key={key} className="flex justify-between gap-3 border-b border-dashed py-0.5">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-medium tabular-nums">{Number(summary[key]).toLocaleString("en-US")}</dd>
        </div>
      ))}
    </dl>
  );
}

