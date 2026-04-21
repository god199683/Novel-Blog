"use client";

import { useEditor, EditorContent, Editor as TiptapEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import { useEffect } from "react";

type Props = {
  initialContent?: string;
  onChange: (html: string) => void;
};

export default function Editor({ initialContent = "", onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Image.configure({ inline: false, allowBase64: false }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Placeholder.configure({
        placeholder: "이야기를 시작해보세요...",
      }),
      Typography,
    ],
    content: initialContent,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "prose max-w-none focus:outline-none",
      },
    },
  });

  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  if (!editor) return <div className="h-64 animate-pulse rounded bg-zinc-100" />;

  return (
    <div className="rounded-lg border border-zinc-200">
      <Toolbar editor={editor} />
      <div className="px-4">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function Toolbar({ editor }: { editor: TiptapEditor }) {
  const addImage = () => {
    const url = window.prompt("이미지 URL을 입력하세요");
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };
  const addLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("링크 URL", prev ?? "");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();
  };

  const btn = (active: boolean) =>
    `rounded px-2 py-1 text-sm ${
      active ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
    }`;

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200 p-2">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={btn(editor.isActive("heading", { level: 1 }))}
      >
        H1
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={btn(editor.isActive("heading", { level: 2 }))}
      >
        H2
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={btn(editor.isActive("heading", { level: 3 }))}
      >
        H3
      </button>
      <span className="mx-1 h-5 w-px bg-zinc-200" />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btn(editor.isActive("bold"))}
      >
        <b>B</b>
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btn(editor.isActive("italic"))}
      >
        <i>I</i>
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={btn(editor.isActive("strike"))}
      >
        <s>S</s>
      </button>
      <span className="mx-1 h-5 w-px bg-zinc-200" />
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btn(editor.isActive("bulletList"))}
      >
        • List
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={btn(editor.isActive("orderedList"))}
      >
        1. List
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={btn(editor.isActive("blockquote"))}
      >
        &ldquo; &rdquo;
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        className={btn(editor.isActive("codeBlock"))}
      >
        {"</>"}
      </button>
      <span className="mx-1 h-5 w-px bg-zinc-200" />
      <button type="button" onClick={addLink} className={btn(editor.isActive("link"))}>
        🔗
      </button>
      <button type="button" onClick={addImage} className={btn(false)}>
        🖼️
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        className={btn(false)}
      >
        —
      </button>
      <span className="mx-1 h-5 w-px bg-zinc-200" />
      <button
        type="button"
        onClick={() => editor.chain().focus().undo().run()}
        className={btn(false)}
      >
        ↶
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().redo().run()}
        className={btn(false)}
      >
        ↷
      </button>
    </div>
  );
}
