import { useEffect, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { GameHeader, GameResult, GuessGrid } from "../components/game";
import { OnscreenKeyboard } from "../components/keyboard/onscreen-keyboard";
import { GAME_ANSWER_LENGTH, type GameGuess } from "../lib/puzzle";
import { TILE_REVEAL_STEP_MS } from "../hooks/use-animation";
import {
  authRequiredGame,
  errorGame,
  failedGame,
  gameState,
  guesses,
  puzzle,
  solvedGame,
} from "./fixtures";

const meta = { title: "Game/Components", parameters: { layout: "padded" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Keyboard: Story = {
  render: () => (
    <OnscreenKeyboard
      letterStates={{ A: "absent", R: "present", I: "correct" }}
      onLetter={fn()}
      onEnter={fn()}
      onBackspace={fn()}
    />
  ),
};
export const KeyboardDisabled: Story = { render: () => <OnscreenKeyboard disabled /> };
export const KeyboardReadOnly: Story = {
  render: () => (
    <OnscreenKeyboard readOnly letterStates={{ A: "absent", R: "present", I: "correct" }} />
  ),
};
export const KeyboardCallbacks: Story = {
  render: () => <OnscreenKeyboard onLetter={fn()} onEnter={fn()} onBackspace={fn()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Q" }));
    await userEvent.click(canvas.getByRole("button", { name: "Enter guess" }));
    await userEvent.click(canvas.getByRole("button", { name: "Delete last letter" }));
  },
};

export const EmptyGrid: Story = { render: () => <GuessGrid game={gameState()} /> };
export const ActiveGrid: Story = {
  render: () => <GuessGrid game={gameState({ guesses, currentGuess: "DR" })} />,
};
export const ErrorGrid: Story = { render: () => <GuessGrid game={errorGame} /> };
export const SolvedGrid: Story = { render: () => <GuessGrid game={solvedGame} /> };
export const FailedGrid: Story = { render: () => <GuessGrid game={failedGame} /> };
export const ValidatingGrid: Story = {
  render: () => (
    <GuessGrid game={gameState({ guesses, currentGuess: "DRAMA", isValidationPending: true })} />
  ),
};
export const RevealingGrid: Story = {
  render: () => (
    <GuessGrid
      game={gameState({
        guesses,
        isRevealingRow: true,
        revealingGuessIndex: 0,
        revealedTileCount: 3,
      })}
    />
  ),
};

const INCORRECT_DEMO_GUESS: GameGuess = {
  word: "DRAMA",
  states: ["absent", "present", "absent", "correct", "absent"],
};

type DemoPhase = "validating" | "revealing" | "settled";

function ValidatingToIncorrectDemo() {
  const [phase, setPhase] = useState<DemoPhase>("validating");
  const [revealedTileCount, setRevealedTileCount] = useState(0);
  const [runToken, setRunToken] = useState(0);

  useEffect(() => {
    setPhase("validating");
    setRevealedTileCount(0);
  }, [runToken]);

  useEffect(() => {
    if (phase !== "validating") return;
    const timer = setTimeout(() => setPhase("revealing"), 1200);
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "revealing") return;
    if (revealedTileCount >= GAME_ANSWER_LENGTH) {
      setPhase("settled");
      return;
    }
    const timer = setTimeout(() => setRevealedTileCount((count) => count + 1), TILE_REVEAL_STEP_MS);
    return () => clearTimeout(timer);
  }, [phase, revealedTileCount]);

  const game = gameState({
    guesses: phase === "validating" ? [] : [INCORRECT_DEMO_GUESS],
    currentGuess: phase === "validating" ? INCORRECT_DEMO_GUESS.word : "",
    isValidationPending: phase === "validating",
    isRevealingRow: phase === "revealing",
    revealingGuessIndex: phase === "revealing" ? 0 : null,
    revealedTileCount: phase === "revealing" ? revealedTileCount : 0,
  });

  return (
    <div style={{ display: "grid", gap: "1rem", justifyItems: "center" }}>
      <p style={{ fontSize: "0.8rem", opacity: 0.7, textTransform: "capitalize" }}>{phase}</p>
      <GuessGrid game={game} />
      <button type="button" onClick={() => setRunToken((token) => token + 1)}>
        Replay
      </button>
    </div>
  );
}

export const ValidatingToIncorrect: Story = {
  render: () => <ValidatingToIncorrectDemo />,
};

const CORRECT_DEMO_GUESS: GameGuess = {
  word: "DRAMA",
  states: ["correct", "correct", "correct", "correct", "correct"],
};

function ValidatingToCorrectDemo() {
  const [phase, setPhase] = useState<DemoPhase>("validating");
  const [revealedTileCount, setRevealedTileCount] = useState(0);
  const [runToken, setRunToken] = useState(0);

  useEffect(() => {
    setPhase("validating");
    setRevealedTileCount(0);
  }, [runToken]);

  useEffect(() => {
    if (phase !== "validating") return;
    const timer = setTimeout(() => setPhase("revealing"), 1200);
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "revealing") return;
    if (revealedTileCount >= GAME_ANSWER_LENGTH) {
      setPhase("settled");
      return;
    }
    const timer = setTimeout(() => setRevealedTileCount((count) => count + 1), TILE_REVEAL_STEP_MS);
    return () => clearTimeout(timer);
  }, [phase, revealedTileCount]);

  const game = gameState({
    guesses: phase === "validating" ? [] : [CORRECT_DEMO_GUESS],
    currentGuess: phase === "validating" ? CORRECT_DEMO_GUESS.word : "",
    isValidationPending: phase === "validating",
    isRevealingRow: phase === "revealing",
    revealingGuessIndex: phase === "revealing" ? 0 : null,
    revealedTileCount: phase === "revealing" ? revealedTileCount : 0,
    isSolved: phase !== "validating",
    isGameOver: phase === "settled",
    status: phase === "settled" ? "solved" : "playing",
  });

  return (
    <div style={{ display: "grid", gap: "1rem", justifyItems: "center" }}>
      <p style={{ fontSize: "0.8rem", opacity: 0.7, textTransform: "capitalize" }}>{phase}</p>
      <GuessGrid game={game} />
      <button type="button" onClick={() => setRunToken((token) => token + 1)}>
        Replay
      </button>
    </div>
  );
}

export const ValidatingToCorrect: Story = {
  render: () => <ValidatingToCorrectDemo />,
};

const ERROR_DEMO_WORD = "DRAMA";
type ErrorDemoPhase = "typing" | "error" | "cleared";

function TypingErrorDemo() {
  const [phase, setPhase] = useState<ErrorDemoPhase>("typing");
  const [typedCount, setTypedCount] = useState(0);
  const [shakeToken, setShakeToken] = useState(0);
  const [runToken, setRunToken] = useState(0);

  useEffect(() => {
    setPhase("typing");
    setTypedCount(0);
  }, [runToken]);

  useEffect(() => {
    if (phase !== "typing") return;
    if (typedCount >= ERROR_DEMO_WORD.length) {
      const timer = setTimeout(() => setPhase("error"), 300);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setTypedCount((count) => count + 1), 180);
    return () => clearTimeout(timer);
  }, [phase, typedCount]);

  useEffect(() => {
    if (phase !== "error") return;
    setShakeToken((token) => token + 1);
    const timer = setTimeout(() => setPhase("cleared"), 1200);
    return () => clearTimeout(timer);
  }, [phase]);

  const currentGuess = phase === "cleared" ? "" : ERROR_DEMO_WORD.slice(0, typedCount);

  const game = gameState({
    currentGuess,
    hasError: phase === "error",
    errorMessage: phase === "error" ? "Not in word list" : null,
    errorCode: phase === "error" ? "not-in-word-list" : null,
    shakeToken,
  });

  return (
    <div style={{ display: "grid", gap: "1rem", justifyItems: "center" }}>
      <p style={{ fontSize: "0.8rem", opacity: 0.7, textTransform: "capitalize" }}>{phase}</p>
      <GuessGrid game={game} />
      <button type="button" onClick={() => setRunToken((token) => token + 1)}>
        Replay
      </button>
    </div>
  );
}

export const TypingError: Story = {
  render: () => <TypingErrorDemo />,
};

export const Header: Story = {
  render: () => <GameHeader dateKey="2026-08-12" />,
};

function ResultStory({ game }: { game: typeof solvedGame }) {
  return (
    <GameResult
      game={game}
      puzzle={puzzle}
      loginUrl="https://auth.example.com/login"
      onShare={fn()}
      onCopy={fn()}
    />
  );
}
export const AuthRequired: Story = { render: () => <ResultStory game={authRequiredGame} /> };
export const SolvedResult: Story = { render: () => <ResultStory game={solvedGame} /> };
export const FailedResult: Story = { render: () => <ResultStory game={failedGame} /> };
export const ResultActions: Story = {
  render: () => {
    const share = fn();
    const copy = fn();
    return (
      <GameResult
        game={solvedGame}
        puzzle={puzzle}
        loginUrl="/login"
        onShare={share}
        onCopy={copy}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Share the drama" }));
    await userEvent.click(canvas.getByRole("button", { name: "Copy story" }));
    await expect(canvas.getByRole("link", { name: "Read the source article" })).toHaveAttribute(
      "href",
      puzzle.sources[0].url,
    );
  },
};

export const TypingHarness: Story = {
  render: () => {
    const [value, setValue] = useState("");
    return (
      <div style={{ display: "grid", gap: "1rem" }}>
        <GuessGrid game={gameState({ currentGuess: value })} />
        <OnscreenKeyboard
          onLetter={(letter) => setValue((current) => `${current}${letter}`.slice(0, 5))}
          onBackspace={() => setValue((current) => current.slice(0, -1))}
        />
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "D" }));
    await userEvent.click(canvas.getByRole("button", { name: "R" }));
    await expect(canvas.getByLabelText("Letter 1")).toHaveTextContent("D");
  },
};
