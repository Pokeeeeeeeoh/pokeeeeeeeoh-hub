import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  format,
  parseISO,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  addWeeks,
  addMonths,
  isSameDay,
  isSameMonth,
  getISOWeek,
  setHours,
  setMinutes,
  eachDayOfInterval,
  getDay,
} from "date-fns";
import { sv } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Clock,
  UserPlus,
  Calendar as CalendarIcon,
  LayoutGrid,
  Repeat,
  User,
  Mail,
  Phone,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface Appointment {
  id: string;
  client_id: string;
  clients: {
    name: string;
    email: string;
    phone: string | null;
  } | null;
}

interface AvailabilitySlot {
  id: string;
  start_time: string;
  end_time: string;
  is_blocked: boolean;
  is_booked: boolean;
  notes: string | null;
  appointments?: Appointment[];
}

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}

type ViewMode = "week" | "month";
type RepeatMode = "none" | "weeks" | "until";

const WEEKDAYS = [
  { value: 1, label: "Mån" },
  { value: 2, label: "Tis" },
  { value: 3, label: "Ons" },
  { value: 4, label: "Tor" },
  { value: 5, label: "Fre" },
  { value: 6, label: "Lör" },
  { value: 0, label: "Sön" },
];

const AdminCalendar = () => {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  // Day action dialog (when clicking on a day)
  const [showDayDialog, setShowDayDialog] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [newSlot, setNewSlot] = useState({
    startTime: "10:00",
    endTime: "12:00",
  });
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("none");
  const [repeatWeekday, setRepeatWeekday] = useState<number>(1);
  const [repeatWeeks, setRepeatWeeks] = useState(4);
  const [repeatUntilDate, setRepeatUntilDate] = useState<Date | undefined>();
  const [addingSlot, setAddingSlot] = useState(false);

  // Slot action dialog (when clicking on a slot)
  const [showSlotDialog, setShowSlotDialog] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [slotRepeatMode, setSlotRepeatMode] = useState<RepeatMode>("none");
  const [slotRepeatWeekday, setSlotRepeatWeekday] = useState<number>(1);
  const [slotRepeatWeeks, setSlotRepeatWeeks] = useState(4);
  const [slotRepeatUntilDate, setSlotRepeatUntilDate] = useState<Date | undefined>();
  const [slotRepeatDays, setSlotRepeatDays] = useState<number[]>([]);
  const [repeatingSlot, setRepeatingSlot] = useState(false);

  // Manual booking state
  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", email: "", phone: "", tattooDescription: "" });
  const [bookingInProgress, setBookingInProgress] = useState(false);

  // Repeat day state
  const [showRepeatDayDialog, setShowRepeatDayDialog] = useState(false);
  const [dayToRepeat, setDayToRepeat] = useState<Date | null>(null);
  const [dayRepeatMode, setDayRepeatMode] = useState<RepeatMode>("weeks");
  const [dayRepeatWeeks, setDayRepeatWeeks] = useState(4);
  const [dayRepeatUntilDate, setDayRepeatUntilDate] = useState<Date | undefined>();
  const [dayRepeatDays, setDayRepeatDays] = useState<number[]>([]);
  const [repeatingDay, setRepeatingDay] = useState(false);

  useEffect(() => {
    fetchSlots();
  }, [currentWeekStart, currentDate, viewMode]);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchSlots = async () => {
    let startDate: Date;
    let endDate: Date;

    if (viewMode === "week") {
      startDate = currentWeekStart;
      endDate = addDays(currentWeekStart, 7);
    } else {
      startDate = startOfMonth(currentDate);
      endDate = addDays(endOfMonth(currentDate), 1);
    }

    const { data, error } = await supabase
      .from("availability_slots")
      .select(`
        *,
        appointments (
          id,
          client_id,
          clients (
            name,
            email,
            phone
          )
        )
      `)
      .gte("start_time", startDate.toISOString())
      .lt("start_time", endDate.toISOString())
      .order("start_time", { ascending: true });

    if (error) {
      console.error("Error fetching slots:", error);
    } else {
      setSlots(data || []);
    }
    setLoading(false);
  };

  const fetchClients = async () => {
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, email, phone")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching clients:", error);
    } else {
      setClients(data || []);
    }
  };

  // Open day dialog when clicking on a day
  const openDayDialog = (day: Date) => {
    setSelectedDay(day);
    setRepeatWeekday(getDay(day));
    setRepeatMode("none");
    setRepeatWeeks(4);
    setRepeatUntilDate(undefined);
    setNewSlot({ startTime: "10:00", endTime: "12:00" });
    setShowDayDialog(true);
  };

  // Open slot dialog when clicking on a slot
  const openSlotDialog = (slot: AvailabilitySlot) => {
    setSelectedSlot(slot);
    const slotDate = parseISO(slot.start_time);
    setSlotRepeatWeekday(getDay(slotDate));
    setSlotRepeatDays([getDay(slotDate)]);
    setSlotRepeatMode("none");
    setSlotRepeatWeeks(4);
    setSlotRepeatUntilDate(undefined);
    setShowSlotDialog(true);
  };

  // Open repeat day dialog
  const openRepeatDayDialog = (day: Date) => {
    const daySlots = getSlotsForDay(day);
    if (daySlots.length === 0) {
      toast.error("Inga tider denna dag att upprepa");
      return;
    }
    setDayToRepeat(day);
    setDayRepeatDays([getDay(day)]);
    setDayRepeatMode("weeks");
    setDayRepeatWeeks(4);
    setDayRepeatUntilDate(undefined);
    setShowRepeatDayDialog(true);
  };

  const handleRepeatDay = async () => {
    if (!dayToRepeat) return;
    setRepeatingDay(true);

    try {
      const daySlots = getSlotsForDay(dayToRepeat);
      const slotsToCreate: { start_time: string; end_time: string }[] = [];

      for (const slot of daySlots) {
        if (slot.is_booked) continue; // Don't repeat booked slots
        
        const slotDate = parseISO(slot.start_time);
        const slotEndDate = parseISO(slot.end_time);
        const startHour = slotDate.getHours();
        const startMin = slotDate.getMinutes();
        const endHour = slotEndDate.getHours();
        const endMin = slotEndDate.getMinutes();

        if (dayRepeatMode === "weeks") {
          for (let i = 1; i <= dayRepeatWeeks; i++) {
            for (const dayOfWeek of dayRepeatDays) {
              let date = addWeeks(dayToRepeat, i);
              const currentDay = getDay(date);
              const diff = dayOfWeek - currentDay;
              date = addDays(date, diff);

              const startTime = setMinutes(setHours(date, startHour), startMin);
              const endTime = setMinutes(setHours(date, endHour), endMin);
              slotsToCreate.push({
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString(),
              });
            }
          }
        } else if (dayRepeatMode === "until" && dayRepeatUntilDate) {
          const days = eachDayOfInterval({ start: addDays(dayToRepeat, 1), end: dayRepeatUntilDate });
          const matchingDays = days.filter((d) => dayRepeatDays.includes(getDay(d)));

          for (const date of matchingDays) {
            const startTime = setMinutes(setHours(date, startHour), startMin);
            const endTime = setMinutes(setHours(date, endHour), endMin);
            slotsToCreate.push({
              start_time: startTime.toISOString(),
              end_time: endTime.toISOString(),
            });
          }
        }
      }

      if (slotsToCreate.length === 0) {
        toast.error("Inga tider att skapa med dessa inställningar");
        setRepeatingDay(false);
        return;
      }

      const { error } = await supabase
        .from("availability_slots")
        .insert(slotsToCreate);

      if (error) throw error;

      toast.success(`${slotsToCreate.length} tid${slotsToCreate.length > 1 ? "er" : ""} tillagd${slotsToCreate.length > 1 ? "a" : ""}`);
      setShowRepeatDayDialog(false);
      setDayToRepeat(null);
      fetchSlots();
    } catch (err) {
      console.error("Error repeating day:", err);
      toast.error("Kunde inte upprepa dagen");
    } finally {
      setRepeatingDay(false);
    }
  };

  const toggleDayRepeatDay = (day: number) => {
    setDayRepeatDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleManualBooking = async (clientId: string) => {
    if (!selectedSlot) return;
    setBookingInProgress(true);

    try {
      const { data: bookingRequest, error: brError } = await supabase
        .from("booking_requests")
        .insert({
          client_id: clientId,
          status: "approved",
          form_responses: { manual_booking: true },
        })
        .select()
        .single();

      if (brError) throw brError;

      const { error: apptError } = await supabase.from("appointments").insert({
        client_id: clientId,
        slot_id: selectedSlot.id,
        booking_request_id: bookingRequest.id,
        start_time: selectedSlot.start_time,
        end_time: selectedSlot.end_time,
      });

      if (apptError) throw apptError;

      const { error: slotError } = await supabase
        .from("availability_slots")
        .update({ is_booked: true })
        .eq("id", selectedSlot.id);

      if (slotError) throw slotError;

      toast.success("Bokning genomförd");
      setShowBookingDialog(false);
      setShowSlotDialog(false);
      fetchSlots();
    } catch (err) {
      console.error("Booking error:", err);
      toast.error("Kunde inte boka tid");
    } finally {
      setBookingInProgress(false);
    }
  };

  const handleBookWithNewClient = async () => {
    // At least one field should have some info
    const hasAnyInfo = newClient.name || newClient.email || newClient.phone || newClient.tattooDescription;
    if (!hasAnyInfo) {
      toast.error("Fyll i minst ett fält");
      return;
    }

    setBookingInProgress(true);

    try {
      let clientId: string;
      
      // If email provided, check for existing
      if (newClient.email) {
        const { data: existingClient } = await supabase
          .from("clients")
          .select("id")
          .eq("email", newClient.email)
          .maybeSingle();

        if (existingClient) {
          clientId = existingClient.id;
        } else {
          const { data: createdClient, error: clientError } = await supabase
            .from("clients")
            .insert({
              name: newClient.name || "Okänd",
              email: newClient.email,
              phone: newClient.phone || null,
              notes: newClient.tattooDescription || null,
            })
            .select()
            .single();

          if (clientError) throw clientError;
          clientId = createdClient.id;
          fetchClients();
        }
      } else {
        // No email - create new client
        const { data: createdClient, error: clientError } = await supabase
          .from("clients")
          .insert({
            name: newClient.name || "Okänd",
            email: `unknown-${Date.now()}@placeholder.local`,
            phone: newClient.phone || null,
            notes: newClient.tattooDescription || null,
          })
          .select()
          .single();

        if (clientError) throw clientError;
        clientId = createdClient.id;
        fetchClients();
      }

      await handleManualBooking(clientId);
    } catch (err) {
      console.error("Error creating client:", err);
      toast.error("Kunde inte skapa kund");
      setBookingInProgress(false);
    }
  };

  const handleAddSlot = async () => {
    if (!selectedDay) return;
    setAddingSlot(true);

    try {
      const [startHour, startMin] = newSlot.startTime.split(":").map(Number);
      const [endHour, endMin] = newSlot.endTime.split(":").map(Number);

      const slotsToCreate: { start_time: string; end_time: string }[] = [];

      if (repeatMode === "none") {
        const startTime = setMinutes(setHours(selectedDay, startHour), startMin);
        const endTime = setMinutes(setHours(selectedDay, endHour), endMin);
        slotsToCreate.push({
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
        });
      } else if (repeatMode === "weeks") {
        for (let i = 0; i < repeatWeeks; i++) {
          let date = addWeeks(selectedDay, i);
          const currentDay = getDay(date);
          const diff = repeatWeekday - currentDay;
          date = addDays(date, diff);

          const startTime = setMinutes(setHours(date, startHour), startMin);
          const endTime = setMinutes(setHours(date, endHour), endMin);
          slotsToCreate.push({
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
          });
        }
      } else if (repeatMode === "until" && repeatUntilDate) {
        const days = eachDayOfInterval({ start: selectedDay, end: repeatUntilDate });
        const matchingDays = days.filter((d) => getDay(d) === repeatWeekday);

        for (const date of matchingDays) {
          const startTime = setMinutes(setHours(date, startHour), startMin);
          const endTime = setMinutes(setHours(date, endHour), endMin);
          slotsToCreate.push({
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
          });
        }
      }

      if (slotsToCreate.length === 0) {
        toast.error("Inga tider att skapa med dessa inställningar");
        setAddingSlot(false);
        return;
      }

      const { error } = await supabase
        .from("availability_slots")
        .insert(slotsToCreate);

      if (error) throw error;

      toast.success(`${slotsToCreate.length} tid${slotsToCreate.length > 1 ? "er" : ""} tillagd${slotsToCreate.length > 1 ? "a" : ""}`);
      setShowDayDialog(false);
      setSelectedDay(null);
      setRepeatMode("none");
      fetchSlots();
    } catch (err) {
      console.error("Error adding slot:", err);
      toast.error("Kunde inte lägga till tid");
    } finally {
      setAddingSlot(false);
    }
  };

  const handleRepeatSlot = async () => {
    if (!selectedSlot) return;
    setRepeatingSlot(true);

    try {
      const slotDate = parseISO(selectedSlot.start_time);
      const slotEndDate = parseISO(selectedSlot.end_time);
      const startHour = slotDate.getHours();
      const startMin = slotDate.getMinutes();
      const endHour = slotEndDate.getHours();
      const endMin = slotEndDate.getMinutes();

      const slotsToCreate: { start_time: string; end_time: string }[] = [];

      if (slotRepeatMode === "weeks") {
        for (let i = 1; i <= slotRepeatWeeks; i++) {
          for (const dayOfWeek of slotRepeatDays) {
            let date = addWeeks(slotDate, i);
            const currentDay = getDay(date);
            const diff = dayOfWeek - currentDay;
            date = addDays(date, diff);

            const startTime = setMinutes(setHours(date, startHour), startMin);
            const endTime = setMinutes(setHours(date, endHour), endMin);
            slotsToCreate.push({
              start_time: startTime.toISOString(),
              end_time: endTime.toISOString(),
            });
          }
        }
      } else if (slotRepeatMode === "until" && slotRepeatUntilDate) {
        const days = eachDayOfInterval({ start: addDays(slotDate, 1), end: slotRepeatUntilDate });
        const matchingDays = days.filter((d) => slotRepeatDays.includes(getDay(d)));

        for (const date of matchingDays) {
          const startTime = setMinutes(setHours(date, startHour), startMin);
          const endTime = setMinutes(setHours(date, endHour), endMin);
          slotsToCreate.push({
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
          });
        }
      }

      if (slotsToCreate.length === 0) {
        toast.error("Inga tider att skapa med dessa inställningar");
        setRepeatingSlot(false);
        return;
      }

      const { error } = await supabase
        .from("availability_slots")
        .insert(slotsToCreate);

      if (error) throw error;

      toast.success(`${slotsToCreate.length} tid${slotsToCreate.length > 1 ? "er" : ""} tillagd${slotsToCreate.length > 1 ? "a" : ""}`);
      setShowSlotDialog(false);
      setSelectedSlot(null);
      fetchSlots();
    } catch (err) {
      console.error("Error repeating slot:", err);
      toast.error("Kunde inte upprepa tid");
    } finally {
      setRepeatingSlot(false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    try {
      await supabase.from("availability_slots").delete().eq("id", slotId);
      toast.success("Tid borttagen");
      setShowSlotDialog(false);
      fetchSlots();
    } catch (err) {
      toast.error("Kunde inte ta bort tid");
    }
  };

  const handleBlockSlot = async (slotId: string, blocked: boolean) => {
    try {
      await supabase
        .from("availability_slots")
        .update({ is_blocked: blocked })
        .eq("id", slotId);
      fetchSlots();
      setShowSlotDialog(false);
    } catch (err) {
      toast.error("Kunde inte uppdatera tid");
    }
  };

  const toggleRepeatDay = (day: number) => {
    setSlotRepeatDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const navigatePrev = () => {
    if (viewMode === "week") {
      setCurrentWeekStart((prev) => addDays(prev, -7));
    } else {
      setCurrentDate((prev) => addMonths(prev, -1));
    }
  };

  const navigateNext = () => {
    if (viewMode === "week") {
      setCurrentWeekStart((prev) => addDays(prev, 7));
    } else {
      setCurrentDate((prev) => addMonths(prev, 1));
    }
  };

  const weekDays = Array.from({ length: 7 }, (_, i) =>
    addDays(currentWeekStart, i)
  );
  const weekNumber = getISOWeek(currentWeekStart);

  const getSlotsForDay = (date: Date) => {
    return slots.filter((slot) => isSameDay(parseISO(slot.start_time), date));
  };

  // Month view days
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthStartWeek = startOfWeek(monthStart, { weekStartsOn: 1 });
  const monthDays = eachDayOfInterval({
    start: monthStartWeek,
    end: addDays(monthEnd, 6 - getDay(monthEnd) || 7),
  }).slice(0, 42);

  const timeOptions = [];
  for (let h = 8; h <= 20; h++) {
    for (let m = 0; m < 60; m += 30) {
      const time = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
      timeOptions.push(time);
    }
  }

  const getClientFromSlot = (slot: AvailabilitySlot) => {
    if (slot.appointments && slot.appointments.length > 0) {
      return slot.appointments[0].clients;
    }
    return null;
  };

  const SlotCard = ({ slot }: { slot: AvailabilitySlot }) => {
    const client = getClientFromSlot(slot);
    
    return (
      <button
        onClick={() => openSlotDialog(slot)}
        className={cn(
          "w-full text-left group px-2 py-1.5 rounded text-xs border transition-colors",
          slot.is_booked
            ? "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400 hover:bg-green-500/20"
            : slot.is_blocked
            ? "bg-muted border-muted text-muted-foreground line-through hover:bg-muted/80"
            : "bg-card border-border hover:border-primary/50 hover:bg-accent/50"
        )}
      >
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[11px] shrink-0">
            {format(parseISO(slot.start_time), "HH:mm")}
          </span>
          {slot.is_booked && client && (
            <span className="text-[10px] opacity-70 truncate">{client.name}</span>
          )}
          {!slot.is_booked && !slot.is_blocked && (
            <span className="text-[10px] opacity-50 truncate">Ledig</span>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="p-4 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Kalender</h1>
          <p className="text-muted-foreground text-sm">
            Hantera dina lediga tider
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          {/* Navigation */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={navigatePrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center min-w-[200px]">
              {viewMode === "week" ? (
                <>
                  <p className="font-mono text-xs text-muted-foreground">
                    Vecka {weekNumber}
                  </p>
                  <p className="text-sm font-medium">
                    {format(currentWeekStart, "d MMM", { locale: sv })} –{" "}
                    {format(addDays(currentWeekStart, 6), "d MMM yyyy", { locale: sv })}
                  </p>
                </>
              ) : (
                <p className="text-sm font-medium">
                  {format(currentDate, "MMMM yyyy", { locale: sv })}
                </p>
              )}
            </div>
            <Button variant="outline" size="icon" onClick={navigateNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "week" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("week")}
            >
              <CalendarIcon className="h-4 w-4 mr-1.5" />
              Vecka
            </Button>
            <Button
              variant={viewMode === "month" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("month")}
            >
              <LayoutGrid className="h-4 w-4 mr-1.5" />
              Månad
            </Button>
          </div>
        </div>

        {/* Calendar */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Laddar kalender...
          </div>
        ) : viewMode === "week" ? (
          /* Week View */
          <div className="overflow-x-auto -mx-4 px-4 pb-4">
            <div className="grid grid-cols-7 gap-1.5 min-w-[700px]">
              {weekDays.map((day, i) => {
                const daySlots = getSlotsForDay(day);
                const isToday = isSameDay(day, new Date());
                const isPast = day < new Date() && !isToday;

                return (
                  <div
                    key={i}
                    className={cn(
                      "min-h-[280px] rounded-lg border flex flex-col",
                      isToday ? "border-primary" : "border-border",
                      isPast && "opacity-50"
                    )}
                  >
                    <button
                      onClick={() => !isPast && openDayDialog(day)}
                      disabled={isPast}
                      className={cn(
                        "p-2 border-b border-border text-center shrink-0 hover:bg-accent/50 transition-colors",
                        isToday && "bg-primary/10",
                        !isPast && "cursor-pointer"
                      )}
                    >
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {format(day, "EEEE", { locale: sv })}
                      </p>
                      <p
                        className={cn(
                          "text-lg font-semibold",
                          isToday && "text-primary"
                        )}
                      >
                        {format(day, "d")}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(day, "MMM", { locale: sv })}
                      </p>
                    </button>

                    <div className="flex-1 p-1.5 space-y-1 overflow-y-auto">
                      {daySlots.map((slot) => (
                        <SlotCard key={slot.id} slot={slot} />
                      ))}
                    </div>

                    {!isPast && (
                      <div className="p-1.5 pt-0 shrink-0 flex gap-1">
                        <button
                          onClick={() => openDayDialog(day)}
                          className="flex-1 p-1.5 rounded border border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
                        >
                          <Plus className="h-3 w-3" />
                          <span className="text-[10px]">Lägg till</span>
                        </button>
                        {daySlots.length > 0 && (
                          <button
                            onClick={() => openRepeatDayDialog(day)}
                            className="p-1.5 rounded border border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
                            title="Upprepa hela dagen"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Month View */
          <div className="overflow-x-auto -mx-4 px-4 pb-4">
            <div className="min-w-[700px]">
              {/* Weekday Headers */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"].map((d) => (
                  <div
                    key={d}
                    className="text-center text-[10px] uppercase tracking-wider text-muted-foreground py-2"
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-1">
                {monthDays.map((day, i) => {
                  const daySlots = getSlotsForDay(day);
                  const isToday = isSameDay(day, new Date());
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const isPast = day < new Date() && !isToday;

                  return (
                    <div
                      key={i}
                      className={cn(
                        "min-h-[100px] rounded border p-1.5 flex flex-col",
                        isToday ? "border-primary" : "border-border",
                        !isCurrentMonth && "bg-muted/30",
                        isPast && "opacity-50"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <button
                          onClick={() => !isPast && isCurrentMonth && openDayDialog(day)}
                          disabled={isPast || !isCurrentMonth}
                          className={cn(
                            "text-xs font-medium hover:text-primary transition-colors",
                            isToday && "text-primary",
                            !isCurrentMonth && "text-muted-foreground"
                          )}
                        >
                          {format(day, "d")}
                        </button>
                        {!isPast && isCurrentMonth && (
                          <button
                            onClick={() => openDayDialog(day)}
                            className="p-0.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        )}
                      </div>

                      <div className="flex-1 space-y-0.5 overflow-y-auto">
                        {daySlots.slice(0, 3).map((slot) => (
                          <button
                            key={slot.id}
                            onClick={() => openSlotDialog(slot)}
                            className={cn(
                              "w-full text-left text-[10px] px-1 py-0.5 rounded truncate",
                              slot.is_booked
                                ? "bg-green-500/20 text-green-700 dark:text-green-400 hover:bg-green-500/30"
                                : slot.is_blocked
                                ? "bg-muted text-muted-foreground line-through"
                                : "bg-primary/10 text-primary hover:bg-primary/20"
                            )}
                          >
                            {format(parseISO(slot.start_time), "HH:mm")}
                          </button>
                        ))}
                        {daySlots.length > 3 && (
                          <div className="text-[10px] text-muted-foreground px-1">
                            +{daySlots.length - 3} till
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Add Slot Dialog (Day Click) */}
        <Dialog open={showDayDialog} onOpenChange={setShowDayDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Lägg till tid</DialogTitle>
            </DialogHeader>
            {selectedDay && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  <span className="text-foreground font-medium">
                    {format(selectedDay, "EEEE d MMMM yyyy", { locale: sv })}
                  </span>
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Starttid</Label>
                    <Select
                      value={newSlot.startTime}
                      onValueChange={(v) =>
                        setNewSlot((prev) => ({ ...prev, startTime: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {timeOptions.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Sluttid</Label>
                    <Select
                      value={newSlot.endTime}
                      onValueChange={(v) =>
                        setNewSlot((prev) => ({ ...prev, endTime: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {timeOptions.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Repeat Options */}
                <div className="space-y-3 pt-2 border-t border-border">
                  <Label className="text-xs text-muted-foreground">
                    Upprepa
                  </Label>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="repeat-none"
                        checked={repeatMode === "none"}
                        onCheckedChange={() => setRepeatMode("none")}
                      />
                      <Label htmlFor="repeat-none" className="text-sm cursor-pointer">
                        Endast denna dag
                      </Label>
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="repeat-weeks"
                        checked={repeatMode === "weeks"}
                        onCheckedChange={() => setRepeatMode("weeks")}
                      />
                      <Label htmlFor="repeat-weeks" className="text-sm cursor-pointer">
                        Upprepa antal veckor
                      </Label>
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="repeat-until"
                        checked={repeatMode === "until"}
                        onCheckedChange={() => setRepeatMode("until")}
                      />
                      <Label htmlFor="repeat-until" className="text-sm cursor-pointer">
                        Upprepa till datum
                      </Label>
                    </div>
                  </div>

                  {repeatMode !== "none" && (
                    <div className="space-y-3 pl-6">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Veckodag</Label>
                        <Select
                          value={repeatWeekday.toString()}
                          onValueChange={(v) => setRepeatWeekday(parseInt(v))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {WEEKDAYS.map((day) => (
                              <SelectItem key={day.value} value={day.value.toString()}>
                                {day.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {repeatMode === "weeks" && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">Antal veckor</Label>
                          <Input
                            type="number"
                            min={1}
                            max={52}
                            value={repeatWeeks}
                            onChange={(e) =>
                              setRepeatWeeks(parseInt(e.target.value) || 1)
                            }
                          />
                        </div>
                      )}

                      {repeatMode === "until" && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">Till datum</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !repeatUntilDate && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {repeatUntilDate
                                  ? format(repeatUntilDate, "d MMMM yyyy", { locale: sv })
                                  : "Välj datum"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={repeatUntilDate}
                                onSelect={setRepeatUntilDate}
                                disabled={(date) => date < selectedDay}
                                weekStartsOn={1}
                                locale={sv}
                                initialFocus
                                className="p-3 pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowDayDialog(false)}
                  >
                    Avbryt
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleAddSlot}
                    disabled={addingSlot}
                  >
                    {addingSlot ? "Lägger till..." : "Lägg till"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Slot Dialog (Slot Click) */}
        <Dialog open={showSlotDialog} onOpenChange={setShowSlotDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {selectedSlot?.is_booked ? "Bokad tid" : "Hantera tid"}
              </DialogTitle>
            </DialogHeader>
            {selectedSlot && (
              <div className="space-y-4">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium">
                    {format(parseISO(selectedSlot.start_time), "EEEE d MMMM yyyy", { locale: sv })}
                  </p>
                  <p className="text-lg font-mono">
                    {format(parseISO(selectedSlot.start_time), "HH:mm")} – {format(parseISO(selectedSlot.end_time), "HH:mm")}
                  </p>
                </div>

                {/* If booked, show client info */}
                {selectedSlot.is_booked && getClientFromSlot(selectedSlot) && (
                  <div className="space-y-3 p-4 border border-green-500/30 bg-green-500/5 rounded-lg">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                      <User className="h-4 w-4" />
                      <span className="font-medium">{getClientFromSlot(selectedSlot)?.name}</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(getClientFromSlot(selectedSlot)?.email || "");
                          toast.success("E-post kopierad");
                        }}
                        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors w-full"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        <span>{getClientFromSlot(selectedSlot)?.email}</span>
                        <Copy className="h-3 w-3 ml-auto opacity-50" />
                      </button>
                      {getClientFromSlot(selectedSlot)?.phone && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(getClientFromSlot(selectedSlot)?.phone || "");
                            toast.success("Telefon kopierad");
                          }}
                          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors w-full"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          <span>{getClientFromSlot(selectedSlot)?.phone}</span>
                          <Copy className="h-3 w-3 ml-auto opacity-50" />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* If not booked, show actions */}
                {!selectedSlot.is_booked && (
                  <div className="space-y-4">
                    {/* Quick Actions */}
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedClientId("");
                          setNewClient({ name: "", email: "", phone: "", tattooDescription: "" });
                          setShowBookingDialog(true);
                        }}
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Boka kund
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleBlockSlot(selectedSlot.id, !selectedSlot.is_blocked)}
                      >
                        <Clock className="h-4 w-4 mr-2" />
                        {selectedSlot.is_blocked ? "Avblockera" : "Blockera"}
                      </Button>
                    </div>

                    {/* Repeat Options */}
                    <div className="space-y-3 pt-4 border-t border-border">
                      <div className="flex items-center gap-2">
                        <Repeat className="h-4 w-4 text-muted-foreground" />
                        <Label className="text-sm font-medium">Upprepa denna tid</Label>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="slot-repeat-weeks"
                            checked={slotRepeatMode === "weeks"}
                            onCheckedChange={(checked) => setSlotRepeatMode(checked ? "weeks" : "none")}
                          />
                          <Label htmlFor="slot-repeat-weeks" className="text-sm cursor-pointer">
                            Antal veckor framåt
                          </Label>
                        </div>

                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="slot-repeat-until"
                            checked={slotRepeatMode === "until"}
                            onCheckedChange={(checked) => setSlotRepeatMode(checked ? "until" : "none")}
                          />
                          <Label htmlFor="slot-repeat-until" className="text-sm cursor-pointer">
                            Till datum
                          </Label>
                        </div>
                      </div>

                      {slotRepeatMode !== "none" && (
                        <div className="space-y-3 pl-6">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Vilka dagar</Label>
                            <div className="flex flex-wrap gap-1">
                              {WEEKDAYS.map((day) => (
                                <button
                                  key={day.value}
                                  onClick={() => toggleRepeatDay(day.value)}
                                  className={cn(
                                    "px-2.5 py-1 text-xs rounded-full border transition-colors",
                                    slotRepeatDays.includes(day.value)
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "bg-background border-border hover:border-primary/50"
                                  )}
                                >
                                  {day.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {slotRepeatMode === "weeks" && (
                            <div className="space-y-1.5">
                              <Label className="text-xs">Antal veckor</Label>
                              <Input
                                type="number"
                                min={1}
                                max={52}
                                value={slotRepeatWeeks}
                                onChange={(e) =>
                                  setSlotRepeatWeeks(parseInt(e.target.value) || 1)
                                }
                              />
                            </div>
                          )}

                          {slotRepeatMode === "until" && (
                            <div className="space-y-1.5">
                              <Label className="text-xs">Till datum</Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "w-full justify-start text-left font-normal",
                                      !slotRepeatUntilDate && "text-muted-foreground"
                                    )}
                                  >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {slotRepeatUntilDate
                                      ? format(slotRepeatUntilDate, "d MMMM yyyy", { locale: sv })
                                      : "Välj datum"}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={slotRepeatUntilDate}
                                    onSelect={setSlotRepeatUntilDate}
                                    disabled={(date) => date <= parseISO(selectedSlot.start_time)}
                                    weekStartsOn={1}
                                    locale={sv}
                                    initialFocus
                                    className="p-3 pointer-events-auto"
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>
                          )}

                          <Button
                            className="w-full"
                            onClick={handleRepeatSlot}
                            disabled={repeatingSlot || slotRepeatDays.length === 0}
                          >
                            {repeatingSlot ? "Skapar tider..." : "Skapa upprepade tider"}
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Delete */}
                    <div className="pt-4 border-t border-border">
                      <Button
                        variant="destructive"
                        className="w-full"
                        onClick={() => handleDeleteSlot(selectedSlot.id)}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Ta bort tid
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Manual Booking Dialog */}
        <Dialog open={showBookingDialog} onOpenChange={setShowBookingDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Boka kund</DialogTitle>
            </DialogHeader>
            {selectedSlot && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Bokar tid:{" "}
                  <span className="text-foreground font-medium">
                    {format(parseISO(selectedSlot.start_time), "EEEE d MMM 'kl' HH:mm", { locale: sv })}
                  </span>
                </p>

                <Tabs defaultValue="existing" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="existing">Befintlig kund</TabsTrigger>
                    <TabsTrigger value="new">Ny kund</TabsTrigger>
                  </TabsList>

                  <TabsContent value="existing" className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Välj kund</Label>
                      <Popover
                        open={clientSearchOpen}
                        onOpenChange={setClientSearchOpen}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={clientSearchOpen}
                            className="w-full justify-between"
                          >
                            {selectedClientId
                              ? clients.find((c) => c.id === selectedClientId)?.name
                              : "Sök kund..."}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Sök på namn eller e-post..." />
                            <CommandList>
                              <CommandEmpty>Inga kunder hittades.</CommandEmpty>
                              <CommandGroup>
                                {clients.map((client) => (
                                  <CommandItem
                                    key={client.id}
                                    value={`${client.name} ${client.email}`}
                                    onSelect={() => {
                                      setSelectedClientId(client.id);
                                      setClientSearchOpen(false);
                                    }}
                                  >
                                    <div className="flex flex-col">
                                      <span className="font-medium">
                                        {client.name}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {client.email}
                                      </span>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <Button
                      className="w-full"
                      onClick={() => handleManualBooking(selectedClientId)}
                      disabled={!selectedClientId || bookingInProgress}
                    >
                      {bookingInProgress ? "Bokar..." : "Boka tid"}
                    </Button>
                  </TabsContent>

                  <TabsContent value="new" className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Namn</Label>
                      <Input
                        value={newClient.name}
                        onChange={(e) =>
                          setNewClient((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        placeholder="Kundens namn"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">E-post</Label>
                      <Input
                        type="email"
                        value={newClient.email}
                        onChange={(e) =>
                          setNewClient((prev) => ({
                            ...prev,
                            email: e.target.value,
                          }))
                        }
                        placeholder="kund@email.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Telefon</Label>
                      <Input
                        value={newClient.phone}
                        onChange={(e) =>
                          setNewClient((prev) => ({
                            ...prev,
                            phone: e.target.value,
                          }))
                        }
                        placeholder="Valfritt"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Tatuering (kort beskrivning)</Label>
                      <Input
                        value={newClient.tattooDescription}
                        onChange={(e) =>
                          setNewClient((prev) => ({
                            ...prev,
                            tattooDescription: e.target.value,
                          }))
                        }
                        placeholder="T.ex. Ros på underarm"
                      />
                    </div>

                    <Button
                      className="w-full"
                      onClick={handleBookWithNewClient}
                      disabled={bookingInProgress}
                    >
                      {bookingInProgress ? "Bokar..." : "Skapa & boka"}
                    </Button>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Repeat Day Dialog */}
        <Dialog open={showRepeatDayDialog} onOpenChange={setShowRepeatDayDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Upprepa hela dagen</DialogTitle>
            </DialogHeader>
            {dayToRepeat && (
              <div className="space-y-4">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium">
                    {format(dayToRepeat, "EEEE d MMMM yyyy", { locale: sv })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {getSlotsForDay(dayToRepeat).filter(s => !s.is_booked).length} lediga tider kommer upprepas
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="day-repeat-weeks"
                        checked={dayRepeatMode === "weeks"}
                        onCheckedChange={(checked) => setDayRepeatMode(checked ? "weeks" : "until")}
                      />
                      <Label htmlFor="day-repeat-weeks" className="text-sm cursor-pointer">
                        Antal veckor framåt
                      </Label>
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="day-repeat-until"
                        checked={dayRepeatMode === "until"}
                        onCheckedChange={(checked) => setDayRepeatMode(checked ? "until" : "weeks")}
                      />
                      <Label htmlFor="day-repeat-until" className="text-sm cursor-pointer">
                        Till datum
                      </Label>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Vilka dagar</Label>
                      <div className="flex flex-wrap gap-1">
                        {WEEKDAYS.map((day) => (
                          <button
                            key={day.value}
                            onClick={() => toggleDayRepeatDay(day.value)}
                            className={cn(
                              "px-2.5 py-1 text-xs rounded-full border transition-colors",
                              dayRepeatDays.includes(day.value)
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background border-border hover:border-primary/50"
                            )}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {dayRepeatMode === "weeks" && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Antal veckor</Label>
                        <Input
                          type="number"
                          min={1}
                          max={52}
                          value={dayRepeatWeeks}
                          onChange={(e) =>
                            setDayRepeatWeeks(parseInt(e.target.value) || 1)
                          }
                        />
                      </div>
                    )}

                    {dayRepeatMode === "until" && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Till datum</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !dayRepeatUntilDate && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {dayRepeatUntilDate
                                ? format(dayRepeatUntilDate, "d MMMM yyyy", { locale: sv })
                                : "Välj datum"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={dayRepeatUntilDate}
                              onSelect={setDayRepeatUntilDate}
                              disabled={(date) => date <= dayToRepeat}
                              weekStartsOn={1}
                              locale={sv}
                              initialFocus
                              className="p-3 pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowRepeatDayDialog(false)}
                  >
                    Avbryt
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleRepeatDay}
                    disabled={repeatingDay || dayRepeatDays.length === 0}
                  >
                    {repeatingDay ? "Skapar tider..." : "Upprepa"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AdminCalendar;
