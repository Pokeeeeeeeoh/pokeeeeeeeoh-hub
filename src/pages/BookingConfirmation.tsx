import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Mail, Clock, ArrowRight } from "lucide-react";
import { useUiText } from "@/hooks/useUiText";
import gotItImg from "@/assets/got-it.jpeg";

const BookingConfirmation = () => {
  const t = useUiText();
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8 animate-fade-in">
          <img src={gotItImg} alt="Got it!" className="mx-auto h-32 sm:h-40 w-auto mb-6" />

          <h1 className="text-3xl font-bold tracking-tight mb-4">
            {t("confirmation_title", "Request Submitted!")}
          </h1>
          <p className="text-muted-foreground mb-8">
            {t("confirmation_subtitle", "Thank you for your booking request. We've received your information and will review it shortly.")}
          </p>
        </div>

        <div className="space-y-4 mb-8 animate-fade-in stagger-1">
          <div className="flex items-start gap-4 p-4 rounded-2xl border border-border bg-card/50 text-left">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-muted shrink-0">
              <Mail className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="font-medium text-sm mb-1">{t("confirmation_email_heading", "Check Your Email")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("confirmation_email_body", "You'll receive a confirmation email with your request details.")}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 rounded-2xl border border-border bg-card/50 text-left">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-muted shrink-0">
              <Clock className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="font-medium text-sm mb-1">{t("confirmation_next_heading", "What Happens Next")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("confirmation_next_body", "We'll review your request within 24-48 hours. If approved, you'll receive an email with a link to select your appointment time.")}
              </p>
            </div>
          </div>
        </div>

        <div className="animate-fade-in stagger-2">
          <p className="text-xs text-muted-foreground mb-4">
            {t("confirmation_disclaimer", "Important: No appointment has been booked yet. You must complete the booking process after approval.")}
          </p>
          <Link to="/">
            <Button variant="outline" className="group">
              Return Home
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" strokeWidth={1.5} />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default BookingConfirmation;
