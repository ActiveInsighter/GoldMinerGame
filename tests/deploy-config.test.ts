import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const DEPLOY_CONFIG = ".wrangler.deploy.json";

describe("deployment configuration", () => {
  it("uses the same generated Wrangler config in the prepare script and deploy command", async () => {
    const [packageSource, prepareSource] = await Promise.all([
      readFile("package.json", "utf8"),
      readFile("scripts/prepare-deploy-config.mjs", "utf8"),
    ]);
    const packageJson = JSON.parse(packageSource) as { scripts?: Record<string, string> };
    const deployCommand = packageJson.scripts?.deploy ?? "";

    expect(prepareSource).toContain(`writeFile(\"${DEPLOY_CONFIG}\"`);
    expect(deployCommand).toContain(`--config ${DEPLOY_CONFIG}`);
    expect(deployCommand.match(new RegExp(DEPLOY_CONFIG.replaceAll(".", "\\."), "gu"))).toHaveLength(2);
  });
});
