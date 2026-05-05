import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { Save, Send, Eye, RefreshCw } from "lucide-react";

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
    const { error } = await supabase.functions.invoke("send-template-email", {
      body: {
        to: entry.recipient,
        templateKey: entry.template_key || "custom",
        subjectOverride: entry.subject || undefined,
      },
    });
    if (error) toast.error("Resend failed");
    else {
      toast.success("Resent");
      loadAll();
    }
  };

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Emails</h1>
            <p className="text-muted-foreground">Edit templates, send custom emails, and view delivery log</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setSendOpen(true)}>
            <Send className="h-4 w-4 mr-2" /> Send custom
          </Button>
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
                      Use <code>{"{{name}}"}</code>, <code>{"{{email}}"}</code>, <code>{"{{bookingUrl}}"}</code>,{" "}
                      <code>{"{{reason}}"}</code>, <code>{"{{appointmentTime}}"}</code> as placeholders.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Subject</Label>
                      <Input value={active.subject} onChange={(e) => updateActive({ subject: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>HTML body</Label>
                      <Textarea
                        value={active.body_html}
                        onChange={(e) => updateActive({ body_html: e.target.value })}
                        rows={16}
                        className="font-mono text-xs"
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
            <div className="flex justify-end mb-3">
              <Button variant="outline" size="sm" onClick={loadAll}>
                <RefreshCw className="h-4 w-4 mr-2" /> Refresh
              </Button>
            </div>
            <div className="border border-border rounded-lg divide-y divide-border">
              {log.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">No emails sent yet</div>
              )}
              {log.map((e) => (
                <div key={e.id} className="p-3 flex items-center gap-3 hover:bg-secondary/40">
                  <Badge variant={e.status === "sent" ? "default" : "destructive"}>{e.status}</Badge>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{e.subject || "(no subject)"}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {e.recipient} · {e.template_key || "custom"} ·{" "}
                      {format(parseISO(e.created_at), "MMM d, HH:mm")}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setLogEntry(e)}>
                    Details
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => resendFromLog(e)}>
                    Resend
                  </Button>
                </div>
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
            <div
              className="border border-border rounded-md overflow-auto max-h-[60vh] bg-white"
              dangerouslySetInnerHTML={{ __html: active?.body_html || "" }}
            />
          </DialogContent>
        </Dialog>

        {/* Send custom */}
        <Dialog open={sendOpen} onOpenChange={setSendOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send custom email</DialogTitle>
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
              <Button onClick={sendCustom} className="w-full">
                <Send className="h-4 w-4 mr-2" /> Send
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Log details */}
        <Dialog open={!!logEntry} onOpenChange={() => setLogEntry(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Email details</DialogTitle>
            </DialogHeader>
            {logEntry && (
              <div className="space-y-2 text-sm">
                <div><span className="text-muted-foreground">To:</span> {logEntry.recipient}</div>
                <div><span className="text-muted-foreground">Subject:</span> {logEntry.subject}</div>
                <div><span className="text-muted-foreground">Template:</span> {logEntry.template_key}</div>
                <div><span className="text-muted-foreground">Status:</span> {logEntry.status}</div>
                <div><span className="text-muted-foreground">Sent:</span> {format(parseISO(logEntry.created_at), "PPp")}</div>
                {logEntry.error_message && (
                  <div className="p-3 rounded bg-destructive/10 text-destructive text-xs whitespace-pre-wrap">
                    {logEntry.error_message}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AdminEmails;
