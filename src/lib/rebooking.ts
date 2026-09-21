import { supabase } from "@/integrations/supabase/client";

export const PUBLIC_SITE_ORIGIN = "https://pokeeeeeeeoh.com";

/**
 * Releases a client's current appointment and emails them a fresh link so they
 * can pick a new slot. The original request (name, contact, tattoo details)
 * stays intact, so the new booking carries all the same info.
 */
export async function sendRebookingLink(bookingRequestId: string) {
  const { data: request, error: reqErr } = await supabase
    .from("booking_requests")
    .select("id, approval_token, clients(name, email)")
    .eq("id", bookingRequestId)
    .single();
  if (reqErr || !request) throw reqErr ?? new Error("Booking request not found");

  const client = (request as any).clients as { name: string; email: string } | null;
  if (!client?.email) throw new Error("This client has no email address");

  // Release any existing appointment(s) for this request.
  const { data: appts } = await supabase
    .from("appointments")
    .select("id, slot_id, google_event_id")
    .eq("booking_request_id", bookingRequestId);

  for (const appt of appts ?? []) {
    const { error: delErr } = await supabase.from("appointments").delete().eq("id", appt.id);
    if (delErr) throw delErr;
    if (appt.slot_id) {
      await supabase
        .from("availability_slots")
        .update({ is_booked: false })
        .eq("id", appt.slot_id);
    }
    if (appt.google_event_id) {
      await supabase.functions
        .invoke("sync-gcal-event", {
          body: { action: "delete", googleEventId: appt.google_event_id },
        })
        .catch((e) => console.warn("gcal delete failed", e));
    }
  }

  // Re-open the request and refresh the 14-day link window.
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const { error: updErr } = await supabase
    .from("booking_requests")
    .update({ status: "approved", approval_token_expires_at: expiresAt })
    .eq("id", bookingRequestId);
  if (updErr) throw updErr;

  const bookingUrl = `${PUBLIC_SITE_ORIGIN}/select-slot?token=${request.approval_token}`;
  const { error: mailErr } = await supabase.functions.invoke("send-template-email", {
    body: {
      templateKey: "reschedule",
      to: client.email,
      bookingRequestId,
      vars: { name: client.name ?? "", bookingUrl },
    },
  });
  if (mailErr) throw mailErr;

  return { email: client.email, bookingUrl };
}
