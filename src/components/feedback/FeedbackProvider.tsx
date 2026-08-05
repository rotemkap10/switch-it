"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type FeedbackTone = "success" | "error" | "info";

export type FeedbackItem = {
  id: string;
  tone: FeedbackTone;
  message: string;
};

type FeedbackContextValue = {
  items: FeedbackItem[];
  push: (tone: FeedbackTone, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  dismiss: (id: string) => void;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

const MAX_ITEMS = 2;
const SUCCESS_MS = 3600;
const INFO_MS = 4200;
const ERROR_MS = 7000;

let feedbackId = 0;
function nextId() {
  feedbackId += 1;
  return `feedback-${feedbackId}`;
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (tone: FeedbackTone, message: string) => {
      const trimmed = message.trim();
      if (!trimmed) {
        return;
      }

      const id = nextId();
      setItems((prev) => {
        const next = [...prev, { id, tone, message: trimmed }];
        return next.slice(-MAX_ITEMS);
      });

      const duration =
        tone === "error" ? ERROR_MS : tone === "info" ? INFO_MS : SUCCESS_MS;
      const timer = window.setTimeout(() => {
        dismiss(id);
      }, duration);
      timersRef.current.set(id, timer);
    },
    [dismiss],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) {
        window.clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  const value = useMemo<FeedbackContextValue>(
    () => ({
      items,
      push,
      success: (message) => push("success", message),
      error: (message) => push("error", message),
      info: (message) => push("info", message),
      dismiss,
    }),
    [items, push, dismiss],
  );

  return (
    <FeedbackContext.Provider value={value}>{children}</FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackContextValue {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error("useFeedback must be used within FeedbackProvider");
  }
  return context;
}
