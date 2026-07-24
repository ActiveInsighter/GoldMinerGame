import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const OUTPUT = path.resolve("test-results/visual");
const FREEZE_MOTION_CSS =
  "*,*::before,*::after{transition:none!important;animation-duration:0s!important;animation-delay:0s!important}";

interface RuntimeDiagnostics {
  pageErrors: string[];
  consoleErrors: string[];
  missingResources: string[];
}

function watchRuntime(page: Page): RuntimeDiagnostics {
  const diagnostics: RuntimeDiagnostics = {
    pageErrors: [],
    consoleErrors: [],
    missingResources: [],
  };
  page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() === 404) {
      diagnostics.missingResources.push(response.url());
    }
  });
  return diagnostics;
}

async function installDeterminism(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const fixedNow = 1_786_000_000_000;
    Date.now = () => fixedNow;
    let state = 0x12345678;
    Math.random = () => {
      state = (state * 1_664_525 + 1_013_904_223) >>> 0;
      return state / 0x1_0000_0000;
    };
  });
}

async function openPath(
  page: Page,
  url: string,
  ready: Locator,
): Promise<void> {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: FREEZE_MOTION_CSS });
  await expect(ready).toBeVisible({ timeout: 15_000 });
}

async function expectVisibleWithDiagnostics(
  locator: Locator,
  diagnostics: RuntimeDiagnostics,
): Promise<void> {
  try {
    await expect(locator).toBeVisible({ timeout: 15_000 });
  } catch (error) {
    const details = JSON.stringify(diagnostics, null, 2);
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\nRuntime diagnostics:\n${details}`,
    );
  }
}

async function capture(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(OUTPUT, name), fullPage: true });
}

async function captureCanvasRegion(
  page: Page,
  canvas: Locator,
  name: string,
  sourceY: number,
  sourceHeight: number,
): Promise<void> {
  const initialBox = await canvas.boundingBox();
  if (!initialBox) throw new Error("Asset preview canvas has no bounding box.");
  const scale = initialBox.width / 1280;
  const absoluteCanvasTop = await page.evaluate(
    ({ y }) => window.scrollY + y,
    { y: initialBox.y },
  );
  const topMargin = 48;
  await page.evaluate(
    ({ targetY }) => window.scrollTo(0, Math.max(0, targetY)),
    {
      targetY: absoluteCanvasTop + sourceY * scale - topMargin,
    },
  );
  await page.waitForTimeout(80);

  const visibleBox = await canvas.boundingBox();
  if (!visibleBox) throw new Error("Asset preview canvas disappeared after scrolling.");
  await page.screenshot({
    path: path.join(OUTPUT, name),
    clip: {
      x: visibleBox.x,
      y: visibleBox.y + sourceY * scale,
      width: visibleBox.width,
      height: sourceHeight * scale,
    },
  });
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

function expectCleanRuntime(diagnostics: RuntimeDiagnostics): void {
  expect(diagnostics.pageErrors).toEqual([]);
  expect(diagnostics.consoleErrors).toEqual([]);
  expect(diagnostics.missingResources).toEqual([]);
}

async function verifyCanvas(page: Page, minimumWidth: number): Promise<void> {
  const canvas = page.locator(".mine-canvas");
  const box = await canvas.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(minimumWidth);
  expect(box?.height ?? 0).toBeGreaterThan(minimumWidth * 0.5);
  const backingSize = await canvas.evaluate((element) => {
    const target = element as HTMLCanvasElement;
    return { width: target.width, height: target.height };
  });
  expect(backingSize).toEqual({ width: 1280, height: 720 });
}

test.beforeAll(async () => {
  await mkdir(OUTPUT, { recursive: true });
});

test("capture direct Phaser rendering and responsive UI", async ({ browser }) => {
  const desktop = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const desktopDiagnostics = watchRuntime(desktop);
  await installDeterminism(desktop);

  await openPath(desktop, "/?visual=1", desktop.locator(".menu-screen"));
  await capture(desktop, "01-menu-desktop.png");

  await desktop.getByRole("button", { name: /开始淘金/ }).click();
  await expectVisibleWithDiagnostics(
    desktop.locator(".mine-canvas"),
    desktopDiagnostics,
  );
  await desktop.waitForTimeout(900);
  await verifyCanvas(desktop, 900);
  await capture(desktop, "02-game-desktop.png");

  await desktop.getByRole("button", { name: "暂停游戏" }).click();
  await expectVisibleWithDiagnostics(
    desktop.getByRole("heading", { name: "卷扬机已停下" }),
    desktopDiagnostics,
  );
  await capture(desktop, "03-pause-desktop.png");

  await openPath(
    desktop,
    "/?visual=1&visualScreen=shop",
    desktop.getByRole("heading", { name: "老山姆补给站" }),
  );
  await capture(desktop, "04-shop-desktop.png");
  await expectNoHorizontalOverflow(desktop);
  expectCleanRuntime(desktopDiagnostics);
  await desktop.close();

  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const mobileDiagnostics = watchRuntime(mobile);
  await installDeterminism(mobile);

  await openPath(mobile, "/?visual=1", mobile.locator(".menu-screen"));
  await capture(mobile, "05-menu-mobile.png");

  await mobile.getByRole("button", { name: /开始淘金/ }).click();
  await expectVisibleWithDiagnostics(
    mobile.locator(".mine-canvas"),
    mobileDiagnostics,
  );
  await mobile.waitForTimeout(700);
  await verifyCanvas(mobile, 360);
  await expectNoHorizontalOverflow(mobile);
  await capture(mobile, "06-game-mobile.png");

  await mobile.getByRole("button", { name: "暂停游戏" }).click();
  await expectVisibleWithDiagnostics(
    mobile.getByRole("heading", { name: "卷扬机已停下" }),
    mobileDiagnostics,
  );
  await capture(mobile, "07-pause-mobile.png");

  await openPath(
    mobile,
    "/?visual=1&visualScreen=shop",
    mobile.getByRole("heading", { name: "老山姆补给站" }),
  );
  await expectNoHorizontalOverflow(mobile);
  await capture(mobile, "08-shop-mobile.png");
  expectCleanRuntime(mobileDiagnostics);
  await mobile.close();

  const assets = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const assetDiagnostics = watchRuntime(assets);
  await installDeterminism(assets);
  await openPath(
    assets,
    "/?visual=1&debug=assets",
    assets.getByRole("heading", { name: "资源与动画预览" }),
  );
  const previewCanvas = assets.locator(".asset-preview-canvas canvas");
  await expectVisibleWithDiagnostics(previewCanvas, assetDiagnostics);
  await assets.waitForTimeout(800);

  await captureCanvasRegion(
    assets,
    previewCanvas,
    "09-miner-animation-preview.png",
    990,
    330,
  );
  await captureCanvasRegion(
    assets,
    previewCanvas,
    "10-item-placeholder-preview.png",
    595,
    405,
  );
  await assets.locator(".asset-preview-react").scrollIntoViewIfNeeded();
  await assets.locator(".asset-preview-react").screenshot({
    path: path.join(OUTPUT, "11-react-art-preview.png"),
  });
  await expectNoHorizontalOverflow(assets);
  expectCleanRuntime(assetDiagnostics);
  await assets.close();
});
