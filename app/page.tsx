"use client";

import { useEffect, useState } from "react";
import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";
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
import SpacesListView from "@/components/views/SpacesListView";
import SpaceLayout from "@/components/views/space/SpaceLayout";
import SpaceDashboard from "@/components/views/space/Dashboard";
import SpaceMap from "@/components/views/space/Map";
import SpaceZones from "@/components/views/space/Zones";
import SpaceCreatures from "@/components/views/space/Creatures";
import SpaceByproducts from "@/components/views/space/Byproducts";
import SpaceSettings from "@/components/views/space/Settings";
import SpaceAccess from "@/components/views/space/Access";

function AppShellLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

export default function Page() {
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
        <Routes>
          {/* 풀스크린 공간 페이지 — 소유자 */}
          <Route path="/spaces/:id" element={<SpaceLayout mode="owner" />}>
            <Route index element={<SpaceDashboard />} />
            <Route path="map" element={<SpaceMap />} />
            <Route path="zones" element={<SpaceZones />} />
            <Route path="creatures" element={<SpaceCreatures />} />
            <Route path="byproducts" element={<SpaceByproducts />} />
            <Route path="settings" element={<SpaceSettings />} />
            <Route path="access" element={<SpaceAccess />} />
          </Route>

          {/* 풀스크린 공간 페이지 — 공개 */}
          <Route
            path="/u/:username/spaces/:slug"
            element={<SpaceLayout mode="public" />}
          >
            <Route index element={<SpaceDashboard />} />
            <Route path="map" element={<SpaceMap />} />
            <Route path="zones" element={<SpaceZones />} />
            <Route path="creatures" element={<SpaceCreatures />} />
            <Route path="byproducts" element={<SpaceByproducts />} />
            <Route path="settings" element={<SpaceSettings />} />
            <Route path="access" element={<SpaceAccess />} />
          </Route>

          {/* 일반 라우트 — AppShell 안 */}
          <Route element={<AppShellLayout />}>
            <Route path="/" element={<HomeView />} />
            <Route path="/login" element={<LoginView />} />
            <Route path="/signup" element={<SignupView />} />
            <Route path="/dashboard" element={<DashboardView />} />
            <Route path="/write" element={<WriteView />} />
            <Route path="/edit/:id" element={<EditView />} />
            <Route path="/account" element={<AccountView />} />
            <Route path="/spaces" element={<SpacesListView />} />
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
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
