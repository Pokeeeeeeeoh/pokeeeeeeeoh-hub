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

    const { to, name, adminEmail } = await req.json();
    if (!to || typeof to !== "string") {
      return new Response(JSON.stringify({ error: "Missing 'to'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientHtml = `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; color: #000; background: #fff;">
        <h1 style="font-size: 22px; margin: 0 0 16px;">Booking request received</h1>
        <p style="font-size: 14px; line-height: 1.6; color: #333;">
          ${name ? `Hi ${name},` : "Hi,"} thanks for your booking request. I've received it and
          will review it shortly. You'll get another email with a link to pick a time slot
          once it's approved.
        </p>
        <p style="font-size: 12px; color: #777; margin-top: 32px;">— pokeeeeeeeoh</p>
      </div>
    `;

    const adminHtml = `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; color: #000; background: #fff;">
        <h1 style="font-size: 22px; margin: 0 0 16px;">New booking request</h1>
        <p style="font-size: 14px; line-height: 1.6; color: #333;">
          ${name || "Someone"} (${to}) just submitted a booking request. Open the admin
          dashboard to review and approve it.
        </p>
      </div>
    `;

    const sends = [
      fetch(`${GATEWAY_URL}/emails`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": RESEND_API_KEY,
        },
        body: JSON.stringify({
          from: "pokeeeeeeeoh <onboarding@resend.dev>",
          to: [to],
          subject: "We received your booking request",
          html: clientHtml,
        }),
      }),
    ];

    if (adminEmail && adminEmail !== to) {
      sends.push(
        fetch(`${GATEWAY_URL}/emails`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": RESEND_API_KEY,
          },
          body: JSON.stringify({
            from: "pokeeeeeeeoh <onboarding@resend.dev>",
            to: [adminEmail],
            subject: `New booking request from ${name || to}`,
            html: adminHtml,
          }),
        }),
      );
    }

    const results = await Promise.all(sends);
    for (const r of results) {
      if (!r.ok) {
        const errBody = await r.text();
        console.error("Resend error:", r.status, errBody);
      } else {
        await r.text();
      }
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
