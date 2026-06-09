import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, RefreshCw, Link as LinkIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function randomKey(bytes = 24): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function BookingLinkPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [key, setKey] = useState<string>("");
  const [rowId, setRowId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("admin_settings")
        .select("id, booking_link_key")
        .limit(1)
        .maybeSingle();
      if (error) {
        toast.error("Could not load booking link");
      } else if (data) {
        setRowId(data.id);
        setKey((data as any).booking_link_key ?? "");
      }
      setLoading(false);
    })();
  }, []);

  const PUBLIC_SITE_ORIGIN = "https://pokeeeeeeeoh.com";
  const fullUrl = key ? `${PUBLIC_SITE_ORIGIN}/select-slot?key=${key}` : "";

  const regenerate = async () => {
    if (!rowId) return;
    setSaving(true);
    const newKey = randomKey();
    const { error } = await supabase
      .from("admin_settings")
      .update({ booking_link_key: newKey })
      .eq("id", rowId);
    setSaving(false);
    if (error) {
      toast.error("Could not regenerate link");
      return;
    }
    setKey(newKey);
    toast.success("New booking link generated. The old one no longer works.");
  };

  const copy = async () => {
    if (!fullUrl) return;
    await navigator.clipboard.writeText(fullUrl);
    toast.success("Link copied to clipboard");
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LinkIcon className="h-5 w-5" />
          Private Booking Link
        </CardTitle>
        <CardDescription>
          A stable, secret link to share with clients who can skip the booking request process and go straight to picking a slot.
          The link is not shown anywhere on the public site. Anyone with the link can book — share it carefully.
          Bookings are rate-limited (max 3 per hour per network) to prevent abuse.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Your link</label>
          <div className="flex gap-2">
            <Input value={fullUrl} readOnly className="font-mono text-xs" />
            <Button onClick={copy} variant="outline" size="icon" aria-label="Copy link">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Anyone with this link can book one of your open slots. Use the button below if it leaks.
          </p>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={saving}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerate link
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Regenerate booking link?</AlertDialogTitle>
              <AlertDialogDescription>
                The current link will stop working immediately. Anyone you've already shared it with will need the new one.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={regenerate}>Regenerate</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
