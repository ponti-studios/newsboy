import type { Meta, StoryObj } from "@storybook/react-vite";

import { GameTile, type GameTileState } from "../components/game";

const meta = {
  title: "Game/Tile",
  component: GameTile,
  parameters: { layout: "padded" },
} satisfies Meta<typeof GameTile>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = { args: { state: "empty" } };
export const Typed: Story = { args: { state: "typed", letter: "E" } };
export const Absent: Story = { args: { state: "absent", letter: "A" } };
export const Present: Story = { args: { state: "present", letter: "R" } };
export const Correct: Story = { args: { state: "correct", letter: "I" } };
export const Loading: Story = { args: { state: "empty", loading: true } };
export const WithError: Story = { args: { state: "typed", letter: "E", hasError: true } };
export const Revealing: Story = { args: { state: "correct", letter: "I", isRevealing: true } };
export const Pending: Story = {
  args: { state: "typed", letter: "D", isPending: true, tileIndex: 0 },
};
export const PendingRow: Story = {
  args: { state: "typed" },
  render: () => (
    <div style={{ display: "flex", gap: "0.5rem" }}>
      {["D", "R", "A", "M", "A"].map((letter, index) => (
        <GameTile key={letter + index} state="typed" letter={letter} isPending tileIndex={index} />
      ))}
    </div>
  ),
};
export const SolvedRow: Story = {
  args: { state: "correct" },
  render: () => (
    <div style={{ display: "flex", gap: "0.5rem" }}>
      {["D", "R", "A", "M", "A"].map((letter, index) => (
        <GameTile key={letter + index} state="correct" letter={letter} isSolved tileIndex={index} />
      ))}
    </div>
  ),
};
export const AllStates: Story = {
  args: { state: "empty" },
  render: () => (
    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
      {(["empty", "typed", "absent", "present", "correct"] as GameTileState[]).map((state) => (
        <GameTile
          key={state}
          state={state}
          letter={state === "empty" ? "" : "E"}
          ariaLabel={`${state} tile`}
        />
      ))}
    </div>
  ),
};
