// Shared caller authorization for internal / admin-only edge functions.
// Allows either:
//   1. A trusted server-side caller presenting the service-role key
//      (Authorization: Bearer <service_role> or X-Internal-Service-Key), or
//   2. A signed-in admin user (JWT that maps to a row in public.admin_users).
// Everyone else (including anyone holding the public anon key) is rejected.
import { createClient } from "npm:@supabase/supabase-js@2";

function bearer(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export function isServiceRoleCaller(req: Request): boolean {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!serviceKey) return false;
  const internal = req.headers.get("x-internal-service-key");
  return bearer(req) === serviceKey || internal === serviceKey;
}

export async function isAdminCaller(req: Request): Promise<boolean> {
  const token = bearer(req);
  if (!token) return false;
  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data?.user) return false;
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: isAdmin } = await admin.rpc("is_admin", {
      _user_id: data.user.id,
    });
    return isAdmin === true;
  } catch (_e) {
    return false;
  }
}

/**
 * Returns a 403 Response when the caller is neither an internal service-role
 * caller nor a signed-in admin. Returns null when the call may proceed.
 */
export async function requireInternalOrAdmin(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  if (isServiceRoleCaller(req)) return null;
  if (await isAdminCaller(req)) return null;
  return new Response(JSON.stringify({ error: "Forbidden" }), {
    status: 403,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
