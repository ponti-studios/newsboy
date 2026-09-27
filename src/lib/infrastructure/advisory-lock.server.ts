import { getSql } from "@pontistudios/db";

export const GAME_GENERATE_LOCK_KEYS = [42, 17] as const;
export type GenerateLockResult<T> = { ok: true; value: T } | { ok: false; code: "lock_busy" };

export async function withGenerateLock<T>(fn: () => Promise<T>): Promise<GenerateLockResult<T>> {
  const reserved = await getSql().reserve();
  try {
    const [row] = await reserved<[{ locked: boolean }]>`
      SELECT pg_try_advisory_lock(${GAME_GENERATE_LOCK_KEYS[0]}, ${GAME_GENERATE_LOCK_KEYS[1]}) AS locked
    `;
    if (!row?.locked) return { ok: false, code: "lock_busy" };
    try {
      return { ok: true, value: await fn() };
    } finally {
      await reserved`SELECT pg_advisory_unlock(${GAME_GENERATE_LOCK_KEYS[0]}, ${GAME_GENERATE_LOCK_KEYS[1]})`;
    }
  } finally {
    reserved.release();
  }
}
