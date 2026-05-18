import { supabase } from "@/integrations/supabase/client";

const BUCKET = "booking-images";

/** Extract the storage path from either a stored full URL or a raw path. */
export function extractBookingImagePath(value: string): string {
  if (!value) return value;
  const marker = `/${BUCKET}/`;
  const idx = value.indexOf(marker);
  if (idx >= 0) return value.slice(idx + marker.length);
  return value;
}

/** Create a short-lived signed URL for an admin to view a booking image. */
export async function getBookingImageSignedUrl(
  value: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const path = extractBookingImagePath(value);
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) return null;
  return data?.signedUrl ?? null;
}
