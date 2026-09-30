import { Link, Outlet, redirect, useLoaderData, useLocation, type LoaderFunctionArgs } from "react-router";
import { getGameBySlug } from "~/lib/data/games.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const slug = params.slug;
  if (!slug) throw Response.json({ error: "Missing topic" }, { status: 400 });
  const url = new URL(request.url);
  if (url.pathname === `/admin/topics/${slug}` && (url.searchParams.has("status") || url.searchParams.has("q") || url.searchParams.has("page"))) {
    return redirect(`${url.pathname}/articles${url.search}`);
  }
  const topic = await getGameBySlug(slug);
  if (!topic) throw Response.json({ error: "Topic not found" }, { status: 404 });
  return { topic: { slug: topic.slug, name: topic.name } };
}

export default function AdminTopicLayout() {
  const { topic } = useLoaderData<typeof loader>();
  const location = useLocation();
  const base = `/admin/topics/${topic.slug}`;
  const items = [
    ["Overview", base],
    ["Articles", `${base}/articles`],
    ["Create puzzle", `${base}/create`],
    ["Schedule", `${base}/schedule`],
    ["Insights", `${base}/insights`],
  ] as const;
  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">{topic.name}</h1>
        <nav aria-label={`${topic.name} admin`} className="flex gap-1 overflow-x-auto">
          {items.map(([label, to]) => (
            <Link key={to} to={to} aria-current={location.pathname === to ? "page" : undefined}
              className="text-muted-foreground hover:bg-muted hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground shrink-0 rounded-md px-3 py-2 text-sm font-medium">
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <Outlet />
    </>
  );
}
