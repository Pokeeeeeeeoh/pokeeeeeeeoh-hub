import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Save,
  FileText,
  Home,
  ListChecks,
  Plus,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

interface FormField {
  id: string;
  type: "text" | "longtext" | "dropdown" | "checkbox";
  label: string;
  required: boolean;
  options?: string[];
}

interface SiteSettings {
  id: string;
  site_name: string;
  tagline: string;
  email: string;
  address: string;
}

const AdminSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Site settings state
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({
    id: "",
    site_name: "",
    tagline: "",
    email: "",
    address: "",
  });

  // Form config state
  const [infoContent, setInfoContent] = useState("");
  const [fields, setFields] = useState<FormField[]>([]);

  // New field state
  const [newFieldType, setNewFieldType] = useState<FormField["type"]>("text");

  useEffect(() => {
    fetchAllConfig();
  }, []);

  const fetchAllConfig = async () => {
    const [siteRes, formRes] = await Promise.all([
      supabase.from("site_settings").select("*").single(),
      supabase.from("form_config").select("*").single(),
    ]);

    if (siteRes.data) {
      setSiteSettings(siteRes.data);
    }

    if (formRes.data) {
      setInfoContent(formRes.data.info_content || "");
      const parsedFields =
        typeof formRes.data.fields === "string"
          ? JSON.parse(formRes.data.fields)
          : formRes.data.fields;
      setFields(parsedFields || []);
    }

    setLoading(false);
  };

  const handleSaveSiteSettings = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("site_settings")
        .update({
          site_name: siteSettings.site_name,
          tagline: siteSettings.tagline,
          email: siteSettings.email,
          address: siteSettings.address,
        })
        .eq("id", siteSettings.id);

      if (error) throw error;
      toast.success("Homepage settings saved");
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFormConfig = async () => {
    setSaving(true);
    try {
      const { data: existingConfig } = await supabase
        .from("form_config")
        .select("id")
        .single();

      if (existingConfig) {
        await supabase
          .from("form_config")
          .update({
            info_content: infoContent,
            fields: JSON.parse(JSON.stringify(fields)),
          })
          .eq("id", existingConfig.id);
      }

      toast.success("Form settings saved");
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const addField = () => {
    const newField: FormField = {
      id: `field_${Date.now()}`,
      type: newFieldType,
      label: "New Question",
      required: false,
      options: newFieldType === "dropdown" ? ["Option 1", "Option 2"] : undefined,
    };
    setFields([...fields, newField]);
  };

  const updateField = (index: number, updates: Partial<FormField>) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], ...updates };
    setFields(newFields);
  };

  const deleteField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const moveField = (index: number, direction: "up" | "down") => {
    const newFields = [...fields];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;
    [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
    setFields(newFields);
  };

  const updateFieldOptions = (index: number, optionsText: string) => {
    const options = optionsText.split("\n").filter((o) => o.trim());
    updateField(index, { options });
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse text-muted-foreground">
            Loading settings...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Customize your homepage, booking form, and content
          </p>
        </div>

        <Tabs defaultValue="homepage" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="homepage" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Homepage</span>
            </TabsTrigger>
            <TabsTrigger value="form" className="flex items-center gap-2">
              <ListChecks className="h-4 w-4" />
              <span className="hidden sm:inline">Form Fields</span>
            </TabsTrigger>
            <TabsTrigger value="content" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Booking Info</span>
            </TabsTrigger>
          </TabsList>

          {/* Homepage Settings */}
          <TabsContent value="homepage" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Homepage Content</CardTitle>
                <CardDescription>
                  Edit the text displayed on your public homepage
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="site_name">Site Name / Title</Label>
                  <Input
                    id="site_name"
                    value={siteSettings.site_name}
                    onChange={(e) =>
                      setSiteSettings((prev) => ({
                        ...prev,
                        site_name: e.target.value,
                      }))
                    }
                    placeholder="Your name or brand"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tagline">Tagline</Label>
                  <Input
                    id="tagline"
                    value={siteSettings.tagline}
                    onChange={(e) =>
                      setSiteSettings((prev) => ({
                        ...prev,
                        tagline: e.target.value,
                      }))
                    }
                    placeholder="A short description"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Contact Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={siteSettings.email}
                    onChange={(e) =>
                      setSiteSettings((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    placeholder="your@email.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address / Location</Label>
                  <Input
                    id="address"
                    value={siteSettings.address}
                    onChange={(e) =>
                      setSiteSettings((prev) => ({
                        ...prev,
                        address: e.target.value,
                      }))
                    }
                    placeholder="Studio name · Street · City"
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleSaveSiteSettings} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save Homepage"}
              </Button>
            </div>
          </TabsContent>

          {/* Form Builder */}
          <TabsContent value="form" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Booking Form Questions</CardTitle>
                <CardDescription>
                  Add, edit, or remove questions on the booking form. Toggle required fields.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {fields.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                    No questions yet. Add one below!
                  </div>
                ) : (
                  <div className="space-y-4">
                    {fields.map((field, index) => (
                      <div
                        key={field.id}
                        className="border border-border rounded-lg p-4 bg-card"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex flex-col gap-1 pt-2">
                            <button
                              onClick={() => moveField(index, "up")}
                              disabled={index === 0}
                              className="p-1 hover:bg-secondary rounded disabled:opacity-30"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </button>
                            <GripVertical className="h-4 w-4 text-muted-foreground mx-auto" />
                            <button
                              onClick={() => moveField(index, "down")}
                              disabled={index === fields.length - 1}
                              className="p-1 hover:bg-secondary rounded disabled:opacity-30"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="flex-1 space-y-3">
                            <div className="flex flex-wrap gap-3">
                              <div className="flex-1 min-w-[200px]">
                                <Label className="text-xs text-muted-foreground">
                                  Question Label
                                </Label>
                                <Input
                                  value={field.label}
                                  onChange={(e) =>
                                    updateField(index, { label: e.target.value })
                                  }
                                  placeholder="Enter question"
                                />
                              </div>
                              <div className="w-32">
                                <Label className="text-xs text-muted-foreground">
                                  Type
                                </Label>
                                <Select
                                  value={field.type}
                                  onValueChange={(v: FormField["type"]) =>
                                    updateField(index, {
                                      type: v,
                                      options:
                                        v === "dropdown"
                                          ? ["Option 1", "Option 2"]
                                          : undefined,
                                    })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="text">Short Text</SelectItem>
                                    <SelectItem value="longtext">Long Text</SelectItem>
                                    <SelectItem value="dropdown">Dropdown</SelectItem>
                                    <SelectItem value="checkbox">Checkbox</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {field.type === "dropdown" && (
                              <div>
                                <Label className="text-xs text-muted-foreground">
                                  Options (one per line)
                                </Label>
                                <Textarea
                                  value={field.options?.join("\n") || ""}
                                  onChange={(e) =>
                                    updateFieldOptions(index, e.target.value)
                                  }
                                  rows={3}
                                  placeholder="Option 1&#10;Option 2&#10;Option 3"
                                  className="font-mono text-sm"
                                />
                              </div>
                            )}

                            <div className="flex items-center justify-between pt-2">
                              <div className="flex items-center gap-2">
                                <Switch
                                  id={`required-${field.id}`}
                                  checked={field.required}
                                  onCheckedChange={(checked) =>
                                    updateField(index, { required: checked })
                                  }
                                />
                                <Label
                                  htmlFor={`required-${field.id}`}
                                  className="text-sm cursor-pointer"
                                >
                                  Required
                                </Label>
                              </div>

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Delete
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete this question?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will remove "{field.label}" from your booking form.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteField(index)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add New Field */}
                <div className="flex gap-2 pt-4 border-t border-border">
                  <Select
                    value={newFieldType}
                    onValueChange={(v: FormField["type"]) => setNewFieldType(v)}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Short Text</SelectItem>
                      <SelectItem value="longtext">Long Text</SelectItem>
                      <SelectItem value="dropdown">Dropdown</SelectItem>
                      <SelectItem value="checkbox">Checkbox</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={addField}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Question
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleSaveFormConfig} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save Form"}
              </Button>
            </div>
          </TabsContent>

          {/* Booking Information Content */}
          <TabsContent value="content" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Booking Information</CardTitle>
                <CardDescription>
                  This content is displayed to clients before they fill out the booking form.
                  Supports Markdown formatting.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={infoContent}
                  onChange={(e) => setInfoContent(e.target.value)}
                  rows={25}
                  className="font-mono text-sm"
                  placeholder="# Booking Information&#10;&#10;Write your policies, pricing, and preparation info here using Markdown..."
                />
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={handleSaveFormConfig} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save Content"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminSettings;