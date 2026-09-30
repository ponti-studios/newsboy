import { redirect, type LoaderFunctionArgs } from "react-router";

export function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("game");
  if (!slug) throw Response.json({ error: "Topic is required" }, { status: 404 });
  const query = new URLSearchParams(url.searchParams);
  query.delete("game");
  const suffix = query.size ? `?${query}` : "";
  const path = url.pathname.slice("/admin".length);

  if (path === "/generate") return redirect(`/admin/topics/${slug}/create${suffix}`);
  if (path === "/generate/stream") return redirect(`/admin/topics/${slug}/create/stream${suffix}`);
  if (path === "/inventory") {
    if (query.get("view") === "runs") return redirect(`/admin/topics/${slug}/schedule${suffix}`);
    return redirect(`/admin/topics/${slug}/schedule${suffix}`);
  }
  if (path === "/insights") return redirect(`/admin/topics/${slug}/insights${suffix}`);
  if (path === "/costs") return redirect(`/admin/topics/${slug}/insights/costs${suffix}`);
  if (path === "/analytics") return redirect(`/admin/topics/${slug}/insights/analytics${suffix}`);
  const date = path.match(/^\/dates\/([^/]+)$/)?.[1];
  if (date) return redirect(`/admin/topics/${slug}/schedule/dates/${date}${suffix}`);
  const generationId = path.match(/^\/generations\/([^/]+)$/)?.[1];
  if (generationId) return redirect(`/admin/topics/${slug}/generations/${generationId}${suffix}`);
  throw Response.json({ error: "Admin page not found" }, { status: 404 });
}
