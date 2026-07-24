import Phaser from "phaser";
import { AssetKeys } from "../config/assetKeys";
import { GROUND_Y, WORLD_HEIGHT, WORLD_WIDTH } from "../config/gameConfig";

function createTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (graphics: Phaser.GameObjects.Graphics) => void,
): void {
  if (scene.textures.exists(key)) return;
  const graphics = scene.add.graphics().setVisible(false);
  graphics.clear();
  draw(graphics);
  graphics.generateTexture(key, width, height);
  graphics.destroy();
}

function drawNugget(graphics: Phaser.GameObjects.Graphics, width: number, height: number): void {
  graphics.lineStyle(3, 0x87520b, 1);
  graphics.fillStyle(0xf7bd23, 1);
  graphics.beginPath();
  graphics.moveTo(width * 0.08, height * 0.56);
  graphics.lineTo(width * 0.23, height * 0.18);
  graphics.lineTo(width * 0.58, height * 0.08);
  graphics.lineTo(width * 0.91, height * 0.34);
  graphics.lineTo(width * 0.78, height * 0.85);
  graphics.lineTo(width * 0.31, height * 0.94);
  graphics.closePath();
  graphics.fillPath();
  graphics.strokePath();
  graphics.fillStyle(0xfff3a0, 0.9);
  graphics.fillEllipse(width * 0.38, height * 0.3, width * 0.28, height * 0.14);
}

function drawDiamond(graphics: Phaser.GameObjects.Graphics, width: number, height: number): void {
  graphics.lineStyle(2, 0xeaffff, 1);
  graphics.fillStyle(0x57dcd8, 1);
  graphics.beginPath();
  graphics.moveTo(width * 0.5, height * 0.04);
  graphics.lineTo(width * 0.92, height * 0.31);
  graphics.lineTo(width * 0.72, height * 0.78);
  graphics.lineTo(width * 0.5, height * 0.97);
  graphics.lineTo(width * 0.28, height * 0.78);
  graphics.lineTo(width * 0.08, height * 0.31);
  graphics.closePath();
  graphics.fillPath();
  graphics.strokePath();
  graphics.lineBetween(width * 0.08, height * 0.31, width * 0.92, height * 0.31);
  graphics.lineBetween(width * 0.5, height * 0.04, width * 0.5, height * 0.97);
}

