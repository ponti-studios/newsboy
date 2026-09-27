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
  return <Outlet />;
}
