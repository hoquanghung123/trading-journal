import { useEffect, useState } from "react";
import { getChartUrl } from "@/lib/journal";
import { ImageIcon } from "lucide-react";
import { Lightbox, type LightboxImage } from "./Lightbox";

interface Props {
  path?: string;
  label: string;
  /** Optional sibling image for arrow-key navigation in the lightbox */
  pair?: { path?: string; label: string };
  /** Caption prefix shown in the lightbox (e.g. "Trade #01") */
  captionPrefix?: string;
}

export function TradeImageThumb({ path, label, pair, captionPrefix }: Props) {
  const [url, setUrl] = useState("");
  const [pairUrl, setPairUrl] = useState("");
  const [lightbox, setLightbox] = useState<{ images: LightboxImage[]; index: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!path) { setUrl(""); return; }
    getChartUrl(path).then((u) => { if (!cancelled) setUrl(u); }).catch(() => {});
    return () => { cancelled = true; };
  }, [path]);

  useEffect(() => {
    let cancelled = false;
    if (!pair?.path) { setPairUrl(""); return; }
    getChartUrl(pair.path).then((u) => { if (!cancelled) setPairUrl(u); }).catch(() => {});
    return () => { cancelled = true; };
  }, [pair?.path]);

  if (!path) {
    return (
      <div className="w-12 h-9 rounded border border-dashed border-terminal-border flex items-center justify-center text-muted-foreground/50">
        <ImageIcon className="w-3 h-3" />
      </div>
    );
  }

  const openLightbox = (e: React.MouseEvent) => {
    e.stopPropagation();
    const prefix = captionPrefix ? `${captionPrefix} — ` : "";
    const images: LightboxImage[] = [{ url, caption: `${prefix}${label}` }];
    if (pair?.path && pairUrl) {
      images.push({ url: pairUrl, caption: `${prefix}${pair.label}` });
    }
    setLightbox({ images, index: 0 });
  };

  return (
    <>
      <button
        onClick={openLightbox}
        className="w-12 h-9 rounded border border-terminal-border overflow-hidden hover:border-neon-cyan transition"
      >
        {url && <img src={url} alt={label} className="w-full h-full object-cover" />}
      </button>
      {lightbox && (
        <Lightbox
          images={lightbox.images}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onIndexChange={(i) => setLightbox((s) => (s ? { ...s, index: i } : s))}
        />
      )}
    </>
  );
}
