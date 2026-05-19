import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Instagram } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import pokeeeeeeeohImg from "@/assets/pokeeeeeeeoh.jpeg";
import bookATattooImg from "@/assets/book-a-tattoo.jpeg";

interface SiteSettings {
  site_name: string;
  tagline: string;
  email: string;
  address: string;
}

const Index = () => {
  const [settings, setSettings] = useState<SiteSettings>({
    site_name: "pokeeeeeeeoh",
    tagline: "Tattoo artist at Something Tattoo, Malmö",
    email: "pokeeeeeeeoh@gmail.com",
    address: "Something Tattoo · Amiralsgatan 10 · Malmö",
  });

  useEffect(() => {
    async function fetchSettings() {
      const { data } = await supabase
        .from("site_settings")
        .select("site_name, tagline, email, address")
        .single();

      if (data) {
        setSettings(data);
      }
    }
    fetchSettings();
  }, []);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="font-mono text-sm tracking-widest uppercase truncate">
            {settings.site_name}
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3">
            <Link to="/admin">
              <Button variant="ghost" size="sm">Admin</Button>
            </Link>
            <Link to="/book">
              <Button variant="outline" size="sm">Book</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative flex min-h-screen items-center justify-center px-4 pt-16">
        <div className="relative z-10 max-w-2xl text-center">
          <h1 className="mb-8 animate-fade-in">
            <img
              src={pokeeeeeeeohImg}
              alt={settings.site_name}
              className="mx-auto w-full max-w-xl h-auto"
            />
          </h1>
          <div className="animate-fade-in stagger-2 flex items-center justify-center">
            <Link
              to="/book"
              aria-label="Book a Tattoo"
              className="inline-block border-2 border-foreground rounded-lg p-4 sm:p-6 hover:bg-foreground/5 transition-colors"
            >
              <img
                src={bookATattooImg}
                alt="Book a Tattoo"
                className="h-20 sm:h-24 w-auto"
              />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="max-w-5xl mx-auto flex flex-col items-center gap-6 text-sm text-muted-foreground">
          <a
            href="https://instagram.com/Pokeeeeeeeoh"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-foreground hover:opacity-70 transition-opacity"
          >
            <Instagram className="h-5 w-5" strokeWidth={1.5} />
            <span className="font-mono text-sm tracking-widest">@Pokeeeeeeeoh</span>
          </a>
          <Link to="/" aria-label={settings.site_name}>
            <img src={pokeeeeeeeohImg} alt={settings.site_name} className="h-10 w-auto" />
          </Link>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 w-full">
            <p className="font-mono text-xs tracking-widest break-all">
              {settings.email}
            </p>
            <p className="text-xs text-center sm:text-right">
              {settings.address}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;