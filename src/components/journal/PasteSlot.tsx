import { useEffect, useRef, useState } from "react";
import { ImageIcon, ClipboardPaste, Loader2, Maximize2 } from "lucide-react";
import { deleteChartImage, getChartUrl, uploadChartImage, resolveTradingViewUrl } from "@/lib/journal";
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

export function PasteSlot({
  label,
  image,
  onChange,
  focused,
  onFocus,
  className,
  children,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [displayUrl, setDisplayUrl] = useState<string>("");
  const [zoom, setZoom] = useState(false);

  // Resolve storage path -> signed URL (or pass through legacy data URL)
  useEffect(() => {
    if (!image) {
      setDisplayUrl("");
      return;
    }
    setDisplayUrl(getChartUrl(image));
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

      // Handle TradingView Link
      const text = e.clipboardData?.getData("text");
      if (text) {
        const tvUrl = resolveTradingViewUrl(text);
        if (tvUrl) {
          e.preventDefault();
          await handleDataUrl(tvUrl);
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
      onClick={() => onFocus?.()}
      onDoubleClick={() => displayUrl && setZoom(true)}
      onFocus={onFocus}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f && f.type.startsWith("image/")) await handleFile(f);
      }}
      className={`relative group rounded-xl overflow-hidden border border-border bg-muted/20 transition-all cursor-pointer outline-none ${focused || drag ? "ring-2 ring-primary/20 border-primary/50" : "hover:border-primary/30"} ${className ?? ""}`}
    >
      {displayUrl ? (
        <>
          <img src={displayUrl} alt={label} loading="lazy" decoding="async" className="w-full h-full object-cover" />
        </>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground font-medium text-xs">
          <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center mb-1">
            <ImageIcon className="w-5 h-5 text-primary/60" />
          </div>
          <span className="font-bold uppercase tracking-wider text-[10px] text-primary/80">{label}</span>
          <span className="flex flex-col items-center gap-1 opacity-60 text-[9px] font-bold text-center px-4">
            <span className="flex items-center gap-1.5">CLICK TO SELECT</span>
            <span className="hidden sm:inline">THEN CTRL+V TO PASTE</span>
          </span>
        </div>
      )}
      {busy && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      )}
      <div className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-white/90 backdrop-blur-sm shadow-sm text-[9px] uppercase tracking-widest text-primary font-black border border-primary/10">
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
