import { mkdir, writeFile } from "node:fs/promises";

const token = process.env.GITHUB_TOKEN?.trim();
const repository = process.env.GITHUB_REPOSITORY?.trim();
if (!token || !repository) throw new Error("GITHUB_TOKEN and GITHUB_REPOSITORY are required.");

const trackedWorkflows = new Set(["Check", "Test", "Build", "Visual", "Deploy Worker"]);
const response = await fetch(`https://api.github.com/repos/${repository}/actions/runs?per_page=100`, {
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2026-03-10",
    "User-Agent": "gold-miner-run-state",
  },
});
if (!response.ok) throw new Error(`GitHub Actions API failed (${response.status}).`);
const body = await response.json();
const runs = body.workflow_runs
  .filter((run) => trackedWorkflows.has(run.name))
  .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
  .slice(0, 16)
  .map((run) => ({
    databaseId: run.id,
    workflow: run.name,
    event: run.event,
    status: run.status,
    conclusion: run.conclusion,
    branch: run.head_branch,
    headSha: run.head_sha,
    runNumber: run.run_number,
    attempt: run.run_attempt,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    url: run.html_url,
  }));

const latest = runs[0] ?? null;
const byWorkflow = Object.fromEntries(
  [...trackedWorkflows].map((workflow) => [workflow, runs.find((run) => run.workflow === workflow) ?? null]),
);
const state = { generatedAt: new Date().toISOString(), repository, latest, byWorkflow, runs };

await mkdir(".github/run-state", { recursive: true });
await writeFile(".github/run-state/latest-run-id.txt", latest ? `${latest.databaseId}\n` : "\n");
await writeFile(".github/run-state/latest-run.json", `${JSON.stringify(latest, null, 2)}\n`);
await writeFile(".github/run-state/recent-runs.json", `${JSON.stringify(state, null, 2)}\n`);
console.log(`Recorded ${runs.length} workflow runs${latest ? `; latest=${latest.databaseId}` : ""}.`);
