import type { Config } from "@react-router/dev/config";

import "dotenv/config";

const appUrl = process.env.NEWSBOY_APP_URL;
if (!appUrl) {
  throw new Error("NEWSBOY_APP_URL is required to configure allowed action origins");
}

const appHostname = new URL(appUrl).hostname;

export default {
  ssr: true,
  appDirectory: "src",
  allowedActionOrigins: [appHostname],
} satisfies Config;
