import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";

const Aftercare = () => {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("form_config")
        .select("aftercare_content")
        .single();
      if (data && (data as any).aftercare_content) {
        setContent((data as any).aftercare_content);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center px-4">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
            Back
          </Link>
        </div>
      </header>

      <main className="pt-24 pb-16 px-4">
        <div className="container mx-auto max-w-2xl">
          <h1 className="mb-8 font-mono text-xs tracking-widest uppercase text-muted-foreground">
            Aftercare
          </h1>
          {loading ? (
            <div className="animate-pulse text-muted-foreground">Loading...</div>
          ) : (
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => <h1 className="text-2xl font-bold mb-4 mt-6 first:mt-0 text-foreground">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-xl font-semibold mb-3 mt-6 text-foreground">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-lg font-medium mb-2 mt-4 text-foreground">{children}</h3>,
                  p: ({ children }) => <p className="mb-4 text-muted-foreground leading-relaxed">{children}</p>,
                  ul: ({ children }) => <ul className="mb-4 space-y-2 text-muted-foreground list-disc pl-5 marker:text-primary">{children}</ul>,
                  ol: ({ children }) => <ol className="mb-4 space-y-2 text-muted-foreground list-decimal pl-5 marker:text-primary">{children}</ol>,
                  li: ({ children }) => <li className="pl-1 leading-relaxed [&>p]:mb-0 [&>p]:inline">{children}</li>,
                  strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Aftercare;
