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
    const {
      templateKey,
      to,
      vars = {},
      bookingRequestId,
      subjectOverride,
      htmlOverride,
    } = await req.json();

    if (!to || (!templateKey && !htmlOverride)) {
      return new Response(
        JSON.stringify({ error: "Missing 'to' or template" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let subject = subjectOverride as string | undefined;
    let html = htmlOverride as string | undefined;

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

    const { data: site } = await sb
      .from("site_settings")
      .select("site_name, address, email, tagline")
      .single();
    const mergedVars: Record<string, string> = {
      address: site?.address ?? "",
      siteName: site?.site_name ?? "",
      siteEmail: site?.email ?? "",
      tagline: site?.tagline ?? "",
      ...vars,
    };

    subject = render(subject || "", mergedVars);
    html = render(html || "", mergedVars);

    const idempotencyKey = `${templateKey || "custom"}-${
      bookingRequestId ?? to
    }-${Date.now()}`;

    const result = await enqueueTransactionalEmail(sb, {
      to,
      subject,
      html,
      templateLabel: templateKey || "custom",
      idempotencyKey,
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
    console.error("send-template-email error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
