"use client";

import { useEditor, EditorContent, Editor as TiptapEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import TextStyle from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import { Extension } from "@tiptap/core";
import { useEffect, useState } from "react";

type Props = {
  initialContent?: string;
  onChange: (html: string) => void;
};

// Custom FontSize extension (not included in core)
const FontSize = Extension.create({
  name: "fontSize",
  addOptions() {
    return { types: ["textStyle"] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el) => (el as HTMLElement).style.fontSize || null,
            renderHTML: (attrs) =>
              attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ chain }: { chain: () => { setMark: (name: string, attrs: object) => { run: () => boolean } } }) =>
          chain().setMark("textStyle", { fontSize: size }).run(),
      unsetFontSize:
        () =>
        ({ chain }: { chain: () => { setMark: (name: string, attrs: object) => { removeEmptyTextStyle: () => { run: () => boolean } } } }) =>
          chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run(),
    } as never;
  },
});

// Custom LineHeight extension — applied to block-level nodes (paragraph, headings)
const LineHeight = Extension.create({
  name: "lineHeight",
  addOptions() {
    return { types: ["paragraph", "heading"] };
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (el) => (el as HTMLElement).style.lineHeight || null,
            renderHTML: (attrs) =>
              attrs.lineHeight ? { style: `line-height: ${attrs.lineHeight}` } : {},
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setLineHeight:
        (value: string) =>
        ({
          commands,
        }: {
          commands: {
            updateAttributes: (type: string, attrs: object) => boolean;
          };
        }) => {
          return (this.options.types as string[]).every((type) =>
            commands.updateAttributes(type, { lineHeight: value })
          );
        },
      unsetLineHeight:
        () =>
        ({
          commands,
        }: {
          commands: {
            resetAttributes: (type: string, attrs: string) => boolean;
          };
        }) => {
          return (this.options.types as string[]).every((type) =>
            commands.resetAttributes(type, "lineHeight")
          );
        },
    } as never;
  },
});

const FONT_SIZES = [
  { label: "매우 작게", value: "12px" },
  { label: "작게", value: "14px" },
  { label: "보통", value: "17px" },
  { label: "크게", value: "20px" },
  { label: "아주 크게", value: "24px" },
  { label: "크게·크게", value: "32px" },
];

const LINE_HEIGHTS = [
  { label: "좁게", value: "1" },
  { label: "조금 좁게", value: "1.25" },
  { label: "보통", value: "1.5" },
  { label: "조금 넓게", value: "1.75" },
  { label: "넓게", value: "2" },
  { label: "아주 넓게", value: "2.5" },
];

