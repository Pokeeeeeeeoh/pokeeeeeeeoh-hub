// Shared helper for transactional sends that use HTML rendered from the
// admin-editable `email_templates` table. Routes through Lovable Email queue.
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

export const SITE_NAME = "pokeeeeeeeoh";
export const SENDER_DOMAIN = "notify.pokeeeeeeeoh.com";
export const FROM_DOMAIN = "notify.pokeeeeeeeoh.com";

export function getSupabase(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

// Strip HTML tags as a basic plaintext fallback.
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>(\s*)/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface EnqueueParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  templateLabel: string;       // for logs (e.g. "approval", "booking_confirmation_client")
  idempotencyKey: string;      // unique per logical send event
  bookingRequestId?: string | null;
}

export interface EnqueueResult {
  ok: boolean;
  status: "sent" | "failed" | "suppressed";
  messageId: string;
  error?: string;
}

export async function enqueueTransactionalEmail(
  sb: SupabaseClient,
  p: EnqueueParams,
): Promise<EnqueueResult> {
  const messageId = crypto.randomUUID();
  const normalizedEmail = p.to.toLowerCase().trim();

  // 1. Suppression check
  const { data: suppressed } = await sb
    .from("suppressed_emails")
    .select("email")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (suppressed) {
    await sb.from("email_log").insert({
      template_key: p.templateLabel,
      recipient: p.to,
      subject: p.subject,
      status: "suppressed",
      error_message: "Recipient is on the suppression list",
      booking_request_id: p.bookingRequestId ?? null,
    });
    return { ok: false, status: "suppressed", messageId, error: "suppressed" };
  }

  // 2. Ensure an unsubscribe token exists for this address (one per email)
  let unsubscribeToken: string | null = null;
  const { data: existing } = await sb
    .from("email_unsubscribe_tokens")
    .select("token, used_at")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (existing && !existing.used_at) {
    unsubscribeToken = existing.token;
  } else if (!existing) {
    unsubscribeToken = crypto.randomUUID().replace(/-/g, "") +
      crypto.randomUUID().replace(/-/g, "");
    await sb.from("email_unsubscribe_tokens").upsert(
      { token: unsubscribeToken, email: normalizedEmail },
      { onConflict: "email", ignoreDuplicates: true },
    );
    const { data: stored } = await sb
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", normalizedEmail)
      .maybeSingle();
    unsubscribeToken = stored?.token ?? unsubscribeToken;
  }

  // 3. Pending log (Lovable's table + project's email_log)
  await sb.from("email_send_log").insert({
    message_id: messageId,
    template_name: p.templateLabel,
    recipient_email: p.to,
    status: "pending",
  });

  // 4. Enqueue
  const { error: enqueueError } = await sb.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId,
      to: p.to,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: p.subject,
      html: p.html,
      text: p.text ?? htmlToText(p.html),
      purpose: "transactional",
      label: p.templateLabel,
      idempotency_key: p.idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  });

  if (enqueueError) {
    await sb.from("email_send_log").insert({
      message_id: messageId,
      template_name: p.templateLabel,
      recipient_email: p.to,
      status: "failed",
      error_message: enqueueError.message,
    });
    await sb.from("email_log").insert({
      template_key: p.templateLabel,
      recipient: p.to,
      subject: p.subject,
      status: "failed",
      error_message: enqueueError.message,
      booking_request_id: p.bookingRequestId ?? null,
    });
    return {
      ok: false,
      status: "failed",
      messageId,
      error: enqueueError.message,
    };
  }

  // Mirror to project's email_log so admin AdminEmails page still works.
  await sb.from("email_log").insert({
    template_key: p.templateLabel,
    recipient: p.to,
    subject: p.subject,
    status: "sent",
    booking_request_id: p.bookingRequestId ?? null,
  });

  return { ok: true, status: "sent", messageId };
}
