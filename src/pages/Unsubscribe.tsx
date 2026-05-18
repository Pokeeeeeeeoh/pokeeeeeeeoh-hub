import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

type State =
  | "validating"
  | "ready"
  | "already"
  | "invalid"
  | "submitting"
  | "done"
  | "error";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>("validating");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON_KEY } },
        );
        const data = await res.json();
        if (data.valid === true) setState("ready");
        else if (data.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      } catch {
        setState("error");
      }
    })();
  }, [token]);

  async function confirm() {
    setState("submitting");
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ token }),
        },
      );
      const data = await res.json();
      if (data.success) setState("done");
      else if (data.reason === "already_unsubscribed") setState("already");
      else {
        setError(data.error ?? "Unable to unsubscribe");
        setState("error");
      }
    } catch (e: any) {
      setError(e?.message ?? "Network error");
      setState("error");
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-2xl font-light tracking-tight">Email preferences</h1>

        {state === "validating" && (
          <p className="text-sm text-muted-foreground">Checking link…</p>
        )}

        {state === "ready" && (
          <>
            <p className="text-sm text-muted-foreground">
              Unsubscribe this email address from all future messages from
              pokeeeeeeeoh?
            </p>
            <button
              onClick={confirm}
              className="inline-flex items-center justify-center border border-foreground px-6 py-3 text-sm uppercase tracking-widest hover:bg-foreground hover:text-background transition-colors"
            >
              Confirm unsubscribe
            </button>
          </>
        )}

        {state === "submitting" && (
          <p className="text-sm text-muted-foreground">Processing…</p>
        )}

        {state === "done" && (
          <p className="text-sm">
            You've been unsubscribed. You won't receive further emails.
          </p>
        )}

        {state === "already" && (
          <p className="text-sm text-muted-foreground">
            This address is already unsubscribed.
          </p>
        )}

        {state === "invalid" && (
          <p className="text-sm text-muted-foreground">
            This unsubscribe link is invalid or expired.
          </p>
        )}

        {state === "error" && (
          <p className="text-sm text-destructive">
            {error ?? "Something went wrong. Please try again."}
          </p>
        )}
      </div>
    </main>
  );
}
