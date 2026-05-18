import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { Search, User, Mail, Phone, Calendar, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Appointment {
  id: string;
  start_time: string;
  end_time: string;
  created_at: string;
}

const AdminClients = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientAppointments, setClientAppointments] = useState<Appointment[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching clients:", error);
      toast.error("Failed to load clients");
    } else {
      setClients(data || []);
    }
    setLoading(false);
  };

  const fetchClientAppointments = async (clientId: string) => {
    const { data } = await supabase
      .from("appointments")
      .select("*")
      .eq("client_id", clientId)
      .order("start_time", { ascending: false });

    setClientAppointments(data || []);
  };

  const handleSelectClient = async (client: Client) => {
    setSelectedClient(client);
    setNotes(client.notes || "");
    await fetchClientAppointments(client.id);
  };

  const handleSaveNotes = async () => {
    if (!selectedClient) return;
    setSaving(true);
    try {
      await supabase
        .from("clients")
        .update({ notes })
        .eq("id", selectedClient.id);

      toast.success("Notes saved");
      fetchClients();
    } catch (err) {
      toast.error("Failed to save notes");
    } finally {
      setSaving(false);
    }
  };

  const filteredClients = clients.filter(
    (client) =>
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground">
            View and manage your client database
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Client List */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading clients...
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-lg">
            No clients found
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredClients.map((client) => (
              <button
                key={client.id}
                onClick={() => handleSelectClient(client)}
                className="p-4 rounded-lg border border-border bg-card hover:bg-card/80 text-left transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium truncate">{client.name}</h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {client.email}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 font-mono">
                      Since {format(parseISO(client.created_at), "MMM yyyy")}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Client Detail Dialog */}
        <Dialog open={!!selectedClient} onOpenChange={() => setSelectedClient(null)}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Client Details</DialogTitle>
            </DialogHeader>
            {selectedClient && (
              <div className="space-y-6">
                {/* Info */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedClient.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={`mailto:${selectedClient.email}`}
                      className="text-primary hover:underline"
                    >
                      {selectedClient.email}
                    </a>
                  </div>
                  {selectedClient.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={`tel:${selectedClient.phone}`}
                        className="text-primary hover:underline"
                      >
                        {selectedClient.phone}
                      </a>
                    </div>
                  )}
                </div>

                {/* Appointments */}
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Appointments
                  </h3>
                  {clientAppointments.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-3 border border-dashed border-border rounded-lg">
                      No appointments yet
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {clientAppointments.map((apt) => (
                        <div
                          key={apt.id}
                          className="p-3 rounded-lg border border-border bg-secondary/30"
                        >
                          <p className="font-medium text-sm">
                            {format(parseISO(apt.start_time), "EEEE, MMMM d, yyyy")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(apt.start_time), "h:mm a")} -{" "}
                            {format(parseISO(apt.end_time), "h:mm a")}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Notes
                  </Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes about this client..."
                    rows={4}
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveNotes}
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save Notes"}
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

export default AdminClients;
