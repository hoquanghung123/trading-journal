import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import Image from '@tiptap/extension-image'
import { Link } from '@tiptap/extension-link'
import { Placeholder } from '@tiptap/extension-placeholder'
import { Underline } from '@tiptap/extension-underline'
import { TextAlign } from '@tiptap/extension-text-align'
import { Subscript } from '@tiptap/extension-subscript'
import { Superscript } from '@tiptap/extension-superscript'

import {
  Bold,
  Italic,
  List,
  Image as ImageIcon,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Quote,
  Undo,
  Redo,
  Link as LinkIcon,
  Table as TableIcon,
  Plus,
  Trash2,
  Code,
  Minus,
  ChevronDown,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Highlighter,
  Eraser
} from "lucide-react";
import { cn } from "@/lib/utils";
import React, { useEffect, useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, ExternalLink, Unlink } from "lucide-react";

interface RichEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  uploadImage?: (file: File) => Promise<string>;
  minHeight?: string;
}

// Default upload: convert to base64 (fallback if no uploadImage provided)
const defaultUploadImage = (file: File): Promise<string> =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.readAsDataURL(file);
  });

export function RichEditor({ value, onChange, placeholder, className, uploadImage, minHeight = '500px' }: RichEditorProps) {
  const [linkUrl, setLinkUrl] = useState('');
  const [isLinkPopoverOpen, setIsLinkPopoverOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Stable ref to uploadImage to avoid stale closures in plugin
  const uploadRef = React.useRef(uploadImage ?? defaultUploadImage);
  React.useEffect(() => { uploadRef.current = uploadImage ?? defaultUploadImage; }, [uploadImage]);


  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({
        allowBase64: true,
        HTMLAttributes: {
          class: 'rounded-2xl shadow-lg border border-primary/10 max-w-full my-8'
        }
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline underline-offset-4 font-bold cursor-pointer hover:text-primary/80 transition-colors'
        }
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Start writing...',
      }),
      Subscript,
      Superscript,
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: `tiptap rich-content focus:outline-none p-6 max-w-none font-medium text-foreground selection:bg-primary/10`,
        style: `min-height: ${minHeight}`,
      },
      handlePaste(_view, event) {
        const items = Array.from(event.clipboardData?.items ?? []);
        const imageItems = items.filter((item) => item.type.startsWith('image/'));
        const htmlItem = items.find((item) => item.type === 'text/html');

        // ── Case 1 & 2: HTML paste (may or may not have image files) ─────────
        // Always check HTML first — Ctrl+A from Notion has html but NO image files
        if (htmlItem) {
          htmlItem.getAsString(async (html) => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // Broken images = attachment: or blob: or relative srcs (non-http, non-data)
            const brokenImgs = Array.from(doc.querySelectorAll('img')).filter(
              (img) => img.src && !img.src.startsWith('http') && !img.src.startsWith('data:')
            );

            if (brokenImgs.length === 0) {
              // No broken images → standard rich-text paste
              editor?.commands.insertContent(html);
              return;
            }

            // ── Case 1: Notion single-image copy (html + image binary files) ──
            if (imageItems.length > 0) {
              setIsUploading(true);
              try {
                const files = imageItems
                  .map((i) => i.getAsFile())
                  .filter((f): f is File => f !== null);

                const uploadedUrls = await Promise.all(
                  files.map((f) => uploadRef.current(f))
                );

                // Replace broken srcs in document order
                brokenImgs.forEach((img, idx) => {
                  if (uploadedUrls[idx]) {
                    img.setAttribute('src', uploadedUrls[idx]);
                  } else {
                    img.remove(); // no matching file → drop the broken img
                  }
                });

                editor?.commands.insertContent(doc.body.innerHTML);
              } catch (err) {
                console.error('[RichEditor] Notion image upload failed:', err);
              } finally {
                setIsUploading(false);
              }
              return;
            }

            // ── Case 2: Ctrl+A from Notion (html only, no image binaries) ────
            // Images in clipboard are unreachable (attachment: / auth-gated).
            // Drop broken <img> nodes and preserve the surrounding text/structure.
            brokenImgs.forEach((img) => img.remove());
            editor?.commands.insertContent(doc.body.innerHTML);
          });

          event.preventDefault();
          return true;
        }

        // ── Case 3: Pure image-file paste (screenshot, drag-drop) ────────────
        if (imageItems.length === 0) return false;

        event.preventDefault();
        imageItems.forEach((item) => {
          const file = item.getAsFile();
          if (!file) return;
          setIsUploading(true);
          uploadRef.current(file)
            .then((url) => editor?.chain().focus().setImage({ src: url }).run())
            .catch((err) => console.error('[RichEditor] Image paste upload failed:', err))
            .finally(() => setIsUploading(false));
        });
        return true;
      },
    },
  })

  // Sync value from outside if it changes
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value)
    }
  }, [value, editor])

  useEffect(() => {
    if (editor?.isActive('link')) {
      setLinkUrl(editor.getAttributes('link').href || '');
    } else {
      setLinkUrl('');
    }
  }, [editor?.isActive('link'), isLinkPopoverOpen]);

  if (!editor) {
    return null
  }

  const addImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setIsUploading(true);
      try {
        const url = await uploadRef.current(file);
        editor.chain().focus().setImage({ src: url }).run();
      } catch (err) {
        console.error('[RichEditor] Image insert upload failed:', err);
      } finally {
        setIsUploading(false);
      }
    };
    input.click();
  }

  const setLink = () => {
    if (linkUrl === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
    }
    setIsLinkPopoverOpen(false);
  };

  const removeLink = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    setIsLinkPopoverOpen(false);
  };

  return (
    <div className={cn("flex flex-col border border-primary/5 rounded-[40px] overflow-hidden bg-white shadow-2xl shadow-primary/5 relative", className)}>
      {/* Upload progress indicator */}
      {isUploading && (
        <div className="absolute inset-x-0 top-0 z-30 h-1 bg-primary/10">
          <div className="h-full bg-primary animate-pulse" style={{ width: '60%' }} />
        </div>
      )}
      {/* TipTap Style Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-white/80 backdrop-blur-md border-b border-primary/5 sticky top-0 z-20 justify-center">
        {/* History Group */}
        <div className="flex items-center gap-0.5 px-1">
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            icon={<Undo size={16} strokeWidth={2.5} />}
            title="Undo"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            icon={<Redo size={16} strokeWidth={2.5} />}
            title="Redo"
          />
        </div>

        <Separator />

        {/* Headings & Lists Group */}
        <div className="flex items-center gap-0.5 px-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 px-2.5 py-2 hover:bg-slate-50 rounded-xl text-slate-500 transition-all text-sm font-bold">
                <Heading size={16} strokeWidth={2.5} />
                <ChevronDown size={12} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="rounded-2xl p-2 border-primary/10 shadow-2xl min-w-[180px]">
              <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className="rounded-xl font-black uppercase text-[10px] p-3 flex justify-between items-center">
                Heading 1 {editor.isActive('heading', { level: 1 }) && <Check size={14} />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className="rounded-xl font-black uppercase text-[10px] p-3 flex justify-between items-center">
                Heading 2 {editor.isActive('heading', { level: 2 }) && <Check size={14} />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className="rounded-xl font-black uppercase text-[10px] p-3 flex justify-between items-center">
                Heading 3 {editor.isActive('heading', { level: 3 }) && <Check size={14} />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} className="rounded-xl font-black uppercase text-[10px] p-3 flex justify-between items-center">
                Heading 4 {editor.isActive('heading', { level: 4 }) && <Check size={14} />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => editor.chain().focus().setParagraph().run()} className="rounded-xl font-black uppercase text-[10px] p-3 flex justify-between items-center border-t border-primary/5 mt-1">
                Paragraph {editor.isActive('paragraph') && <Check size={14} />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 px-2.5 py-2 hover:bg-slate-50 rounded-xl text-slate-500 transition-all text-sm font-bold">
                <List size={16} strokeWidth={2.5} />
                <ChevronDown size={12} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="rounded-2xl p-2 border-primary/10 shadow-2xl">
              <DropdownMenuItem onClick={() => editor.chain().focus().toggleBulletList().run()} className="rounded-xl font-black uppercase text-xs p-3 flex items-center gap-2"><List size={14} /> Bullet List</DropdownMenuItem>
              <DropdownMenuItem onClick={() => editor.chain().focus().toggleOrderedList().run()} className="rounded-xl font-black uppercase text-xs p-3 flex items-center gap-2"><ListOrdered size={14} /> Ordered List</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive('blockquote')}
            icon={<Quote size={16} strokeWidth={2.5} />}
            title="Quote"
          />
        </div>

        <Separator />

        {/* Text Formatting Group */}
        <div className="flex items-center gap-0.5 px-1">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')}
            icon={<Bold size={16} strokeWidth={2.5} />}
            title="Bold"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
            icon={<Italic size={16} strokeWidth={2.5} />}
            title="Italic"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive('strike')}
            icon={<Strikethrough size={16} strokeWidth={2.5} />}
            title="Strike"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            active={editor.isActive('code')}
            icon={<Code size={16} strokeWidth={2.5} />}
            title="Code"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive('underline')}
            icon={<UnderlineIcon size={16} strokeWidth={2.5} />}
            title="Underline"
          />
          <Popover open={isLinkPopoverOpen} onOpenChange={setIsLinkPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "p-2 rounded-xl transition-all border border-transparent",
                  editor.isActive('link')
                    ? "bg-slate-100 text-slate-900 border-slate-200 shadow-inner" 
                    : "text-slate-400 hover:bg-slate-50 hover:text-slate-900"
                )}
                title="Link"
              >
                <LinkIcon size={16} strokeWidth={2.5} />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-3 rounded-2xl border-primary/10 shadow-2xl bg-white/95 backdrop-blur-md" align="start">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <LinkIcon size={14} className="text-primary" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Edit Link</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://example.com"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    className="rounded-xl border-primary/10 focus-visible:ring-primary/20 text-xs h-9"
                    onKeyDown={(e) => e.key === 'Enter' && setLink()}
                  />
                  <Button size="sm" onClick={setLink} className="rounded-xl h-9 px-3 bg-primary hover:bg-primary/90">
                    <Check size={14} />
                  </Button>
                </div>
                {editor.isActive('link') && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={removeLink} 
                    className="w-full rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-50 text-[10px] font-bold uppercase h-8"
                  >
                    <Unlink size={14} className="mr-2" /> Remove Link
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <Separator />

        {/* Scripts Group */}
        <div className="flex items-center gap-0.5 px-1">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleSuperscript().run()}
            active={editor.isActive('superscript')}
            icon={<SuperscriptIcon size={16} strokeWidth={2.5} />}
            title="Superscript"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleSubscript().run()}
            active={editor.isActive('subscript')}
            icon={<SubscriptIcon size={16} strokeWidth={2.5} />}
            title="Subscript"
          />
        </div>

        <Separator />

        {/* Alignment Group */}
        <div className="flex items-center gap-0.5 px-1">
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            active={editor.isActive({ textAlign: 'left' })}
            icon={<AlignLeft size={16} strokeWidth={2.5} />}
            title="Align Left"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            active={editor.isActive({ textAlign: 'center' })}
            icon={<AlignCenter size={16} strokeWidth={2.5} />}
            title="Align Center"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            active={editor.isActive({ textAlign: 'right' })}
            icon={<AlignRight size={16} strokeWidth={2.5} />}
            title="Align Right"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            active={editor.isActive({ textAlign: 'justify' })}
            icon={<AlignJustify size={16} strokeWidth={2.5} />}
            title="Align Justify"
          />
        </div>

        <Separator />

        {/* Add Actions Group */}
        <div className="flex items-center gap-1 px-1">
           <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all text-[10px] font-black uppercase tracking-widest shadow-xl shadow-slate-900/10">
                <Plus size={14} strokeWidth={3} /> Add
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-2xl p-2 border-primary/10 shadow-2xl w-48">
              <DropdownMenuItem onClick={addImage} className="rounded-xl font-black uppercase text-xs p-3 flex items-center gap-2">
                <ImageIcon size={14} /> Insert Image
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} className="rounded-xl font-black uppercase text-xs p-3 flex items-center gap-2">
                <TableIcon size={14} /> Insert Table
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => editor.chain().focus().setHorizontalRule().run()} className="rounded-xl font-black uppercase text-xs p-3 flex items-center gap-2">
                <Minus size={14} /> Horizontal Line
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} className="rounded-xl font-black uppercase text-xs p-3 flex items-center gap-2 text-rose-500">
                <Eraser size={14} /> Clear Format
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <EditorContent editor={editor} />

      <style>{`
        .tiptap p.is-editor-empty:first-child::before {
          color: #adb5bd;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .tiptap table {
          border-collapse: collapse;
          table-layout: fixed;
          width: 100%;
          margin: 1.5rem 0;
          overflow: hidden;
        }
        .tiptap table td,
        .tiptap table th {
          border: 1px solid #e2e8f0;
          box-sizing: border-box;
          min-width: 1em;
          padding: 12px;
          position: relative;
          vertical-align: top;
        }
        .tiptap table th {
          background-color: #f8fafc;
          font-weight: 900;
          text-align: left;
          text-transform: uppercase;
          font-size: 0.75rem;
          letter-spacing: 0.05em;
        }
        .tiptap table .selectedCell:after {
          background: rgba(200, 200, 255, 0.4);
          content: "";
          left: 0;
          right: 0;
          top: 0;
          bottom: 0;
          pointer-events: none;
          position: absolute;
          z-index: 2;
        }
        .tiptap .tableWrapper {
          overflow-x: auto;
          border-radius: 1rem;
          border: 1px solid #e2e8f0;
        }
        .tiptap blockquote {
          border-left: 4px solid #000;
          padding-left: 1.5rem;
          margin: 2rem 0;
          font-style: italic;
          color: #475569;
          font-weight: 600;
        }
        .tiptap img {
          transition: all 0.2s ease-in-out;
          cursor: pointer;
        }
        .tiptap img.ProseMirror-selectednode {
          outline: 1px solid #6366f1;
          outline-offset: 4px;
        }
        .tiptap h1 {
          font-size: 2.25rem;
          font-weight: 700;
          line-height: 1.2;
          margin-top: 2.5rem;
          margin-bottom: 1.5rem;
          letter-spacing: -0.02em;
        }
        .tiptap h2 {
          font-size: 1.5rem;
          font-weight: 700;
          line-height: 1.3;
          margin-top: 2rem;
          margin-bottom: 1rem;
          letter-spacing: -0.01em;
        }
        .tiptap h3 {
          font-size: 1.25rem;
          font-weight: 700;
          line-height: 1.4;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          letter-spacing: -0.01em;
        }
        .tiptap h4 {
          font-size: 1.1rem;
          font-weight: 700;
          line-height: 1.5;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
          letter-spacing: 0.01em;
        }
        .tiptap p {
          margin-bottom: 1.25rem;
          line-height: 1.7;
        }
        .tiptap a {
          color: var(--primary);
          text-decoration: underline;
          text-underline-offset: 4px;
        }
      `}</style>
    </div>
  )
}

function Separator() {
  return <div className="w-px h-6 bg-slate-200 mx-1.5 self-center" />
}

function ToolbarButton({
  onClick,
  icon,
  title,
  active,
  disabled,
  className
}: {
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      disabled={disabled}
      className={cn(
        "p-2 rounded-xl transition-all border border-transparent disabled:opacity-20 disabled:pointer-events-none",
        active 
          ? "bg-slate-100 text-slate-900 border-slate-200 shadow-inner" 
          : "text-slate-400 hover:bg-slate-50 hover:text-slate-900",
        className
      )}
      title={title}
    >
      {icon}
    </button>
  );
}

