import { Button, Card, CardContent, CardHeader, CardTitle } from "@ponti-studios/ui/primitives";
import { Link, useLoaderData, type LoaderFunctionArgs } from "react-router";

import { BRAND_NAME } from "~/config/brand";

export function meta() {
  return [{ title: `${BRAND_NAME} insights` }, { name: "robots", content: "noindex" }];
}

export async function loader({ params }: LoaderFunctionArgs) {
  const slug = params.slug;
  if (!slug) throw Response.json({ error: "Missing topic" }, { status: 400 });
  return { slug };
}

export default function GameAdminInsights() {
  const { slug } = useLoaderData<typeof loader>();
  const base = `/admin/topics/${encodeURIComponent(slug)}/insights`;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-semibold tracking-tight">Insights</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Generation costs</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link to={`${base}/costs`}>View generation costs</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Player activity</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link to={`${base}/analytics`}>View player activity</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
