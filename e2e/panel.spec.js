const { test, expect } = require("@playwright/test");
const path = require("path");
const { encode } = require("./cbor-encode.js");

const panelPath = path.resolve(__dirname, "../panel.html");
const snapshotsDir = path.resolve(__dirname, "../snapshots");

function cborBase64(obj) {
  const buf = encode(obj);
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return Buffer.from(binary, "binary").toString("base64");
}

async function setupPanel(page) {
  await page.addInitScript(() => {
    window.__portListeners = [];
    window.__requestFinishedListeners = [];
    window.__harEntries = [];

    window.chrome = {
      devtools: {
        network: {
          onRequestFinished: {
            addListener(fn) {
              window.__requestFinishedListeners.push(fn);
            },
          },
          getHAR(cb) {
            cb({ entries: window.__harEntries });
          },
        },
      },
      runtime: {
        connect(opts) {
          return {
            name: opts.name,
            onMessage: {
              addListener(fn) {
                window.__portListeners.push(fn);
              },
            },
            postMessage() {},
          };
        },
      },
    };
  });

  await page.goto(`file://${panelPath}`);
  await page.waitForLoadState("domcontentloaded");
}

function sendPortMessage(page, msg) {
  return page.evaluate((m) => {
    window.__portListeners.forEach((fn) => fn(m));
  }, msg);
}

function fireRequestFinished(page, entry) {
  return page.evaluate((e) => {
    window.__requestFinishedListeners.forEach((fn) => fn(e));
  }, entry);
}

