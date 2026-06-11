import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import {
  Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Link as LinkIcon, Image as ImageIcon,
  Undo, Redo, Minus, Code2,
} from "lucide-react";
import { useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

type ToolbarBtnProps = {
  active?: boolean;
  onClick: () => void;
  title: string;
  testId: string;
  children: React.ReactNode;
};

function TBtn({ active, onClick, title, testId, children }: ToolbarBtnProps) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      data-testid={testId}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded border text-ink transition-colors",
        active ? "border-ink bg-ink text-cream" : "border-ink-10 bg-white hover:bg-cream-2",
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const addLink = useCallback(() => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("URL", previous ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url, target: "_blank" }).run();
  }, [editor]);

  const addImage = useCallback(() => {
    const url = window.prompt("Image URL");
    if (!url) return;
    editor.chain().focus().setImage({ src: url, alt: "" }).run();
  }, [editor]);

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-ink-10 bg-paper px-2 py-2">
      <TBtn testId="tb-h1" title="Heading 1" active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="h-4 w-4" /></TBtn>
      <TBtn testId="tb-h2" title="Heading 2" active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></TBtn>
      <TBtn testId="tb-h3" title="Heading 3" active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="h-4 w-4" /></TBtn>
      <span className="mx-1 h-6 w-px bg-ink-10" />
      <TBtn testId="tb-bold" title="Bold" active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></TBtn>
      <TBtn testId="tb-italic" title="Italic" active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></TBtn>
      <TBtn testId="tb-strike" title="Strike" active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></TBtn>
      <TBtn testId="tb-code" title="Inline code" active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}><Code className="h-4 w-4" /></TBtn>
      <span className="mx-1 h-6 w-px bg-ink-10" />
      <TBtn testId="tb-bullet" title="Bulleted list" active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></TBtn>
      <TBtn testId="tb-ordered" title="Numbered list" active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></TBtn>
      <TBtn testId="tb-blockquote" title="Blockquote" active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-4 w-4" /></TBtn>
      <TBtn testId="tb-codeblock" title="Code block" active={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}><Code2 className="h-4 w-4" /></TBtn>
      <TBtn testId="tb-hr" title="Horizontal rule"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus className="h-4 w-4" /></TBtn>
      <span className="mx-1 h-6 w-px bg-ink-10" />
      <TBtn testId="tb-link" title="Link" active={editor.isActive("link")} onClick={addLink}><LinkIcon className="h-4 w-4" /></TBtn>
      <TBtn testId="tb-image" title="Image" onClick={addImage}><ImageIcon className="h-4 w-4" /></TBtn>
      <span className="mx-1 h-6 w-px bg-ink-10" />
      <TBtn testId="tb-undo" title="Undo" onClick={() => editor.chain().focus().undo().run()}><Undo className="h-4 w-4" /></TBtn>
      <TBtn testId="tb-redo" title="Redo" onClick={() => editor.chain().focus().redo().run()}><Redo className="h-4 w-4" /></TBtn>
    </div>
  );
}

export function RichEditor({
  value,
  onChange,
  placeholder = "Start writing your story…",
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" } }),
      Image.configure({ inline: false, allowBase64: true }),
      Placeholder.configure({ placeholder }),
      Typography,
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "prose-editor min-h-[420px] max-w-none px-4 py-5 focus:outline-none text-ink",
        "data-testid": "wysiwyg-editor",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Update content when the parent resets the post (e.g., switching from new -> edit).
  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) return null;

  return (
    <div className="overflow-hidden rounded border border-ink-10 bg-white">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
