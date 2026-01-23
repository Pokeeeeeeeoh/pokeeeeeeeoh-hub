import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

const BookingInfo = () => {
  const [infoContent, setInfoContent] = useState<string>("");
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchInfo() {
      const { data } = await supabase
        .from("form_config")
        .select("info_content")
        .single();
      
      if (data?.info_content) {
        setInfoContent(data.info_content);
      }
      setLoading(false);
    }
    fetchInfo();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (contentRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
        if (scrollTop + clientHeight >= scrollHeight - 50) {
          setHasScrolledToBottom(true);
        }
      }
    };

    const element = contentRef.current;
    if (element) {
      element.addEventListener("scroll", handleScroll);
      // Check if content is short enough that no scroll needed
      if (element.scrollHeight <= element.clientHeight) {
        setHasScrolledToBottom(true);
      }
    }

    return () => element?.removeEventListener("scroll", handleScroll);
  }, [infoContent]);

  const handleContinue = () => {
    if (acknowledged) {
      navigate("/book/form");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center px-4">
          <Link 
            to="/" 
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <span className="mx-auto font-mono text-sm tracking-widest uppercase">
            Booking Information
          </span>
          <div className="w-16" />
        </div>
      </header>

      {/* Content */}
      <main className="pt-24 pb-32 px-4">
        <div className="container mx-auto max-w-2xl">
          <div className="mb-8 animate-fade-in">
            <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase mb-2">
              Step 1 of 2
            </p>
            <h1 className="text-3xl font-bold tracking-tight mb-2">
              Before You Book
            </h1>
            <p className="text-muted-foreground">
              Please read through the following information carefully before submitting your request.
            </p>
          </div>

          {/* Scrollable Content */}
          <div 
            ref={contentRef}
            className="h-[50vh] overflow-y-auto border border-border rounded-lg bg-card/50 p-6 mb-6 animate-fade-in stagger-1"
          >
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-2xl font-bold mb-4 mt-6 first:mt-0 text-foreground">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-xl font-semibold mb-3 mt-6 text-foreground">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-lg font-medium mb-2 mt-4 text-foreground">{children}</h3>
                  ),
                  p: ({ children }) => (
                    <p className="mb-4 text-muted-foreground leading-relaxed">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="mb-4 space-y-2 text-muted-foreground">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="mb-4 space-y-2 text-muted-foreground list-decimal list-inside">{children}</ol>
                  ),
                  li: ({ children }) => (
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1.5">•</span>
                      <span>{children}</span>
                    </li>
                  ),
                  strong: ({ children }) => (
                    <strong className="text-foreground font-semibold">{children}</strong>
                  ),
                }}
              >
                {infoContent}
              </ReactMarkdown>
            </div>
          </div>

          {/* Scroll Indicator */}
          {!hasScrolledToBottom && (
            <p className="text-center text-sm text-muted-foreground mb-6 animate-pulse">
              ↓ Scroll down to continue
            </p>
          )}

          {/* Acknowledgment */}
          <div 
            className={`flex items-start gap-3 p-4 rounded-lg border transition-all duration-300 ${
              hasScrolledToBottom 
                ? "border-border bg-card/50 opacity-100" 
                : "border-transparent bg-transparent opacity-50 pointer-events-none"
            }`}
          >
            <button
              onClick={() => setAcknowledged(!acknowledged)}
              disabled={!hasScrolledToBottom}
              className={`mt-0.5 h-5 w-5 rounded border flex items-center justify-center transition-all ${
                acknowledged 
                  ? "bg-primary border-primary" 
                  : "border-border hover:border-primary/50"
              }`}
            >
              {acknowledged && <Check className="h-3 w-3 text-primary-foreground" />}
            </button>
            <label 
              className="text-sm text-muted-foreground cursor-pointer"
              onClick={() => hasScrolledToBottom && setAcknowledged(!acknowledged)}
            >
              I have read and understood the booking information, policies, and preparation guidelines.
            </label>
          </div>
        </div>
      </main>

      {/* Fixed Footer */}
      <footer className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur-sm p-4">
        <div className="container mx-auto max-w-2xl flex justify-end">
          <Button 
            onClick={handleContinue}
            disabled={!acknowledged}
            className="group"
          >
            Continue to Form
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>
      </footer>
    </div>
  );
};

export default BookingInfo;
