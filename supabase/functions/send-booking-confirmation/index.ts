import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

function render(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    const { to, name, adminEmail, bookingRequestId } = await req.json();
    if (!to) {
      return new Response(JSON.stringify({ error: "Missing 'to'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tpls } = await sb
      .from("email_templates")
      .select("key, subject, body_html")
      .in("key", ["booking_confirmation_client", "booking_confirmation_admin"]);
    const byKey = Object.fromEntries((tpls || []).map((t: any) => [t.key, t]));
    const vars = { name: name || "", email: to };

    async function sendOne(key: string, recipient: string) {
      const tpl = byKey[key];
      if (!tpl) return;
      const subject = render(tpl.subject, vars);
      const html = render(tpl.body_html, vars);
      let status = "sent";
      let error_message: string | null = null;
      try {
        const resp = await fetch(`${GATEWAY_URL}/emails`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": RESEND_API_KEY,
          },
          body: JSON.stringify({
            from: "pokeeeeeeeoh <onboarding@resend.dev>",
            to: [recipient],
            subject,
            html,
          }),
        });
        if (!resp.ok) {
          status = "failed";
          error_message = await resp.text();
        }
      } catch (e) {
        status = "failed";
        error_message = e instanceof Error ? e.message : String(e);
      }
      await sb.from("email_log").insert({
        template_key: key,
        recipient,
        subject,
        status,
        error_message,
        booking_request_id: bookingRequestId || null,
      });
    }

    await sendOne("booking_confirmation_client", to);
    if (adminEmail && adminEmail !== to) {
      await sendOne("booking_confirmation_admin", adminEmail);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("send-booking-confirmation error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
