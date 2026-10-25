"use client";

import { useMemo, useSyncExternalStore } from "react";
import { toast } from "sonner";
import {
  parseLibrary,
  updateLibrary,
  type LibraryAction,
} from "../quest-library";

const KEY = "bountybridge:quests:v1";
const EVENT = "bountybridge:quests-changed";
let memory = "";
let memoryOnly = false;

function snapshot() {
  if (memoryOnly) return memory;
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return memory;
  }
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useQuestLibrary() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "");
  const library = useMemo(() => parseLibrary(raw), [raw]);
  function dispatch(action: LibraryAction) {
    memory = JSON.stringify(updateLibrary(parseLibrary(snapshot()), action));
    try {
      localStorage.setItem(KEY, memory);
      memoryOnly = false;
    } catch {
      memoryOnly = true;
      toast.error(
        "Browser storage is unavailable. Changes will last for this session only."
      );
    }
    window.dispatchEvent(new Event(EVENT));
  }
  return { library, dispatch };
}
