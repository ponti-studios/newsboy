import { db } from "@pontistudios/db";

export async function cleanAll() {
  await db.execute("DELETE FROM labs.game_admin_actions");
  await db.execute("DELETE FROM labs.game_generation_candidates");
  await db.execute("DELETE FROM labs.game_puzzle_revisions");
  await db.execute("DELETE FROM labs.games_attempts");
  await db.execute("DELETE FROM labs.games_puzzles");
  await db.execute("DELETE FROM labs.game_generation_runs");
  await db.execute("DELETE FROM labs.articles");
  await db.execute("DELETE FROM labs.games_topics");
}
