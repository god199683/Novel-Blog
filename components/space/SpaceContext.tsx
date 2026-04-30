"use client";

import { createContext, useContext } from "react";
import type { Space } from "@/lib/supabase";

type Ctx = {
  space: Space;
  isOwner: boolean;
};

const SpaceCtx = createContext<Ctx | null>(null);

export function SpaceProvider({
  space,
  isOwner,
  children,
}: {
  space: Space;
  isOwner: boolean;
  children: React.ReactNode;
}) {
  return (
    <SpaceCtx.Provider value={{ space, isOwner }}>{children}</SpaceCtx.Provider>
  );
}

export function useSpace(): Ctx {
  const v = useContext(SpaceCtx);
  if (!v) throw new Error("useSpace must be used within SpaceProvider");
  return v;
}