test.describe("Panel UI states", () => {
  test("empty state", async ({ page }) => {
    await setupPanel(page);

    await expect(page.locator("#output")).toHaveText("Select a request to view decoded CBOR");
    await expect(page.locator("#status")).toHaveText("0 CBOR responses captured");

    await page.screenshot({ path: path.join(snapshotsDir, "01-empty.png") });
  });

  test("loading state - request started", async ({ page }) => {
    await setupPanel(page);

    await sendPortMessage(page, {
      type: "request-started",
      requestId: "1",
      method: "POST",
      url: "https://api.example.com/service/GetItem",
      requestHeaders: [
        { name: "Content-Type", value: "application/cbor" },
        { name: "Accept", value: "application/cbor" },
      ],
      timeStamp: Date.now(),
    });

    const entry = page.locator(".entry").first();
    await expect(entry).toHaveClass(/status-loading/);
    await expect(entry.locator(".loading-indicator")).toBeVisible();
    await expect(page.locator("#status")).toContainText("1 pending");

    await entry.click();
    await expect(page.locator(".detail-header .status.loading")).toHaveText("Pending…");
    await expect(page.locator(".loading-body")).toContainText("Waiting for response…");

    await page.screenshot({ path: path.join(snapshotsDir, "02-loading.png") });
  });

  test("loading state - response headers received", async ({ page }) => {
    await setupPanel(page);

    await sendPortMessage(page, {
      type: "request-started",
      requestId: "1",
      method: "POST",
      url: "https://api.example.com/service/GetItem",
      requestHeaders: [
        { name: "Content-Type", value: "application/cbor" },
      ],
      timeStamp: Date.now(),
    });

    await page.locator(".entry").first().click();

    await sendPortMessage(page, {
      type: "response-headers",
      requestId: "1",
      statusCode: 200,
      responseHeaders: [
        { name: "Content-Type", value: "application/cbor" },
        { name: "x-amzn-requestid", value: "abc-123" },
      ],
    });

    await expect(page.locator(".loading-body")).toBeVisible();
    const detail = page.locator("#detail");
    await expect(detail).toContainText("Response Headers (2)");

    await page.screenshot({ path: path.join(snapshotsDir, "03-headers-received.png") });
  });

  test("completed state - successful response", async ({ page }) => {
    await setupPanel(page);

    await sendPortMessage(page, {
      type: "request-started",
      requestId: "1",
      method: "POST",
      url: "https://api.example.com/service/GetItem",
      requestHeaders: [
        { name: "Content-Type", value: "application/cbor" },
      ],
      timeStamp: Date.now(),
    });

    await page.locator(".entry").first().click();

    const responseBody = cborBase64({ id: "123", name: "Test Item", active: true });

    await fireRequestFinished(page, {
      request: {
        method: "POST",
        url: "https://api.example.com/service/GetItem",
        headers: [{ name: "Content-Type", value: "application/cbor" }],
        postData: { text: "" },
      },
      response: {
        status: 200,
        statusText: "OK",
        headers: [{ name: "Content-Type", value: "application/cbor" }],
        content: { text: responseBody },
      },
    });

    const entry = page.locator(".entry").first();
    await expect(entry).toHaveClass(/status-ok/);
    await expect(entry.locator(".loading-indicator")).not.toBeVisible();

    await expect(page.locator(".detail-header .status.ok")).toContainText("200");
    await expect(page.locator("#detail pre")).toContainText('"Test Item"');

    await page.screenshot({ path: path.join(snapshotsDir, "04-completed-success.png") });
  });

  test("completed state - error response", async ({ page }) => {
    await setupPanel(page);

    await sendPortMessage(page, {
      type: "request-started",
      requestId: "2",
      method: "POST",
      url: "https://api.example.com/service/Error",
      requestHeaders: [
        { name: "Content-Type", value: "application/cbor" },
      ],
      timeStamp: Date.now(),
    });

    await page.locator(".entry").first().click();

    const responseBody = cborBase64({ __type: "ValidationException", message: "Invalid input" });

    await fireRequestFinished(page, {
      request: {
        method: "POST",
        url: "https://api.example.com/service/Error",
        headers: [{ name: "Content-Type", value: "application/cbor" }],
      },
      response: {
        status: 400,
        statusText: "Bad Request",
        headers: [{ name: "Content-Type", value: "application/cbor" }],
        content: { text: responseBody },
      },
    });

    const entry = page.locator(".entry").first();
    await expect(entry).toHaveClass(/status-err/);
    await expect(page.locator(".detail-header .status.err")).toContainText("400");

    await page.screenshot({ path: path.join(snapshotsDir, "05-completed-error.png") });
  });

  test("multiple requests - mixed states", async ({ page }) => {
    await setupPanel(page);

    await sendPortMessage(page, {
      type: "request-started",
      requestId: "1",
      method: "POST",
      url: "https://api.example.com/service/GetItem",
      requestHeaders: [{ name: "Accept", value: "application/cbor" }],
      timeStamp: Date.now(),
    });

    const responseBody = cborBase64({ id: "123", name: "Done" });
    await fireRequestFinished(page, {
      request: {
        method: "POST",
        url: "https://api.example.com/service/GetItem",
        headers: [{ name: "Accept", value: "application/cbor" }],
      },
      response: {
        status: 200,
        statusText: "OK",
        headers: [{ name: "Content-Type", value: "application/cbor" }],
        content: { text: responseBody },
      },
    });

    await sendPortMessage(page, {
      type: "request-started",
      requestId: "2",
      method: "POST",
      url: "https://api.example.com/service/SlowOperation",
      requestHeaders: [{ name: "Accept", value: "application/cbor" }],
      timeStamp: Date.now(),
    });

    await sendPortMessage(page, {
      type: "request-started",
      requestId: "3",
      method: "POST",
      url: "https://api.example.com/service/AnotherCall",
      requestHeaders: [{ name: "Content-Type", value: "application/cbor" }],
      timeStamp: Date.now(),
    });

    const entries = page.locator(".entry");
    await expect(entries).toHaveCount(3);
    await expect(entries.nth(0)).toHaveClass(/status-ok/);
    await expect(entries.nth(1)).toHaveClass(/status-loading/);
    await expect(entries.nth(2)).toHaveClass(/status-loading/);
    await expect(page.locator("#status")).toContainText("1 CBOR response captured");
    await expect(page.locator("#status")).toContainText("2 pending");

    await page.screenshot({ path: path.join(snapshotsDir, "06-mixed-states.png") });
  });

  test("filter narrows request list by operation name", async ({ page }) => {
    await setupPanel(page);

    const responseBody = cborBase64({ ok: true });

    await fireRequestFinished(page, {
      request: {
        method: "POST",
        url: "https://api.example.com/service/GetItem",
        headers: [{ name: "Accept", value: "application/cbor" }],
      },
      response: {
        status: 200,
        statusText: "OK",
        headers: [{ name: "Content-Type", value: "application/cbor" }],
        content: { text: responseBody },
      },
    });

    await fireRequestFinished(page, {
      request: {
        method: "POST",
        url: "https://api.example.com/service/PutItem",
        headers: [{ name: "Accept", value: "application/cbor" }],
      },
      response: {
        status: 200,
        statusText: "OK",
        headers: [{ name: "Content-Type", value: "application/cbor" }],
        content: { text: responseBody },
      },
    });

    await expect(page.locator(".entry")).toHaveCount(2);

    await page.fill("#filter-input", "Put");
    await expect(page.locator(".entry")).toHaveCount(1);
    await expect(page.locator(".entry .resource")).toHaveText("PutItem");

    await page.fill("#filter-input", "");
    await expect(page.locator(".entry")).toHaveCount(2);
  });

  test("filter is case-insensitive", async ({ page }) => {
    await setupPanel(page);

    const responseBody = cborBase64({ ok: true });

    await fireRequestFinished(page, {
      request: {
        method: "POST",
        url: "https://api.example.com/service/GetItem",
        headers: [{ name: "Accept", value: "application/cbor" }],
      },
      response: {
        status: 200,
        statusText: "OK",
        headers: [{ name: "Content-Type", value: "application/cbor" }],
        content: { text: responseBody },
      },
    });

    await page.fill("#filter-input", "getitem");
    await expect(page.locator(".entry")).toHaveCount(1);

    await page.fill("#filter-input", "GETITEM");
    await expect(page.locator(".entry")).toHaveCount(1);
  });

  test("filter clear button resets filter", async ({ page }) => {
    await setupPanel(page);

    const responseBody = cborBase64({ ok: true });

    await fireRequestFinished(page, {
      request: {
        method: "POST",
        url: "https://api.example.com/service/GetItem",
        headers: [{ name: "Accept", value: "application/cbor" }],
      },
      response: {
        status: 200,
        statusText: "OK",
        headers: [{ name: "Content-Type", value: "application/cbor" }],
        content: { text: responseBody },
      },
    });

    await fireRequestFinished(page, {
      request: {
        method: "POST",
        url: "https://api.example.com/service/PutItem",
        headers: [{ name: "Accept", value: "application/cbor" }],
      },
      response: {
        status: 200,
        statusText: "OK",
        headers: [{ name: "Content-Type", value: "application/cbor" }],
        content: { text: responseBody },
      },
    });

    await page.fill("#filter-input", "Get");
    await expect(page.locator(".entry")).toHaveCount(1);
    await expect(page.locator("#filter-clear")).toBeVisible();

    await page.click("#filter-clear");
    await expect(page.locator("#filter-input")).toHaveValue("");
    await expect(page.locator(".entry")).toHaveCount(2);
    await expect(page.locator("#filter-clear")).toBeHidden();
  });

  test("filter applies to new incoming requests", async ({ page }) => {
    await setupPanel(page);

    const responseBody = cborBase64({ ok: true });

    await fireRequestFinished(page, {
      request: {
        method: "POST",
        url: "https://api.example.com/service/GetItem",
        headers: [{ name: "Accept", value: "application/cbor" }],
      },
      response: {
        status: 200,
        statusText: "OK",
        headers: [{ name: "Content-Type", value: "application/cbor" }],
        content: { text: responseBody },
      },
    });

    await page.fill("#filter-input", "Put");
    await expect(page.locator(".entry")).toHaveCount(0);

    await fireRequestFinished(page, {
      request: {
        method: "POST",
        url: "https://api.example.com/service/PutItem",
        headers: [{ name: "Accept", value: "application/cbor" }],
      },
      response: {
        status: 200,
        statusText: "OK",
        headers: [{ name: "Content-Type", value: "application/cbor" }],
        content: { text: responseBody },
      },
    });

    await expect(page.locator(".entry")).toHaveCount(1);
    await expect(page.locator(".entry .resource")).toHaveText("PutItem");
  });

  test("clear button resets everything", async ({ page }) => {
    await setupPanel(page);

    await sendPortMessage(page, {
      type: "request-started",
      requestId: "1",
      method: "POST",
      url: "https://api.example.com/service/GetItem",
      requestHeaders: [{ name: "Accept", value: "application/cbor" }],
      timeStamp: Date.now(),
    });

    await page.locator("#clear-btn").click();

    await expect(page.locator(".entry")).toHaveCount(0);
    await expect(page.locator("#status")).toHaveText("0 CBOR responses captured");
    await expect(page.locator("#output")).toHaveText("Select a request to view decoded CBOR");

    await page.screenshot({ path: path.join(snapshotsDir, "07-cleared.png") });
  });
});
