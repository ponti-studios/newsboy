import { ABOUT_DESCRIPTION, AboutPage } from "~/components/pages/about-page";
import { BRAND_NAME } from "~/config/brand";

export function meta() {
  return [{ title: `About — ${BRAND_NAME}` }, { name: "description", content: ABOUT_DESCRIPTION }];
}

export default function AboutRoute() {
  return <AboutPage />;
}
