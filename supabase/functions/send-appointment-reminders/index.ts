import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    // Find appointments starting in 23-25 hours that haven't had reminders sent
    const now = new Date();
    const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000).toISOString();
    const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString();

    const { data: appts, error } = await sb
      .from("appointments")
      .select("id, start_time, end_time, booking_request_id, reminder_sent, clients(name, email)")
      .eq("reminder_sent", false)
      .gte("start_time", windowStart)
      .lte("start_time", windowEnd);

    if (error) throw error;

    const results: any[] = [];
    for (const appt of appts || []) {
      const client = (appt as any).clients;
      if (!client?.email) continue;

      const apptDate = new Date(appt.start_time).toLocaleString("en-GB", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit", hour12: false,
      });

      const { data, error: invokeErr } = await sb.functions.invoke("send-template-email", {
        body: {
          templateKey: "appointment_reminder",
          to: client.email,
          bookingRequestId: appt.booking_request_id,
          vars: { name: client.name, appointmentTime: apptDate },
        },
      });

      if (!invokeErr) {
        await sb.from("appointments").update({ reminder_sent: true }).eq("id", appt.id);
      }
      results.push({ id: appt.id, sent: !invokeErr, error: invokeErr?.message });
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-appointment-reminders error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