export function createPlaceholderTextures(scene: Phaser.Scene): void {
  createTexture(scene, AssetKeys.backgrounds.sky, WORLD_WIDTH, GROUND_Y + 20, (g) => {
    g.fillGradientStyle(0xfbd48a, 0xf4bd64, 0xeaa456, 0xe59b49, 1);
    g.fillRect(0, 0, WORLD_WIDTH, GROUND_Y + 20);
    g.fillStyle(0xffe8ad, 0.38);
    g.fillEllipse(WORLD_WIDTH * 0.22, 12, 620, 240);
  });

  createTexture(scene, AssetKeys.backgrounds.surface, WORLD_WIDTH, 160, (g) => {
    g.fillStyle(0xb76c39, 1);
    g.fillRect(0, 112, WORLD_WIDTH, 22);
    g.fillStyle(0x6d3d26, 1);
    g.fillRect(0, 128, WORLD_WIDTH, 8);
    g.lineStyle(2, 0xffe1a0, 0.5);
    g.lineBetween(0, 111, WORLD_WIDTH, 111);
  });

  const mineHeight = WORLD_HEIGHT - GROUND_Y;
  createTexture(scene, AssetKeys.backgrounds.mineFar, WORLD_WIDTH, mineHeight, (g) => {
    g.fillGradientStyle(0x946344, 0x8b5b3e, 0x643d2b, 0x543224, 1);
    g.fillRect(0, 0, WORLD_WIDTH, mineHeight);
  });

  createTexture(scene, AssetKeys.backgrounds.mineMid, WORLD_WIDTH, mineHeight, (g) => {
    g.fillStyle(0xb07950, 0.48);
    g.beginPath();
    g.moveTo(0, 70);
    g.lineTo(180, 34);
    g.lineTo(390, 98);
    g.lineTo(610, 44);
    g.lineTo(820, 102);
    g.lineTo(1040, 40);
    g.lineTo(WORLD_WIDTH, 72);
    g.lineTo(WORLD_WIDTH, 240);
    g.lineTo(0, 218);
    g.closePath();
    g.fillPath();
    g.fillStyle(0x4a2b21, 0.2);
    for (let row = 0; row < 5; row += 1) {
      for (let column = 0; column < 13; column += 1) {
        g.fillEllipse(30 + column * 104 + (row % 2) * 28, 90 + row * 104, 9, 5);
      }
    }
  });

  createTexture(scene, AssetKeys.backgrounds.mineSupports, WORLD_WIDTH, mineHeight, (g) => {
    g.fillStyle(0x38251c, 0.68);
    g.fillRect(88, 160, 20, 264);
    g.fillRect(1172, 152, 20, 276);
    g.fillRect(70, 154, 1140, 18);
    g.fillStyle(0x835132, 0.62);
    g.fillRect(94, 160, 5, 264);
    g.fillRect(1178, 152, 5, 276);
  });

  createTexture(scene, AssetKeys.backgrounds.mineFront, WORLD_WIDTH, mineHeight, (g) => {
    g.fillStyle(0x271b16, 0.28);
    g.beginPath();
    g.moveTo(0, mineHeight - 86);
    g.lineTo(150, mineHeight - 118);
    g.lineTo(320, mineHeight - 72);
    g.lineTo(520, mineHeight - 108);
    g.lineTo(730, mineHeight - 62);
    g.lineTo(940, mineHeight - 112);
    g.lineTo(1120, mineHeight - 76);
    g.lineTo(WORLD_WIDTH, mineHeight - 104);
    g.lineTo(WORLD_WIDTH, mineHeight);
    g.lineTo(0, mineHeight);
    g.closePath();
    g.fillPath();
  });

  createTexture(scene, AssetKeys.items.goldSmall, 44, 38, (g) => drawNugget(g, 44, 38));
  createTexture(scene, AssetKeys.items.goldMedium, 64, 54, (g) => drawNugget(g, 64, 54));
  createTexture(scene, AssetKeys.items.goldLarge, 94, 78, (g) => drawNugget(g, 94, 78));

  createTexture(scene, AssetKeys.items.rock, 68, 60, (g) => {
    g.lineStyle(3, 0x403a35, 1);
    g.fillStyle(0x746b61, 1);
    g.beginPath();
    g.moveTo(4, 34);
    g.lineTo(18, 8);
    g.lineTo(42, 2);
    g.lineTo(65, 22);
    g.lineTo(56, 54);
    g.lineTo(23, 59);
    g.closePath();
    g.fillPath();
    g.strokePath();
    g.fillStyle(0xa59a8d, 1);
    g.fillTriangle(18, 14, 43, 8, 34, 27);
  });

  createTexture(scene, AssetKeys.items.diamond, 46, 50, (g) => drawDiamond(g, 46, 50));

  createTexture(scene, AssetKeys.items.chest, 70, 58, (g) => {
    g.lineStyle(3, 0x4c2a17, 1);
    g.fillStyle(0x9d5b25, 1);
    g.fillRoundedRect(4, 10, 62, 44, 7);
    g.strokeRoundedRect(4, 10, 62, 44, 7);
    g.fillStyle(0xd9a23b, 1);
    g.fillRect(4, 29, 62, 7);
    g.fillRect(31, 10, 8, 44);
    g.fillStyle(0xffe38a, 1);
    g.fillRoundedRect(28, 27, 14, 17, 3);
  });

  createTexture(scene, AssetKeys.items.tnt, 58, 68, (g) => {
    g.lineStyle(3, 0x4d211a, 1);
    g.fillStyle(0xa83a2c, 1);
    g.fillRoundedRect(8, 10, 42, 54, 8);
    g.strokeRoundedRect(8, 10, 42, 54, 8);
    g.fillStyle(0xd8aa62, 1);
    g.fillRect(6, 20, 46, 6);
    g.fillRect(6, 50, 46, 6);
    g.lineStyle(3, 0x2f271f, 1);
    g.lineBetween(29, 10, 40, 1);
    g.fillStyle(0xffd642, 1);
    g.fillCircle(42, 3, 4);
  });

  const drawMole = (g: Phaser.GameObjects.Graphics, diamond: boolean): void => {
    g.lineStyle(2, 0x3d2418, 1);
    g.fillStyle(0x71432b, 1);
    g.fillEllipse(6, 15, 58, 34);
    g.strokeEllipse(6, 15, 58, 34);
    g.fillStyle(0xa36c43, 1);
    g.fillCircle(46, 21, 16);
    g.fillStyle(0x261814, 1);
    g.fillCircle(51, 17, 3);
    g.fillStyle(0xdc9f76, 1);
    g.fillCircle(61, 23, 4);
    if (diamond) drawDiamond(g, 22, 24);
  };
  createTexture(scene, AssetKeys.items.mole, 68, 48, (g) => drawMole(g, false));
  createTexture(scene, AssetKeys.items.diamondMole, 72, 58, (g) => drawMole(g, true));

  createTexture(scene, AssetKeys.hook.head, 44, 46, (g) => {
    g.lineStyle(5, 0xe6d8be, 1);
    g.lineBetween(22, 4, 22, 23);
    g.beginPath();
    g.moveTo(22, 17);
    g.lineTo(8, 28);
    g.lineTo(12, 42);
    g.moveTo(22, 17);
    g.lineTo(36, 28);
    g.lineTo(32, 42);
    g.strokePath();
    g.fillStyle(0x3b2b22, 1);
    g.fillCircle(22, 5, 5);
  });

  createTexture(scene, AssetKeys.miner.placeholder, 148, 178, (g) => {
    g.fillStyle(0x281c17, 0.28);
    g.fillEllipse(74, 166, 118, 15);
    g.lineStyle(4, 0x4f2a1a, 1);
    g.fillStyle(0x9e592e, 1);
    g.fillRoundedRect(45, 82, 72, 73, 20);
    g.strokeRoundedRect(45, 82, 72, 73, 20);
    g.fillStyle(0xf0b574, 1);
    g.fillCircle(75, 63, 38);
    g.fillStyle(0xf6efd8, 1);
    g.fillEllipse(67, 79, 62, 46);
    g.fillStyle(0x2c211c, 1);
    g.fillCircle(85, 57, 4);
    g.fillStyle(0xf0e1b8, 1);
    g.fillRoundedRect(28, 19, 94, 31, 12);
    g.fillStyle(0xa3482b, 1);
    g.fillRect(29, 42, 92, 10);
    g.fillStyle(0x6b3a22, 1);
    g.fillEllipse(75, 51, 124, 17);
    g.lineStyle(5, 0x35241d, 1);
    g.strokeCircle(27, 121, 22);
    g.lineBetween(27, 121, 8, 92);
  });

  const particle = (key: string, color: number, shape: "circle" | "square" | "star") =>
    createTexture(scene, key, 20, 20, (g) => {
      g.fillStyle(color, 1);
      if (shape === "circle") g.fillCircle(10, 10, 7);
      else if (shape === "square") g.fillRect(4, 4, 12, 12);
      else {
        g.beginPath();
        for (let index = 0; index < 10; index += 1) {
          const angle = -Math.PI / 2 + (index * Math.PI) / 5;
          const radius = index % 2 === 0 ? 9 : 4;
          const x = 10 + Math.cos(angle) * radius;
          const y = 10 + Math.sin(angle) * radius;
          if (index === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.closePath();
        g.fillPath();
      }
    });
  particle(AssetKeys.particles.dust, 0xd0a176, "circle");
  particle(AssetKeys.particles.spark, 0xffe56b, "star");
  particle(AssetKeys.particles.smoke, 0x5b514b, "circle");
  particle(AssetKeys.particles.rockChip, 0x82786f, "square");
  particle(AssetKeys.particles.goldChip, 0xf5ba26, "square");
  particle(AssetKeys.particles.star, 0xfff2a0, "star");
}
