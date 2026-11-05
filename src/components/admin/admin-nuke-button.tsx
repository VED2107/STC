"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmAction, toast } from "@/components/ui/feedback";

interface AdminNukeButtonProps {
  isAllowed: boolean;
}

const CONFIRM_TEXT = "DELETE ALL DATA";
const FAILURE_MESSAGE = "The reset stopped with an error. Some data may already be deleted, so check your records.";

/**
 * Super-admin full reset. Lives in its own danger zone at the foot of the dashboard
 * and needs typed confirmation, because the action cannot be undone.
 */
export function AdminNukeButton({ isAllowed }: AdminNukeButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    if (!isAllowed || loading) return;

    const confirmed = await confirmAction({
      title: "Delete all STC data?",
      description:
        "This permanently deletes all students, teachers, classes, attendance, payments, and materials, and every sign-in except yours. It cannot be undone.",
      confirmLabel: "Delete all data",
      destructive: true,
      requireText: CONFIRM_TEXT,
    });
    if (!confirmed) return;

    setLoading(true);

    try {
      const response = await fetch("/api/admin/nuke", { method: "POST" });
      const payload = (await response.json()) as { error?: string; deletedAuthUsers?: number };

      if (!response.ok) {
        throw new Error(payload.error ? `${payload.error}. ${FAILURE_MESSAGE}` : FAILURE_MESSAGE);
      }

      toast.success(`Reset complete. Deleted ${payload.deletedAuthUsers ?? 0} accounts.`);
      router.refresh();
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : FAILURE_MESSAGE);
    } finally {
      setLoading(false);
    }
  }

  if (!isAllowed) {
    return null;
  }

  return (
    <section aria-labelledby="danger-zone-title" className="mt-10 rounded-2xl border border-destructive/30 p-5">
      <h2 id="danger-zone-title" className="text-lg text-destructive">
        Danger zone
      </h2>
      <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Delete all app data and every account except yours. Only super admins can see this.
        </p>
        <Button variant="destructive" onClick={() => void handleReset()} disabled={loading}>
          <AlertTriangle aria-hidden="true" />
          {loading ? "Deleting…" : "Delete all data"}
        </Button>
      </div>
    </section>
  );
}
