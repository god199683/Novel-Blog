"use client";

import type { Grade } from "@/lib/supabase";

export default function GradeBadge({ grade }: { grade: Grade }) {
  return (
    <span
      className={`grade-${grade} inline-block rounded px-2 py-0.5 text-xs font-bold text-white`}
    >
      {grade}
    </span>
  );
}
