import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const { to, name, bookingUrl } = await req.json();
    if (!to || typeof to !== "string") {
      return new Response(JSON.stringify({ error: "Missing 'to'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const html = `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; color: #000; background: #fff;">
        <h1 style="font-size: 22px; margin: 0 0 16px;">Your booking request was approved</h1>
        <p style="font-size: 14px; line-height: 1.6; color: #333;">
          ${name ? `Hi ${name},` : "Hi,"} thanks for your request. It's been approved
          and you can now pick a time slot using the link below.
        </p>
        <p style="margin: 28px 0;">
          <a href="${bookingUrl}" style="display: inline-block; background: #000; color: #fff; padding: 12px 20px; text-decoration: none; font-size: 14px; border-radius: 4px;">
            Choose your appointment
          </a>
        </p>
        <p style="font-size: 12px; color: #777; word-break: break-all;">${bookingUrl}</p>
      </div>
    `;

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
        subject: "Your booking request was approved",
        html,
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error("Resend error:", resp.status, data);
      return new Response(JSON.stringify({ error: data }), {
        status: resp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("send-approval-email error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
