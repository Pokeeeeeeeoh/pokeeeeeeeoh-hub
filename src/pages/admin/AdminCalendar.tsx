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
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Clock,
  UserPlus,
  Calendar as CalendarIcon,
  LayoutGrid,
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

interface AvailabilitySlot {
  id: string;
  start_time: string;
  end_time: string;
  is_blocked: boolean;
  is_booked: boolean;
  notes: string | null;
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
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

const AdminCalendar = () => {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  // Add slot state
  const [showAddSlot, setShowAddSlot] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [newSlot, setNewSlot] = useState({
    startTime: "10:00",
    endTime: "12:00",
  });
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("none");
  const [repeatWeekday, setRepeatWeekday] = useState<number>(1);
  const [repeatWeeks, setRepeatWeeks] = useState(4);
  const [repeatUntilDate, setRepeatUntilDate] = useState<Date | undefined>();
  const [addingSlot, setAddingSlot] = useState(false);

  // Manual booking state
  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", email: "", phone: "" });
  const [bookingInProgress, setBookingInProgress] = useState(false);

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
      .select("*")
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

  const openBookingDialog = (slot: AvailabilitySlot) => {
    setSelectedSlot(slot);
    setSelectedClientId("");
    setNewClient({ name: "", email: "", phone: "" });
    setShowBookingDialog(true);
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

      toast.success("Appointment booked successfully");
      setShowBookingDialog(false);
      fetchSlots();
    } catch (err) {
      console.error("Booking error:", err);
      toast.error("Failed to book appointment");
    } finally {
      setBookingInProgress(false);
    }
  };

