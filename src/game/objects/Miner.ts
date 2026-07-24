import Phaser from "phaser";
import { VisualDepth } from "../config/visualConfig";
import type { HookState } from "../simulation/simulationTypes";
import {
  getMinerInitialTexture,
  MINER_ANIMATIONS,
  type MinerAnimationState,
} from "../systems/AnimationSystem";

export type { MinerAnimationState } from "../systems/AnimationSystem";

/**
 * The single authoritative miner display object.
 *
 * Placeholder and formal art both run through Phaser's texture and animation
 * systems. Replacing the atlas never changes simulation or scene rules.
 */
export class Miner extends Phaser.GameObjects.Sprite {
  private animationState: MinerAnimationState | null = null;
  private readonly reducedMotion: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number, reducedMotion = false) {
    super(scene, x, y, getMinerInitialTexture(scene));
    this.reducedMotion = reducedMotion;
    this.setOrigin(0.5, 0.92).setDepth(VisualDepth.miner);
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
    this.scene.tweens.killTweensOf(this);
    this.setScale(1).setAngle(0).setAlpha(1).clearTint();

    const animation = MINER_ANIMATIONS[next];
    if (this.scene.anims.exists(animation.key)) this.play(animation.key, true);

    if (this.reducedMotion) return;
    if (next === "fire") {
      this.scene.tweens.add({
        targets: this,
        scaleX: 1.04,
        scaleY: 0.96,
        duration: 110,
        yoyo: true,
      });
    } else if (next === "pull-heavy") {
      this.scene.tweens.add({
        targets: this,
        angle: -5,
        scaleX: 1.05,
        duration: 300,
        yoyo: true,
        repeat: -1,
      });
    } else if (next === "dynamite") {
      this.scene.tweens.add({
        targets: this,
        x: { from: this.x - 2, to: this.x + 2 },
        duration: 55,
        yoyo: true,
        repeat: 5,
      });
    } else if (next === "celebrate") {
      this.scene.tweens.add({
        targets: this,
        y: this.y - 18,
        angle: 5,
        duration: 260,
        yoyo: true,
        repeat: -1,
      });
    } else if (next === "fail") {
      this.setTint(0xb9a89c);
      this.scene.tweens.add({
        targets: this,
        angle: 8,
        y: this.y + 8,
        duration: 380,
      });
    }
  }

  override destroy(fromScene?: boolean): void {
    this.scene.tweens.killTweensOf(this);
    super.destroy(fromScene);
  }
}
