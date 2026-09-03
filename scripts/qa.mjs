import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.ADL_BASE_URL || "http://127.0.0.1:4173";
const artifactDirectory = resolve("artifacts");
await mkdir(artifactDirectory, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--enable-features=WebMCP"],
});

const expectedTools = [
  "add_candidate",
  "compare_candidates",
  "organize_results",
  "prepare_search",
  "propose_preferences",
  "review_workspace",
  "search_candidates",
  "stage_decision",
];

async function invokeWebMCP(page, name, input) {
  return await page.evaluate(
    async ({ toolName, toolInput }) => {
      const modelContext = document.modelContext ?? navigator.modelContext;
      if (!modelContext || typeof modelContext.getTools !== "function") {
        throw new Error("Native WebMCP modelContext is unavailable.");
      }
      if (typeof modelContext.executeTool !== "function") {
        throw new Error("Native WebMCP executeTool is unavailable.");
      }
      const tools = await modelContext.getTools();
      const tool = tools.find((candidate) => candidate.name === toolName);
      if (!tool) throw new Error(`WebMCP tool not registered: ${toolName}`);
      const raw = await modelContext.executeTool(tool, JSON.stringify(toolInput));
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.content) && typeof parsed.content[0]?.text === "string") {
        return JSON.parse(parsed.content[0].text);
      }
      return parsed;
    },
    { toolName: name, toolInput: input },
  );
}

async function waitForCompleteImages(page, selector, expected) {
  await page.waitForFunction(
    ({ imageSelector, count }) => {
      const images = [...document.querySelectorAll(imageSelector)];
      return images.length >= count
        && images.slice(0, count).every((item) => item.complete && item.naturalWidth > 0);
    },
    { imageSelector: selector, count: expected },
    { timeout: 15_000 },
  );
}

async function waitForImagePaint(page) {
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
}

