import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_FILES = 10;
const MAX_REQUESTS_PER_HOUR = 6;

const ALLOWED_EXT = new Set([
  "jpg", "jpeg", "png", "webp", "heic", "heif", "gif",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { filenames } = await req.json();
    if (!Array.isArray(filenames) || filenames.length === 0) {
      return new Response(JSON.stringify({ error: "filenames required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (filenames.length > MAX_FILES) {
      return new Response(
        JSON.stringify({ error: `Maximum ${MAX_FILES} files per request` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Rate limit by hashed IP
    const rawIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("cf-connecting-ip")
      || "unknown";
    const ipBytes = new TextEncoder().encode(rawIp + "|upload-url|pokeeeeeeeoh");
    const hashBuf = await crypto.subtle.digest("SHA-256", ipBytes);
    const ipHash = Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, "0")).join("");

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("booking_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .eq("link_key", "upload-url")
      .gte("created_at", oneHourAgo);

    if ((count ?? 0) >= MAX_REQUESTS_PER_HOUR) {
      return new Response(
        JSON.stringify({ error: "Too many upload requests, try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const folder = crypto.randomUUID();
    const results: Array<{ path: string; token: string; signedUrl: string }> = [];

    for (const [idx, raw] of (filenames as unknown[]).entries()) {
      const rawName = String(raw || "upload").split(/[\\/]/).pop() || "upload";
      const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
      const ext = (safeName.split(".").pop() || "").toLowerCase();
      if (!ALLOWED_EXT.has(ext)) {
        return new Response(
          JSON.stringify({ error: `Unsupported file type: .${ext}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const path = `${folder}/${Date.now()}_${idx}_${safeName}`;
      const { data, error } = await supabase.storage
        .from("booking-images")
        .createSignedUploadUrl(path);
      if (error || !data) throw error ?? new Error("Failed to create signed URL");
      results.push({ path, token: data.token, signedUrl: data.signedUrl });
    }

    await supabase.from("booking_attempts").insert({
      ip_hash: ipHash,
      link_key: "upload-url",
      success: true,
    });

    return new Response(JSON.stringify({ uploads: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("get-booking-upload-urls error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
