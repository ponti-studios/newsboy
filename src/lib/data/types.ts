import type { Article, GamesPuzzle as GamesPuzzleRow } from "@pontistudios/db";

export interface PuzzleRecord extends GamesPuzzleRow {
  article: Article;
}
