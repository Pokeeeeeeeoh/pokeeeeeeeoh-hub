import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function GdprNotice({ className = "" }: { className?: string }) {
  const [text, setText] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("gdpr_short")
        .limit(1)
        .maybeSingle();
      setText((data as any)?.gdpr_short ?? "");
    })();
  }, []);

  if (!text) return null;
  return (
    <p className={`text-xs text-muted-foreground leading-relaxed ${className}`}>
      {text}{" "}
      <Link to="/privacy" target="_blank" rel="noopener" className="underline hover:text-foreground">
        Read full Privacy Notice
      </Link>
    </p>
  );
}
