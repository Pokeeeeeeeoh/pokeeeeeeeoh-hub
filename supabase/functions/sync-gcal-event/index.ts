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

  try {
    // Auth: allow internal callers (service role bearer) OR authenticated admins.
    const authHeader = req.headers.get("Authorization") ?? "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    let authorized = false;
    if (bearer && bearer === serviceRole) {
      authorized = true;
    } else if (bearer) {
      // Validate as user JWT and check admin
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
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

    const { appointmentId } = await req.json();
    if (!appointmentId) throw new Error("appointmentId required");

    const supabase = createClient(supabaseUrl, serviceRole);

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
        await gcalFetch(`/users/me/calendarList/${encodeURIComponent(calendarId!)}`, {
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
      result = await gcalFetch(`/calendars/${encodeURIComponent(calendarId!)}/events/${encodeURIComponent(eventId)}`, {
        method: "PATCH",
        body: JSON.stringify(eventBody),
      });
    } else {
      result = await gcalFetch(`/calendars/${encodeURIComponent(calendarId!)}/events`, {
        method: "POST",
        body: JSON.stringify(eventBody),
      });
      eventId = result.id;
      await supabase.from("appointments").update({ google_event_id: eventId }).eq("id", appt.id);
    }

    return new Response(JSON.stringify({ success: true, eventId, calendarId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sync-gcal-event error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