async function waitForGoogleMapPaint(page) {
  let mapFrame = null;
  for (let attempt = 0; attempt < 3 && !mapFrame; attempt += 1) {
    const mapLocator = page.locator('iframe[title^="Google map"]').first();
    await mapLocator.waitFor({ state: "attached" });
    try {
      await mapLocator.scrollIntoViewIfNeeded();
      const mapHandle = await mapLocator.elementHandle();
      mapFrame = await mapHandle?.contentFrame() ?? null;
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
  await mapFrame?.waitForLoadState("domcontentloaded");
  // Google paints its map tiles after the iframe document reaches DOM ready.
  // Give the third-party canvas time to become visually inspectable.
  await page.waitForTimeout(3500);
}

async function verifyWebMCPTools() {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  try {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    const tools = await page.evaluate(async () => {
      const modelContext = document.modelContext ?? navigator.modelContext;
      if (!modelContext || typeof modelContext.getTools !== "function") return null;
      return (await modelContext.getTools()).map((tool) => tool.name).sort();
    });
    if (JSON.stringify(tools) !== JSON.stringify(expectedTools)) {
      throw new Error(`Unexpected WebMCP registration: ${JSON.stringify(tools)}`);
    }

    const results = {};
    results.prepare_search = await invokeWebMCP(page, "prepare_search", {
      city: "Salt Lake City",
      state: "UT",
      maxAllIn: 2200,
      preferences: [
        {
          kind: "furniture",
          label: "Needs a workable place for a 72-inch desk",
          value: true,
          source: "agent_context",
          confidence: 0.96,
        },
      ],
      anchors: [
        {
          label: "Trader Joe's Salt Lake City",
          importance: 4,
          source: "agent_context",
          confidence: 0.9,
        },
      ],
    });
    results.search_candidates = await invokeWebMCP(page, "search_candidates", {
      city: "Salt Lake City",
      state: "UT",
      maxAllIn: 2200,
    });
    await page.getByRole("heading", { name: /best options/i }).waitFor();
    await page.getByText("Needs a workable place for a 72-inch desk", { exact: true }).first().waitFor({ state: "attached" });
    if (results.search_candidates.resultCount !== 10) {
      throw new Error(`search_candidates returned ${results.search_candidates.resultCount}, expected 10`);
    }
    results.review_workspace = await invokeWebMCP(page, "review_workspace", {});
    if (results.review_workspace.leadingCandidates?.length !== 5) {
      throw new Error("review_workspace did not return five compact leading candidates.");
    }

    results.propose_preferences = await invokeWebMCP(page, "propose_preferences", {
      preferences: [
        {
          kind: "lifestyle",
          label: "Prefers a quieter home base",
          value: true,
          source: "agent_context",
          confidence: 0.78,
        },
      ],
      anchors: [{
        label: "University of Utah",
        importance: 4,
        source: "agent_context",
        confidence: 0.84,
      }],
    });
    await page.getByText("Prefers a quieter home base", { exact: true }).waitFor({ state: "attached" });
    const focusedLocation = page.getByRole("button", { name: /University of Utah/i });
    await focusedLocation.waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('button[aria-pressed="true"]')]
      .some((button) => button.textContent?.includes("University of Utah")));

    results.organize_results = await invokeWebMCP(page, "organize_results", {
      sortBy: "market_value",
      direction: "desc",
    });
    if (results.organize_results.sort?.by !== "market_value") {
      throw new Error("organize_results did not apply the requested sort.");
    }

    results.add_candidate = await invokeWebMCP(page, "add_candidate", {
      url: "https://example.com/listings/webmcp-qa",
      name: "WebMCP QA imported listing",
      city: "Salt Lake City",
      state: "UT",
      baseRent: 1750,
    });
    await page.getByText("WebMCP QA imported listing", { exact: true }).waitFor();

    const candidateIds = results.search_candidates.topCandidateIds.slice(0, 2);
    results.compare_candidates = await invokeWebMCP(page, "compare_candidates", { candidateIds });
    await page.getByRole("dialog", { name: /compare/i }).waitFor();
    await page.getByRole("button", { name: "Close comparison" }).last().click();

    results.stage_decision = await invokeWebMCP(page, "stage_decision", {
      candidateId: candidateIds[0],
      rationale: "Strongest current balance of verified cost evidence and personal fit; review before acting.",
    });
    await page.getByText(/strongest current balance of verified cost evidence/i).waitFor();

    if (errors.length > 0) throw new Error(`WebMCP browser errors:\n${errors.join("\n")}`);
    return { tools, results };
  } finally {
    await context.close();
  }
}

const consoleErrors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(error.message));

