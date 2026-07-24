import Phaser from "phaser";
import { AssetKeys } from "../config/assetKeys";
import { VisualDepth } from "../config/visualConfig";
import type { SimulationEvent, SimulationEffectKind } from "../simulation/simulationTypes";

export class EffectsSystem {
  private readonly emitters: Record<string, Phaser.GameObjects.Particles.ParticleEmitter>;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly reducedMotion: boolean,
  ) {
    const create = (key: string, lifespan: number, speed: number, gravityY = 0) =>
      scene.add.particles(0, 0, key, {
        emitting: false,
        lifespan,
        speed: { min: speed * 0.45, max: speed },
        angle: { min: 0, max: 360 },
        scale: { start: 0.85, end: 0 },
        alpha: { start: 1, end: 0 },
        gravityY,
        quantity: 1,
      }).setDepth(VisualDepth.effects);

    this.emitters = {
      dust: create(AssetKeys.particles.dust, 650, 120, 80),
      spark: create(AssetKeys.particles.spark, 580, 190, 70),
      smoke: create(AssetKeys.particles.smoke, 900, 95, -25),
      rock: create(AssetKeys.particles.rockChip, 700, 170, 180),
      gold: create(AssetKeys.particles.goldChip, 640, 190, 155),
      star: create(AssetKeys.particles.star, 820, 210, 40),
    };
  }

  handle(event: SimulationEvent): void {
    if (event.type === "effect") {
      this.emit(event.kind, event.x, event.y);
      return;
    }
    if (event.type === "floating-text") {
      this.floatText(event.x, event.y, event.text, event.color, event.scale ?? 1);
      return;
    }
    if (event.type === "camera-shake") {
      this.scene.cameras.main.shake(event.duration, this.reducedMotion ? Math.min(event.intensity, 0.002) : event.intensity);
    }
  }

  destroy(): void {
    for (const emitter of Object.values(this.emitters)) emitter.destroy();
  }

  private emit(kind: SimulationEffectKind, x: number, y: number): void {
    const amount = (normal: number, reduced: number) => (this.reducedMotion ? reduced : normal);
    if (kind === "grab") this.emitters.dust.emitParticleAt(x, y, amount(8, 3));
    else if (kind === "gold") this.emitters.gold.emitParticleAt(x, y, amount(18, 7));
    else if (kind === "diamond") this.emitters.spark.emitParticleAt(x, y, amount(20, 7));
    else if (kind === "rock-break") this.emitters.rock.emitParticleAt(x, y, amount(18, 6));
    else if (kind === "explosion") {
      this.emitters.spark.emitParticleAt(x, y, amount(34, 10));
      this.emitters.smoke.emitParticleAt(x, y, amount(24, 8));
      this.emitters.rock.emitParticleAt(x, y, amount(18, 6));
    } else if (kind === "combo" || kind === "success") {
      this.emitters.star.emitParticleAt(x, y, amount(kind === "success" ? 46 : 22, 9));
    } else if (kind === "failure") {
      this.emitters.smoke.emitParticleAt(x, y, amount(20, 7));
    } else if (kind === "event") {
      this.emitters.spark.emitParticleAt(x, y, amount(14, 5));
    }
  }

  private floatText(x: number, y: number, value: string, color: string, scale: number): void {
    const text = this.scene.add.text(x, y, value, {
      fontFamily: '"Microsoft YaHei", system-ui, sans-serif',
      fontSize: `${Math.round(24 * scale)}px`,
      fontStyle: "900",
      color,
      stroke: "rgba(55,28,16,.78)",
      strokeThickness: 5,
      align: "center",
    }).setOrigin(0.5).setDepth(VisualDepth.floatingText);
    this.scene.tweens.add({
      targets: text,
      y: y - 42,
      alpha: 0,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: this.reducedMotion ? 450 : 1_050,
      ease: "Cubic.Out",
      onComplete: () => text.destroy(),
    });
  }
}
