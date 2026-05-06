import React, { useRef, useEffect } from "react";
import {
  Bold,
  Italic,
  List,
  Image as ImageIcon,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Quote,
  Undo,
  Redo,
  Type,
  Eraser,
  Minus,
  Maximize2,
  Link,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RichEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function RichEditor({ value, onChange, placeholder, className }: RichEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  // Initialize content only once or when value changes externally
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, []);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target?.result as string;
            const img = `<img src="${base64}" />`;
            execCommand("insertHTML", img);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm",
        className,
      )}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-1 mr-2">
          <ToolbarButton
            onClick={() => execCommand("undo")}
            icon={<Undo size={14} />}
            title="Undo"
          />
          <ToolbarButton
            onClick={() => execCommand("redo")}
            icon={<Redo size={14} />}
            title="Redo"
          />
        </div>

        <div className="w-px h-4 bg-slate-200 mx-1" />

        <div className="flex items-center gap-1 mx-2">
          <ToolbarButton
            onClick={() => execCommand("formatBlock", "H1")}
            icon={<Heading1 size={14} />}
            title="H1"
          />
          <ToolbarButton
            onClick={() => execCommand("formatBlock", "H2")}
            icon={<Heading2 size={14} />}
            title="H2"
          />
        </div>

        <div className="w-px h-4 bg-slate-200 mx-1" />

        <div className="flex items-center gap-1 mx-2">
          <ToolbarButton
            onClick={() => execCommand("bold")}
            icon={<Bold size={14} />}
            title="Bold"
          />
          <ToolbarButton
            onClick={() => execCommand("italic")}
            icon={<Italic size={14} />}
            title="Italic"
          />
          <ToolbarButton
            onClick={() => execCommand("underline")}
            icon={<Underline size={14} />}
            title="Underline"
          />
          <ToolbarButton
            onClick={() => execCommand("strikeThrough")}
            icon={<Strikethrough size={14} />}
            title="Strike"
          />
        </div>

        <div className="w-px h-4 bg-slate-200 mx-1" />

        <div className="flex items-center gap-1 mx-2">
          <ToolbarButton
            onClick={() => execCommand("insertUnorderedList")}
            icon={<List size={14} />}
            title="Bullets"
          />
          <ToolbarButton
            onClick={() => execCommand("insertOrderedList")}
            icon={<ListOrdered size={14} />}
            title="Numbers"
          />
          <ToolbarButton
            onClick={() => execCommand("formatBlock", "blockquote")}
            icon={<Quote size={14} />}
            title="Quote"
          />
        </div>

        <div className="w-px h-4 bg-slate-200 mx-1" />

        <div className="flex items-center gap-1 mx-2">
          <ToolbarButton
            onClick={() => execCommand("justifyLeft")}
            icon={<AlignLeft size={14} />}
            title="Left"
          />
          <ToolbarButton
            onClick={() => execCommand("justifyCenter")}
            icon={<AlignCenter size={14} />}
            title="Center"
          />
          <ToolbarButton
            onClick={() => execCommand("justifyRight")}
            icon={<AlignRight size={14} />}
            title="Right"
          />
        </div>

        <div className="w-px h-4 bg-slate-200 mx-1" />

          <ToolbarButton
            onClick={() => {
              const url = prompt("Enter image URL:");
              if (url) execCommand("insertImage", url);
            }}
            icon={<ImageIcon size={14} />}
            title="Image URL"
          />

        <div className="w-px h-4 bg-slate-200 mx-1" />

        <div className="flex items-center gap-1 mx-2">
          <ToolbarButton
            onClick={() => {
              const url = prompt("Enter link URL:");
              if (url) execCommand("createLink", url);
            }}
            icon={<Link size={14} />}
            title="Link"
          />
          <ToolbarButton
            onClick={() => execCommand("insertHorizontalRule")}
            icon={<Minus size={14} />}
            title="Horizontal Line"
          />
          <ToolbarButton
            onClick={() => execCommand("removeFormat")}
            icon={<Eraser size={14} />}
            title="Clear Format"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="text-[9px] text-primary px-3 uppercase tracking-[0.2em] font-black hidden sm:block bg-primary/5 py-1.5 rounded-full border border-primary/10">
            Elite Framework Editor
          </div>
        </div>
      </div>

      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        className="min-h-[500px] p-10 text-base text-black font-black outline-none rich-content max-w-none overflow-y-auto selection:bg-primary/20 leading-relaxed"
        data-placeholder={placeholder}
      />

      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #cbd5e1;
          pointer-events: none;
          font-weight: 400;
        }
        .rich-content img {
          max-width: 100%;
          border-radius: 1rem;
          margin: 1.5rem 0;
          box-shadow: 0 10px 30px -10px rgba(0,0,0,0.1);
        }
        .rich-content h1 {
          font-size: 1.5rem;
          font-weight: 900;
          color: black;
          margin: 2rem 0 1rem 0;
          text-transform: uppercase;
          letter-spacing: -0.02em;
        }
        .rich-content h2 {
          font-size: 1.25rem;
          font-weight: 900;
          color: black;
          margin: 1.5rem 0 0.75rem 0;
        }
        .rich-content p {
          margin-bottom: 1rem;
        }
        .rich-content hr {
          border: 0;
          border-top: 2px solid rgba(0,0,0,0.05);
          margin: 2rem 0;
        }
        .rich-content a {
          color: #3b82f6;
          text-decoration: underline;
          font-weight: 900;
        }
      `}</style>
    </div>
  );
}

function ToolbarButton({
  onClick,
  icon,
  title,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      className="p-2 rounded-lg hover:bg-white hover:text-blue-600 text-slate-400 transition-all border border-transparent hover:border-slate-200 hover:shadow-sm"
      title={title}
    >
      {icon}
    </button>
  );
}
