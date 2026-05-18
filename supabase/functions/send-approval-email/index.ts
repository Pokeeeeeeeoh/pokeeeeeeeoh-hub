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
    const { to, name, bookingUrl, bookingRequestId } = await req.json();
    if (!to) {
      return new Response(JSON.stringify({ error: "Missing 'to'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: tpl } = await sb
      .from("email_templates")
      .select("subject, body_html")
      .eq("key", "approval")
      .single();

    const { data: site } = await sb
      .from("site_settings")
      .select("site_name, address, email, tagline")
      .single();

    const vars = {
      name: name || "",
      bookingUrl: bookingUrl || "",
      address: site?.address ?? "",
      siteName: site?.site_name ?? "",
      siteEmail: site?.email ?? "",
      tagline: site?.tagline ?? "",
    };
    const subject = render(
      tpl?.subject || "Your booking request was approved",
      vars,
    );
    const html = render(tpl?.body_html || "", vars);

    const result = await enqueueTransactionalEmail(sb, {
      to,
      subject,
      html,
      templateLabel: "approval",
      idempotencyKey: `approval-${bookingRequestId ?? to}`,
      bookingRequestId,
    });

    return new Response(
      JSON.stringify({ success: result.ok, error: result.error }),
      {
        status: result.ok ? 200 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("send-approval-email error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
