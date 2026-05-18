import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ChevronLeft, ChevronRight, X } from "lucide-react";
import { toast } from "sonner";
import { getBookingImageSignedUrl } from "@/lib/bookingImages";

interface ImageLightboxProps {
  images: string[];
  startIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ImageLightbox = ({ images, startIndex, open, onOpenChange }: ImageLightboxProps) => {
  const [index, setIndex] = useState(startIndex);
  const [src, setSrc] = useState<string>("");

  useEffect(() => {
    if (open) setIndex(startIndex);
  }, [open, startIndex]);

  useEffect(() => {
    let cancelled = false;
    setSrc("");
    const raw = images[index];
    if (!raw) return;
    getBookingImageSignedUrl(raw).then((u) => {
      if (!cancelled) setSrc(u ?? "");
    });
    return () => { cancelled = true; };
  }, [images, index]);

  if (!images.length) return null;

  const isIOS = typeof navigator !== "undefined" &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! > 1));

  const handleDownload = async () => {
    // Fetch the image as a blob
    let blob: Blob | null = null;
    try {
      const res = await fetch(src, { mode: "cors", credentials: "omit" });
      if (res.ok) blob = await res.blob();
    } catch {
      // ignore — try without cors
    }
    if (!blob) {
      try {
        const res = await fetch(src);
        if (res.ok) blob = await res.blob();
      } catch {
        // ignore
      }
    }

    const ext = (blob?.type.split("/")[1] || "jpeg").split(";")[0].replace("jpg", "jpeg");
    const filename = `reference-${index + 1}.${ext === "jpeg" ? "jpg" : ext}`;

    // iOS: use Web Share API so the user can save to Photos via the share sheet
    if (blob && isIOS) {
      try {
        const file = new File([blob], filename, { type: blob.type || "image/jpeg" });
        const nav = navigator as Navigator & {
          canShare?: (d: ShareData) => boolean;
          share?: (d: ShareData) => Promise<void>;
        };
        if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
          await nav.share({ files: [file] });
          return;
        }
      } catch (shareErr) {
        if ((shareErr as Error)?.name === "AbortError") return;
        // fall through
      }
      // iOS Safari fallback: open the blob in a new tab so user can long-press → Save to Photos
      try {
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank", "noopener,noreferrer");
        toast.message("Long-press the image, then tap Save to Photos");
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        return;
      } catch {
        // fall through
      }
    }

    // Desktop / Android: anchor download
    if (blob) {
      try {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return;
      } catch (e) {
        console.error("anchor download failed", e);
      }
    }

    // Last resort: open original URL
    window.open(src, "_blank", "noopener,noreferrer");
    toast.message(isIOS ? "Long-press the image, then tap Save to Photos" : "Right-click the image to save it");
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
