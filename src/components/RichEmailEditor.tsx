import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bold, Italic, Underline, Link as LinkIcon, List, ListOrdered, Heading1, Heading2, Code2, Variable } from "lucide-react";

interface Props {
  value: string;
  onChange: (html: string) => void;
  variables?: { key: string; label: string }[];
}

const DEFAULT_VARS = [
  { key: "name", label: "Recipient name" },
  { key: "email", label: "Recipient email" },
  { key: "appointmentTime", label: "Appointment time" },
  { key: "bookingUrl", label: "Booking URL" },
  { key: "reason", label: "Reason" },
  { key: "siteName", label: "Studio name (from Settings)" },
  { key: "address", label: "Studio address (from Settings)" },
  { key: "siteEmail", label: "Studio email (from Settings)" },
  { key: "tagline", label: "Studio tagline (from Settings)" },
];

export const RichEmailEditor = ({ value, onChange, variables = DEFAULT_VARS }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const [showSource, setShowSource] = useState(false);
  const [source, setSource] = useState(value);

  // Sync external value into the editor when it changes (e.g. switching templates)
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || "")) {
      ref.current.innerHTML = value || "";
    }
    setSource(value);
  }, [value, showSource]);

  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const insertHTML = (html: string) => {
    ref.current?.focus();
    document.execCommand("insertHTML", false, html);
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const insertVar = (key: string) => insertHTML(`{{${key}}}`);

  const addLink = () => {
    const url = prompt("Link URL", "https://");
    if (url) exec("createLink", url);
  };

  if (showSource) {
    return (
      <div className="space-y-2">
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange(source);
              setShowSource(false);
            }}
          >
            Back to visual editor
          </Button>
        </div>
        <textarea
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            onChange(e.target.value);
          }}
          rows={18}
          className="w-full font-mono text-xs rounded-md border border-input bg-background p-3"
        />
      </div>
    );
  }

  return (
    <div className="border border-input rounded-md overflow-hidden bg-background">
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-border bg-muted/40">
        <Button type="button" variant="ghost" size="sm" onClick={() => exec("bold")} title="Bold">
          <Bold className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => exec("italic")} title="Italic">
          <Italic className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => exec("underline")} title="Underline">
          <Underline className="h-4 w-4" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button type="button" variant="ghost" size="sm" onClick={() => exec("formatBlock", "<h1>")} title="Heading 1">
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => exec("formatBlock", "<h2>")} title="Heading 2">
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => exec("formatBlock", "<p>")} title="Paragraph">
          P
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button type="button" variant="ghost" size="sm" onClick={() => exec("insertUnorderedList")} title="Bulleted list">
          <List className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => exec("insertOrderedList")} title="Numbered list">
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={addLink} title="Insert link">
          <LinkIcon className="h-4 w-4" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm" title="Insert personalised variable">
              <Variable className="h-4 w-4 mr-1" /> Insert variable
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {variables.map((v) => (
              <DropdownMenuItem key={v.key} onClick={() => insertVar(v.key)}>
                <span className="font-mono text-xs mr-2">{`{{${v.key}}}`}</span>
                <span className="text-muted-foreground text-xs">{v.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="ml-auto">
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowSource(true)} title="Edit HTML">
            <Code2 className="h-4 w-4 mr-1" /> HTML
          </Button>
        </div>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        className="min-h-[320px] max-h-[500px] overflow-auto p-4 text-sm focus:outline-none prose prose-sm max-w-none [&_h1]:text-xl [&_h1]:font-bold [&_h2]:text-lg [&_h2]:font-semibold [&_a]:text-primary [&_a]:underline"
      />
    </div>
  );
};
