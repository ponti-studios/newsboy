import type { Decorator, Preview } from "@storybook/react-vite";
import { MemoryRouter } from "react-router";

import "../src/app.css";

const withRouter: Decorator = (Story) => (
  <MemoryRouter initialEntries={["/"]}>
    <Story />
  </MemoryRouter>
);

const preview: Preview = {
  decorators: [withRouter],
  parameters: {
    layout: "centered",
    a11y: { test: "error" },
    controls: { expanded: true },
    viewport: { options: { mobile: { name: "Mobile", styles: { width: "390px", height: "844px" } } } },
  },
  tags: ["autodocs"],
};

export default preview;
