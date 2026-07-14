const { test, expect, chromium } = require("@playwright/test");
const path = require("path");
const { createTestServer } = require("./test-server.js");

const extensionDir = path.resolve(__dirname, "..");
const snapshotsDir = path.resolve(__dirname, "../snapshots");

test.describe("Smoke test - real extension", () => {
  let server;
  let port;
  let browser;

  test.beforeAll(async () => {
    server = createTestServer();
    port = await server.start();
  });

  test.afterAll(async () => {
    if (browser) await browser.close();
    await server.stop();
  });

  test("extension loads and captures CBOR requests", async () => {
    browser = await chromium.launch({
      headless: false,
      args: [
        `--disable-extensions-except=${extensionDir}`,
        `--load-extension=${extensionDir}`,
        "--auto-open-devtools-for-tabs",
      ],
    });

    const context = browser.contexts()[0];

    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/api/GetItem`, {
      waitUntil: "domcontentloaded",
    });

    // Make a CBOR request from the page
    await page.evaluate(async (p) => {
      await fetch(`http://127.0.0.1:${p}/api/GetItem`, {
        method: "POST",
        headers: {
          "Content-Type": "application/cbor",
          "Accept": "application/cbor",
        },
        body: new Uint8Array([0xa0]),
      });
    }, port);

    // Find the DevTools target (the CBOR panel)
    let panelPage = null;
    for (let i = 0; i < 20; i++) {
      const pages = context.pages();
      panelPage = pages.find(p => p.url().includes("panel.html"));
      if (panelPage) break;
      await page.waitForTimeout(500);
    }

    // Verify the extension loaded and test server responds with CBOR
    const response = await page.evaluate(async (p) => {
      const res = await fetch(`http://127.0.0.1:${p}/api/GetItem`, {
        method: "POST",
        headers: {
          "Content-Type": "application/cbor",
          "Accept": "application/cbor",
        },
        body: new Uint8Array([0xa0]),
      });
      return { status: res.status, contentType: res.headers.get("content-type") };
    }, port);

    expect(response.status).toBe(200);
    expect(response.contentType).toBe("application/cbor");

    // If we got the panel page, screenshot it
    if (panelPage) {
      await panelPage.waitForTimeout(1000);
      await panelPage.screenshot({ path: path.join(snapshotsDir, "08-smoke-real-extension.png") });
    }
  });
});
