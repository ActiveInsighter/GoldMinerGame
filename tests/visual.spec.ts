import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const OUTPUT = path.resolve("test-results/visual");
const FREEZE_MOTION_CSS = "*,*::before,*::after{transition:none!important;animation-duration:0s!important;animation-delay:0s!important}";

async function openMenu(page: Page): Promise<void> {
  await page.goto("/?visual=1", { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: FREEZE_MOTION_CSS });
  await expect(page.locator(".menu-screen")).toBeVisible({ timeout: 15_000 });
}

async function prepare(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.addInitScript(() => {
    const fixedNow = 1_786_000_000_000;
    Date.now = () => fixedNow;
    let state = 0x12345678;
    Math.random = () => {
      state = (state * 1_664_525 + 1_013_904_223) >>> 0;
      return state / 0x1_0000_0000;
    };
  });
  await openMenu(page);
}

async function capture(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(OUTPUT, name), fullPage: true });
}

test.beforeAll(async () => {
  await mkdir(OUTPUT, { recursive: true });
});

test("capture primary desktop and mobile UI", async ({ browser }) => {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await prepare(desktop, 1440, 900);
  await capture(desktop, "01-menu-desktop.png");

  await desktop.getByRole("button", { name: /开始淘金/ }).click();
  await expect(desktop.locator(".mine-canvas")).toBeVisible();
  await desktop.waitForTimeout(900);
  await capture(desktop, "02-game-desktop.png");

  await desktop.getByRole("button", { name: "暂停游戏" }).click();
  await expect(desktop.getByRole("heading", { name: "卷扬机已停下" })).toBeVisible();
  await capture(desktop, "03-pause-desktop.png");

  await openMenu(desktop);
  await desktop.getByRole("button", { name: "声音设置" }).click();
  await expect(desktop.getByRole("heading", { name: "声音与本地数据" })).toBeVisible();
  await capture(desktop, "04-settings-desktop.png");
  await desktop.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await prepare(mobile, 390, 844);
  await capture(mobile, "05-menu-mobile.png");

  await mobile.getByRole("button", { name: /开始淘金/ }).click();
  await expect(mobile.locator(".mine-canvas")).toBeVisible();
  await mobile.waitForTimeout(700);
  await capture(mobile, "06-game-mobile.png");

  await openMenu(mobile);
  await mobile.getByRole("button", { name: "玩法说明" }).click();
  await expect(mobile.getByRole("heading", { name: "淘金入门" })).toBeVisible();
  await capture(mobile, "07-help-mobile.png");

  await openMenu(mobile);
  await mobile.getByRole("button", { name: "成就与记录" }).click();
  await expect(mobile.getByRole("heading", { name: "矿工手册" })).toBeVisible();
  await capture(mobile, "08-achievements-mobile.png");
  await mobile.close();
});
