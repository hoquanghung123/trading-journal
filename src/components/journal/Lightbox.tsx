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
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center p-6 sm:p-10 bg-black/90 backdrop-blur-sm cursor-zoom-out animate-in fade-in-0 duration-200"
    >
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/70 border border-white/20 text-white/80 hover:text-white hover:border-neon-cyan flex items-center justify-center transition"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>

      {hasNav && onIndexChange && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); go(-1); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/70 border border-white/20 text-white/80 hover:text-white hover:border-neon-cyan flex items-center justify-center transition"
            aria-label="Previous"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); go(1); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/70 border border-white/20 text-white/80 hover:text-white hover:border-neon-cyan flex items-center justify-center transition"
            aria-label="Next"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-[95vw] max-h-[85vh] flex items-center justify-center cursor-default animate-in zoom-in-95 fade-in-0 duration-200"
      >
        <img
          src={current.url}
          alt={current.caption}
          className="max-w-[95vw] max-h-[85vh] object-contain rounded-md shadow-2xl"
        />
      </div>

      <div className="mt-4 px-3 py-1.5 rounded bg-black/70 border border-white/15 text-[11px] tracking-widest text-neon-cyan font-bold uppercase">
        {current.caption}
        {hasNav && (
          <span className="ml-2 text-white/50 font-normal normal-case tracking-normal">
            {index + 1} / {images.length}
          </span>
        )}
      </div>
    </div>,
    document.body,
  );
}
