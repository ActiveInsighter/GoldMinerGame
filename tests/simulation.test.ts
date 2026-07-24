import { describe, expect, it } from "vitest";
import { HookConfig } from "../src/game/config/gameConfig";
import {
  GameSimulation,
  pointToSegmentDistance,
  segmentCircleHitT,
} from "../src/game/simulation/GameSimulation";
import {
  ITEM_CONFIGS,
  calculateCatchScore,
  calculatePullSpeed,
  getLevelConfig,
  updateCombo,
  type GeneratedMineItem,
  type LevelItemEffects,
  type MineItemType,
} from "../src/game/model";

const NO_EFFECTS: LevelItemEffects = {
  dynamiteCharges: 0,
  pullSpeedMultiplier: 1,
  rareSpawnWeightMultiplier: 1,
  rockValueMultiplier: 1,
  diamondValueMultiplier: 1,
  timeBonusSeconds: 0,
  aimAssistSeconds: 0,
};

function item(
  type: MineItemType,
  overrides: Partial<GeneratedMineItem> = {},
): GeneratedMineItem {
  const config = ITEM_CONFIGS[type];
  return {
    id: `test-${type}`,
    type,
    x: 640,
    y: 235,
    radius: config.radius,
    rotation: 0,
    value: config.baseValue,
    weight: config.weight,
    velocityX: 0,
    direction: 1,
    collected: false,
    ...overrides,
  };
}

function createSimulation(options: {
  items?: readonly GeneratedMineItem[];
  target?: number;
  durationSeconds?: number;
  initialDynamite?: number;
  eventChancePerMinute?: number;
} = {}): GameSimulation {
  const base = getLevelConfig(1);
  return new GameSimulation({
    level: {
      ...base,
      target: options.target ?? base.target,
      durationSeconds: options.durationSeconds ?? base.durationSeconds,
      rules: {
        ...base.rules,
        eventChancePerMinute:
          options.eventChancePerMinute ?? base.rules.eventChancePerMinute,
      },
    },
    items: options.items ?? [],
    effects: NO_EFFECTS,
    mode: "campaign",
    seed: "simulation-test",
    initialDynamite: options.initialDynamite ?? 0,
    reducedMotion: true,
  });
}

function advance(simulation: GameSimulation, seconds: number): void {
  let remaining = seconds;
  while (remaining > 0 && !simulation.getSnapshot().terminal) {
    const step = Math.min(0.05, remaining);
    simulation.update(step);
    remaining -= step;
  }
}

describe("GameSimulation", () => {
  it("moves through launch, empty return and swinging without React or Canvas", () => {
    const simulation = createSimulation();
    expect(simulation.getSnapshot().hook.state).toBe("swinging");
    expect(simulation.fire()).toBe(true);
    expect(simulation.getSnapshot().hook.state).toBe("extending");

    advance(simulation, 1.2);
    expect(["retractingEmpty", "swinging"]).toContain(
      simulation.getSnapshot().hook.state,
    );
    advance(simulation, 1.2);
    expect(simulation.getSnapshot().hook.state).toBe("swinging");
    expect(simulation.getSnapshot().hook.length).toBeCloseTo(
      HookConfig.minimumLength,
      4,
    );
  });

  it("uses swept segment-circle collision and perfect-distance math", () => {
    expect(segmentCircleHitT(0, 0, 100, 0, 50, 0, 10)).toBeCloseTo(0.4);
    expect(segmentCircleHitT(0, 0, 100, 0, 50, 30, 10)).toBeNull();
    expect(pointToSegmentDistance(50, 12, 0, 0, 100, 0)).toBeCloseTo(12);
  });

  it("keeps heavy items slower than light items", () => {
    const light = calculatePullSpeed(ITEM_CONFIGS.smallGold.weight);
    const heavy = calculatePullSpeed(ITEM_CONFIGS.rock.weight);
    expect(heavy).toBeLessThan(light);
  });

  it("keeps score and combo calculations configuration driven", () => {
    const first = updateCombo({
      currentCombo: 0,
      itemType: "diamond",
      itemValue: 680,
      elapsedSinceLastCatchSeconds: 1,
    });
    const second = updateCombo({
      currentCombo: first.combo,
      itemType: "largeGold",
      itemValue: 520,
      elapsedSinceLastCatchSeconds: 1,
    });
    const score = calculateCatchScore({
      baseValue: 520,
      itemType: "largeGold",
      combo: second.combo,
      perfectGrab: true,
    });

    expect(first.combo).toBe(1);
    expect(second.combo).toBe(2);
    expect(score.total).toBeGreaterThan(520);
  });

  it("uses dynamite only while an item is attached and emits explosion events", () => {
    const simulation = createSimulation({
      items: [item("rock")],
      initialDynamite: 1,
    });
    simulation.drainEvents();
    expect(simulation.useDynamite()).toBe(false);
    simulation.fire();
    advance(simulation, 0.25);
    expect(simulation.getSnapshot().hook.state).toBe("retractingItem");
    expect(simulation.useDynamite()).toBe(true);
    const events = simulation.drainEvents();
    expect(events.some((event) => event.type === "effect" && event.kind === "explosion")).toBe(true);
    expect(events.some((event) => event.type === "item-removed" && event.reason === "destroyed")).toBe(true);
    expect(simulation.getSnapshot().dynamite).toBe(0);
  });

  it("triggers deterministic random mine events without renderer state", () => {
    const simulation = createSimulation({
      durationSeconds: 180,
      target: 999_999,
      eventChancePerMinute: 1,
    });
    simulation.drainEvents();
    let sawEvent = false;
    for (let index = 0; index < 1_200 && !sawEvent; index += 1) {
      simulation.update(0.05);
      sawEvent = simulation
        .drainEvents()
        .some((event) => event.type === "effect" && event.kind === "event");
    }
    expect(sawEvent).toBe(true);
  });

  it("finishes successfully after collecting enough value", () => {
    const simulation = createSimulation({
      items: [item("diamond", { value: 1_000 })],
      target: 100,
      durationSeconds: 20,
    });
    simulation.drainEvents();
    simulation.fire();
    advance(simulation, 2);
    const finished = simulation
      .drainEvents()
      .find((event) => event.type === "finished");
    expect(finished?.type).toBe("finished");
    if (finished?.type === "finished") expect(finished.result.won).toBe(true);
  });

  it("finishes with failure when time expires below target", () => {
    const simulation = createSimulation({
      target: 999_999,
      durationSeconds: 0.1,
    });
    simulation.drainEvents();
    advance(simulation, 0.2);
    const finished = simulation
      .drainEvents()
      .find((event) => event.type === "finished");
    expect(finished?.type).toBe("finished");
    if (finished?.type === "finished") expect(finished.result.won).toBe(false);
  });
});
