const panelPorts = new Set();

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "cbor-panel") return;
  panelPorts.add(port);
  port.onDisconnect.addListener(() => panelPorts.delete(port));
});

function broadcast(msg) {
  for (const port of panelPorts) {
    port.postMessage(msg);
  }
}

function hasCborHeader(headers) {
  if (!headers) return false;
  return headers.some(
    h => (h.name.toLowerCase() === "content-type" || h.name.toLowerCase() === "accept") &&
         (h.value.includes("cbor") || h.value.includes("application/vnd.amazon"))
  );
}

chrome.webRequest.onSendHeaders.addListener(
  (details) => {
    if (hasCborHeader(details.requestHeaders)) {
      broadcast({
        type: "request-started",
        requestId: details.requestId,
        method: details.method,
        url: details.url,
        requestHeaders: details.requestHeaders,
        timeStamp: details.timeStamp
      });
    }
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders"]
);

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (hasCborHeader(details.responseHeaders)) {
      broadcast({
        type: "response-headers",
        requestId: details.requestId,
        statusCode: details.statusCode,
        responseHeaders: details.responseHeaders
      });
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);
