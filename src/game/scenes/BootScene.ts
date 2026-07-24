import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor(
    key: string,
    private readonly nextSceneKey: string,
  ) {
    super({ key });
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#8f5f3d");
    this.scene.start(this.nextSceneKey);
  }
}
