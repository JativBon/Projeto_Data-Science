import { spawn } from "node:child_process";
import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(frontendRoot, "..");

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const arg = process.argv[index];
  if (!arg.startsWith("--")) continue;
  const key = arg.slice(2);
  const next = process.argv[index + 1];
  if (next && !next.startsWith("--")) {
    args.set(key, next);
    index += 1;
  } else {
    args.set(key, "true");
  }
}

const dataset = args.get("dataset") ?? "03";
const id = args.get("id") ?? `dataset${dataset}`;
const port = Number(args.get("port") ?? 3210);
const baseUrl = args.get("base-url") ?? `http://127.0.0.1:${port}`;
const rootOutputDir = path.resolve(repoRoot, args.get("out") ?? "reports/assets/frontend_exports");
const outputDir = path.join(rootOutputDir, id);
const publicOutputDir = path.resolve(frontendRoot, "public/reports/assets/frontend_exports", id);

const captures = [
  {
    file: "observed_graph_frontend.png",
    selector: "[data-export-id='observed-graph']",
    query: `dataset=${dataset}&view=graph`,
  },
  {
    file: "ramex2007_graph_frontend.png",
    selector: "[data-export-id='ramex2007-graph']",
    query: `dataset=${dataset}&view=pure&pureTab=ramex2007`,
  },
  {
    file: "ramex2007_sankey_frontend.png",
    selector: "[data-export-id='sankey-ramex2007']",
    query: `dataset=${dataset}&view=sankey&sankeyMode=ramex2007`,
  },
  {
    file: "forward_sankey_frontend.png",
    selector: "[data-export-id='sankey-forward']",
    query: `dataset=${dataset}&view=sankey&sankeyMode=forward`,
  },
  {
    file: "back_forward_sankey_frontend_top50.png",
    selector: "[data-export-id='sankey-polytree-interpretive']",
    query: `dataset=${dataset}&view=sankey&sankeyMode=polytree&polytreeView=interpretive`,
  },
  {
    file: "back_forward_sankey_frontend_full.png",
    selector: "[data-export-id='sankey-polytree-complete']",
    query: `dataset=${dataset}&view=sankey&sankeyMode=polytree&polytreeView=complete`,
  },
  {
    file: "polytree_frontend.png",
    selector: "[data-export-id='back-forward-graph']",
    query: `dataset=${dataset}&view=pure&pureTab=backforward`,
  },
  {
    file: "temporal_phase1_frontend.png",
    selector: "[data-export-id='temporal-phase1']",
    query: `dataset=${dataset}&view=forum`,
    optional: true,
  },
  {
    file: "temporal_phase2_frontend.png",
    selector: "[data-export-id='temporal-phase2']",
    query: `dataset=${dataset}&view=forum`,
    optional: true,
  },
];

async function isServerReady() {
  try {
    const response = await fetch(baseUrl);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await isServerReady()) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Frontend did not become ready at ${baseUrl}`);
}

function startServerIfNeeded() {
  if (args.get("no-start") === "true") return undefined;
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  const child = spawn(command, ["run", "dev", "--", "-p", String(port)], {
    cwd: frontendRoot,
    env: { ...process.env, NEXT_PUBLIC_SHOW_EXPERIMENTAL: "true" },
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  return child;
}

async function capture(page, item) {
  const url = `${baseUrl}/?${item.query}`;
  console.log(`capturing ${item.file}`);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  } catch (error) {
    if (item.optional) {
      await writePlaceholder(page, item, "Vista RAMEX-Forum temporal não disponível para este dataset.");
      return;
    }
    throw error;
  }
  await page.waitForTimeout(1200);

  try {
    await page.waitForSelector(item.selector, { timeout: item.optional ? 10000 : 45000 });
  } catch {
    if (item.optional) {
      await writePlaceholder(page, item, "Vista RAMEX-Forum temporal não disponível para este dataset.");
      return;
    }
    const exportIds = await page.locator("[data-export-id]").evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-export-id")).filter(Boolean)
    ).catch(() => []);
    throw new Error(`Missing export selector ${item.selector} at ${url}. Present export ids: ${exportIds.join(", ") || "none"}`);
  }

  const locator = page.locator(item.selector).first();
  await locator.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  const target = path.join(outputDir, item.file);
  await locator.screenshot({
    path: target,
    animations: "disabled",
    scale: "device",
  });
  await copyFile(target, path.join(publicOutputDir, item.file));
  await copyFile(target, path.join(rootOutputDir, item.file));
  console.log(`exported ${target}`);
}

async function writePlaceholder(page, item, message) {
  const target = path.join(outputDir, item.file);
  await page.setContent(`
    <main style="width: 1280px; min-height: 520px; box-sizing: border-box; padding: 48px; background: #f8fafc; font-family: Inter, system-ui, sans-serif;">
      <section style="height: 100%; border: 1px solid #cbd5e1; border-radius: 24px; background: white; padding: 40px; box-shadow: 0 24px 80px rgba(15, 23, 42, 0.10);">
        <p style="margin: 0 0 12px; color: #0f766e; font-size: 13px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase;">RAMEX-Forum temporal</p>
        <h1 style="margin: 0 0 16px; color: #0f172a; font-size: 34px; line-height: 1.15;">Figura frontend não disponível</h1>
        <p style="margin: 0; max-width: 820px; color: #475569; font-size: 18px; line-height: 1.65;">${message}</p>
        <p style="margin: 28px 0 0; max-width: 820px; color: #64748b; font-size: 15px; line-height: 1.6;">Quando a análise RAMEX-Forum temporal existir no job, este ficheiro é substituído por uma captura da vista frontend correspondente.</p>
      </section>
    </main>
  `);
  await page.screenshot({ path: target, fullPage: true, scale: "device" });
  await copyFile(target, path.join(publicOutputDir, item.file));
  await copyFile(target, path.join(rootOutputDir, item.file));
  console.log(`exported placeholder ${target}`);
}

await mkdir(outputDir, { recursive: true });
await mkdir(publicOutputDir, { recursive: true });
await mkdir(rootOutputDir, { recursive: true });

let server;
if (!(await isServerReady())) {
  server = startServerIfNeeded();
  await waitForServer();
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1200 },
    deviceScaleFactor: 2,
  });
  await page.addStyleTag({
    content: `
      html, body { background: #f8fafc !important; }
      [data-export-id] { scroll-margin: 24px; }
    `,
  }).catch(() => {});

  for (const item of captures) {
    await capture(page, item);
  }
} finally {
  await browser.close();
  if (server) {
    server.kill();
    server.unref();
  }
}

process.exit(0);
