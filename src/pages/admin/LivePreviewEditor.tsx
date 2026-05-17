import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Check, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface UiTextRow {
  id: string;
  key: string;
  label: string;
  value: string;
  category: string;
}
interface SiteSettings {
  id: string;
  site_name: string;
  tagline: string;
  email: string;
  address: string;
}

type SaveStatus = "idle" | "saving" | "saved";

interface EditableProps {
  value: string;
  onChange: (next: string) => void;
  multiline?: boolean;
  className?: string;
  hint?: string;
  as?: keyof JSX.IntrinsicElements;
}

const Editable = ({
  value,
  onChange,
  multiline,
  className,
  hint,
  as: Tag = "span",
}: EditableProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if ("select" in inputRef.current) inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onChange(draft);
  };

  if (editing) {
    return multiline ? (
      <Textarea
        ref={inputRef as any}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        rows={Math.max(3, Math.min(12, draft.split("\n").length + 1))}
        className={cn("w-full font-sans", className)}
      />
    ) : (
      <Input
        ref={inputRef as any}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className={cn("h-auto py-1 px-2", className)}
      />
    );
  }

  return (
    <Tag
      onClick={() => setEditing(true)}
      title={hint || "Click to edit"}
      className={cn(
        "group relative cursor-text rounded-sm transition-colors",
        "hover:bg-primary/5 hover:outline hover:outline-1 hover:outline-dashed hover:outline-primary/40",
        "px-1 -mx-1",
        !value && "text-muted-foreground/60 italic",
        className
      )}
    >
      {value || "(empty — click to edit)"}
      <Pencil className="inline-block h-3 w-3 ml-1 opacity-0 group-hover:opacity-60 align-baseline" />
    </Tag>
  );
};

interface Props {
  uiTexts: UiTextRow[];
  setUiTexts: React.Dispatch<React.SetStateAction<UiTextRow[]>>;
  siteSettings: SiteSettings;
  setSiteSettings: React.Dispatch<React.SetStateAction<SiteSettings>>;
  infoContent: string;
  setInfoContent: (v: string) => void;
}

