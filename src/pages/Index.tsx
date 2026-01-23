import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="font-mono text-sm tracking-widest uppercase">
            {settings.site_name}
          </Link>
          <nav className="flex items-center gap-6">
            <Link 
              to="/admin" 
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Admin
            </Link>
            <Link to="/book">
              <Button variant="outline" size="sm">
                Book
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative flex min-h-screen items-center justify-center px-4 pt-16">
        <div className="relative z-10 max-w-2xl text-center">
          <h1 className="mb-8 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl animate-fade-in">
            {settings.site_name}
          </h1>
          <p className="mb-8 text-lg text-muted-foreground max-w-md mx-auto animate-fade-in stagger-1">
            {settings.tagline}
          </p>
          <div className="animate-fade-in stagger-2">
            <Link to="/book">
              <Button size="lg" className="group">
                Book a tattoo
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p className="font-mono text-xs tracking-widest">
            {settings.email}
          </p>
          <p className="text-xs">
            {settings.address}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;