import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  format,
  parseISO,
  startOfWeek,
  addDays,
  addWeeks,
  isSameDay,
  getISOWeek,
  setHours,
  setMinutes,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus, X, Clock } from "lucide-react";
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

interface AvailabilitySlot {
  id: string;
  start_time: string;
  end_time: string;
  is_blocked: boolean;
  is_booked: boolean;
  notes: string | null;
}

const AdminCalendar = () => {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [showAddSlot, setShowAddSlot] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [newSlot, setNewSlot] = useState({
    startTime: "10:00",
    endTime: "12:00",
    repeat: false,
    repeatWeeks: 4,
  });
  const [addingSlot, setAddingSlot] = useState(false);

  useEffect(() => {
    fetchSlots();
  }, [currentWeekStart]);

  const fetchSlots = async () => {
    const weekEnd = addDays(currentWeekStart, 7);
    const { data, error } = await supabase
      .from("availability_slots")
      .select("*")
      .gte("start_time", currentWeekStart.toISOString())
      .lt("start_time", weekEnd.toISOString())
      .order("start_time", { ascending: true });

    if (error) {
      console.error("Error fetching slots:", error);
    } else {
      setSlots(data || []);
    }
    setLoading(false);
  };

  const handleAddSlot = async () => {
    if (!selectedDate) return;
    setAddingSlot(true);

    try {
      const [startHour, startMin] = newSlot.startTime.split(":").map(Number);
      const [endHour, endMin] = newSlot.endTime.split(":").map(Number);

      const slotsToCreate: { start_time: string; end_time: string }[] = [];
      const weeksToAdd = newSlot.repeat ? newSlot.repeatWeeks : 1;

      for (let i = 0; i < weeksToAdd; i++) {
        const date = addWeeks(selectedDate, i);
        const startTime = setMinutes(setHours(date, startHour), startMin);
        const endTime = setMinutes(setHours(date, endHour), endMin);

        slotsToCreate.push({
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
        });
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

  const weekDays = Array.from({ length: 7 }, (_, i) =>
    addDays(currentWeekStart, i)
  );
  const weekNumber = getISOWeek(currentWeekStart);

  const getSlotsForDay = (date: Date) => {
    return slots.filter((slot) => isSameDay(parseISO(slot.start_time), date));
  };

  const timeOptions = [];
  for (let h = 8; h <= 20; h++) {
    for (let m = 0; m < 60; m += 30) {
      const time = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
      timeOptions.push(time);
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">
            Availability Calendar
          </h1>
          <p className="text-muted-foreground">
            Manage your available appointment slots
          </p>
        </div>

        {/* Week Navigation */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentWeekStart((prev) => addDays(prev, -7))}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <div className="text-center">
            <p className="font-mono text-sm text-muted-foreground">
              Week {weekNumber}
            </p>
            <p className="font-medium">
              {format(currentWeekStart, "MMM d")} -{" "}
              {format(addDays(currentWeekStart, 6), "MMM d, yyyy")}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentWeekStart((prev) => addDays(prev, 7))}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {/* Calendar Grid */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading calendar...
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day, i) => {
              const daySlots = getSlotsForDay(day);
              const isToday = isSameDay(day, new Date());
              const isPast = day < new Date() && !isToday;

              return (
                <div
                  key={i}
                  className={`min-h-[300px] rounded-lg border ${
                    isToday ? "border-primary/50" : "border-border"
                  } ${isPast ? "opacity-50" : ""}`}
                >
                  <div
                    className={`p-3 border-b border-border ${
                      isToday ? "bg-primary/10" : "bg-card"
                    }`}
                  >
                    <p className="text-xs text-muted-foreground text-center">
                      {format(day, "EEE")}
                    </p>
                    <p
                      className={`text-lg font-semibold text-center ${
                        isToday ? "text-primary" : ""
                      }`}
                    >
                      {format(day, "d")}
                    </p>
                  </div>

                  <div className="p-2 space-y-2">
                    {daySlots.map((slot) => (
                      <div
                        key={slot.id}
                        className={`group p-2 rounded text-xs border transition-colors ${
                          slot.is_booked
                            ? "bg-success/10 border-success/30 text-success"
                            : slot.is_blocked
                            ? "bg-muted border-muted text-muted-foreground line-through"
                            : "bg-card border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono">
                            {format(parseISO(slot.start_time), "h:mm a")}
                          </span>
                          {!slot.is_booked && (
                            <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                              <button
                                onClick={() =>
                                  handleBlockSlot(slot.id, !slot.is_blocked)
                                }
                                className="p-0.5 hover:bg-secondary rounded"
                                title={slot.is_blocked ? "Unblock" : "Block"}
                              >
                                <Clock className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteSlot(slot.id)}
                                className="p-0.5 hover:bg-destructive/20 rounded text-destructive"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                        {slot.is_booked && (
                          <span className="text-[10px] opacity-70">Booked</span>
                        )}
                      </div>
                    ))}

                    {!isPast && (
                      <button
                        onClick={() => {
                          setSelectedDate(day);
                          setShowAddSlot(true);
                        }}
                        className="w-full p-2 rounded border-2 border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        <span className="text-xs">Add</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add Slot Dialog */}
        <Dialog open={showAddSlot} onOpenChange={setShowAddSlot}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Availability Slot</DialogTitle>
            </DialogHeader>
            {selectedDate && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Adding slot for{" "}
                  <span className="text-foreground font-medium">
                    {format(selectedDate, "EEEE, MMMM d, yyyy")}
                  </span>
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Time</Label>
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
                  <div className="space-y-2">
                    <Label>End Time</Label>
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

                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="repeat"
                      checked={newSlot.repeat}
                      onCheckedChange={(checked) =>
                        setNewSlot((prev) => ({
                          ...prev,
                          repeat: checked as boolean,
                        }))
                      }
                    />
                    <Label htmlFor="repeat" className="cursor-pointer">
                      Repeat weekly
                    </Label>
                  </div>

                  {newSlot.repeat && (
                    <div className="space-y-2">
                      <Label>For how many weeks?</Label>
                      <Input
                        type="number"
                        min={1}
                        max={52}
                        value={newSlot.repeatWeeks}
                        onChange={(e) =>
                          setNewSlot((prev) => ({
                            ...prev,
                            repeatWeeks: parseInt(e.target.value) || 1,
                          }))
                        }
                      />
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
      </div>
    </div>
  );
};

export default AdminCalendar;
