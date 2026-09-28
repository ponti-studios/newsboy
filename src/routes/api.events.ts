import type { ActionFunctionArgs } from "react-router";
import { z } from "zod";

import { recordGameEvent } from "../lib/data/events.server";

const eventSchema = z.object({
  event: z.enum(["game_started", "guess_made", "game_won", "game_lost", "shared", "clue_used"]),
  sessionId: z.string().uuid(),
  topicSlug: z.string().regex(/^[a-z0-9-]{1,50}$/),
  puzzleDate: z.string().date(),
  attemptCount: z.number().int().min(0).max(6),
  clueCount: z.number().int().min(0).max(1),
  acquisitionSource: z.string().trim().min(1).max(80).nullable(),
});

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  let input: z.infer<typeof eventSchema>;
  try {
    input = eventSchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Invalid event payload" }, { status: 400 });
  }

  await recordGameEvent(input);
  return new Response(null, { status: 204 });
}
