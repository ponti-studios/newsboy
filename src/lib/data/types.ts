import type { Article, GamesPuzzle as GamesPuzzleRow } from "~/lib/infrastructure/db";

export interface PuzzleRecord extends GamesPuzzleRow {
  article: Article;
}
