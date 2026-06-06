import { Suspense } from "react";
import WorkspaceClient from "./WorkspaceClient";
import type { Viewport } from "next";

export const metadata = {
  title: "Git Workspace - GitSocial",
  description: "Manage your repositories, edit code, and sync changes directly from the web.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function WorkspacePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
          <p className="text-sm font-semibold tracking-wide text-slate-400 animate-pulse">Loading developer workspace...</p>
        </div>
      </div>
    }>
      <WorkspaceClient />
    </Suspense>
  );
}
