import assert from "node:assert/strict";
import test from "node:test";
import {
  LEVEL_CONFIGS,
  calculateComboMultiplier,
  calculatePullSpeed,
  createShopState,
  generateMineField,
  mineItemsOverlap,
  purchaseShopItem,
  seedForDailyChallenge,
} from "../app/game/model.ts";

const bounds = { minX: 46, maxX: 1234, minY: 196, maxY: 688 };

test("daily challenge and mine layouts are deterministic", () => {
  const seedA = seedForDailyChallenge("2026-07-24");
  const seedB = seedForDailyChallenge("2026-07-24");
  assert.equal(seedA, seedB);
  assert.notEqual(seedA, seedForDailyChallenge("2026-07-25"));

  const first = generateMineField({
    level: LEVEL_CONFIGS[2],
    seed: seedA,
    bounds,
    minGap: 10,
  });
  const second = generateMineField({
    level: LEVEL_CONFIGS[2],
    seed: seedB,
    bounds,
    minGap: 10,
  });
  assert.deepEqual(first, second);
  for (let left = 0; left < first.length; left += 1) {
    for (let right = left + 1; right < first.length; right += 1) {
      assert.equal(mineItemsOverlap(first[left], first[right], 10), false);
    }
  }
});

test("heavy catches remain slower but never stall", () => {
  const diamond = calculatePullSpeed(0.35);
  const rock = calculatePullSpeed(9.5);
  assert.ok(diamond > rock);
  assert.ok(rock >= 128);
});

test("shop purchases are atomic and cannot double charge", () => {
  const initial = createShopState(1000);
  const first = purchaseShopItem(initial, "strengthTonic");
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.state.coins, 740);

  const repeated = purchaseShopItem(first.state, "strengthTonic");
  assert.equal(repeated.ok, false);
  assert.equal(repeated.state.coins, 740);
});

test("combo multiplier is capped", () => {
  assert.equal(calculateComboMultiplier(0), 1);
  assert.ok(calculateComboMultiplier(8) > 1);
  assert.equal(calculateComboMultiplier(1000), 3);
});
