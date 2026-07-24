import Phaser from "phaser";
import { AssetKeys } from "../config/assetKeys";
import { VisualDepth } from "../config/visualConfig";
import type { HookState } from "../simulation/simulationTypes";

export type MinerAnimationState =
  | "idle"
  | "fire"
  | "pull-light"
  | "pull-heavy"
  | "dynamite"
  | "celebrate"
  | "fail";

export class Miner extends Phaser.GameObjects.Container {
  private readonly body: Phaser.GameObjects.Image;
  private readonly arm: Phaser.GameObjects.Rectangle;
  private readonly winch: Phaser.GameObjects.Arc;
  private readonly status: Phaser.GameObjects.Text;
  private state: MinerAnimationState = "idle";
  private reducedMotion = false;

  constructor(scene: Phaser.Scene, x: number, y: number, reducedMotion = false) {
    super(scene, x, y);
    this.reducedMotion = reducedMotion;
    this.setDepth(VisualDepth.miner);

    this.body = scene.add.image(0, 0, AssetKeys.miner.placeholder).setOrigin(0.5, 0.92);
    this.arm = scene.add.rectangle(-55, -62, 17, 58, 0xb96833).setOrigin(0.5, 0.15).setRotation(0.7);
    this.winch = scene.add.circle(-78, -35, 19, 0x2d211c).setStrokeStyle(5, 0xd0a15b, 1);
    this.status = scene.add.text(0, -176, "IDLE", {
      fontFamily: "system-ui, sans-serif",
      fontSize: "11px",
      fontStyle: "700",
      color: "#fff3c8",
      backgroundColor: "#59321f",
      padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setAlpha(0.78);

    this.add([this.arm, this.body, this.winch, this.status]);
    scene.add.existing(this);
    this.playState("idle");
  }

  syncFromHook(hookState: HookState, weight: number): void {
    if (hookState === "swinging") this.playState("idle");
    else if (hookState === "extending") this.playState("fire");
    else if (hookState === "retractingEmpty") this.playState("pull-light");
    else if (hookState === "retractingItem") this.playState(weight >= 5 ? "pull-heavy" : "pull-light");
    else if (hookState === "destroying") this.playState("dynamite");
  }

  playState(next: MinerAnimationState): void {
    if (this.state === next) return;
    this.state = next;
    this.scene.tweens.killTweensOf([this, this.body, this.arm, this.winch]);
    this.setScale(1).setAngle(0).setAlpha(1);
    this.body.clearTint();
    this.arm.setRotation(0.7);
    this.status.setText(next.toUpperCase());

    if (next === "fire") {
      this.arm.setRotation(1.22);
      this.scene.tweens.add({ targets: this, scaleX: 1.04, scaleY: 0.96, duration: 110, yoyo: true });
      return;
    }
    if (next === "pull-light") {
      this.arm.setRotation(0.44);
      this.scene.tweens.add({ targets: this, angle: -2, duration: this.reducedMotion ? 450 : 260, yoyo: true, repeat: -1 });
      this.scene.tweens.add({ targets: this.winch, angle: 360, duration: 620, repeat: -1 });
      return;
    }
    if (next === "pull-heavy") {
      this.arm.setRotation(0.22);
      this.body.setTint(0xffd5b0);
      this.scene.tweens.add({ targets: this, angle: -7, scaleX: 1.06, duration: this.reducedMotion ? 520 : 300, yoyo: true, repeat: -1 });
      this.scene.tweens.add({ targets: this.winch, angle: 360, duration: 1_050, repeat: -1 });
      return;
    }
    if (next === "dynamite") {
      this.body.setTint(0xff9b73);
      this.scene.tweens.add({ targets: this, x: { from: this.x - 2, to: this.x + 2 }, duration: 55, yoyo: true, repeat: this.reducedMotion ? 1 : 5 });
      return;
    }
    if (next === "celebrate") {
      this.body.setTint(0xffef9a);
      this.scene.tweens.add({ targets: this, y: this.y - (this.reducedMotion ? 4 : 18), angle: 5, duration: 260, yoyo: true, repeat: -1 });
      return;
    }
    if (next === "fail") {
      this.body.setTint(0xb9a89c);
      this.scene.tweens.add({ targets: this, angle: 8, y: this.y + 8, duration: 380 });
      return;
    }

    this.scene.tweens.add({ targets: this, y: this.y - (this.reducedMotion ? 1 : 3), duration: 1_250, ease: "Sine.InOut", yoyo: true, repeat: -1 });
    this.scene.tweens.add({ targets: this.winch, angle: 360, duration: 4_800, repeat: -1 });
  }

  override destroy(fromScene?: boolean): void {
    this.scene.tweens.killTweensOf([this, this.body, this.arm, this.winch]);
    super.destroy(fromScene);
  }
}