const DEFAULT_FONTS = [
  { label: "기본(Pretendard)", value: "Pretendard, system-ui, sans-serif" },
  { label: "Noto Serif KR", value: "'Noto Serif KR', serif" },
  { label: "나눔고딕", value: "'Nanum Gothic', 'NanumGothic', sans-serif" },
  { label: "나눔명조", value: "'Nanum Myeongjo', 'NanumMyeongjo', serif" },
  { label: "나눔손글씨 펜", value: "'Nanum Pen Script', cursive" },
  { label: "맑은 고딕", value: "'Malgun Gothic', '맑은 고딕', sans-serif" },
  { label: "돋움", value: "Dotum, '돋움', sans-serif" },
  { label: "굴림", value: "Gulim, '굴림', sans-serif" },
  { label: "바탕", value: "Batang, '바탕', serif" },
  { label: "궁서", value: "Gungsuh, '궁서', serif" },
  { label: "Apple SD 산돌", value: "'Apple SD Gothic Neo', sans-serif" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
];

type FontEntry = { label: string; value: string };
type UserFont = { id: string; name: string };

export default function Editor({ initialContent = "", onChange }: Props) {
  const [userFonts, setUserFonts] = useState<UserFont[]>([]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Image.configure({ inline: false, allowBase64: false }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Placeholder.configure({ placeholder: "이야기를 시작해보세요..." }),
      Typography,
      TextStyle,
      FontFamily.configure({ types: ["textStyle"] }),
      FontSize,
      LineHeight,
    ],
    content: initialContent,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: { class: "prose max-w-none focus:outline-none" },
    },
  });

  useEffect(() => () => void editor?.destroy(), [editor]);

  // Load user's saved fonts on mount
  useEffect(() => {
    (async () => {
      const { supabase } = await import("@/lib/supabase");
      const sb = supabase();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) return;
      const { data } = await sb
        .from("user_fonts")
        .select("id,name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (Array.isArray(data)) setUserFonts(data as { id: string; name: string }[]);
    })().catch(() => {});
  }, []);

  const addFont = async () => {
    const win = window as unknown as {
      queryLocalFonts?: () => Promise<{ family: string; fullName: string }[]>;
    };
    let candidate: string | null = null;

    if (win.queryLocalFonts) {
      try {
        const list = await win.queryLocalFonts();
        const families = Array.from(
          new Set(list.map((f) => f.family))
        ).sort((a, b) => a.localeCompare(b, "ko"));
        const sample = families.slice(0, 30).join(", ");
        candidate = window.prompt(
          `추가할 글씨체 이름을 입력하세요.\n\n예시 (시스템에서 감지된 일부): ${sample}${
            families.length > 30 ? "..." : ""
          }`,
          ""
        );
      } catch {
        candidate = window.prompt("추가할 글씨체 이름을 입력하세요 (예: 나눔고딕)", "");
      }
    } else {
      candidate = window.prompt(
        "추가할 글씨체 이름을 입력하세요 (예: 나눔고딕, Arial)",
        ""
      );
    }

    if (!candidate) return;
    const name = candidate.trim();
    if (!name) return;

    try {
      const { supabase } = await import("@/lib/supabase");
      const sb = supabase();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) throw new Error("로그인이 필요합니다");
      const { data, error } = await sb
        .from("user_fonts")
        .insert({ user_id: user.id, name })
        .select()
        .single();
      if (error) throw new Error(error.message);
      setUserFonts((fs) => [
        { id: (data as { id: string }).id, name: (data as { name: string }).name },
        ...fs,
      ]);
    } catch (e) {
      alert(e instanceof Error ? e.message : "오류");
    }
  };

  const deleteFont = async (id: string, name: string) => {
    if (!confirm(`'${name}' 글씨체를 목록에서 지울까요?`)) return;
    try {
      const { supabase } = await import("@/lib/supabase");
      const { error } = await supabase().from("user_fonts").delete().eq("id", id);
      if (error) throw new Error(error.message);
      setUserFonts((fs) => fs.filter((f) => f.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "오류");
    }
  };

  if (!editor) return <div className="h-64 animate-pulse rounded bg-sky-50" />;

  const fonts: FontEntry[] = [
    ...DEFAULT_FONTS,
    ...(userFonts.length > 0
      ? [
          { label: "── 내 글씨체 ──", value: "" },
          ...userFonts.map((f) => ({ label: f.name, value: `'${f.name}'` })),
        ]
      : []),
  ];

  return (
    <div className="rounded-xl border border-sky-100 bg-white shadow-sm">
      <Toolbar
        editor={editor}
        fonts={fonts}
        userFonts={userFonts}
        onAddFont={addFont}
        onDeleteFont={deleteFont}
      />
      <div className="px-4">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

type ToolbarProps = {
  editor: TiptapEditor;
  fonts: FontEntry[];
  userFonts: UserFont[];
  onAddFont: () => void;
  onDeleteFont: (id: string, name: string) => void;
};

function Toolbar({ editor, fonts, userFonts, onAddFont, onDeleteFont }: ToolbarProps) {
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
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const btn = (active: boolean) =>
    `rounded px-2 py-1 text-sm ${
      active ? "bg-brand text-white" : "text-slate-700 hover:bg-sky-50"
    }`;

  const currentFont =
    (editor.getAttributes("textStyle").fontFamily as string | undefined) ?? "";
  const currentSize =
    (editor.getAttributes("textStyle").fontSize as string | undefined) ?? "";
  const currentLineHeight =
    (editor.getAttributes("paragraph").lineHeight as string | undefined) ??
    (editor.getAttributes("heading").lineHeight as string | undefined) ??
    "";

  const removeUserFont = () => {
    if (userFonts.length === 0) {
      alert("삭제할 사용자 글씨체가 없어요.");
      return;
    }
    const list = userFonts.map((f, i) => `${i + 1}. ${f.name}`).join("\n");
    const choice = window.prompt(`삭제할 글씨체 번호를 입력하세요:\n\n${list}`, "");
    if (!choice) return;
    const idx = parseInt(choice.trim(), 10) - 1;
    if (Number.isNaN(idx) || idx < 0 || idx >= userFonts.length) {
      alert("올바른 번호를 입력해 주세요.");
      return;
    }
    const target = userFonts[idx];
    onDeleteFont(target.id, target.name);
  };

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-sky-100 bg-sky-50/30 p-2">
      {/* Font family */}
      <select
        title="글씨체"
        value={currentFont}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) editor.chain().focus().unsetFontFamily().run();
          else editor.chain().focus().setFontFamily(v).run();
        }}
        className="rounded border border-sky-200 bg-white px-1 py-1 text-xs text-slate-700"
      >
        <option value="">글씨체</option>
        {fonts.map((f, i) => (
          <option
            key={`${f.label}-${i}`}
            value={f.value}
            disabled={f.value === ""}
            style={{ fontFamily: f.value || undefined }}
          >
            {f.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        title="원하는 글씨체 추가하기 (저장됨)"
        onClick={onAddFont}
        className="rounded border border-sky-200 px-2 py-1 text-xs text-slate-600 hover:border-brand hover:text-brand"
      >
        ✨ + 폰트
      </button>
      {userFonts.length > 0 && (
        <button
          type="button"
          title="추가한 글씨체 삭제"
          onClick={removeUserFont}
          className="rounded border border-sky-200 px-2 py-1 text-xs text-slate-500 hover:border-red-300 hover:text-red-500"
        >
          − 폰트
        </button>
      )}

      {/* Font size */}
      <select
        title="글자 크기"
        value={currentSize}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) (editor.chain().focus() as unknown as { unsetFontSize: () => { run: () => void } }).unsetFontSize().run();
          else (editor.chain().focus() as unknown as { setFontSize: (s: string) => { run: () => void } }).setFontSize(v).run();
        }}
        className="rounded border border-sky-200 bg-white px-1 py-1 text-xs text-slate-700"
      >
        <option value="">크기</option>
        {FONT_SIZES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label} ({s.value})
          </option>
        ))}
      </select>

      {/* Line height */}
      <select
        title="줄 간격"
        value={currentLineHeight}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) (editor.chain().focus() as unknown as { unsetLineHeight: () => { run: () => void } }).unsetLineHeight().run();
          else (editor.chain().focus() as unknown as { setLineHeight: (s: string) => { run: () => void } }).setLineHeight(v).run();
        }}
        className="rounded border border-sky-200 bg-white px-1 py-1 text-xs text-slate-700"
      >
        <option value="">줄간격</option>
        {LINE_HEIGHTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label} ({s.value})
          </option>
        ))}
      </select>

      <span className="mx-1 h-5 w-px bg-sky-200" />

      <button
        type="button"
        title="제목 1 (큰 제목)"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={btn(editor.isActive("heading", { level: 1 }))}
      >
        H1
      </button>
      <button
        type="button"
        title="제목 2 (중간 제목)"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={btn(editor.isActive("heading", { level: 2 }))}
      >
        H2
      </button>
      <button
        type="button"
        title="제목 3 (작은 제목)"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={btn(editor.isActive("heading", { level: 3 }))}
      >
        H3
      </button>

      <span className="mx-1 h-5 w-px bg-sky-200" />

      <button
        type="button"
        title="굵게 (Ctrl+B)"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btn(editor.isActive("bold"))}
      >
        <b>B</b>
      </button>
      <button
        type="button"
        title="기울임 (Ctrl+I)"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btn(editor.isActive("italic"))}
      >
        <i>I</i>
      </button>
      <button
        type="button"
        title="취소선"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={btn(editor.isActive("strike"))}
      >
        <s>S</s>
      </button>

      <span className="mx-1 h-5 w-px bg-sky-200" />

      <button
        type="button"
        title="글머리 기호 목록"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btn(editor.isActive("bulletList"))}
      >
        • List
      </button>
      <button
        type="button"
        title="번호 매기기 목록"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={btn(editor.isActive("orderedList"))}
      >
        1. List
      </button>
      <button
        type="button"
        title="인용문"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={btn(editor.isActive("blockquote"))}
      >
        &ldquo; &rdquo;
      </button>
      <button
        type="button"
        title="코드 블록"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        className={btn(editor.isActive("codeBlock"))}
      >
        {"</>"}
      </button>

      <span className="mx-1 h-5 w-px bg-sky-200" />

      <button
        type="button"
        title="링크 삽입/편집 (Ctrl+K)"
        onClick={addLink}
        className={btn(editor.isActive("link"))}
      >
        🔗
      </button>
      <button
        type="button"
        title="이미지 URL로 삽입"
        onClick={addImage}
        className={btn(false)}
      >
        🖼️
      </button>
      <button
        type="button"
        title="구분선"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        className={btn(false)}
      >
        —
      </button>

      <span className="mx-1 h-5 w-px bg-sky-200" />

      <button
        type="button"
        title="실행 취소 (Ctrl+Z)"
        onClick={() => editor.chain().focus().undo().run()}
        className={btn(false)}
      >
        ↶
      </button>
      <button
        type="button"
        title="다시 실행 (Ctrl+Shift+Z)"
        onClick={() => editor.chain().focus().redo().run()}
        className={btn(false)}
      >
        ↷
      </button>
    </div>
  );
}
