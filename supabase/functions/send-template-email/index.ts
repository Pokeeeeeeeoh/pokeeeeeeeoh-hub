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

    const {
      templateKey,
      to,
      vars = {},
      bookingRequestId,
      subjectOverride,
      htmlOverride,
    } = await req.json();

    if (!to || (!templateKey && !htmlOverride)) {
      return new Response(JSON.stringify({ error: "Missing 'to' or template" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let subject = subjectOverride;
    let html = htmlOverride;

    if (templateKey && (!subject || !html)) {
      const { data: tpl } = await sb
        .from("email_templates")
        .select("subject, body_html")
        .eq("key", templateKey)
        .single();
      if (tpl) {
        subject = subject || tpl.subject;
        html = html || tpl.body_html;
      }
    }

    subject = render(subject || "", vars);
    html = render(html || "", vars);

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
          to: [to],
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
      template_key: templateKey || "custom",
      recipient: to,
      subject,
      status,
      error_message,
      booking_request_id: bookingRequestId || null,
    });

    return new Response(JSON.stringify({ success: status === "sent", error: error_message }), {
      status: status === "sent" ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("send-template-email error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
