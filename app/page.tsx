"use client";

import { useEffect, useState } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/lib/AuthContext";
import AppShell from "@/components/views/AppShell";
import HomeView from "@/components/views/HomeView";
import LoginView from "@/components/views/LoginView";
import SignupView from "@/components/views/SignupView";
import DashboardView from "@/components/views/DashboardView";
import WriteView from "@/components/views/WriteView";
import EditView from "@/components/views/EditView";
import UserBlogView from "@/components/views/UserBlogView";
import UserPostView from "@/components/views/UserPostView";
import AccountView from "@/components/views/AccountView";

export default function Page() {
  // HashRouter touches `document` on construction, which isn't available
  // during static prerender. Defer the whole app to client-side mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-slate-400 text-sm">
        불러오는 중...
      </div>
    );
  }

  return (
    <AuthProvider>
      <HashRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<HomeView />} />
            <Route path="/login" element={<LoginView />} />
            <Route path="/signup" element={<SignupView />} />
            <Route path="/dashboard" element={<DashboardView />} />
            <Route path="/write" element={<WriteView />} />
            <Route path="/edit/:id" element={<EditView />} />
            <Route path="/account" element={<AccountView />} />
            <Route path="/u/:username" element={<UserBlogView mode="post" />} />
            <Route
              path="/u/:username/materials"
              element={<UserBlogView mode="material" />}
            />
            <Route
              path="/u/:username/materials/:idOrSlug"
              element={<UserPostView />}
            />
            <Route path="/u/:username/:idOrSlug" element={<UserPostView />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      </HashRouter>
    </AuthProvider>
  );
}
