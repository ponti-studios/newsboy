import { db, gameEvents } from "@pontistudios/db";

export interface GameEventInput {
  event: "game_started" | "guess_made" | "game_won" | "game_lost" | "shared" | "clue_used";
  sessionId: string;
  topicSlug: string;
  puzzleDate: string;
  attemptCount: number;
  clueCount: number;
  acquisitionSource: string | null;
}

export async function recordGameEvent(input: GameEventInput): Promise<void> {
  await db.insert(gameEvents).values(input);
}
