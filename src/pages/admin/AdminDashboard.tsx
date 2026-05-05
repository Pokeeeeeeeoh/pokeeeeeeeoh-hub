import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { Search, Eye, Check, X, ChevronDown, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface Client {
  name: string;
  email: string;
  phone: string | null;
}

interface BookingRequest {
  id: string;
  client_id: string;
  status: string;
  form_responses: Record<string, unknown>;
  images: string[];
  approval_token: string;
  admin_notes: string | null;
  decline_reason: string | null;
  created_at: string;
  clients: Client;
}

const AdminDashboard = () => {
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedRequest, setSelectedRequest] = useState<BookingRequest | null>(null);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editClient, setEditClient] = useState<Client>({ name: "", email: "", phone: null });
  const [editResponses, setEditResponses] = useState<Record<string, unknown>>({});

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from("booking_requests")
      .select(`
        *,
        clients (
          name,
          email,
          phone
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching requests:", error);
      toast.error("Failed to load requests");
    } else {
      setRequests(data as unknown as BookingRequest[]);
    }
    setLoading(false);
  };

  const handleApprove = async (request: BookingRequest) => {
    setActionLoading(true);
    try {
      await supabase
        .from("booking_requests")
        .update({ status: "approved" })
        .eq("id", request.id);

      const bookingUrl = `${window.location.origin}/select-slot?token=${request.approval_token}`;
      const { error: emailError } = await supabase.functions.invoke("send-approval-email", {
        body: {
          to: request.clients.email,
          name: request.clients.name,
          bookingUrl,
        },
      });

      if (emailError) {
        console.error("Email send failed:", emailError);
        toast.success("Request approved (email failed to send)");
      } else {
        toast.success("Request approved & email sent!");
      }

      fetchRequests();
      setSelectedRequest(null);
    } catch (err) {
      toast.error("Failed to approve request");
    } finally {
      setActionLoading(false);
    }
  };

  const resendConfirmation = async (request: BookingRequest) => {
    setActionLoading(true);
    try {
      const { error } = await supabase.functions.invoke("send-booking-confirmation", {
        body: {
          to: request.clients.email,
          name: request.clients.name,
          adminEmail: "jakehaynes@gmail.com",
        },
      });
      if (error) throw error;
      toast.success("Confirmation email resent");
    } catch (err) {
      console.error(err);
      toast.error("Failed to resend confirmation email");
    } finally {
      setActionLoading(false);
    }
  };

  const resendApproval = async (request: BookingRequest) => {
    setActionLoading(true);
    try {
      const bookingUrl = `${window.location.origin}/select-slot?token=${request.approval_token}`;
      const { error } = await supabase.functions.invoke("send-approval-email", {
        body: {
          to: request.clients.email,
          name: request.clients.name,
          bookingUrl,
        },
      });
      if (error) throw error;
      toast.success("Approval email resent");
    } catch (err) {
      console.error(err);
      toast.error("Failed to resend approval email");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecline = async () => {
    if (!selectedRequest) return;
    setActionLoading(true);
    try {
      await supabase
        .from("booking_requests")
        .update({ 
          status: "declined",
          decline_reason: declineReason || null
        })
        .eq("id", selectedRequest.id);

      toast.success("Request declined.");
      fetchRequests();
      setSelectedRequest(null);
      setShowDeclineDialog(false);
      setDeclineReason("");
    } catch (err) {
      toast.error("Failed to decline request");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      new: "status-new",
      approved: "status-approved",
      declined: "status-declined",
      booked: "status-booked",
      completed: "status-completed",
      cancelled: "status-declined",
    };
    return (
      <Badge variant="outline" className={variants[status] || ""}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const filteredRequests = requests.filter((request) => {
    const matchesSearch =
      request.clients?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.clients?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || request.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    all: requests.length,
    new: requests.filter((r) => r.status === "new").length,
    approved: requests.filter((r) => r.status === "approved").length,
    booked: requests.filter((r) => r.status === "booked").length,
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Booking Requests</h1>
          <p className="text-muted-foreground">
            Manage incoming tattoo requests
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            {["all", "new", "approved", "booked"].map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(status)}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
                <span className="ml-2 text-xs opacity-70">
                  {statusCounts[status as keyof typeof statusCounts]}
                </span>
              </Button>
            ))}
          </div>
        </div>

        {/* Requests List */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading requests...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-lg">
            No requests found
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRequests.map((request) => (
              <div
                key={request.id}
                className="p-4 rounded-lg border border-border bg-card hover:bg-card/80 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-medium truncate">
                        {request.clients?.name || "Unknown"}
                      </h3>
                      {getStatusBadge(request.status)}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {request.clients?.email}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 font-mono">
                      {format(parseISO(request.created_at), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {request.status === "new" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedRequest(request);
                            setShowDeclineDialog(true);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(request)}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedRequest(request)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Preview of images */}
                {request.images && request.images.length > 0 && (
                  <div className="flex gap-2 mt-3">
                    {request.images.slice(0, 4).map((img, i) => (
                      <div
                        key={i}
                        className="w-12 h-12 rounded border border-border overflow-hidden"
                      >
                        <img
                          src={img}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                    {request.images.length > 4 && (
                      <div className="w-12 h-12 rounded border border-border flex items-center justify-center bg-muted text-xs text-muted-foreground">
                        +{request.images.length - 4}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Request Detail Dialog */}
        <Dialog open={!!selectedRequest && !showDeclineDialog} onOpenChange={() => setSelectedRequest(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Request Details</DialogTitle>
            </DialogHeader>
            {selectedRequest && (
              <div className="space-y-6">
                {/* Client Info */}
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">
                    Client Information
                  </h3>
                  <div className="p-4 rounded-lg border border-border bg-secondary/30 space-y-2">
                    <p><span className="text-muted-foreground">Name:</span> {selectedRequest.clients?.name}</p>
                    <p><span className="text-muted-foreground">Email:</span> {selectedRequest.clients?.email}</p>
                    {selectedRequest.clients?.phone && (
                      <p><span className="text-muted-foreground">Phone:</span> {selectedRequest.clients?.phone}</p>
                    )}
                  </div>
                </div>

                {/* Form Responses */}
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">
                    Tattoo Details
                  </h3>
                  <div className="p-4 rounded-lg border border-border bg-secondary/30 space-y-3">
                    {Object.entries(selectedRequest.form_responses || {}).map(([key, value]) => (
                      <div key={key}>
                        <p className="text-xs text-muted-foreground capitalize">
                          {key.replace(/_/g, " ")}
                        </p>
                        <p className="text-sm">{String(value)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Images */}
                {selectedRequest.images && selectedRequest.images.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">
                      Reference Images
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {selectedRequest.images.map((img, i) => (
                        <a
                          key={i}
                          href={img}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="aspect-square rounded-lg border border-border overflow-hidden hover:border-primary/50 transition-colors"
                        >
                          <img
                            src={img}
                            alt={`Reference ${i + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Booking Link */}
                {selectedRequest.status === "approved" && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">
                      Booking Link
                    </h3>
                    <Input
                      value={`${window.location.origin}/select-slot?token=${selectedRequest.approval_token}`}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Share this link with the client to let them select an appointment slot.
                    </p>
                  </div>
                )}

                {/* Actions */}
                {selectedRequest.status === "new" && (
                  <div className="flex gap-3 pt-4 border-t border-border">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setShowDeclineDialog(true);
                      }}
                    >
                      Decline
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => handleApprove(selectedRequest)}
                      disabled={actionLoading}
                    >
                      Approve Request
                    </Button>
                  </div>
                )}

                {/* Resend Emails */}
                <div className="pt-4 border-t border-border">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">
                    Resend Emails
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => resendConfirmation(selectedRequest)}
                      disabled={actionLoading}
                    >
                      Resend confirmation
                    </Button>
                    {selectedRequest.status === "approved" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resendApproval(selectedRequest)}
                        disabled={actionLoading}
                      >
                        Resend approval link
                      </Button>
                    )}
                  </div>
                </div>

                {/* Status */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  {getStatusBadge(selectedRequest.status)}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Decline Dialog */}
        <Dialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Decline Request</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Optionally provide a reason for declining this request.
                The client will be notified.
              </p>
              <Textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Reason for declining (optional)"
                rows={3}
              />
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowDeclineDialog(false);
                    setDeclineReason("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleDecline}
                  disabled={actionLoading}
                >
                  Decline Request
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AdminDashboard;
