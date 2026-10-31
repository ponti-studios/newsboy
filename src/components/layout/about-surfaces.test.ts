import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { AboutPage } from "~/components/pages/about-page";
import { NewsboyFooter } from "./newsboy-footer";
import { NewsboyNavigation } from "./newsboy-navigation";

function render(route: string, element: ReactElement) {
  return renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [route] }, element));
}

describe("about surfaces", () => {
  it("describes what Newsboy is and who makes it", () => {
    const markup = render("/about", createElement(AboutPage));

    expect(markup).toContain("Newsboy is Ponti Studios&#x27; multi-topic daily news puzzle.");
    expect(markup).toContain("Newsboy is made by Ponti Studios.");
    expect(markup).toContain('href="/"');
  });

  it("credits Ponti Studios with a linked mark on the about page", () => {
    const markup = render("/about", createElement(AboutPage));

    expect(markup).toContain('href="https://ponti.io"');
    expect(markup).toContain('src="/ponti-mark.png"');
    expect(markup).toContain("Ponti Studios");
  });

  it("renders the footer with About, History, and the studio credit", () => {
    const markup = render("/", createElement(NewsboyFooter));

    expect(markup).toContain('href="/about"');
    expect(markup).toContain('href="/history"');
    expect(markup).toContain('href="https://ponti.io"');
  });

  it("keeps the footer off the admin surface", () => {
    expect(render("/admin", createElement(NewsboyFooter))).toBe("");
    expect(render("/admin/topics", createElement(NewsboyFooter))).toBe("");
  });

  it("links to the about page from the game chrome", () => {
    const markup = render(
      "/reality",
      createElement(NewsboyNavigation, {
        games: [{ slug: "reality", name: "Reality" }],
        signedIn: false,
        canAccessAdmin: false,
        loginUrl: "https://api.ponti.io/login",
      }),
    );

    expect(markup).toContain('href="/about"');
  });
});
