import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

let cache: Record<string, string> | null = null;
const listeners = new Set<(t: Record<string, string>) => void>();

async function loadAll() {
  const { data } = await supabase.from("ui_text").select("key, value");
  cache = Object.fromEntries((data || []).map((r: any) => [r.key, r.value]));
  listeners.forEach((l) => l(cache!));
  return cache;
}

export function useUiText() {
  const [text, setText] = useState<Record<string, string>>(cache || {});
  useEffect(() => {
    if (!cache) loadAll();
    else setText(cache);
    const l = (t: Record<string, string>) => setText({ ...t });
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return (key: string, fallback = "") => text[key] ?? fallback;
}

export function refreshUiText() {
  return loadAll();
}
