import { chromium } from "playwright";

const baseUrl = process.env.ADL_BASE_URL || "http://127.0.0.1:4173";
const iterations = Number(process.env.ADL_MEDIA_BENCHMARK_RUNS || 7);
const browser = await chromium.launch({
  headless: true,
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--enable-features=WebMCP"],
});

const samples = [];

async function waitForCompleteImages(page, selector, expected) {
  await page.waitForFunction(
    ({ imageSelector, count }) => {
      const images = [...document.querySelectorAll(imageSelector)];
      return images.length >= count
        && images.slice(0, count).every((image) => image.complete && image.naturalWidth > 0);
    },
    { imageSelector: selector, count: expected },
    { timeout: 15_000 },
  );
}

try {
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: "networkidle" });

    const startedAt = performance.now();
    await page.getByRole("button", { name: /Open the Salt Lake City decision demo/i }).click();
    await page.getByRole("heading", { name: /best options/i }).waitFor();
    const results = performance.now() - startedAt;

    await waitForCompleteImages(page, 'img[data-media-role="lead-hero"]', 1);
    const leadImage = performance.now() - startedAt;

    await waitForCompleteImages(page, 'img[data-media-role="result-hero"][data-media-rank]', 5);
    const firstFive = performance.now() - startedAt;

    await waitForCompleteImages(page, 'img[data-media-role="detail-thumbnail"]', 4);
    const selectedGallery = performance.now() - startedAt;

    samples.push({ results, leadImage, firstFive, selectedGallery });
    await context.close();
  }
} finally {
  await browser.close();
}

function summarize(key) {
  const values = samples.map((sample) => sample[key]).sort((left, right) => left - right);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const percentile = (fraction) => values[Math.min(values.length - 1, Math.floor(values.length * fraction))];
  return {
    average: Math.round(average),
    median: Math.round(percentile(0.5)),
    p95: Math.round(percentile(0.95)),
    minimum: Math.round(values[0]),
    maximum: Math.round(values.at(-1)),
  };
}

console.log(JSON.stringify({
  iterations,
  unit: "milliseconds from demo activation",
  results: summarize("results"),
  leadImage: summarize("leadImage"),
  firstFiveResultImages: summarize("firstFive"),
  selectedGallery: summarize("selectedGallery"),
  scope: "Fresh browser contexts on the local deterministic demo. Includes network image fetches from their public source URLs; excludes browser-agent reasoning and a live listing-provider search.",
}, null, 2));
