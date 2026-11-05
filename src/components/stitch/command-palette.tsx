"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, type LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface CommandItem {
  href: string;
  label: string;
  group: string;
  icon: LucideIcon;
}

/**
 * Jump to any page this role can open. Items come from the role's own navigation,
 * so it cannot reveal a page the person could not already reach. No open animation:
 * this is used constantly and must feel instant.
 */
export function CommandPalette({
  items,
  open,
  onOpenChange,
}: {
  items: CommandItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLUListElement | null>(null);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => `${item.label} ${item.group}`.toLowerCase().includes(needle));
  }, [items, query]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange, open]);

  function reset(next: boolean) {
    if (next) {
      setQuery("");
      setActiveIndex(0);
    }
    onOpenChange(next);
  }

  function go(item: CommandItem) {
    onOpenChange(false);
    setQuery("");
    setActiveIndex(0);
    router.push(item.href);
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (results.length === 0) return;
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const next = (activeIndex + delta + results.length) % results.length;
      setActiveIndex(next);
      listRef.current?.children[next]?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      go(results[activeIndex]);
    }
  }

  const activeId = results[activeIndex] ? `command-${activeIndex}` : undefined;

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent
        showCloseButton={false}
        className="top-[12dvh] translate-y-0 gap-0 p-0 duration-0 data-closed:duration-0 sm:max-w-lg"
      >
        <DialogTitle className="sr-only">Go to a page</DialogTitle>
        <div className="flex items-center gap-3 border-b px-4">
          <Search aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onInputKeyDown}
            role="combobox"
            aria-expanded="true"
            aria-controls="command-list"
            aria-activedescendant={activeId}
            aria-label="Search pages"
            placeholder="Go to…"
            className="h-12 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
        </div>
        {results.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">No page matches “{query}”.</p>
        ) : (
          <ul ref={listRef} id="command-list" role="listbox" aria-label="Pages" className="max-h-80 overflow-y-auto p-2">
            {results.map((item, index) => {
              const Icon = item.icon;
              return (
                <li
                  key={`${item.href}-${item.label}`}
                  id={`command-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseMove={() => setActiveIndex(index)}
                  onClick={() => go(item)}
                  className={cn(
                    "flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm",
                    index === activeIndex ? "bg-muted text-foreground" : "text-foreground",
                  )}
                >
                  <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                  <span className="font-medium">{item.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{item.group}</span>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
