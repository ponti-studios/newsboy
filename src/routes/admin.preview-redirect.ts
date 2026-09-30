import { redirect, type LoaderFunctionArgs } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("game");
  if (slug) {
    url.searchParams.delete("game");
    url.pathname = `/admin/topics/${slug}/create`;
  } else {
    url.pathname = url.pathname.replace("/admin/preview", "/admin/generate");
  }
  return redirect(`${url.pathname}${url.search}`);
}
