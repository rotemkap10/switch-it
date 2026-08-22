"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import {
  QUERY_SCORE_EXACT,
  queryMatchScore,
} from "@/lib/vehicle/catalog";

export type ComboboxOption = {
  value: string;
  label: string;
  keywords?: string[];
};

type ComboboxProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  disabled?: boolean;
  placeholder?: string;
  error?: string;
  hint?: string;
  emptyText?: string;
};

function optionScore(option: ComboboxOption, query: string): number {
  let best = Math.max(
    queryMatchScore(option.label, query),
    queryMatchScore(option.value, query),
  );
  for (const keyword of option.keywords ?? []) {
    best = Math.max(best, queryMatchScore(keyword, query));
  }
  return best;
}

function exactOption(options: ComboboxOption[], query: string): ComboboxOption | undefined {
  return options.find((option) => optionScore(option, query) === QUERY_SCORE_EXACT);
}

function labelForValue(options: ComboboxOption[], value: string): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

function filterOptions(options: ComboboxOption[], query: string): ComboboxOption[] {
  if (!query.trim()) {
    return options;
  }
  return options
    .map((option) => ({ option, score: optionScore(option, query) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.option.label.localeCompare(b.option.label))
    .map((row) => row.option);
}

export function Combobox({
  id,
  label,
  value,
  onChange,
  options,
  disabled = false,
  placeholder,
  error,
  hint,
  emptyText = "No matches",
}: ComboboxProps) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeOptionRef = useRef<HTMLButtonElement>(null);
  const selectingRef = useRef(false);
  const selectedLabel = labelForValue(options, value);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(selectedLabel);
  const [filtering, setFiltering] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [listPlacement, setListPlacement] = useState<"bottom" | "top">("bottom");

  if (!open && query !== selectedLabel) {
    setQuery(selectedLabel);
  }

  const filtered = useMemo(
    () => filterOptions(options, filtering ? query : ""),
    [options, filtering, query],
  );

  const highlightedIndex =
    filtered.length === 0 ? 0 : Math.min(activeIndex, filtered.length - 1);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setFiltering(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const field = containerRef.current;
    if (field) {
      const rect = field.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const needed = Math.min(256, window.innerHeight * 0.45);
      setListPlacement(
        spaceBelow < needed && spaceAbove > spaceBelow ? "top" : "bottom",
      );
    }
    activeOptionRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [open, highlightedIndex]);

  function highlightCommitted() {
    const index = options.findIndex((option) => option.value === value);
    setActiveIndex(index >= 0 ? index : 0);
  }

  function openList() {
    if (disabled) {
      return;
    }
    setOpen(true);
    setFiltering(false);
    highlightCommitted();
  }

  function closeList() {
    setOpen(false);
    setFiltering(false);
  }

  function commit(option: ComboboxOption) {
    selectingRef.current = false;
    onChange(option.value);
    setQuery(option.label);
    closeList();
  }

  function handleInput(next: string) {
    setQuery(next);
    setOpen(true);
    setFiltering(true);
    setActiveIndex(0);
    if (next.trim() === "") {
      if (value !== "") {
        onChange("");
      }
      return;
    }
    const exact = exactOption(options, next);
    if (exact && exact.value !== value) {
      onChange(exact.value);
    }
  }

  function handleBlur() {
    if (selectingRef.current) {
      selectingRef.current = false;
      return;
    }
    const exact = exactOption(options, query);
    if (exact) {
      onChange(exact.value);
      setQuery(exact.label);
    } else {
      setQuery(selectedLabel);
    }
    closeList();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (disabled) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setQuery(selectedLabel);
      closeList();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      setActiveIndex((index) =>
        filtered.length === 0 ? 0 : Math.min(index + 1, filtered.length - 1),
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === "Enter" && open && filtered[highlightedIndex]) {
      event.preventDefault();
      commit(filtered[highlightedIndex]);
    }
  }

  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const activeOption = filtered[highlightedIndex];

  return (
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="ui-combobox__field">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          disabled={disabled}
          placeholder={placeholder}
          value={query}
          onChange={(event) => handleInput(event.target.value)}
          onFocus={(event) => {
            event.currentTarget.scrollIntoView?.({
              block: "nearest",
              inline: "nearest",
            });
            openList();
            if (value) {
              event.currentTarget.select();
            }
          }}
          onClick={openList}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-activedescendant={
            open && activeOption ? `${listId}-opt-${highlightedIndex}` : undefined
          }
          className="ui-combobox__input app-form-control min-h-[var(--app-tap-min)] w-full rounded-[var(--radius-card)] border border-border bg-surface px-3 py-2 text-foreground placeholder:text-muted/70 disabled:opacity-60"
        />
        <button
          type="button"
          className="ui-combobox__chevron"
          tabIndex={-1}
          aria-hidden="true"
          disabled={disabled}
          data-open={open ? "true" : "false"}
          onPointerDown={(event) => {
            event.preventDefault();
            if (disabled) {
              return;
            }
            if (open) {
              closeList();
              return;
            }
            inputRef.current?.focus();
            openList();
          }}
        >
          <svg
            viewBox="0 0 20 20"
            className="ui-combobox__chevron-icon"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            aria-hidden="true"
          >
            <path d="M5 7.5 10 12.5 15 7.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {open && !disabled ? (
          <ul
            id={listId}
            role="listbox"
            className="ui-combobox__list"
            data-placement={listPlacement}
            data-testid={`${id}-listbox`}
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted">{emptyText}</li>
            ) : (
              filtered.map((option, index) => (
                <li key={option.value} className="p-0">
                  <button
                    type="button"
                    ref={index === highlightedIndex ? activeOptionRef : undefined}
                    id={`${listId}-opt-${index}`}
                    role="option"
                    aria-selected={index === highlightedIndex}
                    data-committed={option.value === value ? "true" : "false"}
                    className="ui-combobox__option"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      selectingRef.current = true;
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => commit(option)}
                  >
                    {option.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
