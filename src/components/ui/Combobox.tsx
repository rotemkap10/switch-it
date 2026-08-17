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
  const selectedLabel = labelForValue(options, value);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(selectedLabel);
  const [activeIndex, setActiveIndex] = useState(0);

  if (!open && query !== selectedLabel) {
    setQuery(selectedLabel);
  }

  const filtered = useMemo(() => {
    if (!query.trim()) {
      return options;
    }
    return options
      .map((option) => ({ option, score: optionScore(option, query) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score || a.option.label.localeCompare(b.option.label))
      .map((row) => row.option);
  }, [options, query]);

  const highlightedIndex =
    filtered.length === 0 ? 0 : Math.min(activeIndex, filtered.length - 1);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  function openList() {
    if (!disabled) {
      setOpen(true);
      setActiveIndex(0);
    }
  }

  function commit(option: ComboboxOption) {
    onChange(option.value);
    setQuery(option.label);
    setOpen(false);
  }

  function handleInput(next: string) {
    setQuery(next);
    setOpen(true);
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
    const exact = exactOption(options, query);
    if (exact) {
      onChange(exact.value);
      setQuery(exact.label);
    } else {
      setQuery(selectedLabel);
    }
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (disabled) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setQuery(selectedLabel);
      setOpen(false);
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
      <div className="relative">
        <input
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
          onFocus={openList}
          onClick={openList}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && activeOption ? `${listId}-opt-${highlightedIndex}` : undefined
          }
          className="app-form-control min-h-[var(--app-tap-min)] w-full rounded-[var(--radius-card)] border border-border bg-surface px-3 py-2 text-foreground placeholder:text-muted/70 disabled:opacity-60"
        />
        {open && !disabled ? (
          <ul
            id={listId}
            role="listbox"
            className="ui-combobox__list"
            data-testid={`${id}-listbox`}
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted">{emptyText}</li>
            ) : (
              filtered.map((option, index) => (
                <li key={option.value} className="p-0">
                  <button
                    type="button"
                    id={`${listId}-opt-${index}`}
                    role="option"
                    aria-selected={index === highlightedIndex}
                    className="ui-combobox__option"
                    onPointerDown={(event) => event.preventDefault()}
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
