import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import {
  Button,
  Card,
  CardContent,
  EmptyState,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  StatusBadge,
} from "../components/primitives";
import { statusConfig } from "./fixtures";

const meta = { title: "Primitives", parameters: { layout: "padded" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Buttons: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
      <Button>Primary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button size="sm">Small</Button>
      <Button size="icon" aria-label="More options">
        ⋯
      </Button>
      <Button disabled>Disabled</Button>
      <Button asChild variant="outline">
        <a href="/history">Link button</a>
      </Button>
    </div>
  ),
};

export const Cards: Story = {
  render: () => (
    <Card style={{ maxWidth: 420 }}>
      <CardContent>
        <h2 style={{ marginTop: 0 }}>The Receipt</h2>
        <p>Content stays readable inside the paper surface.</p>
        <Button>Continue</Button>
      </CardContent>
    </Card>
  ),
};
export const EmptyStates: Story = {
  render: () => (
    <EmptyState
      title="No puzzles played yet"
      description="Jump into today's puzzle to start your streak."
      action={<Button>Play today&apos;s puzzle</Button>}
    />
  ),
};

export const Popovers: Story = {
  render: () => (
    <Popover>
      <PopoverTrigger aria-label="Show explanation">Why?</PopoverTrigger>
      <PopoverContent>
        <p style={{ margin: 0 }}>This is a short explanation in a popover.</p>
      </PopoverContent>
    </Popover>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Show explanation" }));
    await expect(canvas.getByRole("dialog")).toBeVisible();
  },
};

export const Selects: Story = {
  render: () => {
    const [value, setValue] = useState("reality");
    return (
      <label>
        Topic{" "}
        <Select
          aria-label="Topic"
          value={value}
          onValueChange={(next) => {
            setValue(next);
          }}
          options={[
            { value: "reality", label: "Reality" },
            { value: "culture", label: "Culture" },
          ]}
        />
      </label>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.selectOptions(canvas.getByRole("combobox", { name: "Topic" }), "culture");
    await expect(canvas.getByRole("combobox", { name: "Topic" })).toHaveValue("culture");
  },
};

export const Sheets: Story = {
  render: () => (
    <Sheet>
      <SheetTrigger>Open unplayed puzzles</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Puzzles you haven&apos;t played</SheetTitle>
        </SheetHeader>
        <p>Aug 19, Aug 20</p>
      </SheetContent>
    </Sheet>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Open unplayed puzzles" }));
    await expect(canvas.getByRole("dialog")).toBeVisible();
  },
};

export const StatusBadges: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "0.5rem" }}>
      {Object.keys(statusConfig).map((status) => (
        <StatusBadge
          key={status}
          status={status as keyof typeof statusConfig}
          config={statusConfig}
        />
      ))}
    </div>
  ),
};

export const CallbackActions: Story = {
  render: () => <Button onClick={fn()}>Record action</Button>,
};
