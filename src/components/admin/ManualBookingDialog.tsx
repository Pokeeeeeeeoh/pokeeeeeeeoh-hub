import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, isSameDay } from "date-fns";
import { enGB } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface OpenSlot {
  id: string;
  start_time: string;
  end_time: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional initial date to prefill for custom-time entry, and to scope the slot list */
  initialDate?: Date | null;
  onBooked?: () => void;
}

export const ManualBookingDialog = ({ open, onOpenChange, initialDate, onBooked }: Props) => {
  const [mode, setMode] = useState<"slot" | "custom">("slot");
  const [openSlots, setOpenSlots] = useState<OpenSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [details, setDetails] = useState("");

  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("12:00");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Reset fields
    setName("");
    setEmail("");
    setPhone("");
    setDetails("");
    setSelectedSlotId("");
    setStartTime("10:00");
    setEndTime("12:00");
    const d = initialDate ?? new Date();
    setDate(format(d, "yyyy-MM-dd"));
    setMode(initialDate ? "slot" : "custom");
    fetchOpenSlots();
  }, [open, initialDate]);

  const fetchOpenSlots = async () => {
    setLoadingSlots(true);
    const { data } = await supabase
      .from("availability_slots")
      .select("id, start_time, end_time")
      .eq("is_booked", false)
      .eq("is_blocked", false)
      .gte("start_time", new Date().toISOString())
      .order("start_time", { ascending: true })
      .limit(300);
    setOpenSlots(data || []);
    setLoadingSlots(false);
  };

  const filteredSlots = useMemo(() => {
    if (!initialDate) return openSlots;
    return openSlots.filter((s) => isSameDay(parseISO(s.start_time), initialDate));
  }, [openSlots, initialDate]);

  const upsertClient = async (): Promise<string> => {
    const trimmedEmail = email.trim();
    const trimmedName = name.trim() || "Unknown";
    if (trimmedEmail) {
      const { data: existing } = await supabase
        .from("clients")
        .select("id")
        .eq("email", trimmedEmail)
        .maybeSingle();
      if (existing) {
        await supabase
          .from("clients")
          .update({
            name: trimmedName,
            phone: phone.trim() || null,
            notes: details.trim() || null,
          })
          .eq("id", existing.id);
        return existing.id;
      }
    }
    const { data: created, error } = await supabase
      .from("clients")
      .insert({
        name: trimmedName,
        email: trimmedEmail || `unknown-${Date.now()}@placeholder.local`,
        phone: phone.trim() || null,
        notes: details.trim() || null,
      })
      .select("id")
      .single();
    if (error) throw error;
    return created.id;
  };

  const handleSave = async () => {
    if (!name.trim() && !email.trim() && !phone.trim()) {
      toast.error("Enter at least a name, email, or phone");
      return;
    }

    setSaving(true);
    try {
      let slotId: string;
      let startISO: string;
      let endISO: string;

      if (mode === "slot") {
        if (!selectedSlotId) {
          toast.error("Pick a slot or switch to custom time");
          setSaving(false);
          return;
        }
        const slot = openSlots.find((s) => s.id === selectedSlotId);
        if (!slot) {
          toast.error("Selected slot not found");
          setSaving(false);
          return;
        }
        // Atomic lock
        const { data: locked, error: lockErr } = await supabase
          .from("availability_slots")
          .update({ is_booked: true })
          .eq("id", slot.id)
          .eq("is_booked", false)
          .eq("is_blocked", false)
          .select("id");
        if (lockErr) throw lockErr;
        if (!locked || locked.length === 0) {
          toast.error("Slot is no longer available");
          setSaving(false);
          return;
        }
        slotId = slot.id;
        startISO = slot.start_time;
        endISO = slot.end_time;
      } else {
        if (!date || !startTime || !endTime) {
          toast.error("Pick a date and time");
          setSaving(false);
          return;
        }
        const start = new Date(`${date}T${startTime}:00`);
        const end = new Date(`${date}T${endTime}:00`);
        if (end <= start) {
          toast.error("End time must be after start time");
          setSaving(false);
          return;
        }
        startISO = start.toISOString();
        endISO = end.toISOString();
        const { data: newSlot, error: slotErr } = await supabase
          .from("availability_slots")
          .insert({
            start_time: startISO,
            end_time: endISO,
            is_booked: true,
            is_blocked: false,
            notes: "Manual booking",
          })
          .select("id")
          .single();
        if (slotErr) throw slotErr;
        slotId = newSlot.id;
      }

      let clientId: string;
      try {
        clientId = await upsertClient();
      } catch (e) {
        await supabase.from("availability_slots").update({ is_booked: false }).eq("id", slotId);
        if (mode === "custom") {
          await supabase.from("availability_slots").delete().eq("id", slotId);
        }
        throw e;
      }

      const formResponses: Record<string, unknown> = { manual_booking: true };
      if (details.trim()) formResponses.tattoo_description = details.trim();

      const { data: br, error: brErr } = await supabase
        .from("booking_requests")
        .insert({
          client_id: clientId,
          status: "booked",
          form_responses: formResponses as never,
        })
        .select("id")
        .single();

      if (brErr) {
        await supabase.from("availability_slots").update({ is_booked: false }).eq("id", slotId);
        if (mode === "custom") {
          await supabase.from("availability_slots").delete().eq("id", slotId);
        }
        throw brErr;
      }

      const { data: appt, error: apptErr } = await supabase
        .from("appointments")
        .insert({
          client_id: clientId,
          slot_id: slotId,
          booking_request_id: br.id,
          start_time: startISO,
          end_time: endISO,
        })
        .select("id")
        .single();

      if (apptErr) {
        await supabase.from("availability_slots").update({ is_booked: false }).eq("id", slotId);
        if (mode === "custom") {
          await supabase.from("availability_slots").delete().eq("id", slotId);
        }
        throw apptErr;
      }

      if (appt?.id) {
        supabase.functions
          .invoke("sync-gcal-event", { body: { appointmentId: appt.id } })
          .catch((e) => console.warn("gcal sync failed", e));
      }

      toast.success("Booking added");
      onOpenChange(false);
      onBooked?.();
    } catch (err) {
      console.error("Manual booking failed", err);
      toast.error("Could not add booking");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[92vw] sm:max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Add Booking</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mb-name">Name</Label>
            <Input id="mb-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Client name" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="mb-email">Email</Label>
              <Input
                id="mb-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mb-phone">Phone</Label>
              <Input
                id="mb-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mb-details">Tattoo details</Label>
            <Textarea
              id="mb-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Idea, size, placement, references, etc."
              rows={3}
            />
          </div>

          <Tabs value={mode} onValueChange={(v) => setMode(v as "slot" | "custom")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="slot">Existing slot</TabsTrigger>
              <TabsTrigger value="custom">Custom time</TabsTrigger>
            </TabsList>

            <TabsContent value="slot" className="space-y-2 pt-3">
              {loadingSlots ? (
                <p className="text-sm text-muted-foreground">Loading slots…</p>
              ) : filteredSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {initialDate ? "No open slots on this day." : "No open slots."} Switch to Custom time.
                </p>
              ) : (
                <Select value={selectedSlotId} onValueChange={setSelectedSlotId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a slot" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredSlots.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {format(parseISO(s.start_time), "EEE d MMM, HH:mm", { locale: enGB })}–
                        {format(parseISO(s.end_time), "HH:mm")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </TabsContent>

            <TabsContent value="custom" className="space-y-3 pt-3">
              <div className="space-y-2">
                <Label htmlFor="mb-date">Date</Label>
                <Input
                  id="mb-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="mb-start">Start</Label>
                  <Input
                    id="mb-start"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mb-end">End</Label>
                  <Input
                    id="mb-end"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                A new slot will be created and marked as booked.
              </p>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Add Booking"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ManualBookingDialog;
