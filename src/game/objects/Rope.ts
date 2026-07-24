import Phaser from "phaser";
import { HookConfig } from "../config/gameConfig";
import { VisualDepth } from "../config/visualConfig";
import type { HookSnapshot } from "../simulation/simulationTypes";

export class Rope extends Phaser.GameObjects.Graphics {
  private aimAssistEnabled = false;

  constructor(scene: Phaser.Scene) {
    super(scene);
    this.setDepth(VisualDepth.rope);
    scene.add.existing(this);
  }

  setAimAssist(enabled: boolean): void {
    this.aimAssistEnabled = enabled;
  }

  sync(hook: HookSnapshot): void {
    this.clear();
    if (this.aimAssistEnabled && hook.state === "swinging") {
      const x = hook.originX + HookConfig.maximumLength * Math.sin(hook.angle);
      const y = hook.originY + HookConfig.maximumLength * Math.cos(hook.angle);
      this.lineStyle(2, 0xfff2a4, 0.58);
      this.lineBetween(hook.originX, hook.originY, x, y);
    }
    this.lineStyle(4, 0x33261d, 1);
    this.lineBetween(hook.originX, hook.originY, hook.x, hook.y);
    this.lineStyle(1, 0xe8d8ba, 0.55);
    this.lineBetween(hook.originX + 1, hook.originY, hook.x + 1, hook.y);
  }
}
