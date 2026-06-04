"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Pencil,
  Plus,
  Search,
  Shield,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { LoadingAnimation } from "@/components/ui/loading-animation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  StitchSectionHeader,
  stitchInputClass,
  stitchPanelClass,
  stitchPanelSoftClass,
  stitchSecondaryButtonClass,
} from "@/components/stitch/primitives";
import { cn } from "@/lib/utils";
import { downloadCSV, downloadXLSX } from "@/lib/export-utils";
import { getAdminPageStorageCache, setAdminPageCache } from "@/lib/admin-page-cache";

interface AuditLogRow {
  id: string;
  actor_id: string | null;
  action: "create" | "update" | "delete";
  entity_type: string;
  entity_id: string | null;
  summary: string;
  details: Record<string, unknown>;
  created_at: string;
  actor?: { full_name: string; role: string } | null;
}

const ENTITY_TYPES = [
  "students",
  "teachers",
  "courses",
  "classes",
  "materials",
  "syllabus",
] as const;

const ACTIONS = ["create", "update", "delete"] as const;

const ACTION_COLORS: Record<string, string> = {
  create: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/50",
  update: "bg-blue-50 text-blue-700 ring-1 ring-blue-200/50",
  delete: "bg-rose-50 text-rose-700 ring-1 ring-rose-200/50",
};

const ACTION_ICONS: Record<string, typeof Plus> = {
  create: Plus,
  update: Pencil,
  delete: Trash2,
};

const PAGE_SIZE = 50;

const FK_FIELDS: Record<string, { table: string; nameCol: string; join?: string }> = {
  class_id: { table: "classes", nameCol: "name" },
  teacher_id: { table: "teachers", nameCol: "name" },
  course_id: { table: "courses", nameCol: "title" },
  student_id: { table: "students", nameCol: "full_name", join: "full_name:profiles!students_profile_id_fkey(full_name)" },
  profile_id: { table: "profiles", nameCol: "full_name" },
  branch_id: { table: "branches", nameCol: "name" },
  teacher_profile_id: { table: "profiles", nameCol: "full_name" },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const supabase = createClient();

function getDefaultDateRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    from: from.toISOString().split("T")[0],
    to: now.toISOString().split("T")[0],
  };
}

function extractEntityLabel(log: AuditLogRow, names: Record<string, string>): string {
  const details = log.details as {
    new?: Record<string, unknown>;
    old?: Record<string, unknown>;
  };
  const entity = details?.new ?? details?.old;

  if (entity) {
    if (typeof entity.full_name === "string") return entity.full_name;
    if (typeof entity.name === "string") return entity.name;
    if (typeof entity.title === "string") return entity.title;
    if (typeof entity.subject === "string") return entity.subject;

    // Resolve FK-based name (e.g. students → profile_id → profile name)
    if (typeof entity.profile_id === "string" && names[entity.profile_id]) {
      return names[entity.profile_id];
    }
  }

  if (log.entity_id && names[log.entity_id]) return names[log.entity_id];
  return log.entity_id?.slice(0, 8) ?? "—";
}

function resolveValue(key: string, val: unknown, names: Record<string, string>): string {
  if (typeof val === "string" && UUID_RE.test(val) && key in FK_FIELDS) {
    return names[val] ?? val.slice(0, 8);
  }
  return JSON.stringify(val);
}

function formatFieldLabel(key: string): string {
  return key.replace(/_id$/, "").replace(/_/g, " ");
}

function formatChanges(log: AuditLogRow, names: Record<string, string>): string[] {
  if (log.action !== "update") return [];
  const details = log.details as {
    old?: Record<string, unknown>;
    new?: Record<string, unknown>;
  };
  if (!details.old || !details.new) return [];

  const changes: string[] = [];
  const skip = new Set(["updated_at", "created_at", "id"]);

  for (const key of Object.keys(details.new)) {
    if (skip.has(key)) continue;
    const oldVal = details.old[key];
    const newVal = details.new[key];
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes.push(
        `${formatFieldLabel(key)}: ${resolveValue(key, oldVal, names)} → ${resolveValue(key, newVal, names)}`,
      );
    }
  }
  return changes;
}

