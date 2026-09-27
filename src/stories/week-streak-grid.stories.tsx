import type { Meta, StoryObj } from "@storybook/react-vite";

import { WeekStreakGrid } from "../components/game";
import { buildWeekGridFixture } from "./fixtures";

const meta = { title: "Game/WeekStreakGrid", parameters: { layout: "padded" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const TOPICS = [
  { slug: "reality", name: "Reality" },
  { slug: "markets", name: "Markets" },
  { slug: "culture", name: "Culture" },
];
const WEEK_START = "2026-08-16";
const WEEK_END = "2026-08-22";

export const MixedWeek: Story = {
  render: () => <WeekStreakGrid rows={buildWeekGridFixture(TOPICS, WEEK_START, WEEK_END, 7)} />,
};

export const SingleTopic: Story = {
  render: () => (
    <WeekStreakGrid rows={buildWeekGridFixture([TOPICS[0]], WEEK_START, WEEK_END, 3)} />
  ),
};

export const Empty: Story = {
  render: () => <WeekStreakGrid rows={[]} />,
};
