import Phaser from "phaser";
import { VisualDepth } from "../config/visualConfig";
import type { HookState } from "../simulation/simulationTypes";
import {
  getMinerInitialTexture,
  MINER_ANIMATIONS,
  type MinerAnimationState,
} from "../systems/AnimationSystem";

export type { MinerAnimationState } from "../systems/AnimationSystem";

export class Miner extends Phaser.GameObjects.Container {
  private readonly bodySprite: Phaser.GameObjects.Sprite;
  private readonly status: Phaser.GameObjects.Text;
  private animationState: MinerAnimationState | null = null;
  private readonly reducedMotion: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number, reducedMotion = false) {
    super(scene, x, y);
    this.reducedMotion = reducedMotion;
    this.setDepth(VisualDepth.miner);

    this.bodySprite = scene.add
      .sprite(0, 0, getMinerInitialTexture(scene))
      .setOrigin(0.5, 0.92);
    this.status = scene.add
      .text(0, -176, "IDLE", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "11px",
        fontStyle: "700",
        color: "#fff3c8",
        backgroundColor: "#59321f",
        padding: { x: 6, y: 3 },
      })
      .setOrigin(0.5)
      .setAlpha(0.78);

    this.add([this.bodySprite, this.status]);
    scene.add.existing(this);
    this.playState("idle");
  }

  syncFromHook(hookState: HookState, weight: number): void {
    if (hookState === "swinging") this.playState("idle");
    else if (hookState === "extending") this.playState("fire");
    else if (hookState === "retractingEmpty") this.playState("pull-light");
    else if (hookState === "retractingItem") {
      this.playState(weight >= 5 ? "pull-heavy" : "pull-light");
    } else if (hookState === "destroying") this.playState("dynamite");
  }

  playState(next: MinerAnimationState): void {
    if (this.animationState === next) return;
    this.animationState = next;
    this.scene.tweens.killTweensOf([this, this.bodySprite]);
    this.setScale(1).setAngle(0).setAlpha(1);
    this.bodySprite.clearTint();

    const animation = MINER_ANIMATIONS[next];
    this.status.setText(
      `${next.toUpperCase()} · ${animation.frameRate} FPS`,
    );
    if (this.scene.anims.exists(animation.key)) {
      this.bodySprite.play(animation.key, true);
    }

    if (next === "fire") {
      this.scene.tweens.add({
        targets: this,
        scaleX: 1.04,
        scaleY: 0.96,
        duration: 110,
        yoyo: true,
      });
      return;
    }
    if (next === "pull-light") {
      this.scene.tweens.add({
        targets: this,
        angle: -2,
        duration: this.reducedMotion ? 450 : 260,
        yoyo: true,
        repeat: -1,
      });
      return;
    }
    if (next === "pull-heavy") {
      this.bodySprite.setTint(0xffd5b0);
      this.scene.tweens.add({
        targets: this,
        angle: -7,
        scaleX: 1.06,
        duration: this.reducedMotion ? 520 : 300,
        yoyo: true,
        repeat: -1,
      });
      return;
    }
    if (next === "dynamite") {
      this.bodySprite.setTint(0xff9b73);
      this.scene.tweens.add({
        targets: this,
        x: { from: this.x - 2, to: this.x + 2 },
        duration: 55,
        yoyo: true,
        repeat: this.reducedMotion ? 1 : 5,
      });
      return;
    }
    if (next === "celebrate") {
      this.bodySprite.setTint(0xffef9a);
      this.scene.tweens.add({
        targets: this,
        y: this.y - (this.reducedMotion ? 4 : 18),
        angle: 5,
        duration: 260,
        yoyo: true,
        repeat: -1,
      });
      return;
    }
    if (next === "fail") {
      this.bodySprite.setTint(0xb9a89c);
      this.scene.tweens.add({
        targets: this,
        angle: 8,
        y: this.y + 8,
        duration: 380,
      });
      return;
    }

    this.scene.tweens.add({
      targets: this,
      y: this.y - (this.reducedMotion ? 1 : 3),
      duration: 1_250,
      ease: "Sine.InOut",
      yoyo: true,
      repeat: -1,
    });
  }

  override destroy(fromScene?: boolean): void {
    this.scene.tweens.killTweensOf([this, this.bodySprite]);
    super.destroy(fromScene);
  }
}
