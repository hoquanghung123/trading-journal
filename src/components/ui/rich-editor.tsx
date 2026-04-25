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
  Redo
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
    <div className={cn("flex flex-col border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm", className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-1 mr-2">
          <ToolbarButton onClick={() => execCommand("undo")} icon={<Undo size={14} />} title="Undo" />
          <ToolbarButton onClick={() => execCommand("redo")} icon={<Redo size={14} />} title="Redo" />
        </div>
        
        <div className="w-px h-4 bg-slate-200 mx-1" />
        
        <div className="flex items-center gap-1 mx-2">
          <ToolbarButton onClick={() => execCommand("formatBlock", "H1")} icon={<Heading1 size={14} />} title="H1" />
          <ToolbarButton onClick={() => execCommand("formatBlock", "H2")} icon={<Heading2 size={14} />} title="H2" />
        </div>

        <div className="w-px h-4 bg-slate-200 mx-1" />

        <div className="flex items-center gap-1 mx-2">
          <ToolbarButton onClick={() => execCommand("bold")} icon={<Bold size={14} />} title="Bold" />
          <ToolbarButton onClick={() => execCommand("italic")} icon={<Italic size={14} />} title="Italic" />
          <ToolbarButton onClick={() => execCommand("underline")} icon={<Underline size={14} />} title="Underline" />
          <ToolbarButton onClick={() => execCommand("strikeThrough")} icon={<Strikethrough size={14} />} title="Strike" />
        </div>

        <div className="w-px h-4 bg-slate-200 mx-1" />

        <div className="flex items-center gap-1 mx-2">
          <ToolbarButton onClick={() => execCommand("insertUnorderedList")} icon={<List size={14} />} title="Bullets" />
          <ToolbarButton onClick={() => execCommand("insertOrderedList")} icon={<ListOrdered size={14} />} title="Numbers" />
          <ToolbarButton onClick={() => execCommand("formatBlock", "blockquote")} icon={<Quote size={14} />} title="Quote" />
        </div>

        <div className="w-px h-4 bg-slate-200 mx-1" />

        <div className="flex items-center gap-1 mx-2">
          <ToolbarButton onClick={() => execCommand("justifyLeft")} icon={<AlignLeft size={14} />} title="Left" />
          <ToolbarButton onClick={() => execCommand("justifyCenter")} icon={<AlignCenter size={14} />} title="Center" />
          <ToolbarButton onClick={() => execCommand("justifyRight")} icon={<AlignRight size={14} />} title="Right" />
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
        
        <div className="ml-auto text-[9px] text-slate-400 px-3 uppercase tracking-[0.2em] font-black hidden sm:block">
           Elite Editor Pro
        </div>
      </div>

      {/* Editable Area */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        className="min-h-[400px] p-8 text-sm text-slate-700 outline-none rich-content max-w-none overflow-y-auto"
        placeholder={placeholder}
      />
      
      <style>{`
        [contenteditable]:empty:before {
          content: attr(placeholder);
          color: #cbd5e1;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}

function ToolbarButton({ onClick, icon, title }: { onClick: () => void; icon: React.ReactNode; title: string }) {
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
