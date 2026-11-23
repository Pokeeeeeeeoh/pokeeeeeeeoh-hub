import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the booking request a new appointment should hang on: the client's
 * latest open (new/approved, not archived) request if one exists — so the
 * tattoo details and pictures stay with the booking — otherwise a new one.
 */
export async function attachBookingRequest(
  clientId: string,
  extra: Record<string, unknown>,
): Promise<{ id: string }> {
  const { data: open } = await supabase
    .from("booking_requests")
    .select("id, form_responses")
    .eq("client_id", clientId)
    .in("status", ["new", "approved"])
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (open) {
    const fr = open.form_responses && typeof open.form_responses === "object" ? (open.form_responses as Record<string, unknown>) : {};
    const merged: Record<string, unknown> = { ...fr };
    if (extra.tattoo_description) merged.manual_booking_notes = extra.tattoo_description;
    const { error } = await supabase
      .from("booking_requests")
      .update({ status: "booked", form_responses: merged as never })
      .eq("id", open.id);
    if (error) throw error;
    return { id: open.id };
  }

  const { data, error } = await supabase
    .from("booking_requests")
    .insert({ client_id: clientId, status: "booked", form_responses: extra as never })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Could not create booking request");
  return data;
}
