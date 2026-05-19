import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import allAboutMeImg from "@/assets/all-about-me.jpeg";

const About = () => {
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
          <h1 className="mb-8 animate-fade-in">
            <img src={allAboutMeImg} alt="All about me" className="w-full max-w-lg h-auto" />
          </h1>
          <div className="space-y-5 text-base leading-relaxed text-foreground animate-fade-in stagger-1">
            <p>Hello.</p>
            <p>
              I have been tattooing for like ten years or something. Maybe more. I started out doing stick and poke but got tired of how slow it was and how small things had to be. It was fun but I started doing machine tattoos a long time ago. My idiotic name stayed with me though. At least it's memorable I suppose.
            </p>
            <p>
              Otherwise I do some random shit like co-own a bakery called Farina. I've studied but never really worked in the fields I studied. What a fucking waste of time. I have two kids. I used to be fun but now I'm ultra lame and just go home all the time, and I totally love it.
            </p>
            <p>
              I'm pretty timid, especially in groups. My voice is low and I find it hard sometimes to find the right place to start talking. I've lived in Malmö for fifteen years. Grew up in Canada.
            </p>
            <p>
              Anyway, I do really care about your tattoos. So I spend a bit of extra time if the placement is off. I don't mind. Mmm I don't know. Yeah. Maybe see you for a tattoo I guess. :)
            </p>
          </div>
          <div className="mt-12 flex justify-center">
            <Link to="/book">
              <Button variant="outline">Book a tattoo</Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default About;
