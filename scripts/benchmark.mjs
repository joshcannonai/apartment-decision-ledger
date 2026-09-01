import { chromium } from "playwright";

const baseUrl = process.env.ADL_BASE_URL || "http://127.0.0.1:4173";
const iterations = Number(process.env.ADL_BENCHMARK_RUNS || 25);

const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--enable-features=WebMCP"],
});

const samples = [];

try {
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: "networkidle" });

    const startedAt = performance.now();
    const result = await page.evaluate(async () => {
      const modelContext = document.modelContext ?? navigator.modelContext;
      const tools = await modelContext.getTools();
      const tool = tools.find((candidate) => candidate.name === "search_candidates");
      if (!tool) throw new Error("search_candidates is not registered");
      return await modelContext.executeTool(
        tool,
        JSON.stringify({ city: "Salt Lake City", state: "UT", maxAllIn: 2200 }),
      );
    });
    await page.locator(".result-row").nth(14).waitFor();
    samples.push(performance.now() - startedAt);

    const parsed = JSON.parse(result);
    if (!parsed || typeof parsed !== "object") throw new Error("Tool returned an invalid result");
    await context.close();
  }
} finally {
  await browser.close();
}

const sorted = [...samples].sort((left, right) => left - right);
const percentile = (value) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * value))];
const average = samples.reduce((sum, sample) => sum + sample, 0) / samples.length;

console.log(
  JSON.stringify(
    {
      iterations,
      unit: "milliseconds",
      average: Math.round(average * 10) / 10,
      median: Math.round(percentile(0.5) * 10) / 10,
      p95: Math.round(percentile(0.95) * 10) / 10,
      minimum: Math.round(sorted[0] * 10) / 10,
      maximum: Math.round(sorted.at(-1) * 10) / 10,
      scope: "Native WebMCP search_candidates invocation through 15 visible deterministic demo rows; page load and browser-agent reasoning excluded.",
    },
    null,
    2,
  ),
);
