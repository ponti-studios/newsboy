import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { cn } from "cn";
import { expect, userEvent, within } from "storybook/test";

import { setRefreshAvailable } from "../../.storybook/mocks/pwa-register-react";
import { PwaUpdatePrompt } from "../components/pwa-update-prompt";
import showcaseStyles from "./pwa-update-prompt-showcase.module.css";

const meta = { title: "Game/UpdatePrompt", parameters: { layout: "padded" } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const READY_MESSAGE = "A fresh version of Newsboy is ready.";

/** Auroral light field so the frosted glass has something to blur. */
const withAuroraBackdrop: Decorator = (Story) => (
  <>
    <div className={showcaseStyles.backdrop} aria-hidden="true">
      <span className={cn(showcaseStyles.blob, showcaseStyles.blobPink)} />
      <span className={cn(showcaseStyles.blob, showcaseStyles.blobGold)} />
      <span className={cn(showcaseStyles.blob, showcaseStyles.blobPlum)} />
    </div>
    <Story />
  </>
);

function promptWithUpdateAvailable() {
  setRefreshAvailable(true);
  return <PwaUpdatePrompt />;
}

export const Available: Story = {
  render: promptWithUpdateAvailable,
  parameters: {
    docs: {
      description: {
        story:
          "Shown when the service worker has downloaded a new build and is waiting to activate. A frosted panel with a pinging “new build” beacon springs in; actions are icon buttons — X defers, the download arrow applies (named “Later”/“Update” for assistive tech). The shell is styled with Tailwind utilities merged via `cn`; only the animation keyframes, engine fallbacks, and button typography live in the component's CSS module. `needRefresh` is `true`, so the toast appears in the corner of the page.",
      },
    },
  },
};

export const AuroraShowcase: Story = {
  render: promptWithUpdateAvailable,
  decorators: [withAuroraBackdrop],
  parameters: {
    docs: {
      description: {
        story:
          "The same toast over a moving aurora backdrop, where the backdrop blur and saturate actually have color to chew on. In the app the page behind is the cream newsprint (or dark mode charcoal), and the panel is clean frosted glass.",
      },
    },
  },
};

export const NoUpdateWaiting: Story = {
  render: () => {
    setRefreshAvailable(false);
    return <PwaUpdatePrompt />;
  },
  parameters: {
    docs: {
      description: {
        story:
          "With no staged worker, `needRefresh` is `false` and the component renders nothing — the banner only exists while an update is ready.",
      },
    },
  },
};

export const ApplyUpdate: Story = {
  render: promptWithUpdateAvailable,
  parameters: {
    docs: {
      description: {
        story:
          "“Update” calls `updateServiceWorker(true)`, which activates the waiting worker and reloads the app. In the sandbox the banner is dismissed to mirror the post-update state.",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const banner = canvas.getByRole("status");
    await expect(banner).toHaveTextContent(READY_MESSAGE);

    await userEvent.click(canvas.getByRole("button", { name: "Update" }));

    await expect(canvas.queryByRole("status")).not.toBeInTheDocument();
  },
};

export const LaterDismiss: Story = {
  render: promptWithUpdateAvailable,
  parameters: {
    docs: {
      description: {
        story:
          "“Later” hides the prompt (`setNeedRefresh(false)`) until the next `updatefound` event stages another build.",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status")).toHaveTextContent(READY_MESSAGE);

    await userEvent.click(canvas.getByRole("button", { name: "Later" }));

    await expect(canvas.queryByRole("status")).not.toBeInTheDocument();
  },
};
