import { Outlet } from "react-router";

import { requireGameAdminMiddleware } from "~/lib/admin/auth";

export const middleware = [requireGameAdminMiddleware];

// Server middleware only runs on client nav when a loader exists on this match.
export function loader() {
  return null;
}

export function meta() {
  return [{ name: "robots", content: "noindex" }];
}

export default function GameAdminLayout() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <Outlet />
    </main>
  );
}
