// Shared test harness for driving the panel with mocked chrome.* APIs.
// Used by panel.spec.js (assertions) and screenshot.spec.js (README image).
const path = require("path");
const { encode } = require("./cbor-encode.js");

const panelPath = path.resolve(__dirname, "../src/panel.html");

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

module.exports = { panelPath, cborBase64, setupPanel, sendPortMessage, fireRequestFinished };
