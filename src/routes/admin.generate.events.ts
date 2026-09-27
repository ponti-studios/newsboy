import type { ActionFunctionArgs } from "react-router";

import { BRAND_NAME } from "~/config/brand";
import { getGameAdminActor } from "~/lib/admin/auth";
import { resolveAdminGame } from "~/lib/admin/inventory";
import { readGenerateForm } from "~/lib/admin/generate-form";
import { startGeneration } from "~/lib/admin/generate.server";
import { DEFAULT_GAME_SLUG } from "~/lib/generation/catalog";
import { assertSameOrigin } from "~/lib/infrastructure/origin";

/**
 * Starts a generation and returns immediately with its run id — the actual
 * LLM call happens detached from this request (see startGeneration). Live
 * progress after this point comes from the SSE route at generate/stream, not
 * from this response.
 */
export async function action({ request, context }: ActionFunctionArgs) {
  const originDenied = assertSameOrigin(request);
  if (originDenied) return originDenied;

  const auth = getGameAdminActor(context);
  const form = await request.formData();
  const slug = String(form.get("game") ?? DEFAULT_GAME_SLUG);
  const game = await resolveAdminGame(slug);
  if (!game) {
    return Response.json(
      { ok: false, error: `No active ${BRAND_NAME} topic found` },
      { status: 404 },
    );
  }

  const input = readGenerateForm(form);
  const result = await startGeneration(game, input, auth.userId);
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
