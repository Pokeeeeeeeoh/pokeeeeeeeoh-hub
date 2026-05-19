import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { token, linkKey, slotId, name, email, phone, notes, website } = body ?? {};

    // Honeypot — bots fill hidden field; real users don't.
    if (typeof website === "string" && website.trim() !== "") {
      return new Response(JSON.stringify({ error: "Invalid submission" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!slotId) {
      return new Response(JSON.stringify({ error: "Missing slotId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const projectUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Hash client IP for rate limiting (don't store raw IP).
    const rawIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("cf-connecting-ip")
      || "unknown";
    const ipBytes = new TextEncoder().encode(rawIp + "|pokeeeeeeeoh");
    const hashBuf = await crypto.subtle.digest("SHA-256", ipBytes);
    const ipHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, "0")).join("");

    // Resolve client + booking request — either via token (approval link)
    // or open-link mode (requires valid linkKey).
    let request: { id: string; client_id: string; status: string; clients: { name: string; email: string } | null } | null = null;

    if (token) {
      const { data, error } = await supabase
        .from("booking_requests")
        .select("id, client_id, status, clients(name, email)")
        .eq("approval_token", token)
        .single();
      if (error || !data) throw new Error("Invalid token");
      if (data.status !== "approved" && data.status !== "booked") {
        throw new Error("Request is not approved");
      }
      request = data as any;
    } else {
      // Open-link mode requires a valid linkKey
      const cleanKey = typeof linkKey === "string" ? linkKey.trim() : "";
      if (!cleanKey) throw new Error("Missing booking link key");

      const { data: settings } = await supabase
        .from("admin_settings")
        .select("booking_link_key")
        .not("booking_link_key", "is", null)
        .limit(1)
        .maybeSingle();

      if (!settings?.booking_link_key || settings.booking_link_key !== cleanKey) {
        throw new Error("Invalid booking link");
      }

      // Rate limit: max 3 bookings per IP per hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count: recentCount } = await supabase
        .from("booking_attempts")
        .select("id", { count: "exact", head: true })
        .eq("ip_hash", ipHash)
        .eq("success", true)
        .gte("created_at", oneHourAgo);

      if ((recentCount ?? 0) >= 3) {
        throw new Error("Too many bookings from your network. Please try again later.");
      }

      const cleanEmail = (email ?? "").trim().toLowerCase();
      const cleanName = (name ?? "").trim();
      const cleanPhone = (phone ?? "").trim() || null;
      const cleanNotes = (notes ?? "").trim() || null;

      if (!cleanEmail || !cleanName) {
        throw new Error("Name and email are required");
      }
      if (cleanName.length > 200 || cleanEmail.length > 320) {
        throw new Error("Input too long");
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        throw new Error("Invalid email address");
      }

      // Find or create client by email
      const { data: existingClient } = await supabase
        .from("clients")
        .select("id, name, email")
        .ilike("email", cleanEmail)
        .maybeSingle();

      let clientId: string;
      let clientName: string;
      let clientEmail: string;

      if (existingClient) {
        clientId = existingClient.id;
        clientName = existingClient.name;
        clientEmail = existingClient.email;
        // Optionally update phone if provided and missing — keep simple, don't overwrite.
        if (cleanPhone) {
          await supabase
            .from("clients")
            .update({ phone: cleanPhone })
            .eq("id", clientId)
            .is("phone", null);
        }
      } else {
        const { data: newClient, error: clientErr } = await supabase
          .from("clients")
          .insert({ name: cleanName, email: cleanEmail, phone: cleanPhone })
          .select("id, name, email")
          .single();
        if (clientErr || !newClient) throw new Error("Could not create client");
        clientId = newClient.id;
        clientName = newClient.name;
        clientEmail = newClient.email;
      }

      // Create a booking_request marked as approved/booked so appointment is linked
      const { data: newReq, error: reqErr } = await supabase
        .from("booking_requests")
        .insert({
          client_id: clientId,
          status: "approved",
          form_responses: { source: "open_calendar_link", notes: cleanNotes },
        })
        .select("id, client_id, status")
        .single();
      if (reqErr || !newReq) throw new Error("Could not create booking request");

      request = {
        id: newReq.id,
        client_id: newReq.client_id,
        status: newReq.status,
        clients: { name: clientName, email: clientEmail },
      };
    }

    if (!request) throw new Error("Could not resolve booking request");

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
    const { data: apptRow, error: apptErr } = await supabase.from("appointments").insert({
      booking_request_id: request.id,
      client_id: request.client_id,
      slot_id: slot.id,
      start_time: slot.start_time,
      end_time: slot.end_time,
    }).select("id").single();
    if (apptErr) throw apptErr;

    // Record successful attempt for rate limiting (open-link mode only)
    if (!token) {
      await supabase.from("booking_attempts").insert({
        ip_hash: ipHash,
        link_key: linkKey ?? null,
        success: true,
      });
    }

    // Fire-and-forget: push to Google Calendar (authenticated as service role)
    if (apptRow?.id) {
      const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      fetch(`${projectUrl}/functions/v1/sync-gcal-event`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${serviceRole}`,
        },
        body: JSON.stringify({ appointmentId: apptRow.id }),
      }).catch((e) => console.warn("gcal sync invoke failed", e));
    }

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
        timeZone: "Europe/Stockholm",
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
      JSON.stringify({
        success: true,
        slot_id: slot.id,
        start_time: slot.start_time,
        end_time: slot.end_time,
        client_name: request.clients?.name ?? null,
        client_email: request.clients?.email ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("book-slot error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
