import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ChevronLeft, ChevronRight, X } from "lucide-react";
import { toast } from "sonner";

interface ImageLightboxProps {
  images: string[];
  startIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ImageLightbox = ({ images, startIndex, open, onOpenChange }: ImageLightboxProps) => {
  const [index, setIndex] = useState(startIndex);

  useEffect(() => {
    if (open) setIndex(startIndex);
  }, [open, startIndex]);

  if (!images.length) return null;
  const src = images[index];

  const handleDownload = async () => {
    try {
      const res = await fetch(src, { mode: "cors" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const ext = (blob.type.split("/")[1] || "jpg").split(";")[0];
      const filename = `reference-${index + 1}.${ext}`;

      // Try Web Share API (best on iOS — saves to Photos via share sheet)
      const file = new File([blob], filename, { type: blob.type || "image/jpeg" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        try {
          await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({ files: [file] });
          return;
        } catch (shareErr) {
          // user cancelled or share failed — fall through to download
          if ((shareErr as Error)?.name === "AbortError") return;
        }
      }

      // Fallback: anchor download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.error("download failed", e);
      // Last resort: open in a new tab so user can long-press save
      window.open(src, "_blank", "noopener,noreferrer");
      toast.message("Long-press the image to save it");
    }
  };

  const prev = () => setIndex((i) => (i - 1 + images.length) % images.length);
  const next = () => setIndex((i) => (i + 1) % images.length);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 bg-background border-border [&>button]:hidden">
        <div className="relative">
          <img
            src={src}
            alt={`Reference ${index + 1}`}
            className="w-full max-h-[85vh] object-contain bg-black"
          />
          <div className="absolute top-2 right-2 flex gap-2">
            <Button size="icon" variant="secondary" onClick={handleDownload} title="Download">
              <Download className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="secondary" onClick={() => onOpenChange(false)} title="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
          {images.length > 1 && (
            <>
              <Button
                size="icon"
                variant="secondary"
                className="absolute left-2 top-1/2 -translate-y-1/2"
                onClick={prev}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                size="icon"
                variant="secondary"
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={next}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-background/80 text-xs font-mono">
                {index + 1} / {images.length}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
