import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";

async function gcalFetch(path: string, init: RequestInit = {}) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const GCAL_KEY = Deno.env.get("GOOGLE_CALENDAR_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
  if (!GCAL_KEY) throw new Error("GOOGLE_CALENDAR_API_KEY missing");

  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": GCAL_KEY,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(`GCal ${res.status}: ${text}`);
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let supabase: ReturnType<typeof createClient> | null = null;
  let trackedAppointmentId: string | undefined;
  try {
    // Auth: allow internal callers (service role bearer) OR authenticated admins.
    const authHeader = req.headers.get("Authorization") ?? "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
    const internalServiceKey = req.headers.get("X-Internal-Service-Key") ?? "";
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!serviceRole || !supabaseUrl || !anonKey) {
      throw new Error("Backend configuration missing");
    }

    let authorized = false;
    if ((bearer && bearer === serviceRole) || (internalServiceKey && internalServiceKey === serviceRole)) {
      authorized = true;
    } else if (bearer) {
      // Validate as user JWT and check admin
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${bearer}` } },
      });
      const { data: userData } = await userClient.auth.getUser();
      const userId = userData?.user?.id;
      if (userId) {
        const adminClient = createClient(supabaseUrl, serviceRole);
        const { data: isAdmin } = await adminClient.rpc("is_admin", { _user_id: userId });
        if (isAdmin === true) authorized = true;
      }
    }

    if (!authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { appointmentId, action, googleEventId } = body as {
      appointmentId?: string;
      action?: "delete" | "upsert";
      googleEventId?: string;
    };

    supabase = createClient(supabaseUrl, serviceRole);

    // ----- DELETE branch -----
    if (action === "delete") {
      const { data: settings } = await supabase
        .from("admin_settings")
        .select("google_calendar_id")
        .limit(1)
        .maybeSingle();
      const calendarId = settings?.google_calendar_id as string | null;
      if (!calendarId || !googleEventId) {
        return new Response(JSON.stringify({ success: true, skipped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      try {
        await gcalFetch(
          `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`,
          { method: "DELETE" },
        );
      } catch (e) {
        // 404/410 means already gone — treat as success
        const msg = (e as Error).message;
        if (!/\b(404|410)\b/.test(msg)) throw e;
      }
      await supabase
        .from("google_calendar_deletion_queue")
        .delete()
        .eq("google_event_id", googleEventId);
      return new Response(JSON.stringify({ success: true, deleted: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!appointmentId) throw new Error("appointmentId required");
    trackedAppointmentId = appointmentId;

    await supabase
      .from("appointments")
      .update({
        google_sync_status: "syncing",
        google_sync_last_attempt_at: new Date().toISOString(),
        google_sync_error: null,
      })
      .eq("id", appointmentId);

    // Load appointment with client + booking_request
    const { data: appt, error: apptErr } = await supabase
      .from("appointments")
      .select("id, start_time, end_time, google_event_id, booking_request_id, clients(name, email, phone, notes), booking_requests(form_responses)")
      .eq("id", appointmentId)
      .single();
    if (apptErr || !appt) throw new Error("Appointment not found");

    // Ensure dedicated calendar exists (admin-only table)
    const { data: settings } = await supabase
      .from("admin_settings")
      .select("id, google_calendar_id")
      .limit(1)
      .maybeSingle();

    let calendarId = settings?.google_calendar_id as string | null;
    if (!calendarId) {
      const created = await gcalFetch("/calendars", {
        method: "POST",
        body: JSON.stringify({
          summary: "Tattoo Bookings",
          description: "Appointments synced from your booking app",
          timeZone: "Europe/Stockholm",
        }),
      });
      calendarId = created.id;
      try {
        await gcalFetch(`/users/me/calendarList/${encodeURIComponent(calendarId)}`, {
          method: "PATCH",
          body: JSON.stringify({ colorId: "11" }),
        });
      } catch (e) { console.warn("color set failed", e); }

      if (settings?.id) {
        await supabase.from("admin_settings").update({ google_calendar_id: calendarId }).eq("id", settings.id);
      } else {
        await supabase.from("admin_settings").insert({ google_calendar_id: calendarId });
      }
    }

    const client = (appt as any).clients ?? {};
    const formResponses = (appt as any).booking_requests?.form_responses ?? {};
    const tattooDescription =
      formResponses.tattoo_description ||
      formResponses.description ||
      formResponses.notes ||
      formResponses.idea ||
      (client as any).notes ||
      "";

    const summary = `${client.name ?? "Client"} — Tattoo`;
    const descriptionParts = [
      client.name ? `Name: ${client.name}` : null,
      client.phone ? `Phone: ${client.phone}` : null,
      client.email ? `Email: ${client.email}` : null,
      tattooDescription ? `\nTattoo:\n${tattooDescription}` : null,
    ].filter(Boolean);

    const eventBody = {
      summary,
      description: descriptionParts.join("\n"),
      start: { dateTime: new Date(appt.start_time).toISOString() },
      end: { dateTime: new Date(appt.end_time).toISOString() },
    };

    let eventId = appt.google_event_id as string | null;
    let result;
    if (eventId) {
      try {
        result = await gcalFetch(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
          method: "PATCH",
          body: JSON.stringify(eventBody),
        });
      } catch (error) {
        if (!/\b(404|410)\b/.test((error as Error).message)) throw error;
        eventId = null;
      }
    }
    if (!eventId) {
      result = await gcalFetch(`/calendars/${encodeURIComponent(calendarId)}/events`, {
        method: "POST",
        body: JSON.stringify(eventBody),
      });
      eventId = result.id;
    }

    const { error: statusError } = await supabase
      .from("appointments")
      .update({
        google_event_id: eventId,
        google_sync_status: "synced",
        google_sync_last_success_at: new Date().toISOString(),
        google_sync_error: null,
      })
      .eq("id", appt.id);
    if (statusError) throw statusError;

    return new Response(JSON.stringify({ success: true, eventId, calendarId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sync-gcal-event error", e);
    if (supabase && trackedAppointmentId) {
      await supabase
        .from("appointments")
        .update({
          google_sync_status: "failed",
          google_sync_error: (e as Error).message.slice(0, 2000),
          google_sync_last_attempt_at: new Date().toISOString(),
        })
        .eq("id", trackedAppointmentId);
    }
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
