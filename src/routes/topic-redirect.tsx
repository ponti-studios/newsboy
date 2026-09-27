import { redirect, type LoaderFunctionArgs } from "react-router";

import { DEFAULT_GAME_SLUG } from "../lib/generation/catalog";

export function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const defaultSlug = process.env.GAME_DEFAULT_SLUG ?? DEFAULT_GAME_SLUG;
  throw redirect(`/${defaultSlug}${url.search}`);
}
