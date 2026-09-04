// Generates the Chrome Web Store listing screenshot (1280x800 JPEG — one of
// the two sizes the store accepts). Reuses the same mock-chrome harness as the
// README screenshot. Run on demand via `npm run screenshot:store`; NOT part of
// CI, so normal runs never touch tracked files. Writes directly to
// docs/store-icons/store-screenshot-1280x800.jpg.
const { test } = require("@playwright/test");
const path = require("path");
const { cborBase64, setupPanel, sendPortMessage, fireRequestFinished } = require("./panel-harness.js");

const outputPath = path.resolve(__dirname, "../docs/store-icons/store-screenshot-1280x800.jpg");

test("generate Chrome Web Store screenshot", async ({ page }) => {
  // Store screenshot must be exactly 1280x800; a viewport-clipped (non-fullPage)
  // shot at this size yields those exact dimensions.
  await page.setViewportSize({ width: 1280, height: 800 });
  await setupPanel(page);

  const host = "https://api.example.com";

  const listBody = cborBase64({
    results: {
      items: [
        { id: "itm_8a3f", name: "alpha-service", status: "ACTIVE", replicas: 3 },
        { id: "itm_2b7c", name: "beta-processor", status: "ACTIVE", replicas: 1 },
        { id: "itm_5e10", name: "gamma-worker", status: "DEGRADED", replicas: 2 },
      ],
      nextToken: null,
    },
  });

  await fireRequestFinished(page, {
    request: {
      method: "POST",
      url: `${host}/service/ListItems`,
      headers: [
        { name: "Accept", value: "application/cbor" },
        { name: "Content-Type", value: "application/cbor" },
        { name: "smithy-protocol", value: "rpc-v2-cbor" },
      ],
      postData: { text: cborBase64({ maxResults: 50, filter: "status=ACTIVE" }) },
    },
    response: {
      status: 200,
      statusText: "OK",
      headers: [
        { name: "Content-Type", value: "application/cbor" },
        { name: "smithy-protocol", value: "rpc-v2-cbor" },
      ],
      content: { text: listBody },
    },
  });

  await fireRequestFinished(page, {
    request: {
      method: "POST",
      url: `${host}/service/GetItem`,
      headers: [{ name: "Content-Type", value: "application/cbor" }],
    },
    response: {
      status: 200,
      statusText: "OK",
      headers: [{ name: "Content-Type", value: "application/cbor" }],
      content: { text: cborBase64({ id: "itm_8a3f", name: "alpha-service" }) },
    },
  });

  await fireRequestFinished(page, {
    request: {
      method: "POST",
      url: `${host}/service/DeleteItem`,
      headers: [{ name: "Content-Type", value: "application/cbor" }],
    },
    response: {
      status: 409,
      statusText: "Conflict",
      headers: [{ name: "Content-Type", value: "application/cbor" }],
      content: { text: cborBase64({ __type: "ConflictException", message: "Item is in use" }) },
    },
  });

  await sendPortMessage(page, {
    type: "request-started",
    requestId: "live-1",
    method: "POST",
    url: `${host}/service/UpdateItem`,
    requestHeaders: [{ name: "Accept", value: "application/cbor" }],
    timeStamp: Date.now(),
  });

  await page.locator(".entry").first().click();
  await page.evaluate(() => {
    document.querySelectorAll("details.headers-section").forEach((d) => (d.open = true));
  });

  // JPEG (store accepts JPEG); no alpha, so the panel's own background fills it.
  await page.screenshot({ path: outputPath, type: "jpeg", quality: 90 });
});
