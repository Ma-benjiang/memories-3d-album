import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const layoutSource = readFileSync(
  new URL("../../app/layout.js", import.meta.url),
  "utf8",
);

describe("RootLayout", () => {
  it("tolerates browser-extension attributes on the html element", () => {
    expect(layoutSource).toMatch(
      /<html\s+lang="zh-CN"\s+suppressHydrationWarning>/,
    );
    expect(layoutSource).not.toMatch(/<body[^>]*suppressHydrationWarning/);
  });
});
