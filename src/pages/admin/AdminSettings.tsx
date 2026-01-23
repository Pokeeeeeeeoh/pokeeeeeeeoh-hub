import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Save, FileText } from "lucide-react";

const AdminSettings = () => {
  const [infoContent, setInfoContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    const { data, error } = await supabase
      .from("form_config")
      .select("*")
      .single();

    if (error) {
      console.error("Error fetching config:", error);
    } else if (data) {
      setInfoContent(data.info_content || "");
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: existingConfig } = await supabase
        .from("form_config")
        .select("id")
        .single();

      if (existingConfig) {
        await supabase
          .from("form_config")
          .update({ info_content: infoContent })
          .eq("id", existingConfig.id);
      }

      toast.success("Settings saved");
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="max-w-3xl mx-auto">
          <div className="animate-pulse text-muted-foreground">
            Loading settings...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Configure your booking system
          </p>
        </div>

        <div className="space-y-8">
          {/* Booking Information */}
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Booking Information</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              This content is displayed to clients before they fill out the
              booking form. Supports Markdown formatting.
            </p>
            <div className="space-y-2">
              <Label>Information Content (Markdown)</Label>
              <Textarea
                value={infoContent}
                onChange={(e) => setInfoContent(e.target.value)}
                rows={20}
                className="font-mono text-sm"
                placeholder="# Booking Information

Write your policies, pricing, and preparation info here using Markdown..."
              />
            </div>
          </section>

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t border-border">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
