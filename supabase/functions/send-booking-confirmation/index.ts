import {
  enqueueTransactionalEmail,
  getSupabase,
} from "../_shared/enqueue-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function render(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const sb = getSupabase();
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

    const { data: site } = await sb
      .from("site_settings")
      .select("site_name, address, email, tagline")
      .single();

    const vars: Record<string, string> = {
      name: name || "",
      email: to,
      address: site?.address ?? "",
      siteName: site?.site_name ?? "",
      siteEmail: site?.email ?? "",
      tagline: site?.tagline ?? "",
    };

    async function sendOne(key: string, recipient: string) {
      const tpl = byKey[key];
      if (!tpl) return;
      const subject = render(tpl.subject, vars);
      const html = render(tpl.body_html, vars);
      await enqueueTransactionalEmail(sb, {
        to: recipient,
        subject,
        html,
        templateLabel: key,
        idempotencyKey: `${key}-${bookingRequestId ?? recipient}`,
        bookingRequestId,
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
