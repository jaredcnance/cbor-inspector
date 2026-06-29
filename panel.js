const entries = [];
let selectedIndex = -1;

const listEl = document.getElementById("request-list");
const outputEl = document.getElementById("output");
const statusEl = document.getElementById("status");
const clearBtn = document.getElementById("clear-btn");

function isCborResponse(entry) {
  if (!entry.response || !entry.response.headers) return false;
  return entry.response.headers.some(
    h => h.name.toLowerCase() === "content-type" &&
         (h.value.includes("cbor") || h.value.includes("application/vnd.amazon"))
  );
}

function syntaxHighlight(json) {
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
    let cls = "json-number";
    if (/^"/.test(match)) {
      cls = /:$/.test(match) ? "json-key" : "json-string";
    } else if (/true|false/.test(match)) {
      cls = "json-bool";
    } else if (/null/.test(match)) {
      cls = "json-null";
    }
    return `<span class="${cls}">${match}</span>`;
  });
}

function getResourceName(pathname) {
  const segments = pathname.split("/").filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] : pathname;
}

function statusClass(status) {
  if (status >= 400) return "status-err";
  if (status >= 200 && status < 400) return "status-ok";
  return "";
}

function renderList() {
  listEl.innerHTML = "";
  entries.forEach((entry, i) => {
    const div = document.createElement("div");
    const status = entry.response ? entry.response.status : 0;
    div.className = "entry " + statusClass(status) + (i === selectedIndex ? " selected" : "");

    const method = entry.request.method;
    const url = new URL(entry.request.url);
    const resource = getResourceName(url.pathname);

    div.innerHTML = `<span class="method">${method}</span><span class="resource">${resource}</span>`;
    div.addEventListener("click", () => selectEntry(i));
    listEl.appendChild(div);
  });
  statusEl.textContent = `${entries.length} CBOR response${entries.length !== 1 ? "s" : ""} captured`;
}

function renderHeadersTable(headers) {
  if (!headers || headers.length === 0) return "<em>No headers</em>";
  let html = '<table class="headers-table"><tr><th>Name</th><th>Value</th></tr>';
  for (const h of headers) {
    const name = h.name.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const value = h.value.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    html += `<tr><td class="header-name">${name}</td><td class="header-value">${value}</td></tr>`;
  }
  html += "</table>";
  return html;
}

function decodeCborBody(raw) {
  if (!raw) return null;
  try {
    let buffer;
    if (/^[A-Za-z0-9+/=\s]+$/.test(raw)) {
      const clean = raw.replace(/\s/g, "");
      const bin = atob(clean);
      buffer = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buffer[i] = bin.charCodeAt(i);
    } else {
      buffer = new TextEncoder().encode(raw);
    }
    const decoded = CBOR.decode(buffer.buffer || buffer);
    return JSON.stringify(decoded, (key, val) => {
      if (val instanceof ArrayBuffer) return `<binary ${val.byteLength} bytes>`;
      return val;
    }, 2);
  } catch (e) {
    return null;
  }
}

function renderRequestBody(entry) {
  const postData = entry.request && entry.request.postData;
  if (!postData || !postData.text) return "";

  const decoded = decodeCborBody(postData.text);
  const content = decoded
    ? `<pre>${syntaxHighlight(decoded)}</pre>`
    : `<pre>${postData.text.slice(0, 1000)}</pre>`;

  return `<details class="headers-section"><summary>Request Body</summary>${content}</details>`;
}

function renderHeaders(entry) {
  const reqHeaders = entry.request ? entry.request.headers : [];
  const resHeaders = entry.response ? entry.response.headers : [];

  return `<details class="headers-section"><summary>Request Headers (${reqHeaders.length})</summary>${renderHeadersTable(reqHeaders)}</details>` +
         renderRequestBody(entry) +
         `<details class="headers-section"><summary>Response Headers (${resHeaders.length})</summary>${renderHeadersTable(resHeaders)}</details>`;
}

function selectEntry(index) {
  selectedIndex = index;
  renderList();

  const entry = entries[index];
  const detailEl = document.getElementById("detail");

  const url = new URL(entry.request.url);
  const fullPath = `${entry.request.method} ${url.pathname}${url.search}`;
  const status = entry.response ? entry.response.status : 0;
  const statusText = entry.response ? entry.response.statusText : "";
  const sCls = status >= 400 ? "err" : "ok";

  entry.getContent((body, encoding) => {
    const decoded = decodeCborBody(body);
    let bodyHtml;
    if (decoded) {
      bodyHtml = `<pre>${syntaxHighlight(decoded)}</pre>`;
    } else {
      bodyHtml = `<pre>Decode error\n\nRaw body (first 500 chars):\n${(body || "").slice(0, 500)}</pre>`;
    }

    const headerHtml = `<div class="detail-header"><div class="path">${fullPath}</div><div class="status ${sCls}">${status} ${statusText}</div></div>`;
    detailEl.innerHTML = headerHtml + renderHeaders(entry) + bodyHtml;
  });
}

function onRequestFinished(entry) {
  if (isCborResponse(entry)) {
    entries.push(entry);
    renderList();
  }
}

chrome.devtools.network.onRequestFinished.addListener(onRequestFinished);

// Also scan already-finished requests when panel opens
chrome.devtools.network.getHAR((harLog) => {
  if (harLog && harLog.entries) {
    harLog.entries.forEach((e) => {
      if (isCborResponse(e)) {
        entries.push(e);
      }
    });
    renderList();
  }
});

clearBtn.addEventListener("click", () => {
  entries.length = 0;
  selectedIndex = -1;
  renderList();
  outputEl.textContent = "Select a request to view decoded CBOR";
});
