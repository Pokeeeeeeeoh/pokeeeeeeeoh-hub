import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, CheckCircle, AlertCircle, ChevronLeft, ChevronRight, FastForward } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, startOfWeek, addDays, isSameDay, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, endOfWeek, isSameMonth } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { enGB } from "date-fns/locale";
import { toast } from "sonner";
import { useUiText } from "@/hooks/useUiText";

interface AvailableSlot {
  id: string;
  start_time: string;
  end_time: string;
}

interface BookingRequest {
  id: string;
  client_id: string;
  status: string;
  clients: {
    name: string;
    email: string;
  };
}

const SelectSlot = () => {
  const t = useUiText();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<BookingRequest | null>(null);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);
  const [alreadyBooked, setAlreadyBooked] = useState(false);

  useEffect(() => {
    async function verifyToken() {
      if (!token) {
        setError("Invalid or missing booking link.");
        setLoading(false);
        return;
      }

      const { data: requestData, error: requestError } = await supabase
        .from("booking_requests")
        .select(`
          id,
          client_id,
          status,
          clients (
            name,
            email
          )
        `)
        .eq("approval_token", token)
        .single();

      if (requestError || !requestData) {
        setError("Booking request not found or link has expired.");
        setLoading(false);
        return;
      }

      if (requestData.status !== "approved" && requestData.status !== "booked") {
        setError("This request is no longer available for booking.");
        setLoading(false);
        return;
      }

      setRequest(requestData as unknown as BookingRequest);
      await fetchSlots();
      setLoading(false);
    }

    verifyToken();
  }, [token]);

  const fetchSlots = async () => {
    const { data } = await supabase
      .from("availability_slots")
      .select("*")
      .eq("is_booked", false)
      .eq("is_blocked", false)
      .gte("start_time", new Date().toISOString())
      .order("start_time", { ascending: true });

    if (data) {
      setSlots(data);
    }
  };

  const handleBookSlot = async () => {
    if (!selectedSlot || !request) return;
    
    setBooking(true);

    try {
      const slot = slots.find(s => s.id === selectedSlot);
      if (!slot) throw new Error("Slot not found");

      const { data: result, error: fnError } = await supabase.functions.invoke("book-slot", {
        body: { token, slotId: selectedSlot },
      });
      if (fnError) throw fnError;
      if (result?.error) throw new Error(result.error);

      // Send appointment confirmation
      const apptDate = format(parseISO(slot.start_time), "EEEE d MMMM yyyy 'at' HH:mm", { locale: enGB });
      supabase.functions.invoke("send-template-email", {
        body: {
          templateKey: "appointment_booked",
          to: request.clients.email,
          bookingRequestId: request.id,
          vars: { name: request.clients.name, appointmentTime: apptDate },
        },
      }).catch((e) => console.error("appt email failed", e));

      setBooked(true);
    } catch (err) {
      console.error("Booking error:", err);
      toast.error("Could not book the slot. Please try again.");
    } finally {
      setBooking(false);
    }
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  const weekNumber = getISOWeek(currentWeekStart);

  const getSlotsForDay = (date: Date) => {
    return slots.filter(slot => isSameDay(parseISO(slot.start_time), date));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="animate-pulse text-muted-foreground">Verifying your booking link...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Cannot Access</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button variant="outline" onClick={() => navigate("/")}>
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  if (booked) {
    const bookedSlot = slots.find(s => s.id === selectedSlot);
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/10 mb-6">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-4">
            {alreadyBooked
              ? t("slot_booked_existing_title", "Appointment Already Booked")
              : t("slot_booked_title", "Appointment Booked!")}
          </h1>
          <p className="text-muted-foreground mb-6">
            {alreadyBooked
              ? t("slot_booked_existing_subtitle", "This booking link has already been used and your appointment is already confirmed.")
              : t("slot_booked_subtitle", "Your appointment is confirmed. We'll send a confirmation email with all the details.")}
          </p>
          {bookedSlot && (
            <div className="p-4 rounded-lg border border-border bg-card mb-6 text-left">
              <div className="flex items-center gap-3 mb-2">
                <Calendar className="h-5 w-5 text-muted-foreground shrink-0" />
                <span className="font-medium">
                  {format(parseISO(bookedSlot.start_time), "EEEE d MMMM yyyy", { locale: enGB })}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
                <span>
                  {format(parseISO(bookedSlot.start_time), "HH:mm")} – {format(parseISO(bookedSlot.end_time), "HH:mm")}
                </span>
              </div>
            </div>
          )}
          <Button variant="outline" onClick={() => navigate("/")}>
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <header className="border-b border-border bg-background/80 backdrop-blur-sm p-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl font-semibold">{t("slot_title", "Select Your Appointment")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("slot_subtitle", "Choose from the available slots below")}
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-6 px-4 pb-32">
        {/* Week Navigation */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(prev => addDays(prev, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center min-w-0 flex-1">
            <p className="font-mono text-xs text-muted-foreground">Week {weekNumber}</p>
            <p className="text-sm font-medium truncate">
              {format(currentWeekStart, "d MMM", { locale: enGB })} – {format(addDays(currentWeekStart, 6), "d MMM yyyy", { locale: enGB })}
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(prev => addDays(prev, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Month jump + next available */}
        <div className="flex items-center gap-2 mb-6">
          <Select
            value={format(startOfMonth(currentWeekStart), "yyyy-MM")}
            onValueChange={(v) => {
              const [y, m] = v.split("-").map(Number);
              const target = new Date(y, m - 1, 1);
              setCurrentWeekStart(startOfWeek(target, { weekStartsOn: 1 }));
            }}
          >
            <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => addMonths(startOfMonth(new Date()), i)).map((m) => (
                <SelectItem key={format(m, "yyyy-MM")} value={format(m, "yyyy-MM")}>
                  {format(m, "MMMM yyyy", { locale: enGB })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const next = slots.find(s => parseISO(s.start_time) >= new Date());
              if (next) {
                setCurrentWeekStart(startOfWeek(parseISO(next.start_time), { weekStartsOn: 1 }));
                setSelectedSlot(next.id);
              } else {
                toast.info("No upcoming slots available");
              }
            }}
          >
            <FastForward className="h-4 w-4 mr-1" /> Next available
          </Button>
        </div>

        {/* Calendar - Stacked on mobile */}
        <div className="space-y-3 sm:hidden">
          {weekDays.map((day, i) => {
            const daySlots = getSlotsForDay(day);
            const isToday = isSameDay(day, new Date());
            const isPast = day < new Date() && !isToday;
            
            if (daySlots.length === 0 && isPast) return null;
            
            return (
              <div key={i} className={`rounded-lg border ${isToday ? 'border-primary' : 'border-border'} overflow-hidden`}>
                <div className={`p-3 border-b ${isToday ? 'bg-primary/10' : 'bg-muted/30'}`}>
                  <p className="font-medium capitalize">
                    {format(day, "EEEE d MMMM", { locale: enGB })}
                  </p>
                </div>
                <div className="p-3">
                  {daySlots.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {daySlots.map(slot => (
                        <button
                          key={slot.id}
                          onClick={() => setSelectedSlot(slot.id)}
                          className={`px-4 py-2 text-sm rounded-lg border transition-all ${
                            selectedSlot === slot.id
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-card border-border hover:border-primary/50'
                          }`}
                        >
                          {format(parseISO(slot.start_time), "HH:mm")}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No available slots</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Calendar Grid - Desktop */}
        <div className="hidden sm:grid grid-cols-7 gap-2 mb-8">
          {weekDays.map((day, i) => {
            const daySlots = getSlotsForDay(day);
            const isToday = isSameDay(day, new Date());
            
            return (
              <div key={i} className="min-h-[180px] rounded-lg border border-border overflow-hidden">
                <div className={`text-center p-2 border-b ${isToday ? 'bg-primary/10' : 'bg-muted/30'}`}>
                  <p className="text-xs text-muted-foreground capitalize">{format(day, "EEE", { locale: enGB })}</p>
                  <p className={`text-lg font-semibold ${isToday ? 'text-primary' : ''}`}>
                    {format(day, "d")}
                  </p>
                </div>
                <div className="space-y-1 p-1.5">
                  {daySlots.map(slot => (
                    <button
                      key={slot.id}
                      onClick={() => setSelectedSlot(slot.id)}
                      className={`w-full p-2 text-xs rounded border transition-all ${
                        selectedSlot === slot.id
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border hover:border-primary/50'
                      }`}
                    >
                      {format(parseISO(slot.start_time), "HH:mm")}
                    </button>
                  ))}
                  {daySlots.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center p-2">
                      —
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Booking Action */}
        {selectedSlot && (
          <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background p-4 z-50">
            <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                {(() => {
                  const slot = slots.find(s => s.id === selectedSlot);
                  if (!slot) return null;
                  return (
                    <div>
                      <p className="font-medium truncate capitalize">
                        {format(parseISO(slot.start_time), "EEEE d MMMM", { locale: enGB })}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(parseISO(slot.start_time), "HH:mm")} – {format(parseISO(slot.end_time), "HH:mm")}
                      </p>
                    </div>
                  );
                })()}
              </div>
              <Button onClick={handleBookSlot} disabled={booking} className="shrink-0">
                {booking ? "Booking..." : "Confirm"}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SelectSlot;