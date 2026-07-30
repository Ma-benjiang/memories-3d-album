import { describe, expect, it } from "vitest";
import {
  calculateAge,
  chooseFrame,
  determineLightMode,
  groupMemoriesByMonth,
  shouldDropHidden,
} from "../../src/domain/memories";

describe("memory domain", () => {
  it("calculates the subject's age on the capture date", () => {
    expect(calculateAge("2023-11-10", "2024-03-10")).toEqual({
      months: 4,
      label: "4个月",
    });
    expect(calculateAge("2023-11-10", "2025-01-09")).toEqual({
      months: 13,
      label: "1岁1个月",
    });
    expect(calculateAge("2023-11-10", "2023-10-10").label).toBe("待补充");
  });

  it("groups dated memories by month and keeps undated memories pending", () => {
    const groups = groupMemoriesByMonth([
      { id: "c", capturedAt: "" },
      { id: "b", capturedAt: "2024-04-02" },
      { id: "a", capturedAt: "2024-03-10" },
      { id: "d", capturedAt: "2024-03-29" },
    ]);
    expect(groups.map((group) => group.key)).toEqual(["2024-03", "2024-04", "pending"]);
    expect(groups[0].memories.map((memory) => memory.id)).toEqual(["a", "d"]);
  });

  it("selects frame orientation and material from photo properties", () => {
    expect(chooseFrame({ width: 1600, height: 900, averageLuma: 0.5 }).orientation).toBe(
      "landscape",
    );
    expect(chooseFrame({ width: 900, height: 1600, averageLuma: 0.25 }).style).toBe(
      "titanium",
    );
    expect(chooseFrame({ width: 1000, height: 1000, averageLuma: 0.8 }).style).toBe(
      "oak",
    );
  });

  it("uses local time for the day and night gallery", () => {
    expect(determineLightMode(7)).toBe("day");
    expect(determineLightMode(17)).toBe("day");
    expect(determineLightMode(18)).toBe("night");
    expect(determineLightMode(2)).toBe("night");
  });

  it("guarantees a hidden drop on the third missed easter egg", () => {
    expect(shouldDropHidden(0, 0.34)).toBe(true);
    expect(shouldDropHidden(1, 0.9)).toBe(false);
    expect(shouldDropHidden(2, 0.99)).toBe(true);
  });
});
