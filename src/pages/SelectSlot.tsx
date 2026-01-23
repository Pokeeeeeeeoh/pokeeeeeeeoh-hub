import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, startOfWeek, addDays, isSameDay, getISOWeek } from "date-fns";
import { toast } from "sonner";

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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<BookingRequest | null>(null);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);

  useEffect(() => {
    async function verifyToken() {
      if (!token) {
        setError("Invalid or missing booking token.");
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

      if (requestData.status !== "approved") {
        if (requestData.status === "booked") {
          setError("This request has already been booked.");
        } else {
          setError("This request is no longer available for booking.");
        }
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

      // Create appointment
      const { error: appointmentError } = await supabase
        .from("appointments")
        .insert({
          booking_request_id: request.id,
          client_id: request.client_id,
          slot_id: slot.id,
          start_time: slot.start_time,
          end_time: slot.end_time,
        });

      if (appointmentError) throw appointmentError;

      // Mark slot as booked
      await supabase
        .from("availability_slots")
        .update({ is_booked: true })
        .eq("id", selectedSlot);

      // Update request status
      await supabase
        .from("booking_requests")
        .update({ status: "booked" })
        .eq("id", request.id);

      setBooked(true);
    } catch (err) {
      console.error("Booking error:", err);
      toast.error("Failed to book appointment. Please try again.");
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Verifying your booking link...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Unable to Access</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button variant="outline" onClick={() => navigate("/")}>
            Return Home
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
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-success/10 mb-6">
            <CheckCircle className="h-10 w-10 text-success" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-4">
            Appointment Booked!
          </h1>
          <p className="text-muted-foreground mb-6">
            Your appointment has been confirmed. We'll send you a confirmation email 
            with all the details.
          </p>
          {bookedSlot && (
            <div className="p-4 rounded-lg border border-border bg-card mb-6 text-left">
              <div className="flex items-center gap-3 mb-2">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">
                  {format(parseISO(bookedSlot.start_time), "EEEE, MMMM d, yyyy")}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <span>
                  {format(parseISO(bookedSlot.start_time), "h:mm a")} - {format(parseISO(bookedSlot.end_time), "h:mm a")}
                </span>
              </div>
            </div>
          )}
          <Button variant="outline" onClick={() => navigate("/")}>
            Return Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur-sm p-4">
        <div className="container mx-auto max-w-4xl">
          <h1 className="text-xl font-semibold">Select Your Appointment</h1>
          <p className="text-sm text-muted-foreground">
            Choose from the available time slots below
          </p>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl py-8 px-4">
        {/* Week Navigation */}
        <div className="flex items-center justify-between mb-6">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setCurrentWeekStart(prev => addDays(prev, -7))}
          >
            Previous Week
          </Button>
          <span className="font-mono text-sm text-muted-foreground">
            Week {weekNumber} • {format(currentWeekStart, "MMM d")} - {format(addDays(currentWeekStart, 6), "MMM d, yyyy")}
          </span>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setCurrentWeekStart(prev => addDays(prev, 7))}
          >
            Next Week
          </Button>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2 mb-8">
          {weekDays.map((day, i) => {
            const daySlots = getSlotsForDay(day);
            const isToday = isSameDay(day, new Date());
            
            return (
              <div key={i} className="min-h-[200px]">
                <div className={`text-center p-2 rounded-t-lg border-b ${isToday ? 'bg-primary/10' : 'bg-card'}`}>
                  <p className="text-xs text-muted-foreground">{format(day, "EEE")}</p>
                  <p className={`text-lg font-semibold ${isToday ? 'text-primary' : ''}`}>
                    {format(day, "d")}
                  </p>
                </div>
                <div className="space-y-1 p-1">
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
                      {format(parseISO(slot.start_time), "h:mm a")}
                    </button>
                  ))}
                  {daySlots.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center p-2">
                      No slots
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Booking Action */}
        {selectedSlot && (
          <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background p-4">
            <div className="container mx-auto max-w-4xl flex items-center justify-between">
              <div>
                {(() => {
                  const slot = slots.find(s => s.id === selectedSlot);
                  if (!slot) return null;
                  return (
                    <div>
                      <p className="font-medium">
                        {format(parseISO(slot.start_time), "EEEE, MMMM d")}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(parseISO(slot.start_time), "h:mm a")} - {format(parseISO(slot.end_time), "h:mm a")}
                      </p>
                    </div>
                  );
                })()}
              </div>
              <Button onClick={handleBookSlot} disabled={booking}>
                {booking ? "Booking..." : "Confirm Appointment"}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SelectSlot;
