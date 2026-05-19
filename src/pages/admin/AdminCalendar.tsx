import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { enGB } from "date-fns/locale";
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
  Pencil,
  Undo2,
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
import { ImageLightbox } from "@/components/ImageLightbox";
import { BookingImage } from "@/components/BookingImage";
import { PullToRefreshPortal } from "@/components/PullToRefreshPortal";
import { ManualBookingDialog } from "@/components/admin/ManualBookingDialog";

interface BookingRequestLite {
  id: string;
  form_responses: Record<string, unknown> | null;
  images: string[] | null;
  admin_notes: string | null;
}

interface Appointment {
  id: string;
  client_id: string;
  booking_request_id: string | null;
  clients: {
    name: string;
    email: string;
    phone: string | null;
  } | null;
  booking_requests: BookingRequestLite | null;
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
type RepeatMode = "none" | "weeks" | "until" | "custom";

interface SlotPattern {
  startTime: string;
  endTime: string;
}

const DEFAULT_PATTERNS: SlotPattern[] = [
  { startTime: "10:00", endTime: "12:00" },
  { startTime: "13:00", endTime: "15:00" },
  { startTime: "15:00", endTime: "17:00" },
];

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

  // Day action dialog (when clicking on a day)
  const [showDayDialog, setShowDayDialog] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showDayBookingsDialog, setShowDayBookingsDialog] = useState(false);
  const [dayBookingsDate, setDayBookingsDate] = useState<Date | null>(null);
  const [patterns, setPatterns] = useState<SlotPattern[]>(DEFAULT_PATTERNS);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("none");
  const [repeatWeekdays, setRepeatWeekdays] = useState<number[]>([]);
  const [repeatWeeks, setRepeatWeeks] = useState(4);
  const [repeatUntilDate, setRepeatUntilDate] = useState<Date | undefined>();
  const [customDates, setCustomDates] = useState<Date[]>([]);
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
  const [editStartTime, setEditStartTime] = useState("10:00");
  const [editEndTime, setEditEndTime] = useState("12:00");
  const [savingEdit, setSavingEdit] = useState(false);

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
  const [lightbox, setLightbox] = useState<{ open: boolean; index: number }>({ open: false, index: 0 });

  // Manual "Add Booking" dialog
  const [showAddBookingDialog, setShowAddBookingDialog] = useState(false);
  const [addBookingDate, setAddBookingDate] = useState<Date | null>(null);

  // Booking edit state
  const [editingBooking, setEditingBooking] = useState(false);
  const [editClient, setEditClient] = useState({ name: "", email: "", phone: "" });
  const [editResponses, setEditResponses] = useState<Record<string, string>>({});
  const [editAdminNotes, setEditAdminNotes] = useState("");
  const [savingBooking, setSavingBooking] = useState(false);

  // Cancel / rebook state
  const [cancellingBooking, setCancellingBooking] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<{ id: string; start_time: string; end_time: string }[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [rebookSlotId, setRebookSlotId] = useState<string>("");
  const [rebooking, setRebooking] = useState(false);

  // Undo history for schedule edits
  type UndoAction =
    | { type: "insert"; ids: string[]; label: string }
    | {
        type: "updateTime";
        slotId: string;
        prevStart: string;
        prevEnd: string;
        wasBooked: boolean;
        label: string;
      }
    | {
        type: "delete";
        row: { id: string; start_time: string; end_time: string; is_blocked: boolean; is_booked: boolean; notes: string | null };
        label: string;
      }
    | { type: "block"; slotId: string; prevBlocked: boolean; label: string };
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [undoing, setUndoing] = useState(false);
  const pushUndo = (action: UndoAction) =>
    setUndoStack((prev) => [...prev.slice(-19), action]);

  const startEditBooking = () => {
    const appt = selectedSlot?.appointments?.[0];
    if (!appt) return;
    const c = appt.clients ?? { name: "", email: "", phone: "" };
    setEditClient({ name: c.name ?? "", email: c.email ?? "", phone: c.phone ?? "" });
    const responses = (appt.booking_requests?.form_responses as Record<string, unknown>) || {};
    const stringified: Record<string, string> = {};
    Object.entries(responses).forEach(([k, v]) => {
      if (k === "manual_booking") return;
      stringified[k] = typeof v === "string" ? v : v == null ? "" : JSON.stringify(v);
    });
    if (Object.keys(stringified).length === 0) {
      stringified["tattoo_description"] = "";
    }
    setEditResponses(stringified);
    setEditAdminNotes(appt.booking_requests?.admin_notes ?? "");
    setEditingBooking(true);
  };

  const saveBookingEdit = async () => {
    const appt = selectedSlot?.appointments?.[0];
    if (!appt) return;
    setSavingBooking(true);
    try {
      const { error: cErr } = await supabase
        .from("clients")
        .update({
          name: editClient.name.trim(),
          email: editClient.email.trim(),
          phone: editClient.phone.trim() || null,
        })
        .eq("id", appt.client_id);
      if (cErr) throw cErr;

      if (appt.booking_request_id) {
        const cleaned: Record<string, string> = {};
        Object.entries(editResponses).forEach(([k, v]) => {
          if (k.trim()) cleaned[k] = v;
        });
        const { error: rErr } = await supabase
          .from("booking_requests")
          .update({
            form_responses: cleaned as never,
            admin_notes: editAdminNotes.trim() || null,
          })
          .eq("id", appt.booking_request_id);
        if (rErr) throw rErr;
      }

      supabase.functions
        .invoke("sync-gcal-event", { body: { appointmentId: appt.id } })
        .catch((e) => console.warn("gcal resync failed", e));

      toast.success("Booking updated");
      setEditingBooking(false);
      await fetchSlots();
    } catch (err) {
      console.error("Edit booking failed", err);
      toast.error("Could not save changes");
    } finally {
      setSavingBooking(false);
    }
  };

  useEffect(() => {
    fetchSlots();
  }, [currentWeekStart, currentDate, viewMode]);

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
    setEditingBooking(false);
    setRebookSlotId("");
    if (selectedSlot?.is_booked) {
      fetchAvailableSlotsForRebook();
    }
  }, [selectedSlot?.id]);

  const fetchAvailableSlotsForRebook = async () => {
    setLoadingAvailable(true);
    const { data } = await supabase
      .from("availability_slots")
      .select("id, start_time, end_time")
      .eq("is_booked", false)
      .eq("is_blocked", false)
      .gte("start_time", new Date().toISOString())
      .order("start_time", { ascending: true })
      .limit(200);
    setAvailableSlots(data || []);
    setLoadingAvailable(false);
  };

  const handleCancelBooking = async () => {
    const appt = selectedSlot?.appointments?.[0];
    if (!selectedSlot || !appt) return;
    if (!confirm("Cancel this booking? The slot will become available again.")) return;
    setCancellingBooking(true);
    try {
      const { error: aErr } = await supabase.from("appointments").delete().eq("id", appt.id);
      if (aErr) throw aErr;
      await supabase
        .from("availability_slots")
        .update({ is_booked: false })
        .eq("id", selectedSlot.id);
      if (appt.booking_request_id) {
        await supabase
          .from("booking_requests")
          .update({ status: "approved" })
          .eq("id", appt.booking_request_id);
      }
      toast.success("Booking cancelled");
      setShowSlotDialog(false);
      fetchSlots();
    } catch (err) {
      console.error("Cancel booking failed", err);
      toast.error("Could not cancel booking");
    } finally {
      setCancellingBooking(false);
    }
  };

  const handleRebookBooking = async () => {
    const appt = selectedSlot?.appointments?.[0];
    if (!selectedSlot || !appt || !rebookSlotId) return;
    const target = availableSlots.find((s) => s.id === rebookSlotId);
    if (!target) return;
    setRebooking(true);
    try {
      const { error: uErr } = await supabase
        .from("appointments")
        .update({
          slot_id: target.id,
          start_time: target.start_time,
          end_time: target.end_time,
        })
        .eq("id", appt.id);
      if (uErr) throw uErr;
      await supabase
        .from("availability_slots")
        .update({ is_booked: true })
        .eq("id", target.id);
      await supabase
        .from("availability_slots")
        .update({ is_booked: false })
        .eq("id", selectedSlot.id);

      supabase.functions
        .invoke("sync-gcal-event", { body: { appointmentId: appt.id } })
        .catch((e) => console.warn("gcal resync failed", e));

      toast.success("Booking moved");
      setShowSlotDialog(false);
      fetchSlots();
    } catch (err) {
      console.error("Rebook failed", err);
      toast.error("Could not move booking");
    } finally {
      setRebooking(false);
    }
  };

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
          booking_request_id,
          clients (
            name,
            email,
            phone
          ),
          booking_requests (
            id,
            form_responses,
            images,
            admin_notes
          )
        )
      `)
      .gte("start_time", startDate.toISOString())
      .lt("start_time", endDate.toISOString())
      .order("start_time", { ascending: true });

    if (error) {
      console.error("Error fetching slots:", error);
    } else {
      setSlots((data || []) as unknown as AvailabilitySlot[]);
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
    setRepeatWeekdays([getDay(day)]);
    setRepeatMode("none");
    setRepeatWeeks(4);
    setRepeatUntilDate(undefined);
    setCustomDates([]);
    setPatterns(DEFAULT_PATTERNS);
    setShowDayDialog(true);
  };

  const openDayBookings = (day: Date) => {
    setDayBookingsDate(day);
    setShowDayBookingsDialog(true);
  };

  // Day click: always open the day view (shows bookings + open slots + add slot)
  const handleDayClick = (day: Date) => {
    openDayBookings(day);
  };


  // Open slot dialog when clicking on a slot
  const openSlotDialog = (slot: AvailabilitySlot) => {
    setSelectedSlot(slot);
    const slotDate = parseISO(slot.start_time);
    const slotEnd = parseISO(slot.end_time);
    setSlotRepeatWeekday(getDay(slotDate));
    setSlotRepeatDays([getDay(slotDate)]);
    setSlotRepeatMode("none");
    setSlotRepeatWeeks(4);
    setSlotRepeatUntilDate(undefined);
    setEditStartTime(format(slotDate, "HH:mm"));
    setEditEndTime(format(slotEnd, "HH:mm"));
    setShowSlotDialog(true);
  };

  // Open repeat day dialog
  const openRepeatDayDialog = (day: Date) => {
    const daySlots = getSlotsForDay(day);
    if (daySlots.length === 0) {
      toast.error("No slots on this day to repeat");
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
        toast.error("No slots to create with these settings");
        setRepeatingDay(false);
        return;
      }

      const { error } = await supabase
        .from("availability_slots")
        .insert(slotsToCreate);

      if (error) throw error;

      toast.success(`${slotsToCreate.length} slot${slotsToCreate.length > 1 ? "s" : ""} added`);
      setShowRepeatDayDialog(false);
      setDayToRepeat(null);
      fetchSlots();
    } catch (err) {
      console.error("Error repeating day:", err);
      toast.error("Could not repeat the day");
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
      // ATOMIC slot lock first — prevents double-booking with concurrent public bookings.
      const { data: lockedSlots, error: lockErr } = await supabase
        .from("availability_slots")
        .update({ is_booked: true })
        .eq("id", selectedSlot.id)
        .eq("is_booked", false)
        .eq("is_blocked", false)
        .select("id");

      if (lockErr) throw lockErr;
      if (!lockedSlots || lockedSlots.length === 0) {
        toast.error("Slot is no longer available");
        setBookingInProgress(false);
        return;
      }

      const { data: bookingRequest, error: brError } = await supabase
        .from("booking_requests")
        .insert({
          client_id: clientId,
          status: "booked",
          form_responses: { manual_booking: true },
        })
        .select()
        .single();

      if (brError) {
        // Roll back the slot lock
        await supabase.from("availability_slots").update({ is_booked: false }).eq("id", selectedSlot.id);
        throw brError;
      }

      const { data: apptRow, error: apptError } = await supabase.from("appointments").insert({
        client_id: clientId,
        slot_id: selectedSlot.id,
        booking_request_id: bookingRequest.id,
        start_time: selectedSlot.start_time,
        end_time: selectedSlot.end_time,
      }).select("id").single();

      if (apptError) {
        await supabase.from("availability_slots").update({ is_booked: false }).eq("id", selectedSlot.id);
        throw apptError;
      }

      if (apptRow?.id) {
        supabase.functions.invoke("sync-gcal-event", { body: { appointmentId: apptRow.id } })
          .catch((e) => console.warn("gcal sync failed", e));
      }

      toast.success("Booking completed");
      setShowBookingDialog(false);
      setShowSlotDialog(false);
      fetchSlots();
    } catch (err) {
      console.error("Booking error:", err);
      toast.error("Could not book the slot");
    } finally {
      setBookingInProgress(false);
    }
  };


  const handleBookWithNewClient = async () => {
    // At least one field should have some info
    const hasAnyInfo = newClient.name || newClient.email || newClient.phone || newClient.tattooDescription;
    if (!hasAnyInfo) {
      toast.error("Please fill in at least one field");
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
              name: newClient.name || "Unknown",
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
            name: newClient.name || "Unknown",
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
      toast.error("Could not create client");
      setBookingInProgress(false);
    }
  };

  const handleAddSlot = async () => {
    if (!selectedDay) return;
    setAddingSlot(true);

    try {
      const validPatterns = patterns.filter((p) => p.startTime && p.endTime);
      if (validPatterns.length === 0) {
        toast.error("Add at least one time slot");
        setAddingSlot(false);
        return;
      }

      // Determine target dates
      let targetDates: Date[] = [];

      if (repeatMode === "none") {
        targetDates = [selectedDay];
      } else if (repeatMode === "weeks") {
        if (repeatWeekdays.length === 0) {
          toast.error("Select at least one weekday");
          setAddingSlot(false);
          return;
        }
        const weekStart = startOfWeek(selectedDay, { weekStartsOn: 1 });
        for (let i = 0; i < repeatWeeks; i++) {
          for (const wd of repeatWeekdays) {
            // Map: Mon=1..Sun=0 → offset from Monday
            const offset = wd === 0 ? 6 : wd - 1;
            const date = addDays(addWeeks(weekStart, i), offset);
            if (date >= selectedDay || isSameDay(date, selectedDay)) {
              targetDates.push(date);
            }
          }
        }
      } else if (repeatMode === "until" && repeatUntilDate) {
        if (repeatWeekdays.length === 0) {
          toast.error("Select at least one weekday");
          setAddingSlot(false);
          return;
        }
        const days = eachDayOfInterval({ start: selectedDay, end: repeatUntilDate });
        targetDates = days.filter((d) => repeatWeekdays.includes(getDay(d)));
      } else if (repeatMode === "custom") {
        if (customDates.length === 0) {
          toast.error("Select at least one date");
          setAddingSlot(false);
          return;
        }
        targetDates = customDates;
      }

      const slotsToCreate: { start_time: string; end_time: string }[] = [];
      for (const date of targetDates) {
        for (const p of validPatterns) {
          const [sh, sm] = p.startTime.split(":").map(Number);
          const [eh, em] = p.endTime.split(":").map(Number);
          slotsToCreate.push({
            start_time: setMinutes(setHours(date, sh), sm).toISOString(),
            end_time: setMinutes(setHours(date, eh), em).toISOString(),
          });
        }
      }

      if (slotsToCreate.length === 0) {
        toast.error("No slots to create");
        setAddingSlot(false);
        return;
      }

      const { data: inserted, error } = await supabase
        .from("availability_slots")
        .insert(slotsToCreate)
        .select("id");

      if (error) throw error;

      const ids = (inserted || []).map((r) => r.id as string);
      if (ids.length > 0) {
        pushUndo({
          type: "insert",
          ids,
          label: `${ids.length} slot${ids.length > 1 ? "s" : ""} added`,
        });
      }

      toast.success(`${slotsToCreate.length} slot${slotsToCreate.length > 1 ? "s" : ""} added`);
      setShowDayDialog(false);
      setSelectedDay(null);
      setRepeatMode("none");
      fetchSlots();
    } catch (err) {
      console.error("Error adding slot:", err);
      toast.error("Could not add slot");
    } finally {
      setAddingSlot(false);
    }
  };

  const toggleRepeatWeekday = (day: number) => {
    setRepeatWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const updatePattern = (i: number, field: "startTime" | "endTime", value: string) => {
    setPatterns((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: value } : p)));
  };

  const addPattern = () => {
    setPatterns((prev) => [...prev, { startTime: "10:00", endTime: "12:00" }]);
  };

  const removePattern = (i: number) => {
    setPatterns((prev) => prev.filter((_, idx) => idx !== i));
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
        toast.error("No slots to create with these settings");
        setRepeatingSlot(false);
        return;
      }

      const { data: inserted, error } = await supabase
        .from("availability_slots")
        .insert(slotsToCreate)
        .select("id");

      if (error) throw error;

      const ids = (inserted || []).map((r) => r.id as string);
      if (ids.length > 0) {
        pushUndo({
          type: "insert",
          ids,
          label: `${ids.length} repeated slot${ids.length > 1 ? "s" : ""}`,
        });
      }

      toast.success(`${slotsToCreate.length} slot${slotsToCreate.length > 1 ? "s" : ""} added`);
      setShowSlotDialog(false);
      setSelectedSlot(null);
      fetchSlots();
    } catch (err) {
      console.error("Error repeating slot:", err);
      toast.error("Could not repeat slot");
    } finally {
      setRepeatingSlot(false);
    }
  };

  const handleSaveSlotTime = async () => {
    if (!selectedSlot) return;
    setSavingEdit(true);
    try {
      const [sh, sm] = editStartTime.split(":").map(Number);
      const [eh, em] = editEndTime.split(":").map(Number);
      const baseDate = parseISO(selectedSlot.start_time);
      const newStart = setMinutes(setHours(baseDate, sh), sm);
      const newEnd = setMinutes(setHours(baseDate, eh), em);
      if (newEnd <= newStart) {
        toast.error("End time must be after start time");
        setSavingEdit(false);
        return;
      }

      const { error: slotErr } = await supabase
        .from("availability_slots")
        .update({
          start_time: newStart.toISOString(),
          end_time: newEnd.toISOString(),
        })
        .eq("id", selectedSlot.id);
      if (slotErr) throw slotErr;

      // Keep linked appointment in sync if booked
      if (selectedSlot.is_booked) {
        await supabase
          .from("appointments")
          .update({
            start_time: newStart.toISOString(),
            end_time: newEnd.toISOString(),
          })
          .eq("slot_id", selectedSlot.id);
      }

      pushUndo({
        type: "updateTime",
        slotId: selectedSlot.id,
        prevStart: selectedSlot.start_time,
        prevEnd: selectedSlot.end_time,
        wasBooked: selectedSlot.is_booked,
        label: "Slot time changed",
      });

      toast.success("Slot updated");
      setShowSlotDialog(false);
      fetchSlots();
    } catch (err) {
      console.error("Error updating slot:", err);
      toast.error("Could not update slot");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    try {
      const slotRow =
        slots.find((s) => s.id === slotId) ||
        (selectedSlot && selectedSlot.id === slotId ? selectedSlot : null);
      await supabase.from("availability_slots").delete().eq("id", slotId);
      if (slotRow) {
        pushUndo({
          type: "delete",
          row: {
            id: slotRow.id,
            start_time: slotRow.start_time,
            end_time: slotRow.end_time,
            is_blocked: slotRow.is_blocked,
            is_booked: false,
            notes: slotRow.notes,
          },
          label: "Slot removed",
        });
      }
      toast.success("Slot removed");
      setShowSlotDialog(false);
      fetchSlots();
    } catch (err) {
      toast.error("Could not remove slot");
    }
  };

  const handleBlockSlot = async (slotId: string, blocked: boolean) => {
    try {
      await supabase
        .from("availability_slots")
        .update({ is_blocked: blocked })
        .eq("id", slotId);
      pushUndo({
        type: "block",
        slotId,
        prevBlocked: !blocked,
        label: blocked ? "Slot blocked" : "Slot unblocked",
      });
      fetchSlots();
      setShowSlotDialog(false);
    } catch (err) {
      toast.error("Could not update slot");
    }
  };

  const handleUndo = async () => {
    if (undoStack.length === 0 || undoing) return;
    const action = undoStack[undoStack.length - 1];
    setUndoing(true);
    try {
      if (action.type === "insert") {
        const { error } = await supabase
          .from("availability_slots")
          .delete()
          .in("id", action.ids);
        if (error) throw error;
      } else if (action.type === "updateTime") {
        const { error } = await supabase
          .from("availability_slots")
          .update({ start_time: action.prevStart, end_time: action.prevEnd })
          .eq("id", action.slotId);
        if (error) throw error;
        if (action.wasBooked) {
          await supabase
            .from("appointments")
            .update({ start_time: action.prevStart, end_time: action.prevEnd })
            .eq("slot_id", action.slotId);
        }
      } else if (action.type === "delete") {
        const { error } = await supabase
          .from("availability_slots")
          .insert(action.row);
        if (error) throw error;
      } else if (action.type === "block") {
        const { error } = await supabase
          .from("availability_slots")
          .update({ is_blocked: action.prevBlocked })
          .eq("id", action.slotId);
        if (error) throw error;
      }
      setUndoStack((prev) => prev.slice(0, -1));
      toast.success(`Undone: ${action.label}`);
      fetchSlots();
    } catch (err) {
      console.error("Undo failed:", err);
      toast.error("Could not undo last change");
    } finally {
      setUndoing(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

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
            <span className="text-[10px] opacity-50 truncate">Available</span>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="p-4 lg:p-8">
      <PullToRefreshPortal
        onRefresh={async () => { await Promise.all([fetchSlots(), fetchClients()]); }}
        disabled={showSlotDialog || showBookingDialog || showDayDialog || showRepeatDayDialog || showDayBookingsDialog}
      />
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground text-sm">
            Manage your available slots
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
                    Week {weekNumber}
                  </p>
                  <p className="text-sm font-medium">
                    {format(currentWeekStart, "d MMM", { locale: enGB })} –{" "}
                    {format(addDays(currentWeekStart, 6), "d MMM yyyy", { locale: enGB })}
                  </p>
                </>
              ) : (
                <p className="text-sm font-medium">
                  {format(currentDate, "MMMM yyyy", { locale: enGB })}
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
              variant="outline"
              size="sm"
              onClick={handleUndo}
              disabled={undoStack.length === 0 || undoing}
              title={
                undoStack.length === 0
                  ? "Nothing to undo"
                  : `Undo: ${undoStack[undoStack.length - 1].label} (⌘Z)`
              }
            >
              <Undo2 className="h-4 w-4 mr-1.5" strokeWidth={1.5} />
              Undo
            </Button>
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
          <>
            {/* Week View — Mobile: stacked day list */}
            <div className="md:hidden space-y-2">
              {weekDays.map((day, i) => {
                const daySlots = getSlotsForDay(day);
                const isToday = isSameDay(day, new Date());
                const isPast = day < new Date() && !isToday;

                return (
                  <div
                    key={i}
                    className={cn(
                      "rounded-lg border",
                      isToday ? "border-primary" : "border-border",
                      isPast && "opacity-50"
                    )}
                  >
                    <button
                      onClick={() => !isPast && openDayDialog(day)}
                      disabled={isPast}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 border-b border-border",
                        isToday && "bg-primary/10",
                        !isPast && "hover:bg-accent/50 active:bg-accent/70 transition-colors"
                      )}
                    >
                      <div className="flex items-baseline gap-2">
                        <span className={cn("text-base font-semibold", isToday && "text-primary")}>
                          {format(day, "EEE d MMM", { locale: enGB })}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {daySlots.length} slot{daySlots.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      {!isPast && (
                        <span className="text-muted-foreground text-xs flex items-center gap-1">
                          <Plus className="h-3.5 w-3.5" /> Add
                        </span>
                      )}
                    </button>

                    {daySlots.length > 0 && (
                      <div className="p-2 space-y-1.5">
                        {daySlots.map((slot) => (
                          <SlotCard key={slot.id} slot={slot} />
                        ))}
                      </div>
                    )}

                    {!isPast && daySlots.length > 0 && (
                      <div className="px-2 pb-2">
                        <button
                          onClick={() => openRepeatDayDialog(day)}
                          className="w-full text-[11px] py-1.5 rounded border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary/50 flex items-center justify-center gap-1.5"
                        >
                          <Copy className="h-3 w-3" /> Repeat this day
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Week View — Desktop: 7-column grid */}
            <div className="hidden md:block">
              <div className="grid grid-cols-7 gap-1.5">
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
                          {format(day, "EEEE", { locale: enGB })}
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
                          {format(day, "MMM", { locale: enGB })}
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
                            <span className="text-[10px]">Add</span>
                          </button>
                          {daySlots.length > 0 && (
                            <button
                              onClick={() => openRepeatDayDialog(day)}
                              className="p-1.5 rounded border border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
                              title="Repeat entire day"
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
          </>
        ) : (
          /* Month View — fits any width */
          <div className="w-full">
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-1">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, idx) => (
                <div
                  key={idx}
                  className="text-center text-[10px] uppercase tracking-wider text-muted-foreground py-1.5 sm:py-2"
                >
                  <span className="sm:hidden">{d}</span>
                  <span className="hidden sm:inline">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][idx]}</span>
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
              {monthDays.map((day, i) => {
                const daySlots = getSlotsForDay(day);
                const isToday = isSameDay(day, new Date());
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isPast = day < new Date() && !isToday;

                return (
                  <div
                    key={i}
                    onClick={() => !isPast && isCurrentMonth && handleDayClick(day)}
                    className={cn(
                      "min-h-[68px] sm:min-h-[100px] rounded border p-1 sm:p-1.5 flex flex-col overflow-hidden",
                      isToday ? "border-primary" : "border-border",
                      !isCurrentMonth && "bg-muted/30",
                      isPast && "opacity-50",
                      !isPast && isCurrentMonth && "cursor-pointer hover:bg-accent/30 transition-colors",
                    )}
                  >
                    <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                      <span
                        className={cn(
                          "text-[11px] sm:text-xs font-medium",
                          isToday && "text-primary",
                          !isCurrentMonth && "text-muted-foreground"
                        )}
                      >
                        {format(day, "d")}
                      </span>
                      {!isPast && isCurrentMonth && (
                        <button
                          onClick={(e) => { e.stopPropagation(); openDayDialog(day); }}
                          className="hidden sm:block p-0.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                          title="Add slot"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      )}
                    </div>

                    {/* Mobile: compact slot times */}
                    <div className="sm:hidden flex-1 flex flex-col gap-0.5 overflow-hidden">
                      {daySlots.slice(0, 3).map((slot) => {
                        const clientName =
                          slot.is_booked && slot.appointments?.[0]?.clients?.name
                            ? slot.appointments[0].clients.name.split(" ")[0]
                            : null;
                        return (
                          <div
                            key={slot.id}
                            className={cn(
                              "text-[9px] leading-tight px-1 py-0.5 rounded truncate",
                              slot.is_booked
                                ? "bg-green-500/20 text-green-700 dark:text-green-400"
                                : slot.is_blocked
                                ? "bg-muted text-muted-foreground line-through"
                                : "bg-primary/10 text-primary",
                            )}
                          >
                            {format(parseISO(slot.start_time), "HH:mm")}
                            {clientName && <span className="ml-1 font-medium">{clientName}</span>}
                          </div>
                        );
                      })}
                      {daySlots.length > 3 && (
                        <div className="text-[8px] text-muted-foreground leading-none px-1">
                          +{daySlots.length - 3}
                        </div>
                      )}
                    </div>

                    {/* Desktop: time + client name */}
                    <div className="hidden sm:block flex-1 space-y-0.5 overflow-y-auto">
                      {daySlots.slice(0, 3).map((slot) => {
                        const clientName =
                          slot.is_booked && slot.appointments?.[0]?.clients?.name
                            ? slot.appointments[0].clients.name
                            : null;
                        return (
                          <button
                            key={slot.id}
                            onClick={(e) => { e.stopPropagation(); openSlotDialog(slot); }}
                            className={cn(
                              "w-full text-left text-[10px] px-1 py-0.5 rounded truncate",
                              slot.is_booked
                                ? "bg-green-500/20 text-green-700 dark:text-green-400 hover:bg-green-500/30"
                                : slot.is_blocked
                                ? "bg-muted text-muted-foreground line-through"
                                : "bg-primary/10 text-primary hover:bg-primary/20",
                            )}
                            title={clientName ?? undefined}
                          >
                            {format(parseISO(slot.start_time), "HH:mm")}
                            {clientName && (
                              <span className="ml-1 font-medium">
                                {clientName.split(" ")[0]}
                              </span>
                            )}
                          </button>
                        );
                      })}
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
        )}


        {/* Day Bookings Dialog */}
        <Dialog open={showDayBookingsDialog} onOpenChange={setShowDayBookingsDialog}>
          <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {dayBookingsDate
                  ? format(dayBookingsDate, "EEEE d MMMM yyyy", { locale: enGB })
                  : "Bookings"}
              </DialogTitle>
            </DialogHeader>
            {dayBookingsDate && (() => {
              const slots = getSlotsForDay(dayBookingsDate);
              const bookedSlots = slots.filter(
                (s) => s.is_booked && s.appointments && s.appointments.length > 0,
              );
              const openSlots = slots.filter((s) => !s.is_booked && !s.is_blocked);
              return (
                <div className="space-y-3">
                  {bookedSlots.length === 0 && (
                    <p className="text-sm text-muted-foreground">No bookings this day.</p>
                  )}
                  {bookedSlots.map((slot) => {
                    const appt = slot.appointments![0];
                    const client = appt.clients;
                    return (
                      <button
                        key={slot.id}
                        onClick={() => {
                          setShowDayBookingsDialog(false);
                          openSlotDialog(slot);
                        }}
                        className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-accent/40 transition-colors"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-medium text-sm">
                            {client?.name ?? "Unknown client"}
                          </span>
                          <span className="font-mono text-xs text-muted-foreground shrink-0">
                            {format(parseISO(slot.start_time), "HH:mm")}–
                            {format(parseISO(slot.end_time), "HH:mm")}
                          </span>
                        </div>
                        {client?.email && (
                          <div className="text-xs text-muted-foreground truncate mt-0.5">
                            {client.email}
                          </div>
                        )}
                        {client?.phone && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {client.phone}
                          </div>
                        )}
                      </button>
                    );
                  })}

                  {openSlots.length > 0 && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                        Open slots
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {openSlots.map((slot) => (
                          <button
                            key={slot.id}
                            onClick={() => {
                              setShowDayBookingsDialog(false);
                              openSlotDialog(slot);
                            }}
                            className="text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20"
                          >
                            {format(parseISO(slot.start_time), "HH:mm")}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-border">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setShowDayBookingsDialog(false);
                        openDayDialog(dayBookingsDate);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1.5" />
                      Add slot to this day
                    </Button>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* Add Slot Dialog (Day Click) */}
        <Dialog open={showDayDialog} onOpenChange={setShowDayDialog}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Slot</DialogTitle>
            </DialogHeader>
            {selectedDay && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  <span className="text-foreground font-medium">
                    {format(selectedDay, "EEEE d MMMM yyyy", { locale: enGB })}
                  </span>
                </p>

                {/* Time Slots (multiple) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Time slots</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={addPattern}
                      className="h-7 px-2 text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add slot
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {patterns.map((p, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Select
                          value={p.startTime}
                          onValueChange={(v) => updatePattern(i, "startTime", v)}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {timeOptions.map((time) => (
                              <SelectItem key={time} value={time}>{time}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-xs text-muted-foreground">–</span>
                        <Select
                          value={p.endTime}
                          onValueChange={(v) => updatePattern(i, "endTime", v)}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {timeOptions.map((time) => (
                              <SelectItem key={time} value={time}>{time}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {patterns.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => removePattern(i)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Apply To */}
                <div className="space-y-3 pt-2 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Repeat className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm font-medium">Apply to</Label>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { v: "none", label: "Just this day" },
                      { v: "weeks", label: "Weekdays · next N weeks" },
                      { v: "until", label: "Weekdays · until date" },
                      { v: "custom", label: "Custom dates" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setRepeatMode(opt.v)}
                        className={cn(
                          "px-3 py-2 text-xs rounded-md border transition-colors text-left",
                          repeatMode === opt.v
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border hover:border-primary/50"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {(repeatMode === "weeks" || repeatMode === "until") && (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Weekdays</Label>
                        <p className="text-[11px] text-muted-foreground">
                          Slots will be created on every selected weekday {repeatMode === "until" ? "between this day and the end date" : "for the next N weeks"}.
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {WEEKDAYS.map((day) => (
                            <button
                              key={day.value}
                              type="button"
                              onClick={() => toggleRepeatWeekday(day.value)}
                              className={cn(
                                "px-2.5 py-1 text-xs rounded-full border transition-colors",
                                repeatWeekdays.includes(day.value)
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background border-border hover:border-primary/50"
                              )}
                            >
                              {day.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {repeatMode === "weeks" && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">Number of weeks</Label>
                          <Input
                            type="number"
                            min={1}
                            max={52}
                            value={repeatWeeks}
                            onChange={(e) => setRepeatWeeks(parseInt(e.target.value) || 1)}
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
                                  ? format(repeatUntilDate, "d MMMM yyyy", { locale: enGB })
                                  : "Select date"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={repeatUntilDate}
                                onSelect={setRepeatUntilDate}
                                disabled={(date) => date < selectedDay}
                                weekStartsOn={1}
                                locale={enGB}
                                initialFocus
                                className="p-3 pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      )}
                    </div>
                  )}

                  {repeatMode === "custom" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">
                        Pick dates ({customDates.length} selected)
                      </Label>
                      <div className="rounded-md border border-border flex justify-center">
                        <Calendar
                          mode="multiple"
                          selected={customDates}
                          onSelect={(dates) => setCustomDates(dates || [])}
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                          weekStartsOn={1}
                          locale={enGB}
                          className="p-3 pointer-events-auto"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowDayDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleAddSlot}
                    disabled={addingSlot}
                  >
                    {addingSlot ? "Adding..." : "Add"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Slot Dialog (Slot Click) */}
        <Dialog open={showSlotDialog} onOpenChange={setShowSlotDialog}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedSlot?.is_booked ? "Booked Slot" : "Manage Slot"}
              </DialogTitle>
            </DialogHeader>
            {selectedSlot && (
              <div className="space-y-4">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium">
                    {format(parseISO(selectedSlot.start_time), "EEEE d MMMM yyyy", { locale: enGB })}
                  </p>
                  <p className="text-lg font-mono">
                    {format(parseISO(selectedSlot.start_time), "HH:mm")} – {format(parseISO(selectedSlot.end_time), "HH:mm")}
                  </p>
                </div>

                {/* Edit times */}
                <div className="space-y-2">
                  <Label className="text-xs">Edit times</Label>
                  <div className="flex items-center gap-2">
                    <Select value={editStartTime} onValueChange={setEditStartTime}>
                      <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {timeOptions.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-muted-foreground">–</span>
                    <Select value={editEndTime} onValueChange={setEditEndTime}>
                      <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {timeOptions.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={handleSaveSlotTime}
                      disabled={
                        savingEdit ||
                        (editStartTime === format(parseISO(selectedSlot.start_time), "HH:mm") &&
                          editEndTime === format(parseISO(selectedSlot.end_time), "HH:mm"))
                      }
                    >
                      {savingEdit ? "Saving" : "Save"}
                    </Button>
                  </div>
                  {selectedSlot.is_booked && (
                    <p className="text-[11px] text-muted-foreground">
                      The client's appointment will be updated too. They won't be notified automatically.
                    </p>
                  )}
                </div>

                {selectedSlot.is_booked && selectedSlot.appointments?.[0] && (() => {
                  const appt = selectedSlot.appointments![0];
                  const client = appt.clients;
                  const br = appt.booking_requests;
                  const responses = (br?.form_responses as Record<string, unknown>) || {};
                  const images = br?.images || [];
                  const responseEntries = Object.entries(responses).filter(([k]) => k !== "manual_booking");

                  if (editingBooking) {
                    return (
                      <div className="space-y-4 p-4 border border-primary/30 bg-primary/5 rounded-lg">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium">Edit booking</h3>
                          <Button size="sm" variant="ghost" onClick={() => setEditingBooking(false)}>
                            Cancel
                          </Button>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs">Name</Label>
                          <Input value={editClient.name} onChange={(e) => setEditClient({ ...editClient, name: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Email</Label>
                          <Input type="email" value={editClient.email} onChange={(e) => setEditClient({ ...editClient, email: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Phone</Label>
                          <Input value={editClient.phone} onChange={(e) => setEditClient({ ...editClient, phone: e.target.value })} />
                        </div>

                        {br && (
                          <>
                            <div className="space-y-3 pt-2 border-t border-border">
                              <Label className="text-xs">Tattoo details</Label>
                              {Object.entries(editResponses).map(([key, value]) => (
                                <div key={key} className="space-y-1">
                                  <p className="text-[11px] text-muted-foreground capitalize">{key.replace(/_/g, " ")}</p>
                                  <Textarea
                                    value={value}
                                    onChange={(e) => setEditResponses({ ...editResponses, [key]: e.target.value })}
                                    rows={3}
                                  />
                                </div>
                              ))}
                            </div>

                            <div className="space-y-2">
                              <Label className="text-xs">Admin notes</Label>
                              <Textarea
                                value={editAdminNotes}
                                onChange={(e) => setEditAdminNotes(e.target.value)}
                                rows={3}
                                placeholder="Internal notes (not visible to client)"
                              />
                            </div>
                          </>
                        )}

                        <Button onClick={saveBookingEdit} disabled={savingBooking} className="w-full">
                          {savingBooking ? "Saving…" : "Save changes"}
                        </Button>
                      </div>
                    );
                  }

                  return (
                    <>
                      {client && (
                        <div className="space-y-3 p-4 border border-green-500/30 bg-green-500/5 rounded-lg">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-green-700 dark:text-green-400 min-w-0">
                              <User className="h-4 w-4 shrink-0" />
                              <span className="font-medium truncate">{client.name}</span>
                            </div>
                            <Button size="sm" variant="outline" onClick={startEditBooking} className="h-7 px-2 text-xs">
                              <Pencil className="h-3 w-3 mr-1" /> Edit
                            </Button>
                          </div>
                          <div className="space-y-2 text-sm">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(client.email || "");
                                toast.success("Email copied");
                              }}
                              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors w-full"
                            >
                              <Mail className="h-3.5 w-3.5" />
                              <span className="truncate">{client.email}</span>
                              <Copy className="h-3 w-3 ml-auto opacity-50 shrink-0" />
                            </button>
                            {client.phone && (
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(client.phone || "");
                                  toast.success("Phone copied");
                                }}
                                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors w-full"
                              >
                                <Phone className="h-3.5 w-3.5" />
                                <span>{client.phone}</span>
                                <Copy className="h-3 w-3 ml-auto opacity-50 shrink-0" />
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {responseEntries.length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium text-muted-foreground mb-2">Tattoo Details</h3>
                          <div className="p-3 rounded-lg border border-border bg-secondary/30 space-y-2 text-sm">
                            {responseEntries.map(([key, value]) => (
                              <div key={key}>
                                <p className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, " ")}</p>
                                <p className="whitespace-pre-wrap">{String(value)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {br?.admin_notes && (
                        <div>
                          <h3 className="text-sm font-medium text-muted-foreground mb-2">Admin Notes</h3>
                          <p className="text-sm whitespace-pre-wrap p-3 rounded-lg border border-border bg-secondary/30">{br.admin_notes}</p>
                        </div>
                      )}
                      {images.length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium text-muted-foreground mb-2">Reference Images</h3>
                          <div className="grid grid-cols-3 gap-2">
                            {images.map((img, i) => (
                              <button
                                key={i}
                                type="button"
                                onClick={() => setLightbox({ open: true, index: i })}
                                className="aspect-square rounded-lg border border-border overflow-hidden hover:border-primary/50 transition-colors"
                              >
                                <BookingImage src={img} alt={`Reference ${i + 1}`} className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}

                {selectedSlot.is_booked && (
                  <div className="space-y-3 pt-4 border-t border-border">
                    <h3 className="text-sm font-medium">Manage booking</h3>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Move to another available slot</Label>
                      <div className="flex gap-2">
                        <Select value={rebookSlotId} onValueChange={setRebookSlotId}>
                          <SelectTrigger className="flex-1">
                            <SelectValue
                              placeholder={
                                loadingAvailable
                                  ? "Loading…"
                                  : availableSlots.length === 0
                                  ? "No upcoming free slots"
                                  : "Select a slot"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {availableSlots.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {format(parseISO(s.start_time), "EEE d MMM, HH:mm", { locale: enGB })}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          onClick={handleRebookBooking}
                          disabled={!rebookSlotId || rebooking}
                        >
                          {rebooking ? "Moving…" : "Move"}
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        The client won't be notified automatically.
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={handleCancelBooking}
                      disabled={cancellingBooking}
                    >
                      <X className="h-4 w-4 mr-2" />
                      {cancellingBooking ? "Cancelling…" : "Cancel booking"}
                    </Button>
                  </div>
                )}

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
                        Book Client
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleBlockSlot(selectedSlot.id, !selectedSlot.is_blocked)}
                      >
                        <Clock className="h-4 w-4 mr-2" />
                        {selectedSlot.is_blocked ? "Unblock" : "Block"}
                      </Button>
                    </div>

                    {/* Repeat Options */}
                    <div className="space-y-3 pt-4 border-t border-border">
                      <div className="flex items-center gap-2">
                        <Repeat className="h-4 w-4 text-muted-foreground" />
                        <Label className="text-sm font-medium">Repeat this slot</Label>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="slot-repeat-weeks"
                            checked={slotRepeatMode === "weeks"}
                            onCheckedChange={(checked) => setSlotRepeatMode(checked ? "weeks" : "none")}
                          />
                          <Label htmlFor="slot-repeat-weeks" className="text-sm cursor-pointer">
                            Number of weeks forward
                          </Label>
                        </div>

                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="slot-repeat-until"
                            checked={slotRepeatMode === "until"}
                            onCheckedChange={(checked) => setSlotRepeatMode(checked ? "until" : "none")}
                          />
                          <Label htmlFor="slot-repeat-until" className="text-sm cursor-pointer">
                            Until date
                          </Label>
                        </div>
                      </div>

                      {slotRepeatMode !== "none" && (
                        <div className="space-y-3 pl-6">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Which days</Label>
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
                              <Label className="text-xs">Number of weeks</Label>
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
                              <Label className="text-xs">Until date</Label>
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
                                      ? format(slotRepeatUntilDate, "d MMMM yyyy", { locale: enGB })
                                      : "Select date"}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={slotRepeatUntilDate}
                                    onSelect={setSlotRepeatUntilDate}
                                    disabled={(date) => date <= parseISO(selectedSlot.start_time)}
                                    weekStartsOn={1}
                                    locale={enGB}
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
                            {repeatingSlot ? "Creating slots..." : "Create repeated slots"}
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
                        Remove Slot
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
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Book Client</DialogTitle>
            </DialogHeader>
            {selectedSlot && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Booking slot:{" "}
                  <span className="text-foreground font-medium">
                    {format(parseISO(selectedSlot.start_time), "EEEE d MMM 'at' HH:mm", { locale: enGB })}
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
                              : "Search client..."}
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
                      {bookingInProgress ? "Booking..." : "Book Slot"}
                    </Button>
                  </TabsContent>

                  <TabsContent value="new" className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Name</Label>
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
                      <Label className="text-xs">Email</Label>
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
                    <div className="space-y-2">
                      <Label className="text-xs">Tattoo (brief description)</Label>
                      <Input
                        value={newClient.tattooDescription}
                        onChange={(e) =>
                          setNewClient((prev) => ({
                            ...prev,
                            tattooDescription: e.target.value,
                          }))
                        }
                        placeholder="E.g. Rose on forearm"
                      />
                    </div>

                    <Button
                      className="w-full"
                      onClick={handleBookWithNewClient}
                      disabled={bookingInProgress}
                    >
                      {bookingInProgress ? "Booking..." : "Create & Book"}
                    </Button>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Repeat Day Dialog */}
        <Dialog open={showRepeatDayDialog} onOpenChange={setShowRepeatDayDialog}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Repeat Entire Day</DialogTitle>
            </DialogHeader>
            {dayToRepeat && (
              <div className="space-y-4">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium">
                    {format(dayToRepeat, "EEEE d MMMM yyyy", { locale: enGB })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {getSlotsForDay(dayToRepeat).filter(s => !s.is_booked).length} available slots will be repeated
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
                        Number of weeks forward
                      </Label>
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="day-repeat-until"
                        checked={dayRepeatMode === "until"}
                        onCheckedChange={(checked) => setDayRepeatMode(checked ? "until" : "weeks")}
                      />
                      <Label htmlFor="day-repeat-until" className="text-sm cursor-pointer">
                        Until date
                      </Label>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Which days</Label>
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
                        <Label className="text-xs">Number of weeks</Label>
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
                        <Label className="text-xs">Until date</Label>
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
                                ? format(dayRepeatUntilDate, "d MMMM yyyy", { locale: enGB })
                                : "Select date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={dayRepeatUntilDate}
                              onSelect={setDayRepeatUntilDate}
                              disabled={(date) => date <= dayToRepeat}
                              weekStartsOn={1}
                              locale={enGB}
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
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleRepeatDay}
                    disabled={repeatingDay || dayRepeatDays.length === 0}
                  >
                    {repeatingDay ? "Creating slots..." : "Repeat"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <ImageLightbox
          images={selectedSlot?.appointments?.[0]?.booking_requests?.images || []}
          startIndex={lightbox.index}
          open={lightbox.open}
          onOpenChange={(o) => setLightbox((p) => ({ ...p, open: o }))}
        />
      </div>
    </div>
  );
};

export default AdminCalendar;