  const handleBookWithNewClient = async () => {
    if (!newClient.name || !newClient.email) {
      toast.error("Name and email are required");
      return;
    }

    setBookingInProgress(true);

    try {
      const { data: existingClient } = await supabase
        .from("clients")
        .select("id")
        .eq("email", newClient.email)
        .maybeSingle();

      let clientId: string;

      if (existingClient) {
        clientId = existingClient.id;
      } else {
        const { data: createdClient, error: clientError } = await supabase
          .from("clients")
          .insert({
            name: newClient.name,
            email: newClient.email,
            phone: newClient.phone || null,
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
      toast.error("Failed to create client");
      setBookingInProgress(false);
    }
  };

  const handleAddSlot = async () => {
    if (!selectedDate) return;
    setAddingSlot(true);

    try {
      const [startHour, startMin] = newSlot.startTime.split(":").map(Number);
      const [endHour, endMin] = newSlot.endTime.split(":").map(Number);

      const slotsToCreate: { start_time: string; end_time: string }[] = [];

      if (repeatMode === "none") {
        // Single slot
        const startTime = setMinutes(setHours(selectedDate, startHour), startMin);
        const endTime = setMinutes(setHours(selectedDate, endHour), endMin);
        slotsToCreate.push({
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
        });
      } else if (repeatMode === "weeks") {
        // Repeat for X weeks on selected weekday
        for (let i = 0; i < repeatWeeks; i++) {
          let date = addWeeks(selectedDate, i);
          // Adjust to correct weekday
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
        // Repeat until date on selected weekday
        const days = eachDayOfInterval({ start: selectedDate, end: repeatUntilDate });
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
        toast.error("No slots to create with these settings");
        setAddingSlot(false);
        return;
      }

      const { error } = await supabase
        .from("availability_slots")
        .insert(slotsToCreate);

      if (error) throw error;

      toast.success(
        `Added ${slotsToCreate.length} slot${slotsToCreate.length > 1 ? "s" : ""}`
      );
      setShowAddSlot(false);
      setSelectedDate(null);
      setRepeatMode("none");
      fetchSlots();
    } catch (err) {
      console.error("Error adding slot:", err);
      toast.error("Failed to add slot");
    } finally {
      setAddingSlot(false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    try {
      await supabase.from("availability_slots").delete().eq("id", slotId);
      toast.success("Slot removed");
      fetchSlots();
    } catch (err) {
      toast.error("Failed to remove slot");
    }
  };

  const handleBlockSlot = async (slotId: string, blocked: boolean) => {
    try {
      await supabase
        .from("availability_slots")
        .update({ is_blocked: blocked })
        .eq("id", slotId);
      fetchSlots();
    } catch (err) {
      toast.error("Failed to update slot");
    }
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
  }).slice(0, 42); // Max 6 weeks

  const timeOptions = [];
  for (let h = 8; h <= 20; h++) {
    for (let m = 0; m < 60; m += 30) {
      const time = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
      timeOptions.push(time);
    }
  }

  const openAddSlotDialog = (day: Date) => {
    setSelectedDate(day);
    setRepeatWeekday(getDay(day));
    setShowAddSlot(true);
  };

  const SlotCard = ({ slot }: { slot: AvailabilitySlot }) => (
    <div
      className={cn(
        "group px-2 py-1.5 rounded text-xs border transition-colors",
        slot.is_booked
          ? "bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400"
          : slot.is_blocked
          ? "bg-muted border-muted text-muted-foreground line-through"
          : "bg-card border-border hover:border-primary/50"
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[11px] shrink-0">
          {format(parseISO(slot.start_time), "HH:mm")}
        </span>
        {slot.is_booked && (
          <span className="text-[10px] opacity-70 truncate">Booked</span>
        )}
        {!slot.is_booked && (
          <div className="ml-auto opacity-0 group-hover:opacity-100 flex gap-0.5 transition-opacity shrink-0">
            {!slot.is_blocked && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openBookingDialog(slot);
                }}
                className="p-0.5 hover:bg-primary/20 rounded text-primary"
                title="Book client"
              >
                <UserPlus className="h-3 w-3" />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleBlockSlot(slot.id, !slot.is_blocked);
              }}
              className="p-0.5 hover:bg-secondary rounded"
              title={slot.is_blocked ? "Unblock" : "Block"}
            >
              <Clock className="h-3 w-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteSlot(slot.id);
              }}
              className="p-0.5 hover:bg-destructive/20 rounded text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-4 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">
            Availability Calendar
          </h1>
          <p className="text-muted-foreground text-sm">
            Manage your available appointment slots
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          {/* Navigation */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={navigatePrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center min-w-[180px]">
              {viewMode === "week" ? (
                <>
                  <p className="font-mono text-xs text-muted-foreground">
                    Week {weekNumber}
                  </p>
                  <p className="text-sm font-medium">
                    {format(currentWeekStart, "MMM d")} –{" "}
                    {format(addDays(currentWeekStart, 6), "MMM d")}
                  </p>
                </>
              ) : (
                <p className="text-sm font-medium">
                  {format(currentDate, "MMMM yyyy")}
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
              Week
            </Button>
            <Button
              variant={viewMode === "month" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("month")}
            >
              <LayoutGrid className="h-4 w-4 mr-1.5" />
              Month
            </Button>
          </div>
        </div>

        {/* Calendar */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading calendar...
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
                    <div
                      className={cn(
                        "p-2 border-b border-border text-center shrink-0",
                        isToday && "bg-primary/10"
                      )}
                    >
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {format(day, "EEE")}
                      </p>
                      <p
                        className={cn(
                          "text-lg font-semibold",
                          isToday && "text-primary"
                        )}
                      >
                        {format(day, "d")}
                      </p>
                    </div>

                    <div className="flex-1 p-1.5 space-y-1 overflow-y-auto">
                      {daySlots.map((slot) => (
                        <SlotCard key={slot.id} slot={slot} />
                      ))}
                    </div>

                    {!isPast && (
                      <div className="p-1.5 pt-0 shrink-0">
                        <button
                          onClick={() => openAddSlotDialog(day)}
                          className="w-full p-1.5 rounded border border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
                        >
                          <Plus className="h-3 w-3" />
                          <span className="text-[10px]">Add</span>
                        </button>
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
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
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
                        <span
                          className={cn(
                            "text-xs font-medium",
                            isToday && "text-primary",
                            !isCurrentMonth && "text-muted-foreground"
                          )}
                        >
                          {format(day, "d")}
                        </span>
                        {!isPast && isCurrentMonth && (
                          <button
                            onClick={() => openAddSlotDialog(day)}
                            className="p-0.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        )}
                      </div>

                      <div className="flex-1 space-y-0.5 overflow-y-auto">
                        {daySlots.slice(0, 3).map((slot) => (
                          <div
                            key={slot.id}
                            className={cn(
                              "text-[10px] px-1 py-0.5 rounded truncate cursor-pointer",
                              slot.is_booked
                                ? "bg-green-500/20 text-green-700 dark:text-green-400"
                                : slot.is_blocked
                                ? "bg-muted text-muted-foreground line-through"
                                : "bg-primary/10 text-primary"
                            )}
                            onClick={() => !slot.is_booked && openBookingDialog(slot)}
                          >
                            {format(parseISO(slot.start_time), "HH:mm")}
                          </div>
                        ))}
                        {daySlots.length > 3 && (
                          <div className="text-[10px] text-muted-foreground px-1">
                            +{daySlots.length - 3} more
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

        {/* Add Slot Dialog */}
        <Dialog open={showAddSlot} onOpenChange={setShowAddSlot}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Availability Slot</DialogTitle>
            </DialogHeader>
            {selectedDate && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Starting from{" "}
                  <span className="text-foreground font-medium">
                    {format(selectedDate, "EEEE, MMM d, yyyy")}
                  </span>
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Start Time</Label>
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
                    <Label className="text-xs">End Time</Label>
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
                    Repeat Options
                  </Label>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="repeat-none"
                        checked={repeatMode === "none"}
                        onCheckedChange={() => setRepeatMode("none")}
                      />
                      <Label htmlFor="repeat-none" className="text-sm cursor-pointer">
                        Single slot only
                      </Label>
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="repeat-weeks"
                        checked={repeatMode === "weeks"}
                        onCheckedChange={() => setRepeatMode("weeks")}
                      />
                      <Label htmlFor="repeat-weeks" className="text-sm cursor-pointer">
                        Repeat for weeks
                      </Label>
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="repeat-until"
                        checked={repeatMode === "until"}
                        onCheckedChange={() => setRepeatMode("until")}
                      />
                      <Label htmlFor="repeat-until" className="text-sm cursor-pointer">
                        Repeat until date
                      </Label>
                    </div>
                  </div>

                  {repeatMode !== "none" && (
                    <div className="space-y-3 pl-6">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Weekday</Label>
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
                          <Label className="text-xs">Number of weeks</Label>
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
                          <Label className="text-xs">Until date</Label>
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
                                  ? format(repeatUntilDate, "PPP")
                                  : "Pick a date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={repeatUntilDate}
                                onSelect={setRepeatUntilDate}
                                disabled={(date) => date < selectedDate}
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
                    onClick={() => setShowAddSlot(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleAddSlot}
                    disabled={addingSlot}
                  >
                    {addingSlot ? "Adding..." : "Add Slot"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Manual Booking Dialog */}
        <Dialog open={showBookingDialog} onOpenChange={setShowBookingDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Book Appointment</DialogTitle>
            </DialogHeader>
            {selectedSlot && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Booking slot:{" "}
                  <span className="text-foreground font-medium">
                    {format(
                      parseISO(selectedSlot.start_time),
                      "EEE, MMM d 'at' HH:mm"
                    )}
                  </span>
                </p>

                <Tabs defaultValue="existing" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="existing">Existing Client</TabsTrigger>
                    <TabsTrigger value="new">New Client</TabsTrigger>
                  </TabsList>

                  <TabsContent value="existing" className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Select Client</Label>
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
                              : "Search clients..."}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search by name or email..." />
                            <CommandList>
                              <CommandEmpty>No clients found.</CommandEmpty>
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
                      {bookingInProgress ? "Booking..." : "Book Appointment"}
                    </Button>
                  </TabsContent>

                  <TabsContent value="new" className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Name *</Label>
                      <Input
                        value={newClient.name}
                        onChange={(e) =>
                          setNewClient((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        placeholder="Client name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Email *</Label>
                      <Input
                        type="email"
                        value={newClient.email}
                        onChange={(e) =>
                          setNewClient((prev) => ({
                            ...prev,
                            email: e.target.value,
                          }))
                        }
                        placeholder="client@email.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Phone</Label>
                      <Input
                        value={newClient.phone}
                        onChange={(e) =>
                          setNewClient((prev) => ({
                            ...prev,
                            phone: e.target.value,
                          }))
                        }
                        placeholder="Optional"
                      />
                    </div>

                    <Button
                      className="w-full"
                      onClick={handleBookWithNewClient}
                      disabled={
                        !newClient.name || !newClient.email || bookingInProgress
                      }
                    >
                      {bookingInProgress ? "Booking..." : "Create & Book"}
                    </Button>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AdminCalendar;