import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PNG } from "pngjs";

const directory = path.resolve(process.env.VISUAL_OUTPUT_DIR ?? "test-results/visual");
const files = (await readdir(directory))
  .filter((name) => /^\d{2}-.+\.png$/u.test(name))
  .sort((left, right) => left.localeCompare(right));

if (files.length === 0) throw new Error(`No visual screenshots found in ${directory}.`);

const groups = [];
for (let index = 0; index < files.length; index += 4) groups.push(files.slice(index, index + 4));

for (const [groupIndex, group] of groups.entries()) {
  const images = await Promise.all(
    group.map(async (name) => ({ name, image: PNG.sync.read(await readFile(path.join(directory, name))) })),
  );
  const cellWidth = Math.max(...images.map(({ image }) => image.width));
  const cellHeight = Math.max(...images.map(({ image }) => image.height));
  const gutter = 18;
  const sheet = new PNG({
    width: cellWidth * 2 + gutter * 3,
    height: cellHeight * 2 + gutter * 3,
  });

  for (let offset = 0; offset < sheet.data.length; offset += 4) {
    sheet.data[offset] = 41;
    sheet.data[offset + 1] = 25;
    sheet.data[offset + 2] = 17;
    sheet.data[offset + 3] = 255;
  }

  images.forEach(({ image }, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = gutter + column * (cellWidth + gutter) + Math.floor((cellWidth - image.width) / 2);
    const y = gutter + row * (cellHeight + gutter) + Math.floor((cellHeight - image.height) / 2);
    PNG.bitblt(image, sheet, 0, 0, image.width, image.height, x, y);
  });

  await writeFile(
    path.join(directory, `contact-sheet-${groupIndex + 1}.png`),
    PNG.sync.write(sheet),
  );
}

await writeFile(
  path.join(directory, "manifest.json"),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), screenshots: files, contactSheets: groups.map((_, index) => `contact-sheet-${index + 1}.png`) }, null, 2)}\n`,
);
console.log(`Created ${groups.length} contact sheet(s) from ${files.length} screenshot(s).`);
