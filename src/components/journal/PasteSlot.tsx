import { useCallback, useContext, useEffect, useId, useMemo, useRef, useState, createContext } from "react";
import { ImageIcon, Loader2, Maximize2, Replace, Trash2 } from "lucide-react";
import {
  deleteChartImage,
  getChartUrl,
  uploadChartImage,
  resolveTradingViewUrl,
} from "@/lib/journal";
import { toast } from "sonner";
import { Lightbox } from "./Lightbox";
import { cn } from "@/lib/utils";

const ChartFitContext = createContext<{
  height?: number;
  report: (id: string, height: number | null) => void;
} | null>(null);

/** Shared slot height = tallest loaded chart at current column width. */
export function ChartFitProvider({ children }: { children: React.ReactNode }) {
  const [heights, setHeights] = useState<Record<string, number>>({});
  const report = useCallback((id: string, height: number | null) => {
    setHeights((prev) => {
      if (height == null) {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      }
      if (prev[id] === height) return prev;
      return { ...prev, [id]: height };
    });
  }, []);
  const height = useMemo(() => {
    const vals = Object.values(heights);
    return vals.length ? Math.max(...vals) : undefined;
  }, [heights]);
  const value = useMemo(() => ({ height, report }), [height, report]);
  return <ChartFitContext.Provider value={value}>{children}</ChartFitContext.Provider>;
}

interface Props {
  label: string;
  image?: string; // storage path OR legacy data URL
  onChange: (path: string | undefined) => void;
  onBusyChange?: (busy: boolean) => void;
  focused?: boolean;
  onFocus?: () => void;
  className?: string;
  children?: React.ReactNode;
  /** Hover/touch toolbar: replace, expand, remove. Off on tape slots. */
  showChartActions?: boolean;
  /** Chip that marks this slot as the Cmd+V target. */
  showPasteTarget?: boolean;
  /** Fill the slot without letterbox. Height follows the tallest Timeline chart. */
  fitImage?: boolean;
}

export function PasteSlot({
  label,
  image,
  onChange,
  onBusyChange,
  focused,
  onFocus,
  className,
  children,
  showChartActions = false,
  showPasteTarget = false,
  fitImage = false,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const slotId = useId();
  const fit = useContext(ChartFitContext);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [displayUrl, setDisplayUrl] = useState<string>("");
  const [zoom, setZoom] = useState(false);

  const onBusyChangeRef = useRef(onBusyChange);
  useEffect(() => {
    onBusyChangeRef.current = onBusyChange;
  }, [onBusyChange]);

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
    onBusyChangeRef.current?.(true);
    try {
      const path = await uploadChartImage(file);
      const old = image;
      onChange(path);
      if (old) deleteChartImage(old).catch(() => {});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      onBusyChangeRef.current?.(false);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    const old = image;
    onChange(undefined);
    if (old) deleteChartImage(old).catch(() => {});
  };

  const handleDataUrl = async (dataUrl: string) => {
    setBusy(true);
    onBusyChangeRef.current?.(true);
    try {
      const path = await uploadChartImage(dataUrl);
      const old = image;
      onChange(path);
      if (old) deleteChartImage(old).catch(() => {});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      onBusyChangeRef.current?.(false);
    }
  };

  const handleFileRef = useRef(handleFile);
  const handleDataUrlRef = useRef(handleDataUrl);

  useEffect(() => {
    handleFileRef.current = handleFile;
    handleDataUrlRef.current = handleDataUrl;
  });

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
          await handleFileRef.current(file);
          return;
        }
      }

      // Handle TradingView Link
      const text = e.clipboardData?.getData("text");
      if (text) {
        const tvUrl = resolveTradingViewUrl(text);
        if (tvUrl) {
          e.preventDefault();
          await handleDataUrlRef.current(tvUrl);
          return;
        }
      }
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [focused]);

  const reportFit = fit?.report;
  const fitHeight = fit?.height;
  const measureRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!fitImage || !reportFit) return;
    const box = ref.current;
    const measure = () => {
      const img = imgRef.current;
      if (!img?.naturalWidth || !displayUrl) {
        reportFit(slotId, null);
        return;
      }
      const w = box?.clientWidth ?? 0;
      if (!w) return;
      reportFit(slotId, Math.round((w * img.naturalHeight) / img.naturalWidth));
    };
    measureRef.current = measure;
    if (!box) return;
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    measure();
    return () => ro.disconnect();
  }, [displayUrl, fitImage, reportFit, slotId]);

  useEffect(() => {
    if (!fitImage || !reportFit) return;
    return () => reportFit(slotId, null);
  }, [fitImage, reportFit, slotId]);

  return (
    <div
      ref={ref}
      tabIndex={0}
      onClick={() => {
        onFocus?.();
        if (!displayUrl) fileRef.current?.click();
      }}
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
      className={cn(
        "relative group rounded-xl overflow-hidden border border-border bg-muted/20 transition-all cursor-pointer outline-none",
        focused || drag ? "ring-2 ring-primary/20 border-primary/50" : "hover:border-primary/30",
        fitImage && fitHeight == null && "h-44",
        className,
      )}
      style={fitImage && fitHeight ? { height: fitHeight } : undefined}
    >
      {displayUrl ? (
        <>
          <img
            ref={imgRef}
            src={displayUrl}
            alt={label}
            loading="lazy"
            decoding="async"
            onLoad={() => measureRef.current()}
            className={
              fitImage
                ? "w-full h-full object-cover"
                : "w-full h-full object-contain bg-muted/5"
            }
          />
        </>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground font-medium text-xs">
          <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center mb-1">
            <ImageIcon className="w-5 h-5 text-primary/60" />
          </div>
          <span className="font-bold uppercase tracking-wider text-[10px] text-primary/80">
            {label}
          </span>
          <span className="flex flex-col items-center gap-1 opacity-60 text-[9px] font-bold text-center px-4">
            <span>Tap to upload</span>
            <span className="hidden sm:inline">or paste image / TradingView URL</span>
          </span>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f && f.type.startsWith("image/")) void handleFile(f);
        }}
      />
      {busy && (
        <div className="absolute inset-0 bg-background/70 backdrop-blur-[2px] flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      )}
      {displayUrl && (
        <div className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-card/90 backdrop-blur-sm shadow-sm text-[9px] uppercase tracking-widest text-primary font-black border border-primary/10">
          {label}
        </div>
      )}
      {showPasteTarget && focused && (
        <div className="absolute bottom-2 left-2 px-2 py-1 rounded-lg bg-primary text-primary-foreground shadow-sm text-[9px] uppercase tracking-widest font-black">
          Paste target
        </div>
      )}
      {showChartActions && displayUrl && !busy && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10">
          <button
            type="button"
            title="Replace chart"
            onClick={(e) => {
              e.stopPropagation();
              onFocus?.();
              fileRef.current?.click();
            }}
            className="w-8 h-8 rounded-lg bg-card/95 border border-border shadow-sm flex items-center justify-center text-foreground hover:border-primary/50"
          >
            <Replace className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Expand chart"
            onClick={(e) => {
              e.stopPropagation();
              setZoom(true);
            }}
            className="w-8 h-8 rounded-lg bg-card/95 border border-border shadow-sm flex items-center justify-center text-foreground hover:border-primary/50"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Remove chart"
            onClick={handleRemove}
            className="w-8 h-8 rounded-lg bg-card/95 border border-destructive/30 shadow-sm flex items-center justify-center text-destructive hover:bg-destructive hover:text-white"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
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
