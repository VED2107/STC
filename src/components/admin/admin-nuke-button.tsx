"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";

interface AdminNukeButtonProps {
  isAllowed: boolean;
}

export function AdminNukeButton({ isAllowed }: AdminNukeButtonProps) {
  const router = useRouter();
  const [nukeLoading, setNukeLoading] = useState(false);
  const [nukeMessage, setNukeMessage] = useState<string | null>(null);

  async function handleNukeAll() {
    if (!isAllowed || nukeLoading) {
      return;
    }

    const confirmed = window.confirm(
      "This will permanently delete all STC app data and all auth users except your super-admin account. Continue?",
    );
    if (!confirmed) {
      return;
    }

    setNukeLoading(true);
    setNukeMessage(null);

    try {
      const response = await fetch("/api/admin/nuke", { method: "POST" });
      const payload = (await response.json()) as { error?: string; deletedAuthUsers?: number };

      if (!response.ok) {
        throw new Error(payload.error ?? "Nuke failed");
      }

      setNukeMessage(`Reset complete. Deleted ${payload.deletedAuthUsers ?? 0} auth users.`);
      router.refresh();
      window.location.reload();
    } catch (err) {
      setNukeMessage(err instanceof Error ? err.message : "Nuke failed");
    } finally {
      setNukeLoading(false);
    }
  }

  if (!isAllowed) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void handleNukeAll()}
        disabled={nukeLoading}
        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-100 disabled:pointer-events-none disabled:opacity-60"
      >
        <AlertTriangle className="h-4 w-4" />
        {nukeLoading ? "Nuking..." : "Nuke All Data"}
      </button>
      {nukeMessage ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {nukeMessage}
        </div>
      ) : null}
    </>
  );
}
