import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { HistoryGuestView, HistoryPageView } from "../components/pages/history-page";
import { emptyHistory, history } from "./fixtures";

const meta = { title: "Pages/History", parameters: { layout: "padded" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const SignedOut: Story = {
  render: () => (
    <HistoryGuestView
      loginUrl="/login"
      puzzles={[
        { dateKey: "2026-05-13", gameSlug: "culture", gameName: "Culture" },
        { dateKey: "2026-05-12", gameSlug: "culture", gameName: "Culture" },
        { dateKey: "2026-05-11", gameSlug: "reality", gameName: "Reality" },
        { dateKey: "2026-05-10", gameSlug: "technology", gameName: "Technology" },
      ]}
    />
  ),
};

export const WithHistory: Story = {
  render: () => <HistoryPageView history={history} onPageChange={fn()} />,
};

export const NoGridYet: Story = {
  render: () => <HistoryPageView history={{ ...history, weekGrid: [] }} onPageChange={fn()} />,
};

export const EmptyHistory: Story = {
  render: () => <HistoryPageView history={{ ...emptyHistory, weekGrid: [] }} onPageChange={fn()} />,
};
