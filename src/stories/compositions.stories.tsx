import type { Meta, StoryObj } from "@storybook/react-vite";
import { GameBoard, GameBoardSkeleton } from "../components/game";
import { fallbackPuzzle, guesses, puzzle } from "./fixtures";

const meta = { title: "Game/Compositions", parameters: { layout: "padded" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const common = { gameSlug: "reality", isSignedIn: false };

export const FreshBoard: Story = {
  render: () => <GameBoard {...common} puzzle={puzzle} initialGuesses={[]} />,
};
export const BoardWithGuesses: Story = {
  render: () => <GameBoard {...common} puzzle={puzzle} initialGuesses={guesses} />,
};
export const FallbackBoard: Story = {
  render: () => <GameBoard {...common} puzzle={fallbackPuzzle} initialGuesses={[]} />,
};
export const BoardSkeleton: Story = { render: () => <GameBoardSkeleton /> };
