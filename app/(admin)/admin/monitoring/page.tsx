import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info, OctagonAlert, ScrollText } from "lucide-react";
import { AutoRefresh } from "@/components/admin/auto-refresh";
import { StatCard } from "@/components/admin/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ListFilters } from "@/components/shared/list-filters";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge, type Tone } from "@/components/shared/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/config/app";
import { dateTime, everyText, uptimeText } from "@/lib/admin/format";
import { requirePlatformPagePermission } from "@/lib/auth/platform";
import { errorsQuerySchema } from "@/lib/validations/admin-commercial";
import { ADMIN_PAGE_SIZES } from "@/lib/validations/admin-list";
import { getMonitoring, listErrorEvents, listJobRuns } from "@/services/platform-commercial.service";

export const metadata: Metadata = { title: "System monitoring" };

const SERVICE: Record<string, { tone: Tone; label: string }> = {
  up: { tone: "active", label: "Up" },
  down: { tone: "danger", label: "Down" },
  not_configured: { tone: "warning", label: "Not configured" },
  not_checked: { tone: "neutral", label: "Configured, not tested" },
};
const JOB: Record<string, { tone: Tone; label: string }> = {
  ok: { tone: "active", label: "Healthy" },
  late: { tone: "warning", label: "Late" },
  failing: { tone: "danger", label: "Failing" },
  never_run: { tone: "draft", label: "Never run" },
};
const ALERT_ICON = { critical: OctagonAlert, warning: AlertTriangle, info: Info } as const;

