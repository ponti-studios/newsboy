import { getGameUser, loginUrl, type GameUser } from "../../server/auth";

export type HominemUser = GameUser;
export const getHominemUser = getGameUser;
export function buildHominemLoginUrl(returnTo: string) {
  return loginUrl(new Request(returnTo), returnTo);
}
