import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { GameBoard, GameBoardSkeleton, GameResult, GuessGrid } from "../components/game";
import boardStyles from "../components/game/game-board.module.css";
import { fallbackPuzzle, gameState, guesses, puzzle } from "./fixtures";

const meta = { title: "Game/Compositions", parameters: { layout: "padded" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const common = { loginUrl: "/login", gameSlug: "reality" };

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

export const FirstGuessAuthWall: Story = {
  render: () => {
    const game = gameState({
      guesses: [guesses[0]],
      status: "playing",
      authRequired: true,
      isGameOver: true,
    });

    return (
      <div className={boardStyles.shell}>
        <GuessGrid game={game} dateKey={puzzle.dateKey} />
        <GameResult
          game={game}
          puzzle={puzzle}
          loginUrl={common.loginUrl}
          onShare={fn()}
          onCopy={fn()}
        />
      </div>
    );
  },
};
