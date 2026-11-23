import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BookingImage } from "@/components/BookingImage";

type Req = {
  id: string;
  status: string;
  created_at: string;
  archived_at: string | null;
  form_responses: Record<string, unknown> | null;
  images: string[] | null;
};

/** Shows every other request from this client (archived included) with details and pictures. */
export function ClientRequestHistory({ clientId, excludeId }: { clientId: string; excludeId?: string | null }) {
  const [reqs, setReqs] = useState<Req[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase
      .from("booking_requests")
      .select("id,status,created_at,archived_at,form_responses,images")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!active) return;
        const list = ((data as Req[]) || []).filter((r) => {
          if (r.id === excludeId) return false;
          const fr = r.form_responses || {};
          const hasInfo = Object.keys(fr).some((k) => k !== "manual_booking") || (r.images?.length ?? 0) > 0;
          return hasInfo;
        });
        setReqs(list);
      });
    return () => { active = false; };
  }, [clientId, excludeId]);

  if (reqs.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground mb-2">Other requests from this client ({reqs.length})</h3>
      <div className="space-y-2">
        {reqs.map((r) => {
          const entries = Object.entries(r.form_responses || {}).filter(([k]) => k !== "manual_booking");
          const isOpen = open === r.id;
          return (
            <div key={r.id} className="rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : r.id)}
                className="w-full flex items-center justify-between gap-2 p-3 text-left text-sm"
              >
                <span>
                  {new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  <span className="text-muted-foreground"> · {r.status}{r.archived_at ? " · archived" : ""}</span>
                  {(r.images?.length ?? 0) > 0 && <span className="text-muted-foreground"> · {r.images!.length} image{r.images!.length > 1 ? "s" : ""}</span>}
                </span>
                <span className="text-xs text-muted-foreground">{isOpen ? "Hide" : "Show"}</span>
              </button>
              {isOpen && (
                <div className="px-3 pb-3 space-y-3">
                  {entries.map(([k, v]) => (
                    <div key={k} className="text-sm">
                      <div className="text-xs text-muted-foreground">{k}</div>
                      <div className="whitespace-pre-wrap break-words">{Array.isArray(v) ? v.join(", ") : String(v ?? "")}</div>
                    </div>
                  ))}
                  {(r.images?.length ?? 0) > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {r.images!.map((img, i) => (
                        <div key={i} className="aspect-square rounded-lg border border-border overflow-hidden">
                          <BookingImage src={img} alt={`Reference ${i + 1}`} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
