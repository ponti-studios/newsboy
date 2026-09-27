import { SectionIntro } from "@ponti-studios/ui/layout";
import { Button } from "@ponti-studios/ui/primitives";
import { Link, useLoaderData, type LoaderFunctionArgs } from "react-router";

import { loadAdminInventory } from "~/lib/admin/inventory";
import { DEFAULT_GAME_SLUG } from "~/lib/generation/catalog";

import { InventoryList } from "./admin.inventory-list";

import { BRAND_NAME } from "~/config/brand";

export function meta() {
  return [{ title: `${BRAND_NAME} inventory` }, { name: "robots", content: "noindex" }];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const slug = new URL(request.url).searchParams.get("game") ?? DEFAULT_GAME_SLUG;
  const inventory = await loadAdminInventory(slug);
  if (!inventory) {
    throw Response.json({ error: `No active ${BRAND_NAME} topic found` }, { status: 404 });
  }
  return inventory;
}

export default function GameAdminInventory() {
  const inventory = useLoaderData<typeof loader>();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link to={`/admin?game=${inventory.game.slug}`}>← Admin</Link>
      </Button>

      <SectionIntro
        eyebrow={inventory.game.name}
        title="Inventory"
        description={`${inventory.cells.length} dates · Players are signed-in people who started that day, not generations`}
      />

      <InventoryList cells={inventory.cells} gameSlug={inventory.game.slug} />
    </main>
  );
}
