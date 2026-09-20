"use client";

import { useId, useMemo, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Member = { id: string; name: string };

type Props = {
  members: Member[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Chip input for multiple assignees — type a name, then Enter or a click.
 *
 * Wired as a real ARIA combobox rather than an input with a styled list under
 * it. Before, Enter always took suggestion #1 and the arrow keys did nothing,
 * so anyone not using a mouse could only ever assign whoever happened to sort
 * first — and a screen reader was never told the list had appeared at all.
 */
export function AssigneeInput({ members, selectedIds, onChange, placeholder, disabled, className }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const listId = useId();

  const selected = selectedIds
    .map((id) => members.find((m) => m.id === id))
    .filter((m): m is Member => !!m);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return members.filter((m) => !selectedIds.includes(m.id) && m.name.toLowerCase().includes(q)).slice(0, 5);
  }, [members, selectedIds, query]);

  const isOpen = open && suggestions.length > 0;
  // The list is re-filtered on every keystroke, so a remembered index can point
  // past the end of it.
  const activeOption = suggestions[Math.min(activeIndex, suggestions.length - 1)];

  function add(id: string) {
    onChange([...selectedIds, id]);
    setQuery("");
    setOpen(false);
    setActiveIndex(0);
  }

  function remove(id: string) {
    onChange(selectedIds.filter((existing) => existing !== id));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (suggestions.length === 0) return;
      e.preventDefault();
      setOpen(true);
      // Wraps, so holding one arrow reaches every option without having to
      // know which end of the list you started at.
      setActiveIndex((current) => {
        const next = e.key === "ArrowDown" ? current + 1 : current - 1;
        return (next + suggestions.length) % suggestions.length;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeOption) add(activeOption.id);
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Backspace" && !query && selected.length > 0) {
      remove(selected[selected.length - 1].id);
    }
  }

  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          "flex min-h-6 flex-wrap items-center gap-1 rounded-lg border border-default bg-default px-3 py-[5px]",
          "focus-within:border-brand-secondary focus-within:ring-1 focus-within:ring-brand-secondary",
          disabled && "opacity-60",
        )}
      >
        {selected.map((m) => (
          <span
            key={m.id}
            className="flex items-center gap-1 rounded-full bg-default-secondary px-2 py-0.5 text-body-tiny text-default"
          >
            {m.name}
            {!disabled && (
              <button
                type="button"
                onClick={() => remove(m.id)}
                aria-label={`Remove ${m.name}`}
                className="text-default-secondary hover:text-default"
              >
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}
        {!disabled && (
          <input
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={isOpen && activeOption ? `${listId}-${activeOption.id}` : undefined}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 100)}
            placeholder={selected.length === 0 ? placeholder ?? "Type a name…" : ""}
            className="min-w-24 flex-1 border-none bg-transparent text-body-tiny text-default outline-none placeholder:text-default-tertiary"
          />
        )}
      </div>
      <div
        id={listId}
        role="listbox"
        className={cn(
          "absolute left-0 top-full z-20 mt-1 w-full rounded-lg border border-default bg-default py-1 shadow-lg",
          !isOpen && "hidden",
        )}
      >
        {suggestions.map((m, index) => (
          <button
            key={m.id}
            id={`${listId}-${m.id}`}
            role="option"
            aria-selected={m.id === activeOption?.id}
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => add(m.id)}
            className={cn(
              "block w-full px-3 py-1.5 text-left text-body-sm text-default",
              m.id === activeOption?.id && "bg-default-secondary",
            )}
          >
            {m.name}
          </button>
        ))}
      </div>
    </div>
  );
}
