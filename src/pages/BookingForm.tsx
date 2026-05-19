import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, UploadCloud, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUiText } from "@/hooks/useUiText";
import GdprNotice from "@/components/GdprNotice";

interface FormField {
  id: string;
  type: "text" | "longtext" | "dropdown" | "checkbox";
  label: string;
  required: boolean;
  options?: string[];
}

type ContactKey = "name" | "email" | "phone";
interface ContactFieldConfig {
  label: string;
  required: boolean;
  enabled: boolean;
}
type ContactFields = Record<ContactKey, ContactFieldConfig>;

const DEFAULT_CONTACT_FIELDS: ContactFields = {
  name: { label: "Name", required: true, enabled: true },
  email: { label: "Email", required: true, enabled: true },
  phone: { label: "Phone", required: false, enabled: true },
};

const BookingForm = () => {
  const t = useUiText();
  const [fields, setFields] = useState<FormField[]>([]);
  const [contactFields, setContactFields] = useState<ContactFields>(DEFAULT_CONTACT_FIELDS);
  const [formData, setFormData] = useState<Record<string, string | boolean>>({});
  const [clientInfo, setClientInfo] = useState({ name: "", email: "", phone: "" });
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchConfig() {
      const { data } = await supabase
        .from("form_config")
        .select("fields, contact_fields")
        .single();

      if (data?.fields) {
        const parsedFields = typeof data.fields === 'string'
          ? JSON.parse(data.fields)
          : data.fields;
        setFields(parsedFields as FormField[]);
      }
      if ((data as any)?.contact_fields) {
        const raw = (data as any).contact_fields;
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        setContactFields({ ...DEFAULT_CONTACT_FIELDS, ...(parsed || {}) });
      }
      setLoading(false);
    }
    fetchConfig();
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif'];
      return validTypes.includes(file.type) && file.size <= 10 * 1024 * 1024;
    });

    if (validFiles.length !== files.length) {
      toast.error("Some files were skipped. Only JPG, PNG, WEBP, HEIC, HEIF, GIF under 10MB allowed.");
    }

    setImages(prev => [...prev, ...validFiles]);
    
    validFiles.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setImagePreviews(prev => [...prev, e.target?.result as string]);
        };
        reader.readAsDataURL(file);
      } else {
        setImagePreviews(prev => [...prev, '/placeholder.svg']);
      }
    });
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!clientInfo.name || !clientInfo.email) {
      toast.error("Please fill in your name and email.");
      return;
    }
    if (contactFields.phone.enabled && contactFields.phone.required && !clientInfo.phone) {
      toast.error(`Please fill in your ${contactFields.phone.label.toLowerCase()}.`);
      return;
    }

    setSubmitting(true);

    try {
      // Upload images first to the private bucket (anon allowed). Use a temp folder
      // keyed by email so paths are stable before we have a client id.
      const tempKey = `pending/${clientInfo.email.toLowerCase().replace(/[^a-z0-9]/g, "_")}-${Date.now()}`;
      const imageUrls: string[] = [];
      for (const [idx, image] of images.entries()) {
        // Sanitise the client-supplied filename to prevent path traversal /
        // weird characters from polluting storage paths.
        const rawName = (image.name || "upload").split(/[\\/]/).pop() || "upload";
        const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
        const fileName = `${tempKey}/${Date.now()}_${idx}_${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("booking-images")
          .upload(fileName, image);
        if (uploadError) throw uploadError;
        imageUrls.push(fileName);
      }

      // Submit booking request through rate-limited edge function
      const { data: result, error: fnError } = await supabase.functions.invoke(
        "submit-booking-request",
        {
          body: {
            name: clientInfo.name,
            email: clientInfo.email,
            phone: clientInfo.phone,
            formResponses: formData,
            images: imageUrls,
          },
        },
      );

      if (fnError || (result as any)?.error) {
        const msg = (result as any)?.error || fnError?.message || "Please try again.";
        throw new Error(msg);
      }

      const bookingRequestId = (result as any).bookingRequestId as string;

      // Send confirmation email to client + notification to admin (fire and forget)
      supabase.functions.invoke("send-booking-confirmation", {
        body: {
          to: clientInfo.email,
          name: clientInfo.name,
          adminEmail: "jakehaynes@gmail.com",
          bookingRequestId,
        },
      }).catch((e) => console.error("Email send failed:", e));

      navigate("/book/confirmation");

    } catch (error: any) {
      console.error("Submission error:", error);
      toast.error(`Failed to submit: ${error?.message || "Please try again."}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading form...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center px-4">
          <Link 
            to="/book" 
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
            Back
          </Link>
          <span className="mx-auto font-mono text-sm tracking-widest uppercase">
            Booking Request
          </span>
          <div className="w-16" />
        </div>
      </header>

      {/* Form */}
      <main className="pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-2xl">
          <div className="mb-8 animate-fade-in">
            <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase mb-2">
              {t("form_step", "Step 2 of 2")}
            </p>
            <h1 className="text-3xl font-bold tracking-tight mb-2">
              {t("form_title", "Tell Us About Your Idea")}
            </h1>
            <p className="text-muted-foreground">
              {t("form_subtitle", "Fill out the form below with details about your tattoo concept.")}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Contact Info */}
            <section className="space-y-4 animate-fade-in stagger-1">
              <h2 className="text-lg font-semibold border-b border-border pb-2">
                {t("form_contact_heading", "Contact Information")}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    {contactFields.name.label} {contactFields.name.required && "*"}
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    autoComplete="name"
                    value={clientInfo.name}
                    onChange={(e) => setClientInfo(prev => ({ ...prev, name: e.target.value }))}
                    required={contactFields.name.required}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">
                    {contactFields.email.label} {contactFields.email.required && "*"}
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={clientInfo.email}
                    onChange={(e) => setClientInfo(prev => ({ ...prev, email: e.target.value }))}
                    required={contactFields.email.required}
                  />
                </div>
                {contactFields.phone.enabled && (
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="phone">
                      {contactFields.phone.label}{" "}
                      {contactFields.phone.required ? "*" : (
                        <span className="text-muted-foreground font-normal">(optional)</span>
                      )}
                    </Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      value={clientInfo.phone}
                      onChange={(e) => setClientInfo(prev => ({ ...prev, phone: e.target.value }))}
                      required={contactFields.phone.required}
                    />
                  </div>
                )}
              </div>
            </section>

            {/* Dynamic Fields */}
            <section className="space-y-4 animate-fade-in stagger-2">
              <h2 className="text-lg font-semibold border-b border-border pb-2">
                {t("form_details_heading", "Tattoo Details")}
              </h2>
              <div className="space-y-6">
                {fields.map((field) => (
                  <div key={field.id} className="space-y-2">
                    <Label htmlFor={field.id}>
                      {field.label} {field.required && "*"}
                    </Label>
                    
                    {field.type === "text" && (
                      <Input
                        id={field.id}
                        value={(formData[field.id] as string) || ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, [field.id]: e.target.value }))}
                        required={field.required}
                      />
                    )}
                    
                    {field.type === "longtext" && (
                      <Textarea
                        id={field.id}
                        value={(formData[field.id] as string) || ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, [field.id]: e.target.value }))}
                        rows={4}
                        required={field.required}
                      />
                    )}
                    
                    {field.type === "dropdown" && field.options && (
                      <Select
                        value={(formData[field.id] as string) || ""}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, [field.id]: value }))}
                        required={field.required}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select an option" />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options.filter((o) => o.trim()).map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    
                    {field.type === "checkbox" && (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={field.id}
                          checked={(formData[field.id] as boolean) || false}
                          onCheckedChange={(checked) => 
                            setFormData(prev => ({ ...prev, [field.id]: checked as boolean }))
                          }
                        />
                        <label 
                          htmlFor={field.id} 
                          className="text-sm text-muted-foreground cursor-pointer"
                        >
                          Yes
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Image Upload */}
            <section className="space-y-4 animate-fade-in stagger-3">
              <h2 className="text-lg font-semibold border-b border-border pb-2 flex items-center gap-2">
                {t("form_images_heading", "Reference Images")}
                <span className="text-xs font-normal text-muted-foreground">(optional)</span>
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("form_images_subtitle", "Upload reference images, inspiration, or sketches of your idea. You can skip this and submit without images.")}
              </p>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-border bg-card">
                    <img
                      src={preview}
                      alt={`Reference ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-2 right-2 p-1 rounded-full bg-background/80 hover:bg-background transition-colors"
                    >
                      <X className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                  </div>
                ))}
                
                <label className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center cursor-pointer transition-colors bg-card/50">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-2">
                    <UploadCloud className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                  <span className="text-xs text-muted-foreground">Add Image</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/gif"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </section>

            {/* Submit */}
            <div className="pt-4">
              <Button 
                type="submit" 
                size="lg" 
                className="w-full"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  t("form_submit", "Submit Booking Request")
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground mt-4">
                {t("form_submit_disclaimer", "By submitting, you agree to our booking policies. Your request will be reviewed within 24-48 hours.")}
              </p>
              <GdprNotice className="text-center mt-3" />
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default BookingForm;
