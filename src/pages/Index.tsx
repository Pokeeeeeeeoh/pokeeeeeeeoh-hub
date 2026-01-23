import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, CheckCircle, Clock } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="font-mono text-sm tracking-widest uppercase">
            Tattoo Studio
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
                Book Now
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative flex min-h-screen items-center justify-center px-4 pt-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_hsl(var(--muted)/0.3)_0%,_transparent_70%)]" />
        
        <div className="relative z-10 max-w-3xl text-center">
          <p className="mb-4 font-mono text-sm tracking-widest text-muted-foreground uppercase animate-fade-in">
            Custom Tattoo Art
          </p>
          <h1 className="mb-6 text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl animate-fade-in stagger-1 text-balance">
            Ink That Tells
            <br />
            Your Story
          </h1>
          <p className="mb-8 text-lg text-muted-foreground max-w-lg mx-auto animate-fade-in stagger-2">
            Every piece is a collaboration. Submit your idea, get approved, 
            and book your session—all in one place.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in stagger-3">
            <Link to="/book">
              <Button size="lg" className="group">
                Start Your Request
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="border-t border-border bg-card/50 py-24 px-4">
        <div className="container mx-auto max-w-5xl">
          <h2 className="mb-4 text-center font-mono text-sm tracking-widest text-muted-foreground uppercase">
            How It Works
          </h2>
          <p className="mb-16 text-center text-3xl font-semibold tracking-tight">
            Simple. Transparent. Professional.
          </p>

          <div className="grid gap-8 md:grid-cols-3">
            <ProcessStep
              icon={<CheckCircle className="h-6 w-6" />}
              number="01"
              title="Submit Request"
              description="Fill out the booking form with your tattoo idea, reference images, and placement preferences."
            />
            <ProcessStep
              icon={<Clock className="h-6 w-6" />}
              number="02"
              title="Get Approved"
              description="We'll review your request within 24-48 hours and reach out if we're a good fit."
            />
            <ProcessStep
              icon={<Calendar className="h-6 w-6" />}
              number="03"
              title="Book Your Slot"
              description="Once approved, choose from available appointment times and confirm your session."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-border py-24 px-4">
        <div className="container mx-auto max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-semibold tracking-tight">
            Ready to Get Started?
          </h2>
          <p className="mb-8 text-muted-foreground">
            Take the first step toward your new tattoo. 
            We can't wait to hear about your idea.
          </p>
          <Link to="/book">
            <Button size="lg" className="group">
              Begin Booking Request
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p className="font-mono text-xs tracking-widest uppercase">
            © {new Date().getFullYear()} Tattoo Studio
          </p>
          <p className="text-xs">
            Built with care for artists and clients alike.
          </p>
        </div>
      </footer>
    </div>
  );
};

function ProcessStep({
  icon,
  number,
  title,
  description,
}: {
  icon: React.ReactNode;
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="group relative p-6 rounded-lg border border-border/50 bg-card/30 transition-all hover:border-border hover:bg-card/60">
      <div className="mb-4 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary text-foreground">
          {icon}
        </div>
        <span className="font-mono text-2xl font-bold text-muted-foreground/30">
          {number}
        </span>
      </div>
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

export default Index;
