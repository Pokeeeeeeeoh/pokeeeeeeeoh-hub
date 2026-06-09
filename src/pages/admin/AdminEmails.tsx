import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Save, Send, Eye, RefreshCw, Bell, Mail } from "lucide-react";
import { RichEmailEditor } from "@/components/RichEmailEditor";

interface Template {
  id: string;
  key: string;
  name: string;
  subject: string;
  body_html: string;
}
interface LogEntry {
  id: string;
  created_at: string;
  template_key: string | null;
  recipient: string;
  subject: string | null;
  status: string;
  error_message: string | null;
  metadata: { body_html?: string } | null;
}

const AdminEmails = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeKey, setActiveKey] = useState<string>("");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendTo, setSendTo] = useState("");
  const [sendSubject, setSendSubject] = useState("");
  const [sendHtml, setSendHtml] = useState("");
  const [logEntry, setLogEntry] = useState<LogEntry | null>(null);

  // Confirmation dialogs
  const [confirmResend, setConfirmResend] = useState<LogEntry | null>(null);
  const [confirmSendCustom, setConfirmSendCustom] = useState(false);
  const [confirmTestReminders, setConfirmTestReminders] = useState(false);

  const loadAll = async () => {
    const [tpls, logs] = await Promise.all([
      supabase.from("email_templates").select("*").order("name"),
      supabase.from("email_log").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    if (tpls.data) {
      setTemplates(tpls.data);
      if (!activeKey && tpls.data.length) setActiveKey(tpls.data[0].key);
    }
    if (logs.data) setLog(logs.data as LogEntry[]);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const active = templates.find((t) => t.key === activeKey);

  const updateActive = (patch: Partial<Template>) => {
    setTemplates((prev) => prev.map((t) => (t.key === activeKey ? { ...t, ...patch } : t)));
  };

  const saveTemplate = async () => {
    if (!active) return;
    setSaving(true);
    const { error } = await supabase
      .from("email_templates")
      .update({ subject: active.subject, body_html: active.body_html, name: active.name })
      .eq("id", active.id);
    setSaving(false);
    if (error) toast.error("Failed to save");
    else toast.success("Template saved");
  };

  const sendCustom = async () => {
    if (!sendTo) return toast.error("Recipient required");
    const { error } = await supabase.functions.invoke("send-template-email", {
      body: {
        to: sendTo,
        templateKey: "custom",
        subjectOverride: sendSubject,
        htmlOverride: sendHtml,
      },
    });
    if (error) toast.error("Failed to send");
    else {
      toast.success("Email sent");
      setSendOpen(false);
      setSendTo("");
      setSendSubject("");
      setSendHtml("");
      loadAll();
    }
  };

  const resendFromLog = async (entry: LogEntry) => {
    const body: Record<string, unknown> = {
      to: entry.recipient,
      templateKey: entry.template_key || "custom",
      subjectOverride: entry.subject || undefined,
    };
    // If we saved the rendered body, resend with the same body — otherwise the
    // template will re-render from the latest version which may differ.
    if (entry.metadata?.body_html) {
      body.htmlOverride = entry.metadata.body_html;
    }
    const { error } = await supabase.functions.invoke("send-template-email", { body });
    if (error) toast.error("Resend failed");
    else {
      toast.success("Resent");
      loadAll();
    }
  };

  const [sendingTest, setSendingTest] = useState(false);
  const sendTestReminders = async () => {
    if (sendingTest) return;
    setSendingTest(true);
    const tId = toast.loading("Sending test reminders…");
    const { data, error } = await supabase.functions.invoke("send-appointment-reminders", {
      body: { test: true },
    });
    setSendingTest(false);
    if (error) {
      toast.error("Failed to send test reminders", { id: tId });
      return;
    }
    const results = ((data as any)?.results ?? []) as { sent: boolean }[];
    const sent = results.filter((r) => r.sent).length;
    const failed = results.length - sent;
    if (results.length === 0) {
      toast.warning("No upcoming appointments to send reminders to", { id: tId });
    } else if (failed === 0) {
      toast.success(`✓ Sent ${sent} test reminder${sent === 1 ? "" : "s"}`, {
        id: tId,
        description: "Check the Log tab to see them.",
      });
    } else {
      toast.error(`Sent ${sent}, ${failed} failed`, { id: tId });
    }
    loadAll();
  };

  const statusVariant = (s: string): "default" | "destructive" | "secondary" =>
    s === "sent" ? "default" : s === "suppressed" ? "secondary" : "destructive";

  return (
    <div className="p-4 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Emails</h1>
          <p className="text-muted-foreground">Edit templates, send custom emails, and view delivery log</p>
        </div>

        <Tabs defaultValue="templates" className="space-y-6">
          <TabsList>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="log">Log ({log.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="templates">
            <div className="grid gap-6 md:grid-cols-[220px_1fr]">
              <div className="space-y-1">
                {templates.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setActiveKey(t.key)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      t.key === activeKey ? "bg-secondary" : "hover:bg-secondary/50"
                    }`}
                  >
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs font-mono text-muted-foreground">{t.key}</div>
                  </button>
                ))}
              </div>

              {active && (
                <Card>
                  <CardHeader>
                    <CardTitle>{active.name}</CardTitle>
                    <CardDescription>
                      Personalised tags: <code>{"{{name}}"}</code>, <code>{"{{email}}"}</code>,{" "}
                      <code>{"{{appointmentTime}}"}</code>, <code>{"{{bookingUrl}}"}</code>,{" "}
                      <code>{"{{reason}}"}</code>. Studio info auto-fills from Settings:{" "}
                      <code>{"{{siteName}}"}</code>, <code>{"{{address}}"}</code>,{" "}
                      <code>{"{{siteEmail}}"}</code>, <code>{"{{tagline}}"}</code>.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Subject</Label>
                      <Input value={active.subject} onChange={(e) => updateActive({ subject: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Body</Label>
                      <RichEmailEditor
                        value={active.body_html}
                        onChange={(html) => updateActive({ body_html: html })}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={saveTemplate} disabled={saving}>
                        <Save className="h-4 w-4 mr-2" /> Save
                      </Button>
                      <Button variant="outline" onClick={() => setPreviewOpen(true)}>
                        <Eye className="h-4 w-4 mr-2" /> Preview
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="log">
            {/* Toolbar — clearer grouping with primary and secondary actions */}
            <Card className="mb-4">
              <CardContent className="p-4 flex flex-wrap items-center gap-2">
                <Button onClick={() => setSendOpen(true)}>
                  <Mail className="h-4 w-4 mr-2" /> Compose email
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setConfirmTestReminders(true)}
                  disabled={sendingTest}
                >
                  <Bell className={`h-4 w-4 mr-2 ${sendingTest ? "animate-pulse" : ""}`} />
                  {sendingTest ? "Sending…" : "Send test reminders"}
                </Button>
                <div className="flex-1" />
                <Button variant="ghost" size="sm" onClick={loadAll}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Refresh
                </Button>
              </CardContent>
            </Card>

            <div className="border border-border rounded-lg divide-y divide-border">
              {log.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">No emails sent yet</div>
              )}
              {log.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setLogEntry(e)}
                  className="w-full p-3 flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 hover:bg-secondary/40 text-left"
                >
                  <Badge variant={statusVariant(e.status)}>{e.status}</Badge>
                  <div className="flex-1 min-w-0 w-full sm:w-auto order-last sm:order-none">
                    <div className="text-sm truncate">{e.subject || "(no subject)"}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {e.recipient} · {e.template_key || "custom"} ·{" "}
                      {format(parseISO(e.created_at), "MMM d, HH:mm")}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground hidden sm:inline">View →</span>
                </button>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Preview */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Preview: {active?.subject}</DialogTitle>
            </DialogHeader>
            <iframe
              title="Email preview"
              srcDoc={active?.body_html || ""}
              sandbox=""
              className="border border-border rounded-md w-full h-[60vh] bg-white"
            />
          </DialogContent>
        </Dialog>

        {/* Send custom */}
        <Dialog open={sendOpen} onOpenChange={setSendOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Compose email</DialogTitle>
              <DialogDescription>
                Send a one-off email to any recipient. You'll be asked to confirm before sending.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>To</Label>
                <Input value={sendTo} onChange={(e) => setSendTo(e.target.value)} placeholder="recipient@example.com" />
              </div>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input value={sendSubject} onChange={(e) => setSendSubject(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>HTML body</Label>
                <Textarea
                  rows={10}
                  value={sendHtml}
                  onChange={(e) => setSendHtml(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSendOpen(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  if (!sendTo) return toast.error("Recipient required");
                  setConfirmSendCustom(true);
                }}
              >
                <Send className="h-4 w-4 mr-2" /> Send…
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Log details — shows the full rendered email body */}
        <Dialog open={!!logEntry} onOpenChange={() => setLogEntry(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Email details</DialogTitle>
            </DialogHeader>
            {logEntry && (
              <div className="space-y-4">
                <div className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">
                  <span className="text-muted-foreground">To</span>
                  <span className="break-all">{logEntry.recipient}</span>
                  <span className="text-muted-foreground">Subject</span>
                  <span>{logEntry.subject || "(no subject)"}</span>
                  <span className="text-muted-foreground">Template</span>
                  <span className="font-mono text-xs">{logEntry.template_key || "custom"}</span>
                  <span className="text-muted-foreground">Status</span>
                  <span><Badge variant={statusVariant(logEntry.status)}>{logEntry.status}</Badge></span>
                  <span className="text-muted-foreground">Sent</span>
                  <span>{format(parseISO(logEntry.created_at), "PPp")}</span>
                </div>

                {logEntry.error_message && (
                  <div className="p-3 rounded bg-destructive/10 text-destructive text-xs whitespace-pre-wrap">
                    {logEntry.error_message}
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Email body</Label>
                  {logEntry.metadata?.body_html ? (
                    <iframe
                      title="Email body"
                      srcDoc={logEntry.metadata.body_html}
                      sandbox=""
                      className="border border-border rounded-md w-full h-[55vh] bg-white"
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No body stored for this email (sent before full-body logging was enabled).
                    </p>
                  )}
                </div>

                <DialogFooter className="gap-2 sm:gap-2">
                  <Button variant="outline" onClick={() => setLogEntry(null)}>Close</Button>
                  <Button onClick={() => setConfirmResend(logEntry)}>
                    <Send className="h-4 w-4 mr-2" /> Resend…
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Confirm: Resend from log */}
        <AlertDialog open={!!confirmResend} onOpenChange={(o) => !o && setConfirmResend(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Resend this email?</AlertDialogTitle>
              <AlertDialogDescription>
                A new copy will be sent to <strong>{confirmResend?.recipient}</strong>
                {confirmResend?.subject ? <> with the subject "<em>{confirmResend.subject}</em>"</> : null}.
                The recipient will receive it again — make sure that's what you want.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  const entry = confirmResend;
                  setConfirmResend(null);
                  if (entry) await resendFromLog(entry);
                }}
              >
                Yes, resend
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Confirm: Send custom email */}
        <AlertDialog open={confirmSendCustom} onOpenChange={setConfirmSendCustom}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Send this email?</AlertDialogTitle>
              <AlertDialogDescription>
                The email will be sent to <strong>{sendTo}</strong>. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  setConfirmSendCustom(false);
                  await sendCustom();
                }}
              >
                Yes, send
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Confirm: Send test reminders */}
        <AlertDialog open={confirmTestReminders} onOpenChange={setConfirmTestReminders}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Send test reminders now?</AlertDialogTitle>
              <AlertDialogDescription>
                This sends real reminder emails to every client with an upcoming appointment in the reminder window.
                Only use this for testing — clients will receive an extra reminder.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  setConfirmTestReminders(false);
                  await sendTestReminders();
                }}
              >
                Yes, send
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default AdminEmails;
