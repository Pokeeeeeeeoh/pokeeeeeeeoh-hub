import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_PER_HOUR = 3;
const MAX_PER_DAY = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { name, email, phone, formResponses, images, website } = body ?? {};

    // Honeypot
    if (typeof website === "string" && website.trim() !== "") {
      return new Response(JSON.stringify({ error: "Invalid submission" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanEmail = (email ?? "").trim().toLowerCase();
    const cleanName = (name ?? "").trim();
    const cleanPhone = (phone ?? "").trim() || null;

    if (!cleanEmail || !cleanName) {
      return new Response(JSON.stringify({ error: "Name and email are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (cleanName.length > 200 || cleanEmail.length > 320) {
      return new Response(JSON.stringify({ error: "Input too long" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return new Response(JSON.stringify({ error: "Invalid email address" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Hash IP for rate limiting
    const rawIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("cf-connecting-ip")
      || "unknown";
    const ipBytes = new TextEncoder().encode(rawIp + "|booking-request|pokeeeeeeeoh");
    const hashBuf = await crypto.subtle.digest("SHA-256", ipBytes);
    const ipHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, "0")).join("");

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { count: hourCount } = await supabase
      .from("booking_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .eq("link_key", "booking-request")
      .eq("success", true)
      .gte("created_at", oneHourAgo);

    if ((hourCount ?? 0) >= MAX_PER_HOUR) {
      return new Response(JSON.stringify({
        error: `Too many requests. You can submit up to ${MAX_PER_HOUR} booking requests per hour. Please try again later.`,
      }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { count: dayCount } = await supabase
      .from("booking_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .eq("link_key", "booking-request")
      .eq("success", true)
      .gte("created_at", oneDayAgo);

    if ((dayCount ?? 0) >= MAX_PER_DAY) {
      return new Response(JSON.stringify({
        error: `Daily limit reached (${MAX_PER_DAY} requests). Please try again tomorrow.`,
      }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Find-or-create client
    const { data: clientId, error: clientErr } = await supabase.rpc(
      "upsert_client_for_booking",
      { _email: cleanEmail, _name: cleanName, _phone: cleanPhone ?? "" },
    );
    if (clientErr || !clientId) throw clientErr ?? new Error("Could not create client");

    const bookingRequestId = crypto.randomUUID();
    const { error: reqErr } = await supabase
      .from("booking_requests")
      .insert({
        id: bookingRequestId,
        client_id: clientId,
        form_responses: formResponses ?? {},
        images: Array.isArray(images) ? images : [],
        status: "new",
      });
    if (reqErr) throw reqErr;

    // Record successful attempt for rate limiting
    await supabase.from("booking_attempts").insert({
      ip_hash: ipHash,
      link_key: "booking-request",
      success: true,
    });

    // Fire-and-forget admin notification email
    try {
      const { data: site } = await supabase
        .from("site_settings")
        .select("email, site_name")
        .single();
      const adminEmail = site?.email;
      if (adminEmail) {
        const projectUrl = Deno.env.get("SUPABASE_URL")!;
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
        const safeName = cleanName.replace(/[<>&]/g, "");
        const safeEmail = cleanEmail.replace(/[<>&]/g, "");
        const safePhone = (cleanPhone ?? "").replace(/[<>&]/g, "");
        const notes = typeof formResponses === "object" && formResponses
          ? Object.entries(formResponses).map(([k, v]) =>
              `<p><strong>${String(k).replace(/[<>&]/g, "")}:</strong> ${String(v ?? "").replace(/[<>&]/g, "").slice(0, 500)}</p>`
            ).join("")
          : "";
        const html = `
          <h2>New booking request</h2>
          <p><strong>Name:</strong> ${safeName}</p>
          <p><strong>Email:</strong> ${safeEmail}</p>
          ${safePhone ? `<p><strong>Phone:</strong> ${safePhone}</p>` : ""}
          ${notes}
          <p style="margin-top:24px;"><a href="https://pokeeeeeeeoh.com/admin/dashboard">Review in admin →</a></p>
        `;
        fetch(`${projectUrl}/functions/v1/send-template-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
          body: JSON.stringify({
            to: adminEmail,
            subjectOverride: `New booking request from ${cleanName}`,
            htmlOverride: html,
            bookingRequestId,
          }),
        }).catch((e) => console.warn("admin notify failed", e));
      }
    } catch (e) {
      console.warn("admin notify error", e);
    }


    return new Response(JSON.stringify({ success: true, bookingRequestId, clientId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("submit-booking-request error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
