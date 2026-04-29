// 사용자가 붙여넣는 시스템 카드 형식을 트리로 파싱한다.
// 형식 예:
//   [Title
//     : Section
//       - bullet item
//         continuation line
//         : sub-item (label)
//             ※ 추가 메모
//   ]

export type SystemBlock = {
  type: "label" | "bullet" | "note";
  text: string;
  depth: number;
  children: SystemBlock[];
};

export type SystemDoc = {
  title: string;
  blocks: SystemBlock[];
};

export function parseSystem(input: string): SystemDoc | null {
  if (!input) return null;
  let text = input.trim();
  if (!text) return null;
  // 바깥 [ ... ] 둘러싸기 제거 — 없어도 진행
  if (text.startsWith("[") && text.endsWith("]")) {
    text = text.slice(1, -1).trim();
  }
  if (!text) return null;

  const lines = text.split(/\r?\n/);
  // 빈 줄 건너뛰며 첫 비빈 줄 = 제목
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  if (i >= lines.length) return null;
  const title = lines[i].trim();
  i++;

  type Raw = {
    depth: number;
    type: "label" | "bullet" | "note" | "cont";
    text: string;
  };
  const raw: Raw[] = [];
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const indent = line.length - line.trimStart().length;
    const t = line.trim();
    if (t.startsWith(":")) {
      raw.push({ depth: indent, type: "label", text: t.slice(1).trim() });
    } else if (t.startsWith("-")) {
      raw.push({ depth: indent, type: "bullet", text: t.slice(1).trim() });
    } else if (t.startsWith("※")) {
      raw.push({ depth: indent, type: "note", text: t.slice(1).trim() });
    } else {
      raw.push({ depth: indent, type: "cont", text: t });
    }
  }

  // 연속 라인은 직전 항목의 본문으로 합침
  const merged: Raw[] = [];
  for (const r of raw) {
    if (r.type === "cont" && merged.length > 0) {
      merged[merged.length - 1].text += "\n" + r.text;
    } else {
      merged.push(r);
    }
  }

  // depth 기준으로 트리 구성
  const root: SystemBlock[] = [];
  const stack: { depth: number; children: SystemBlock[] }[] = [
    { depth: -1, children: root },
  ];
  for (const r of merged) {
    if (r.type === "cont") continue;
    const node: SystemBlock = {
      type: r.type,
      text: r.text,
      depth: r.depth,
      children: [],
    };
    while (stack.length > 1 && stack[stack.length - 1].depth >= r.depth) {
      stack.pop();
    }
    stack[stack.length - 1].children.push(node);
    stack.push({ depth: r.depth, children: node.children });
  }

  return { title, blocks: root };
}