export default function AuditLogsPage() {
  const router = useRouter();
  const { role, loading: authLoading } = useAuth();

  const defaults = useMemo(getDefaultDateRange, []);
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);
  const [entityFilter, setEntityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [nameMap, setNameMap] = useState<Record<string, string>>({});

  interface AuditLogsCacheData {
    logs: AuditLogRow[];
    hasMore: boolean;
  }

  const auditCacheKey = `admin:audit-logs:${dateFrom}:${dateTo}:${entityFilter}:${actionFilter}`;

  useEffect(() => {
    if (authLoading) return;
    if (role !== "admin" && role !== "super_admin") {
      router.push(role === "teacher" ? "/admin/attendance" : "/dashboard");
    }
  }, [authLoading, role, router]);

  const resolveNames = useCallback(async (rows: AuditLogRow[]) => {
    const idsByTable: Record<string, Set<string>> = {};

    for (const log of rows) {
      const details = log.details as { old?: Record<string, unknown>; new?: Record<string, unknown> };
      for (const record of [details.old, details.new]) {
        if (!record) continue;
        for (const [key, val] of Object.entries(record)) {
          const fk = FK_FIELDS[key];
          if (!fk || typeof val !== "string" || !UUID_RE.test(val)) continue;
          (idsByTable[key] ??= new Set()).add(val);
        }
      }
    }

    const map: Record<string, string> = {};
    const fetches = Object.entries(idsByTable).map(async ([field, ids]) => {
      const fk = FK_FIELDS[field];
      if (!fk) return;
      const idArr = Array.from(ids);
      const selectCol = fk.join ?? fk.nameCol;
      const { data } = await supabase.from(fk.table).select(`id, ${selectCol}`).in("id", idArr);
      if (!data) return;
      for (const row of data) {
        const r = row as Record<string, unknown>;
        const name = fk.join
          ? (r[fk.nameCol] as { full_name?: string } | null)?.full_name
          : (r[fk.nameCol] as string);
        if (name) map[r.id as string] = name;
      }
    });

    await Promise.all(fetches);
    setNameMap(map);
  }, []);

  const fetchLogs = useCallback(async () => {
    const cached = getAdminPageStorageCache<AuditLogsCacheData>(auditCacheKey);
    if (cached) {
      setLogs(cached.logs);
      setHasMore(cached.hasMore);
      setExpandedIds(new Set());
      setLoading(false);
      void resolveNames(cached.logs);
    }
    if (!cached) setLoading(true);

    let query = supabase
      .from("audit_logs")
      .select("*, actor:profiles!audit_logs_actor_id_fkey(full_name, role)")
      .gte("created_at", `${dateFrom}T00:00:00`)
      .lte("created_at", `${dateTo}T23:59:59`)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE + 1);

    if (entityFilter !== "all") {
      query = query.eq("entity_type", entityFilter);
    }
    if (actionFilter !== "all") {
      query = query.eq("action", actionFilter);
    }

    const { data } = await query;
    const rows = (data as AuditLogRow[] | null) ?? [];

    const finalLogs = rows.length > PAGE_SIZE ? rows.slice(0, PAGE_SIZE) : rows;
    const finalHasMore = rows.length > PAGE_SIZE;
    setHasMore(finalHasMore);
    setLogs(finalLogs);

    setAdminPageCache<AuditLogsCacheData>(auditCacheKey, {
      logs: finalLogs,
      hasMore: finalHasMore,
    });

    setExpandedIds(new Set());
    setLoading(false);
    void resolveNames(finalLogs);
  }, [dateFrom, dateTo, entityFilter, actionFilter, auditCacheKey, resolveNames]);

  useEffect(() => {
    if (role === "admin" || role === "super_admin") {
      void fetchLogs();
    }
  }, [fetchLogs, role]);

  const filteredLogs = useMemo(() => {
    if (!search.trim()) return logs;
    const q = search.toLowerCase().trim();
    return logs.filter(
      (log) =>
        log.summary.toLowerCase().includes(q) ||
        log.entity_type.toLowerCase().includes(q) ||
        extractEntityLabel(log, nameMap).toLowerCase().includes(q) ||
        (log.actor?.full_name ?? "").toLowerCase().includes(q),
    );
  }, [logs, search]);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const exportHeaders = [
    { key: "created_at", label: "Timestamp" },
    { key: "actor_name", label: "Actor" },
    { key: "action", label: "Action" },
    { key: "entity_type", label: "Entity Type" },
    { key: "entity_label", label: "Entity" },
    { key: "summary", label: "Summary" },
  ];

  function buildExportRows() {
    return filteredLogs.map((log) => ({
      created_at: new Date(log.created_at).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
      }),
      actor_name: log.actor?.full_name ?? "System",
      action: log.action,
      entity_type: log.entity_type,
      entity_label: extractEntityLabel(log, nameMap),
      summary: log.summary,
    }));
  }

  if (authLoading || (role !== "admin" && role !== "super_admin")) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingAnimation size="lg" />
      </div>
    );
  }

  return (
    <div className="px-6 py-8 md:px-10">
      <StitchSectionHeader
        eyebrow="Security"
        title="Audit Logs"
        description="Track every administrative action across students, teachers, courses, classes, materials, and syllabus."
      />

      <div className={cn(stitchPanelClass, "mt-8")}>
        <div className="grid gap-4 md:grid-cols-5">
          <div>
            <label className="mb-2 block text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={stitchInputClass}
            />
          </div>
          <div>
            <label className="mb-2 block text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={stitchInputClass}
            />
          </div>
          <div>
            <label className="mb-2 block text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Entity
            </label>
            <Select value={entityFilter} onValueChange={(v) => setEntityFilter(v ?? "all")}>
              <SelectTrigger>
                <SelectValue placeholder="All Entities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                {ENTITY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-2 block text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Action
            </label>
            <Select value={actionFilter} onValueChange={(v) => setActionFilter(v ?? "all")}>
              <SelectTrigger>
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a.charAt(0).toUpperCase() + a.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-2 block text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Search
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={cn(stitchInputClass, "pl-10")}
                placeholder="Search logs..."
              />
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className={cn(stitchSecondaryButtonClass, "gap-2")}
            onClick={() =>
              downloadCSV(
                buildExportRows(),
                exportHeaders,
                `audit_logs_${dateFrom}_to_${dateTo}`,
              )
            }
            disabled={filteredLogs.length === 0}
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button
            type="button"
            className={cn(stitchSecondaryButtonClass, "gap-2")}
            onClick={() =>
              void downloadXLSX(
                buildExportRows(),
                exportHeaders,
                `audit_logs_${dateFrom}_to_${dateTo}`,
              )
            }
            disabled={filteredLogs.length === 0}
          >
            <Download className="h-4 w-4" /> Export Excel
          </button>
        </div>
      </div>

      {loading ? (
        <div className="mt-10 flex min-h-40 items-center justify-center">
          <LoadingAnimation size="md" />
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className={cn(stitchPanelSoftClass, "mt-8 text-center")}>
          <Shield className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-4 text-2xl text-foreground">No Audit Logs</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {search
              ? `No logs match "${search.trim()}".`
              : "No administrative actions recorded in the selected range."}
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-3">
          {filteredLogs.map((log) => {
            const isExpanded = expandedIds.has(log.id);
            const changes = formatChanges(log, nameMap);
            const entityLabel = extractEntityLabel(log, nameMap);
            const ActionIcon = ACTION_ICONS[log.action] ?? Shield;

            return (
              <div
                key={log.id}
                className={cn(
                  stitchPanelSoftClass,
                  "cursor-pointer transition-all hover:border-black/10 hover:shadow-[0_8px_24px_-16px_rgba(26,28,29,0.15)]",
                  isExpanded && "border-primary/15 shadow-[0_12px_30px_-16px_rgba(26,28,29,0.18)]",
                )}
              >
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-4 text-left"
                  onClick={() => toggleExpand(log.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                      log.action === "create" && "bg-emerald-50 text-emerald-600",
                      log.action === "update" && "bg-blue-50 text-blue-600",
                      log.action === "delete" && "bg-rose-50 text-rose-600",
                    )}>
                      <ActionIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-[0.18em] font-medium",
                            ACTION_COLORS[log.action] ?? "bg-muted text-muted-foreground",
                          )}
                        >
                          {log.action}
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          {log.entity_type}
                        </span>
                        <span className="text-sm font-medium text-foreground">
                          {entityLabel}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        by <span className="font-medium text-foreground/70">{log.actor?.full_name ?? "System"}</span>
                        {log.actor?.role
                          ? ` (${log.actor.role})`
                          : ""}
                        {" · "}
                        {new Date(log.created_at).toLocaleString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                          timeZone: "Asia/Kolkata",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="mt-1 shrink-0">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-primary" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="mt-4 border-t border-border/50 pt-4">
                    {log.action === "update" && changes.length > 0 ? (
                      <div>
                        <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                          Changes
                        </p>
                        <div className="space-y-1">
                          {changes.map((change, i) => (
                            <p
                              key={i}
                              className="rounded-lg bg-muted/50 px-3 py-1.5 font-mono text-xs text-foreground"
                            >
                              {change}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : log.action === "create" ? (
                      <p className="text-xs text-muted-foreground">
                        New {log.entity_type.replace(/s$/, "")} record created.
                      </p>
                    ) : log.action === "delete" ? (
                      <p className="text-xs text-destructive">
                        Record permanently removed.
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No additional details.
                      </p>
                    )}
                    <p className="mt-3 font-mono text-[10px] text-muted-foreground">
                      ID: {log.entity_id ?? "—"}
                    </p>
                  </div>
                )}
              </div>
            );
          })}

          {hasMore && (
            <div className={cn(stitchPanelSoftClass, "text-center")}>
              <p className="text-sm text-muted-foreground">
                Showing first {PAGE_SIZE} results. Narrow filters to see more.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
