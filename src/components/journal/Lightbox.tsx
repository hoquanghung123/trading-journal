import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export interface LightboxImage {
  url: string;
  caption: string;
}

interface Props {
  images: LightboxImage[];
  index: number;
  onClose: () => void;
  onIndexChange?: (i: number) => void;
}

export function Lightbox({ images, index, onClose, onIndexChange }: Props) {
  const current = images[index];
  const hasNav = images.length > 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (!hasNav || !onIndexChange) return;
      if (e.key === "ArrowRight") onIndexChange((index + 1) % images.length);
      if (e.key === "ArrowLeft") onIndexChange((index - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [index, images.length, hasNav, onClose, onIndexChange]);

  if (!current) return null;

  const go = (delta: number) => {
    if (!onIndexChange) return;
    onIndexChange((index + delta + images.length) % images.length);
  };

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center p-6 sm:p-10 bg-slate-950/95 backdrop-blur-md cursor-zoom-out animate-in fade-in-0 duration-300"
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-6 right-6 w-12 h-12 rounded-2xl bg-white/10 border border-white/10 text-white/70 hover:text-white hover:bg-white/20 flex items-center justify-center transition-all shadow-xl backdrop-blur-sm"
        aria-label="Close"
      >
        <X className="w-6 h-6" />
      </button>

      {hasNav && onIndexChange && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            className="absolute left-6 top-1/2 -translate-y-1/2 w-14 h-14 rounded-2xl bg-white/10 border border-white/10 text-white/70 hover:text-white hover:bg-white/20 flex items-center justify-center transition-all shadow-xl backdrop-blur-sm"
            aria-label="Previous"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            className="absolute right-6 top-1/2 -translate-y-1/2 w-14 h-14 rounded-2xl bg-white/10 border border-white/10 text-white/70 hover:text-white hover:bg-white/20 flex items-center justify-center transition-all shadow-xl backdrop-blur-sm"
            aria-label="Next"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        </>
      )}

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-[95vw] max-h-[85vh] flex items-center justify-center cursor-default animate-in zoom-in-95 fade-in-0 duration-500"
      >
        <img
          src={current.url}
          alt={current.caption}
          className="max-w-[95vw] max-h-[85vh] object-contain rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10"
        />
      </div>

      <div className="mt-8 px-6 py-2.5 rounded-2xl bg-white/10 border border-white/10 text-xs tracking-widest text-white font-black uppercase backdrop-blur-md shadow-xl flex items-center gap-4">
        <span>{current.caption}</span>
        {hasNav && (
          <span className="px-2 py-0.5 rounded-lg bg-primary text-white text-[10px] font-black">
            {index + 1} / {images.length}
          </span>
        )}
      </div>
    </div>,
    document.body,
  );
}
