"use client";

import { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Info,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ReadinessIssueApi, ReadinessReportApi } from "@/lib/api/endpoints/studio-api";

export interface ReadinessPanelProps {
  report: ReadinessReportApi | null;
  loading?: boolean;
  acknowledgedWarningKeys: Set<string>;
  onToggleAcknowledgeWarning: (key: string) => void;
  onNavigateToIssue?: (documentId: string, nodeId: string | null) => void;
}

export function ReadinessPanel({
  report,
  loading = false,
  acknowledgedWarningKeys,
  onToggleAcknowledgeWarning,
  onNavigateToIssue,
}: ReadinessPanelProps) {
  const [filter, setFilter] = useState<"ALL" | "BLOCKER" | "WARNING" | "INFORMATION">("ALL");

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent mb-3" />
        <p className="text-sm font-medium">Evaluating publish readiness…</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        No readiness evaluation available.
      </div>
    );
  }

  const { issues, counts, canPublish } = report;
  const filteredIssues = issues.filter(
    (issue) => filter === "ALL" || issue.severity === filter,
  );

  const unacknowledgedWarningsCount = issues.filter(
    (i) => i.severity === "WARNING" && !acknowledgedWarningKeys.has(i.key),
  ).length;

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3.5 shadow-sm">
        <div className="flex items-center gap-2.5">
          {counts.blockers > 0 ? (
            <XCircle className="size-5 text-destructive shrink-0" aria-hidden />
          ) : unacknowledgedWarningsCount > 0 ? (
            <AlertTriangle className="size-5 text-amber-500 shrink-0" aria-hidden />
          ) : (
            <CheckCircle2 className="size-5 text-emerald-500 shrink-0" aria-hidden />
          )}
          <div>
            <h4 className="text-sm font-semibold tracking-tight">
              {counts.blockers > 0
                ? "Publish Blocked"
                : unacknowledgedWarningsCount > 0
                  ? "Warnings Require Review"
                  : "Ready to Publish"}
            </h4>
            <p className="text-xs text-muted-foreground">
              {counts.blockers > 0
                ? `${counts.blockers} blocker(s) must be resolved before publishing.`
                : unacknowledgedWarningsCount > 0
                  ? `${unacknowledgedWarningsCount} warning(s) must be acknowledged to proceed.`
                  : "All readiness checks passed. Store design is ready to go live."}
            </p>
          </div>
        </div>

        {/* Severity Filter Tabs */}
        <div className="flex items-center gap-1 rounded-md border bg-muted/50 p-1 text-xs">
          <button
            type="button"
            onClick={() => setFilter("ALL")}
            className={cn(
              "rounded px-2.5 py-1 font-medium transition-colors",
              filter === "ALL"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            All ({issues.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("BLOCKER")}
            className={cn(
              "rounded px-2.5 py-1 font-medium transition-colors",
              filter === "BLOCKER"
                ? "bg-destructive text-destructive-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Blockers ({counts.blockers})
          </button>
          <button
            type="button"
            onClick={() => setFilter("WARNING")}
            className={cn(
              "rounded px-2.5 py-1 font-medium transition-colors",
              filter === "WARNING"
                ? "bg-amber-500 text-white shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Warnings ({counts.warnings})
          </button>
        </div>
      </div>

      {/* Issue List */}
      {filteredIssues.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
          <ShieldCheck className="size-8 text-emerald-500 mb-2" aria-hidden />
          <p className="font-medium text-foreground">No issues in this view</p>
          <p className="text-xs">Your draft content meets all requirements for this category.</p>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
          {filteredIssues.map((issue) => {
            const isWarning = issue.severity === "WARNING";
            const isBlocker = issue.severity === "BLOCKER";
            const isAcknowledged = acknowledgedWarningKeys.has(issue.key);

            return (
              <Card
                key={issue.key}
                className={cn(
                  "transition-all",
                  isBlocker && "border-destructive/40 bg-destructive/5",
                  isWarning && !isAcknowledged && "border-amber-500/40 bg-amber-500/5",
                  isWarning && isAcknowledged && "border-muted bg-muted/20 opacity-75",
                )}
              >
                <CardContent className="p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      {isBlocker ? (
                        <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
                      ) : isWarning ? (
                        <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
                      ) : (
                        <Info className="size-4 text-blue-500 shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold leading-none">{issue.ruleId}</span>
                          <Badge
                            variant={isBlocker ? "destructive" : isWarning ? "outline" : "secondary"}
                            className="text-[10px] px-1.5 py-0"
                          >
                            {issue.severity}
                          </Badge>
                          {isAcknowledged ? (
                            <Badge variant="secondary" className="text-[10px] text-muted-foreground">
                              Acknowledged
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-sm font-medium leading-snug">{issue.message}</p>
                        <p className="text-xs text-muted-foreground">
                          Fix: <span className="font-medium text-foreground">{issue.fixAction}</span>
                          {issue.controlPath ? ` (${issue.controlPath})` : ""}
                        </p>
                      </div>
                    </div>

                    {onNavigateToIssue ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        className="shrink-0 gap-1 text-xs"
                        onClick={() => onNavigateToIssue(issue.target.documentId, issue.target.nodeId)}
                      >
                        Fix <ArrowRight className="size-3" />
                      </Button>
                    ) : null}
                  </div>

                  {isWarning ? (
                    <div className="flex items-center gap-2 pt-1 border-t border-muted/60">
                      <Checkbox
                        id={`ack-${issue.key}`}
                        checked={isAcknowledged}
                        onCheckedChange={() => onToggleAcknowledgeWarning(issue.key)}
                      />
                      <Label
                        htmlFor={`ack-${issue.key}`}
                        className="text-xs cursor-pointer font-normal text-muted-foreground"
                      >
                        I acknowledge this warning and wish to proceed anyway
                      </Label>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