const STEPS = [
  { key: "home", label: "Homepage" },
  { key: "info", label: "Booking Info" },
  { key: "form", label: "Booking Form" },
  { key: "slot", label: "Select Slot" },
  { key: "confirm", label: "Confirmation" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

export default function LivePreviewEditor({
  uiTexts,
  setUiTexts,
  siteSettings,
  setSiteSettings,
  infoContent,
  setInfoContent,
}: Props) {
  const [step, setStep] = useState<StepKey>("home");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const dirtyRef = useRef<Set<string>>(new Set());
  const dirtySiteRef = useRef(false);

  const byKey = useMemo(() => {
    const m: Record<string, UiTextRow> = {};
    uiTexts.forEach((u) => (m[u.key] = u));
    return m;
  }, [uiTexts]);

  // Debounced autosave for ui_text and site_settings
  useEffect(() => {
    if (dirtyRef.current.size === 0 && !dirtySiteRef.current) return;
    setStatus("saving");
    const handle = setTimeout(async () => {
      try {
        const keys = Array.from(dirtyRef.current);
        dirtyRef.current.clear();
        const rows = keys
          .map((k) => byKey[k])
          .filter(Boolean);

        const results = await Promise.all([
          ...rows.map((r) =>
            supabase.from("ui_text").update({ value: r.value }).eq("id", r.id).select("id")
          ),
          dirtySiteRef.current
            ? supabase
                .from("site_settings")
                .update({
                  site_name: siteSettings.site_name,
                  tagline: siteSettings.tagline,
                  email: siteSettings.email,
                  address: siteSettings.address,
                })
                .eq("id", siteSettings.id)
                .select("id")
            : Promise.resolve({ error: null, data: [{ id: "noop" }] } as any),
        ]);
        dirtySiteRef.current = false;
        const failed = results.find((r: any) => r.error);
        if (failed?.error) throw failed.error;
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 1200);
      } catch (err: any) {
        console.error("Live edit save failed:", err);
        toast.error(err?.message || "Failed to save");
        setStatus("idle");
      }
    }, 600);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiTexts, siteSettings]);

  const updateText = (key: string, next: string) => {
    setUiTexts((prev) =>
      prev.map((u) => (u.key === key ? { ...u, value: next } : u))
    );
    dirtyRef.current.add(key);
  };

  const updateSite = (patch: Partial<SiteSettings>) => {
    setSiteSettings((prev) => ({ ...prev, ...patch }));
    dirtySiteRef.current = true;
  };

  const t = (key: string, fallback = "") => byKey[key]?.value ?? fallback;

  // Render simplified mirrors of each step
  const renderHome = () => (
    <div className="rounded-md border border-border bg-background p-8 space-y-6">
      <div className="text-center space-y-3">
        <Editable
          as="h1"
          className="block text-4xl font-bold tracking-tight"
          value={siteSettings.site_name}
          onChange={(v) => updateSite({ site_name: v })}
        />
        <Editable
          as="p"
          className="block text-base text-muted-foreground"
          value={siteSettings.tagline}
          onChange={(v) => updateSite({ tagline: v })}
        />
        <div className="text-sm text-muted-foreground pt-2 space-y-1">
          <Editable
            as="div"
            value={siteSettings.address}
            onChange={(v) => updateSite({ address: v })}
          />
          <Editable
            as="div"
            value={siteSettings.email}
            onChange={(v) => updateSite({ email: v })}
          />
        </div>
      </div>
    </div>
  );

  const renderInfo = () => (
    <div className="rounded-md border border-border bg-background p-8 space-y-6">
      <div>
        <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase mb-2">
          <Editable value={t("booking_info_step")} onChange={(v) => updateText("booking_info_step", v)} />
        </p>
        <Editable
          as="h1"
          className="block text-3xl font-bold tracking-tight mb-2"
          value={t("booking_info_title")}
          onChange={(v) => updateText("booking_info_title", v)}
        />
        <Editable
          as="p"
          className="block text-muted-foreground"
          value={t("booking_info_subtitle")}
          onChange={(v) => updateText("booking_info_subtitle", v)}
        />
      </div>
      <div className="space-y-2">
        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Booking information (Markdown)
        </div>
        <Editable
          multiline
          value={infoContent}
          onChange={setInfoContent}
          className="block text-sm whitespace-pre-wrap"
        />
      </div>
      <div className="space-y-3 pt-2">
        <div className="flex items-start gap-2">
          <div className="h-4 w-4 mt-0.5 rounded border border-border" />
          <Editable
            value={t("booking_info_acknowledge")}
            onChange={(v) => updateText("booking_info_acknowledge", v)}
            className="text-sm"
          />
        </div>
        <Button disabled className="opacity-90">
          <Editable value={t("booking_info_continue")} onChange={(v) => updateText("booking_info_continue", v)} />
        </Button>
      </div>
    </div>
  );

  const renderForm = () => (
    <div className="rounded-md border border-border bg-background p-8 space-y-6">
      <div>
        <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase mb-2">
          <Editable value={t("form_step")} onChange={(v) => updateText("form_step", v)} />
        </p>
        <Editable
          as="h1"
          className="block text-3xl font-bold tracking-tight mb-2"
          value={t("form_title")}
          onChange={(v) => updateText("form_title", v)}
        />
        <Editable
          as="p"
          className="block text-muted-foreground"
          value={t("form_subtitle")}
          onChange={(v) => updateText("form_subtitle", v)}
        />
      </div>

      <div className="space-y-2">
        <Editable
          as="h2"
          className="block text-lg font-semibold border-b border-border pb-2"
          value={t("form_contact_heading")}
          onChange={(v) => updateText("form_contact_heading", v)}
        />
        <p className="text-xs text-muted-foreground">
          (Contact field labels live in the Form Fields tab)
        </p>
      </div>

      <div className="space-y-2">
        <Editable
          as="h2"
          className="block text-lg font-semibold border-b border-border pb-2"
          value={t("form_details_heading")}
          onChange={(v) => updateText("form_details_heading", v)}
        />
        <p className="text-xs text-muted-foreground">
          (Questions live in the Form Fields tab)
        </p>
      </div>

      <div className="space-y-2">
        <Editable
          as="h2"
          className="block text-lg font-semibold border-b border-border pb-2"
          value={t("form_images_heading")}
          onChange={(v) => updateText("form_images_heading", v)}
        />
        <Editable
          as="p"
          className="block text-sm text-muted-foreground"
          value={t("form_images_subtitle")}
          onChange={(v) => updateText("form_images_subtitle", v)}
        />
      </div>

      <div className="pt-2 space-y-3">
        <Button disabled className="w-full opacity-90">
          <Editable value={t("form_submit")} onChange={(v) => updateText("form_submit", v)} />
        </Button>
        <Editable
          as="p"
          className="block text-xs text-center text-muted-foreground"
          value={t("form_submit_disclaimer")}
          onChange={(v) => updateText("form_submit_disclaimer", v)}
        />
      </div>
    </div>
  );

  const renderSlot = () => (
    <div className="rounded-md border border-border bg-background p-8 space-y-4">
      <Editable
        as="h1"
        className="block text-3xl font-bold tracking-tight"
        value={t("slot_title")}
        onChange={(v) => updateText("slot_title", v)}
      />
      <Editable
        as="p"
        className="block text-muted-foreground"
        value={t("slot_subtitle")}
        onChange={(v) => updateText("slot_subtitle", v)}
      />
      <div className="grid gap-2 sm:grid-cols-2 pt-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="border border-border rounded-md p-3 text-sm text-muted-foreground">
            (Example slot {i})
          </div>
        ))}
      </div>
      <div className="border-t border-border pt-6 mt-4 space-y-2">
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          After booking
        </p>
        <Editable
          as="h2"
          className="block text-xl font-semibold"
          value={t("slot_booked_title")}
          onChange={(v) => updateText("slot_booked_title", v)}
        />
        <Editable
          as="p"
          className="block text-muted-foreground"
          value={t("slot_booked_subtitle")}
          onChange={(v) => updateText("slot_booked_subtitle", v)}
        />
      </div>
    </div>
  );

  const renderConfirm = () => (
    <div className="rounded-md border border-border bg-background p-8 space-y-6">
      <Editable
        as="h1"
        className="block text-3xl font-bold tracking-tight"
        value={t("confirmation_title")}
        onChange={(v) => updateText("confirmation_title", v)}
      />
      <Editable
        as="p"
        className="block text-muted-foreground"
        value={t("confirmation_subtitle")}
        onChange={(v) => updateText("confirmation_subtitle", v)}
      />
      <div className="border border-border rounded-md p-4 space-y-2">
        <Editable
          as="h3"
          className="block font-semibold"
          value={t("confirmation_email_heading")}
          onChange={(v) => updateText("confirmation_email_heading", v)}
        />
        <Editable
          as="p"
          className="block text-sm text-muted-foreground"
          value={t("confirmation_email_body")}
          onChange={(v) => updateText("confirmation_email_body", v)}
        />
      </div>
      <div className="border border-border rounded-md p-4 space-y-2">
        <Editable
          as="h3"
          className="block font-semibold"
          value={t("confirmation_next_heading")}
          onChange={(v) => updateText("confirmation_next_heading", v)}
        />
        <Editable
          as="p"
          className="block text-sm text-muted-foreground"
          value={t("confirmation_next_body")}
          onChange={(v) => updateText("confirmation_next_body", v)}
        />
      </div>
      <Editable
        as="p"
        className="block text-xs text-center text-muted-foreground"
        value={t("confirmation_disclaimer")}
        onChange={(v) => updateText("confirmation_disclaimer", v)}
      />
    </div>
  );

  const renderStep = () => {
    switch (step) {
      case "home": return renderHome();
      case "info": return renderInfo();
      case "form": return renderForm();
      case "slot": return renderSlot();
      case "confirm": return renderConfirm();
    }
  };

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="space-y-4">
      {/* Stepper */}
      <div className="flex flex-wrap items-center gap-2">
        {STEPS.map((s) => (
          <button
            key={s.key}
            onClick={() => setStep(s.key)}
            className={cn(
              "px-3 py-1.5 text-xs font-mono uppercase tracking-widest rounded-md border transition-colors",
              step === s.key
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {s.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          {status === "saving" && (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </>
          )}
          {status === "saved" && (
            <>
              <Check className="h-3 w-3" /> Saved
            </>
          )}
          {status === "idle" && <span>Click any text to edit</span>}
        </div>
      </div>

      {/* Preview */}
      {renderStep()}

      {/* Prev / Next */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={stepIndex === 0}
          onClick={() => setStep(STEPS[Math.max(0, stepIndex - 1)].key)}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          {stepIndex > 0 ? STEPS[stepIndex - 1].label : "Start"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={stepIndex === STEPS.length - 1}
          onClick={() => setStep(STEPS[Math.min(STEPS.length - 1, stepIndex + 1)].key)}
        >
          {stepIndex < STEPS.length - 1 ? STEPS[stepIndex + 1].label : "End"}
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
