import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function Privacy() {
  const [text, setText] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("gdpr_full")
        .limit(1)
        .maybeSingle();
      setText((data as any)?.gdpr_full ?? "");
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border p-4">
        <div className="max-w-2xl mx-auto">
          <Link to="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Link>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-10">
        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : (
          <article className="prose prose-sm max-w-none whitespace-pre-wrap font-sans">
            {text}
          </article>
        )}
      </main>
    </div>
  );
}
