import { describe, expect, it } from "vitest";
import {
  calculateComboMultiplier,
  calculatePullSpeed,
  generateMineField,
  getLevelConfig,
  mineItemsOverlap,
} from "../src/game/model";

describe("gold miner model", () => {
  it("generates the same mine for the same seed", () => {
    const options = {
      level: getLevelConfig(1),
      seed: "fixed-seed",
      bounds: { minX: 30, maxX: 930, minY: 190, maxY: 610 },
    };
    expect(generateMineField(options)).toEqual(generateMineField(options));
  });

  it("never knowingly overlaps generated items", () => {
    const items = generateMineField({
      level: getLevelConfig(3),
      seed: "spacing",
      bounds: { minX: 30, maxX: 930, minY: 190, maxY: 610 },
    });
    for (let left = 0; left < items.length; left += 1) {
      for (let right = left + 1; right < items.length; right += 1) {
        expect(mineItemsOverlap(items[left]!, items[right]!, 6)).toBe(false);
      }
    }
  });

  it("makes heavy items slower and caps combo growth", () => {
    expect(calculatePullSpeed(9)).toBeLessThan(calculatePullSpeed(1));
    expect(calculateComboMultiplier(100)).toBe(3);
  });
});
