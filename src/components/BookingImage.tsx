import { useEffect, useState } from "react";
import { getBookingImageSignedUrl } from "@/lib/bookingImages";

interface Props {
  src: string;
  alt?: string;
  className?: string;
}

/** Renders a booking image by resolving the stored value to a signed URL. */
export function BookingImage({ src, alt = "", className }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    getBookingImageSignedUrl(src).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!url) {
    return <div className={className} aria-label={alt} />;
  }
  return <img src={url} alt={alt} className={className} />;
}
