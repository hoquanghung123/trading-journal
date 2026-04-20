import { useEffect, useRef, useState } from "react";
import { ImageIcon, ClipboardPaste, Loader2, Maximize2 } from "lucide-react";
import { deleteChartImage, getChartUrl, uploadChartImage } from "@/lib/journal";
import { toast } from "sonner";
import { Lightbox } from "./Lightbox";

interface Props {
  label: string;
  image?: string; // storage path OR legacy data URL
  onChange: (path: string | undefined) => void;
  focused?: boolean;
  onFocus?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export function PasteSlot({ label, image, onChange, focused, onFocus, className, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [displayUrl, setDisplayUrl] = useState<string>("");
  const [zoom, setZoom] = useState(false);

  // Resolve storage path -> signed URL (or pass through legacy data URL)
  useEffect(() => {
    let cancelled = false;
    if (!image) { setDisplayUrl(""); return; }
    getChartUrl(image)
      .then((u) => { if (!cancelled) setDisplayUrl(u); })
      .catch(() => { if (!cancelled) setDisplayUrl(""); });
    return () => { cancelled = true; };
  }, [image]);

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const path = await uploadChartImage(file);
      const old = image;
      onChange(path);
      if (old) deleteChartImage(old).catch(() => {});
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const handleDataUrl = async (dataUrl: string) => {
    setBusy(true);
    try {
      const path = await uploadChartImage(dataUrl);
      const old = image;
      onChange(path);
      if (old) deleteChartImage(old).catch(() => {});
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!focused) return;
    const handler = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of items) {
        if (it.type.startsWith("image/")) {
          const file = it.getAsFile();
          if (!file) continue;
          e.preventDefault();
          await handleFile(file);
          return;
        }
      }
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [focused]);

  return (
    <div
      ref={ref}
      tabIndex={0}
      onClick={onFocus}
      onFocus={onFocus}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={async (e) => {
        e.preventDefault(); setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f && f.type.startsWith("image/")) await handleFile(f);
      }}
      className={`relative group rounded-md overflow-hidden border border-terminal-border bg-terminal-bg/60 transition-all cursor-pointer outline-none ${focused ? "neon-focus" : ""} ${drag ? "neon-focus" : ""} ${className ?? ""}`}
    >
      {displayUrl ? (
        <>
          <img src={displayUrl} alt={label} className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setZoom(true); }}
            title="Zoom"
            className="absolute top-1 right-7 w-5 h-5 rounded bg-black/70 border border-terminal-border text-muted-foreground hover:text-neon-cyan hover:border-neon-cyan opacity-0 group-hover:opacity-100 transition flex items-center justify-center z-10"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
        </>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-muted-foreground/70 text-[10px] uppercase tracking-wider">
          <ImageIcon className="w-5 h-5 opacity-50" />
          <span>{label}</span>
          <span className="flex items-center gap-1 opacity-60"><ClipboardPaste className="w-3 h-3" /> Ctrl+V</span>
        </div>
      )}
      {busy && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-neon-cyan animate-spin" />
        </div>
      )}
      <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-[9px] uppercase tracking-widest text-neon-cyan font-bold">
        {label}
      </div>
      {children}
      {zoom && displayUrl && (
        <Lightbox
          images={[{ url: displayUrl, caption: label }]}
          index={0}
          onClose={() => setZoom(false)}
        />
      )}
    </div>
  );
}
