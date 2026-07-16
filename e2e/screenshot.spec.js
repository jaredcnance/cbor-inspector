// Generates the README hero image. Run on demand via `npm run screenshot`;
// NOT part of the CI test run, so normal runs never touch tracked files.
// Writes directly to docs/screenshot.png (committed).
const { test } = require("@playwright/test");
const path = require("path");
const { cborBase64, setupPanel, sendPortMessage, fireRequestFinished } = require("./panel-harness.js");

const outputPath = path.resolve(__dirname, "../docs/screenshot.png");

test("generate README screenshot", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 720 });
  await setupPanel(page);

  const host = "https://api.example.com";

  // A completed request whose decoded body shows off nested structure.
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

  // A couple more completed entries so the request list looks populated.
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

  // One in-flight request to show the loading indicator.
  await sendPortMessage(page, {
    type: "request-started",
    requestId: "live-1",
    method: "POST",
    url: `${host}/service/UpdateItem`,
    requestHeaders: [{ name: "Accept", value: "application/cbor" }],
    timeStamp: Date.now(),
  });

  // Select the first (rich) entry, then expand every collapsible section.
  await page.locator(".entry").first().click();
  await page.evaluate(() => {
    document.querySelectorAll("details.headers-section").forEach((d) => (d.open = true));
  });

  await page.screenshot({ path: outputPath });
});