try {
  const webmcp = await verifyWebMCPTools();
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Find the apartment that fits your actual life." }).waitFor();
  if (!(await page.getByRole("button", { name: "Find apartments" }).isDisabled())) {
    throw new Error("The empty apartment search action should be disabled.");
  }
  if (await page.locator("[data-agent-field]").count() !== 5) {
    throw new Error("The entry screen did not expose all five visible WebMCP-prefillable fields.");
  }
  await page.screenshot({ path: resolve(artifactDirectory, "empty-desktop.png"), fullPage: true });

  const themeControl = page.getByRole("button", { name: /Theme: system/i });
  await themeControl.click();
  if (await page.locator("html").getAttribute("data-theme") !== "dark") {
    throw new Error("Dark mode did not apply to the document.");
  }
  await page.reload({ waitUntil: "networkidle" });
  if (await page.getByRole("button", { name: /Theme: dark/i }).count() !== 1 || await page.locator("html").getAttribute("data-theme") !== "dark") {
    throw new Error("Dark mode did not persist across reload.");
  }

  await page.getByRole("button", { name: /Open the Salt Lake City demo/i }).click();
  await page.getByRole("heading", { name: /best options/i }).waitFor();
  await page.getByRole("heading", { name: "Answer these to enhance and narrow your search" }).waitFor();

  const resultCount = await page.locator(".result-row").count();
  if (resultCount !== 10) throw new Error(`Expected 10 demo candidates; found ${resultCount}`);
  if ((await page.getByText(/demo snapshot/i).count()) === 0) {
    throw new Error("The curated demo is not visibly labeled as a demo snapshot.");
  }

  const firstApproval = page.locator(".approval-section .approve").first();
  if (await firstApproval.isVisible()) await firstApproval.click();

  await page.locator(".sort-control select").selectOption("market_value");
  const compareButtons = page.locator(".compare-check");
  await compareButtons.nth(0).click();
  await compareButtons.nth(1).click();
  await waitForCompleteImages(page, 'img[data-media-role="lead-hero"]', 1);
  await waitForCompleteImages(page, 'img[data-media-role="result-hero"][data-media-rank]', 10);
  const resultSources = await page.locator('img[data-media-role="result-hero"][data-media-rank]').evaluateAll((images) => images.map((image) => image.getAttribute("src")));
  if (new Set(resultSources).size !== resultSources.length) {
    throw new Error("The demo result list rendered a duplicate lead photo.");
  }
  await waitForImagePaint(page);
  await page.screenshot({ path: resolve(artifactDirectory, "workspace-desktop.png"), fullPage: true });

  const customQuestion = page.locator(".question-row").filter({ hasText: "72-inch desk" }).first();
  await customQuestion.getByPlaceholder("Type an answer").fill("Yes, elevator access matters");
  await customQuestion.getByRole("button", { name: /Apply answer/i }).click();
  await customQuestion.getByText("Updated", { exact: true }).waitFor();
  await page.screenshot({ path: resolve(artifactDirectory, "workspace-answer-updated-desktop.png"), fullPage: true });
  await customQuestion.getByRole("button", { name: /Rerun ranking/i }).click();
  const runTwoButton = page.getByRole("button", { name: "Run 2" });
  await runTwoButton.waitFor({ state: "visible" });
  if (!(await runTwoButton.isDisabled())) throw new Error("Run 2 did not expose its searching state.");
  await page.screenshot({ path: resolve(artifactDirectory, "workspace-run-2-loading-desktop.png"), fullPage: true });
  await runTwoButton.click();
  await page.screenshot({ path: resolve(artifactDirectory, "workspace-run-2-desktop.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /best options/i }).waitFor();
  await page.screenshot({ path: resolve(artifactDirectory, "workspace-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Decision" }).click();
  await page.getByRole("heading", { name: /Capitol Reef/i }).waitFor();
  await waitForCompleteImages(page, 'img[data-media-role="lead-hero"]', 1);
  await waitForImagePaint(page);
  await waitForGoogleMapPaint(page);
  await page.screenshot({ path: resolve(artifactDirectory, "workspace-mobile-decision.png"), fullPage: true });
  await page.getByRole("button", { name: "Refine" }).click();
  await page.getByRole("heading", { name: /enhance and narrow/i }).waitFor();
  await page.screenshot({ path: resolve(artifactDirectory, "workspace-mobile-refine.png"), fullPage: true });

  await page.getByRole("button", { name: "Decision" }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  const mapFrame = page.locator('iframe[title^="Google map"]').first();
  await mapFrame.waitFor({ state: "visible" });
  if (!(await mapFrame.getAttribute("src"))?.includes("maps.google.com/maps?output=embed")) {
    throw new Error("The keyless Google Maps preview was not rendered.");
  }
  await page.getByRole("button", { name: /add location/i }).click();
  await page.getByPlaceholder("Place name or address").fill("University of Utah");
  await page.getByRole("button", { name: "Add to search" }).click();
  await page.getByRole("button", { name: /University of Utah/i }).waitFor();
  await page.getByRole("button", { name: /sort results by this place/i }).click();
  if (await page.locator(".sort-control select").inputValue() !== "distance") {
    throw new Error("The added location did not become an available distance sort.");
  }
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /best options/i }).waitFor();
  await page.getByText("Capitol Reef · #206", { exact: true }).first().click();
  await waitForGoogleMapPaint(page);
  await page.screenshot({ path: resolve(artifactDirectory, "workspace-location-added-desktop.png"), fullPage: true });

  if (consoleErrors.length > 0) {
    throw new Error(`Browser console errors:\n${consoleErrors.join("\n")}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        resultCount,
        tools: webmcp.tools,
        invokedTools: Object.keys(webmcp.results).sort(),
        screenshots: 9,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