export default async function MonitoringPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePlatformPagePermission("monitoring:read");
  const raw = await searchParams;
  const query = errorsQuerySchema.parse(Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
  const [m, errors, runs] = await Promise.all([
    getMonitoring(),
    listErrorEvents({ search: query.q, page: query.page, limit: query.pageSize }),
    listJobRuns({ page: 1, limit: 10 }),
  ]);
  const peak = Math.max(1, ...m.errors.byHour.map((h) => h.count));

  return (
    <>
      <PageHeader
        title="System monitoring"
        description={`Measured ${dateTime(m.generatedAt)}. This page refreshes itself every 30 seconds.`}
        actions={<AutoRefresh seconds={30} />}
      />

      <div className="space-y-6">
        {m.alerts.length === 0 ? (
          <p className="flex items-center gap-2 rounded-lg border border-success/25 bg-success/10 p-3 text-sm text-success-text">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden /> Nothing needs attention right now.
          </p>
        ) : (
          <ul aria-label="Alerts" className="space-y-2">
            {m.alerts.map((a) => {
              const Icon = ALERT_ICON[a.severity];
              return (
                <li key={a.id} className={a.severity === "critical" ? "flex gap-2.5 rounded-lg border border-error/30 bg-error/10 p-3 text-sm" : "flex gap-2.5 rounded-lg border border-warning/35 bg-warning/10 p-3 text-sm"}>
                  <Icon className={a.severity === "critical" ? "mt-0.5 size-4 shrink-0 text-destructive" : "mt-0.5 size-4 shrink-0 text-warning-text"} aria-hidden />
                  <span>
                    <span className="font-medium">{a.severity === "critical" ? "Critical: " : ""}{a.title}</span>
                    <span className="block text-muted-foreground">{a.detail}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <section aria-label="Status" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="API" value="Up" hint={`Instance running for ${uptimeText(m.api.instanceUptimeSeconds)} · ${m.api.environment}`} />
          <StatCard label="Database" value={m.database.status === "up" ? "Up" : "Down"} hint={m.database.latencyMs === null ? "Not answering" : `${m.database.latencyMs} ms round trip`} tone={m.database.status === "down" ? "danger" : undefined} />
          <StatCard label="Server errors, 15 minutes" value={m.errors.available ? m.errors.last15Minutes : "—"} hint={m.errors.available ? "HTTP 5xx" : (m.errors.reason ?? "Not available")} tone={m.errors.last15Minutes >= 5 ? "warning" : undefined} />
          <StatCard label="Server errors, 24 hours" value={m.errors.available ? m.errors.last24Hours : "—"} hint={m.errors.available ? "HTTP 5xx" : (m.errors.reason ?? "Not available")} />
        </section>

        <SectionCard title="Services" description="Measured means it was called just now. Configured means a setting exists, nothing more.">
          <ul className="divide-y">
            {m.services.map((s) => (
              <li key={s.key} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span>
                  <span className="font-medium">{s.label}</span>
                  {s.detail ? <span className="block text-xs text-muted-foreground">{s.detail}</span> : null}
                </span>
                <span className="flex items-center gap-3">
                  {s.latencyMs !== null ? <span className="text-xs tabular-nums text-muted-foreground">{s.latencyMs} ms</span> : null}
                  <StatusBadge tone={SERVICE[s.status].tone}>{SERVICE[s.status].label}</StatusBadge>
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>

        {m.errors.available ? (
          <SectionCard title="Server errors by hour" description="The last 24 hours, oldest first. A bar is the number of unhandled server errors in that hour; an empty hour is a real zero.">
            <div role="img" aria-label={`Server errors per hour over the last 24 hours: ${m.errors.last24Hours} in total.`} className="flex h-28 items-end gap-1">
              {m.errors.byHour.map((h) => (
                <div key={h.hour} className="flex h-full flex-1 flex-col justify-end" title={`${dateTime(h.hour)}: ${h.count}`}>
                  <div className={h.count > 0 ? "rounded-t-sm bg-destructive/80" : "rounded-t-sm bg-muted"} style={{ height: `${h.count === 0 ? 3 : Math.max(8, (h.count / peak) * 100)}%` }} />
                </div>
              ))}
            </div>
            {m.errors.topIssues.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead>Most frequent, last 24 hours</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead className="hidden sm:table-cell">Last seen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {m.errors.topIssues.map((t) => (
                      <TableRow key={`${t.method}${t.route}${t.errorName}${t.message}`}>
                        <TableCell>
                          <span className="block font-mono text-xs">{t.method} {t.route}</span>
                          <span className="block text-sm">{t.errorName}: {t.message}</span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{t.count}</TableCell>
                        <TableCell className="hidden whitespace-nowrap text-sm sm:table-cell">{dateTime(t.lastSeen)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </SectionCard>
        ) : null}

        <SectionCard title="Scheduled jobs" description="Each job is expected at the interval shown (the recommended schedule). A job that was never run may simply not be scheduled yet.">
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Job</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead className="hidden md:table-cell">Last run</TableHead>
                  <TableHead className="text-right">Runs, 24 h</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {m.jobs.map((j) => (
                  <TableRow key={j.job}>
                    <TableCell>
                      <span className="block font-medium">{j.label}</span>
                      <span className="block text-xs text-muted-foreground">Every {everyText(j.expectedEveryMinutes)}</span>
                    </TableCell>
                    <TableCell><StatusBadge tone={JOB[j.health].tone}>{JOB[j.health].label}</StatusBadge></TableCell>
                    <TableCell className="hidden text-sm md:table-cell">
                      {j.lastRun ? (
                        <>
                          {dateTime(j.lastRun.startedAt)} · {j.lastRun.durationMs} ms
                          {j.lastRun.error ? <span className="block text-xs text-destructive">{j.lastRun.error}</span> : null}
                        </>
                      ) : (
                        <span className="text-muted-foreground">No run recorded</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{j.runsLast24Hours}</TableCell>
                    <TableCell className="text-right tabular-nums">{j.failuresLast24Hours}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {runs.items.length > 0 ? (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Latest runs</summary>
              <ul className="mt-2 divide-y">
                {runs.items.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5">
                    <span><span className="font-mono text-xs">{r.job}</span> · {r.status === "ok" ? "ok" : <span className="text-destructive">failed{r.error ? `: ${r.error}` : ""}</span>}</span>
                    <span className="text-xs text-muted-foreground">{dateTime(r.startedAt)} · {r.durationMs} ms</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </SectionCard>

        <SectionCard title="Recent server errors" description="Unhandled errors only (HTTP 5xx). Messages are cleaned of ids, e-mail addresses and tokens. The request id matches the X-Request-Id in the server log.">
          <ListFilters searchPlaceholder="Search by route, error, message or request id" />
          {errors.meta.total === 0 ? (
            <EmptyState icon={ScrollText} title={query.q ? "No errors match" : "No server errors recorded"} description={query.q ? "Try a different search." : "Errors appear here when the API fails to handle a request. Recorded errors are kept for 14 days."} />
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead>When</TableHead>
                      <TableHead>Request</TableHead>
                      <TableHead className="hidden lg:table-cell">Request id</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {errors.items.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="whitespace-nowrap text-sm align-top">{dateTime(e.occurredAt)}</TableCell>
                        <TableCell>
                          <span className="block font-mono text-xs">{e.method} {e.route} → {e.status}</span>
                          <span className="block text-sm">{e.errorName}: {e.message}</span>
                          {e.source ? <span className="block text-xs text-muted-foreground">{e.source}</span> : null}
                        </TableCell>
                        <TableCell className="hidden font-mono text-xs text-muted-foreground lg:table-cell">{e.requestId ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination page={errors.meta.page} pageSize={errors.meta.limit} total={errors.meta.total} basePath={ROUTES.adminMonitoring} params={{ q: query.q, pageSize: String(errors.meta.limit) }} pageSizeOptions={ADMIN_PAGE_SIZES} />
            </>
          )}
        </SectionCard>

        <SectionCard title="Not measured" description="Things people often expect on a monitoring screen that this system does not measure. They are listed so a missing number is never mistaken for zero.">
          <ul className="space-y-2 text-sm">
            {m.unavailableMetrics.map((u) => (
              <li key={u.key}>
                <span className="font-medium">{u.label}</span>
                <span className="block text-muted-foreground">{u.reason}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Billing problems (failed payments and webhooks, overdue invoices) are on <Link href={ROUTES.adminBilling} className="underline">Billing & invoices</Link>.
          </p>
        </SectionCard>
      </div>
    </>
  );
}
