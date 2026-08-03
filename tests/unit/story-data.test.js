import { describe, expect, it } from "vitest";
import {
  getStoryPath,
  STORY_CHAPTERS,
  STORY_EXHIBITS,
  STORY_OVERVIEW,
} from "../../src/story/story-data";

describe("homepage scrollytelling", () => {
  it("starts with a room overview before visiting every exhibit", () => {
    expect(STORY_CHAPTERS[0]).toMatchObject(STORY_OVERVIEW);
    expect(STORY_CHAPTERS).toHaveLength(STORY_EXHIBITS.length + 1);
    expect(new Set(STORY_EXHIBITS.map((exhibit) => exhibit.url)).size).toBe(
      STORY_EXHIBITS.length,
    );

    for (const mobile of [false, true]) {
      const path = getStoryPath(mobile);
      expect(path.camera).toHaveLength(STORY_CHAPTERS.length + 1);
      expect(path.look).toHaveLength(path.camera.length);
    }
  });

  it("mounts all exhibits around the circular gallery wall", () => {
    const radii = STORY_EXHIBITS.map((exhibit) =>
      Math.hypot(exhibit.frame.position[0], exhibit.frame.position[2]),
    );
    expect(radii.every((radius) => radius > 6.4 && radius < 8)).toBe(true);
    expect(new Set(STORY_EXHIBITS.map((exhibit) => exhibit.frame.position.join(","))).size).toBe(6);
    expect(STORY_EXHIBITS.every((exhibit) => exhibit.frame.scale < 1)).toBe(true);
  });
});
