import { redirect, type LoaderFunctionArgs } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  url.pathname = url.pathname.replace("/admin/preview", "/admin/generate");
  return redirect(`${url.pathname}${url.search}`);
}
