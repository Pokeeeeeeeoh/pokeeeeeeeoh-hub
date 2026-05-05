import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { token, slotId } = await req.json();
    if (!token || !slotId) {
      return new Response(JSON.stringify({ error: "Missing token or slotId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const projectUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify request via token
    const { data: request, error: reqErr } = await supabase
      .from("booking_requests")
      .select("id, client_id, status, clients(name, email)")
      .eq("approval_token", token)
      .single();
    if (reqErr || !request) throw new Error("Invalid token");

    if (request.status !== "approved" && request.status !== "booked") {
      throw new Error("Request is not approved");
    }


    // Verify slot is available
    const { data: slot, error: slotErr } = await supabase
      .from("availability_slots")
      .select("id, start_time, end_time, is_booked, is_blocked")
      .eq("id", slotId)
      .single();
    if (slotErr || !slot) throw new Error("Slot not found");
    if (slot.is_booked || slot.is_blocked) throw new Error("Slot no longer available");

    const { data: existingAppointment } = await supabase
      .from("appointments")
      .select("id")
      .eq("booking_request_id", request.id)
      .eq("slot_id", slot.id)
      .maybeSingle();

    if (existingAppointment) {
      return new Response(
        JSON.stringify({ success: true, alreadyBooked: true, slot_id: slot.id, start_time: slot.start_time, end_time: slot.end_time }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Create appointment
    const { error: apptErr } = await supabase.from("appointments").insert({
      booking_request_id: request.id,
      client_id: request.client_id,
      slot_id: slot.id,
      start_time: slot.start_time,
      end_time: slot.end_time,
    });
    if (apptErr) throw apptErr;

    // Mark slot booked
    await supabase.from("availability_slots").update({ is_booked: true }).eq("id", slotId);
    // Update request status
    await supabase.from("booking_requests").update({ status: "booked" }).eq("id", request.id);

    const clientEmail = request.clients?.email;
    const clientName = request.clients?.name ?? "";
    if (clientEmail) {
      const appointmentTime = new Date(slot.start_time).toLocaleString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "UTC",
      }).replace(",", " at");

      const emailResp = await fetch(`${projectUrl}/functions/v1/send-template-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          templateKey: "appointment_booked",
          to: clientEmail,
          bookingRequestId: request.id,
          vars: { name: clientName, appointmentTime },
        }),
      });

      if (!emailResp.ok) {
        console.error("book-slot confirmation email failed", await emailResp.text());
      }
    }

    return new Response(
      JSON.stringify({ success: true, slot_id: slot.id, start_time: slot.start_time, end_time: slot.end_time }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("book-slot error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
