import { Link, Outlet, useLocation, type LoaderFunctionArgs } from "react-router";

import { requireGameAdminMiddleware } from "~/lib/admin/auth";

export const middleware = [requireGameAdminMiddleware];

// Keep a loader on the protected layout so its middleware is included during client navigation.
export async function loader(_args: LoaderFunctionArgs) {
  return null;
}

// Server middleware only runs on client nav when a loader exists on this match.
export function meta() {
  return [{ name: "robots", content: "noindex" }];
}

export default function GameAdminLayout() {
  const location = useLocation();
  const path = location.pathname;
  const items = [
    { id: "home", label: "All topics", to: "/admin", active: path === "/admin" },
    { id: "topics", label: "Topics", to: "/admin/topics", active: path === "/admin/topics" },
  ] as const;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <div className="mb-8 flex w-full flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Admin" className="-mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto px-1">
          {items.map((item) => (
            <Link
              key={item.id}
              to={item.to}
              aria-current={item.active ? "page" : undefined}
              className="text-muted-foreground hover:bg-muted hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground shrink-0 rounded-md px-3 py-2 text-sm font-medium"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <Outlet />
    </main>
  );
}
