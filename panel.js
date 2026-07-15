const entries = [];
let selectedIndex = -1;

const listEl = document.getElementById("request-list");
const outputEl = document.getElementById("output");
const statusEl = document.getElementById("status");
const clearBtn = document.getElementById("clear-btn");
const filterInput = document.getElementById("filter-input");
const filterClear = document.getElementById("filter-clear");

let filterText = "";

const pendingRequests = new Map();

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

function matchesFilter(entry) {
  if (!filterText) return true;
  const url = new URL(entry.request.url);
  const resource = getResourceName(url.pathname);
  return resource.toLowerCase().includes(filterText);
}

function renderList() {
  listEl.innerHTML = "";
  entries.forEach((entry, i) => {
    if (!matchesFilter(entry)) return;

    const div = document.createElement("div");
    const status = entry.response ? entry.response.status : 0;
    const loading = entry._loading;
    const cls = loading ? "status-loading" : statusClass(status);
    div.className = "entry " + cls + (i === selectedIndex ? " selected" : "");

    const method = entry.request.method;
    const url = new URL(entry.request.url);
    const resource = getResourceName(url.pathname);

    let inner = `<span class="method">${method}</span><span class="resource">${resource}</span>`;
    if (loading) {
      inner += `<span class="loading-indicator"></span>`;
    }
    div.innerHTML = inner;
    div.addEventListener("click", () => selectEntry(i));
    listEl.appendChild(div);
  });

  const loadingCount = entries.filter(e => e._loading).length;
  const doneCount = entries.length - loadingCount;
  let statusText = `${doneCount} CBOR response${doneCount !== 1 ? "s" : ""} captured`;
  if (loadingCount > 0) {
    statusText += ` · ${loadingCount} pending`;
  }
  statusEl.textContent = statusText;
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

function stringToBytes(str) {
  const buffer = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) buffer[i] = str.charCodeAt(i) & 0xff;
  return buffer;
}

function decodeCborBody(raw) {
  if (!raw) return null;
  try {
    let buffer;
    const looksBase64 = /^[A-Za-z0-9+/\s]+=*\s*$/.test(raw) && raw.length > 4;
    if (looksBase64) {
      const clean = raw.replace(/\s/g, "");
      buffer = stringToBytes(atob(clean));
    } else {
      buffer = stringToBytes(raw);
    }
    const decoded = CBOR.decode(buffer.buffer);
    return JSON.stringify(decoded, (key, val) => {
      if (val instanceof ArrayBuffer) return `<binary ${val.byteLength} bytes>`;
      return val;
    }, 2);
  } catch (e) {
    return null;
  }
}

function copyButton(id) {
  return `<button class="copy-btn" data-copy-id="${id}">Copy</button>`;
}

const copyTexts = {};

function attachCopyListeners() {
  document.querySelectorAll("[data-copy-id]").forEach((btn) => {
    if (btn._bound) return;
    btn._bound = true;
    btn.addEventListener("click", () => {
      const text = copyTexts[btn.dataset.copyId];
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = "Copied!";
        btn.classList.add("copied");
        setTimeout(() => {
          btn.textContent = "Copy";
          btn.classList.remove("copied");
        }, 1500);
      });
    });
  });
}

function renderRequestBody(entry) {
  const postData = entry.request && entry.request.postData;
  if (!postData || !postData.text) return "";

  const decoded = decodeCborBody(postData.text);
  const raw = decoded || postData.text.slice(0, 1000);
  const content = decoded
    ? `<pre>${syntaxHighlight(decoded)}</pre>`
    : `<pre>${raw}</pre>`;

  copyTexts["req-body"] = raw;
  return `<details class="headers-section"><summary>Request Body</summary><div class="body-section">${copyButton("req-body")}${content}</div></details>`;
}

function parseCookies(headers) {
  if (!headers) return [];
  const cookies = [];
  for (const h of headers) {
    if (h.name.toLowerCase() === "cookie") {
      for (const pair of h.value.split(";")) {
        const eq = pair.indexOf("=");
        if (eq > 0) {
          cookies.push({ name: pair.slice(0, eq).trim(), value: pair.slice(eq + 1).trim() });
        }
      }
    }
  }
  return cookies;
}

function renderCookies(entry) {
  const reqHeaders = entry.request ? entry.request.headers : [];
  const cookies = parseCookies(reqHeaders);
  if (cookies.length === 0) return "";

  const cookieText = cookies.map(c => `${c.name}=${c.value}`).join("\n");
  copyTexts["req-cookies"] = cookieText;

  let html = `<details class="headers-section"><summary>Cookies (${cookies.length})</summary>`;
  html += `<div class="body-section">${copyButton("req-cookies")}`;
  html += '<table class="headers-table"><tr><th>Name</th><th>Value</th></tr>';
  for (const c of cookies) {
    const name = c.name.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const value = c.value.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    html += `<tr><td class="header-name">${name}</td><td class="header-value">${value}</td></tr>`;
  }
  html += "</table></div></details>";
  return html;
}

function renderHeaders(entry) {
  const reqHeaders = entry.request ? entry.request.headers : [];
  const resHeaders = entry.response ? entry.response.headers : [];

  let html = `<details class="headers-section"><summary>Request Headers (${reqHeaders.length})</summary>${renderHeadersTable(reqHeaders)}</details>`;
  html += renderRequestBody(entry);
  html += renderCookies(entry);
  if (resHeaders.length > 0) {
    html += `<details class="headers-section"><summary>Response Headers (${resHeaders.length})</summary>${renderHeadersTable(resHeaders)}</details>`;
  }
  return html;
}

function renderLoadingDetail(entry) {
  const detailEl = document.getElementById("detail");
  const url = new URL(entry.request.url);
  const fullPath = `${entry.request.method} ${url.pathname}${url.search}`;

  let html = `<div class="detail-header"><div class="path">${fullPath}</div><div class="status loading">Pending…</div></div>`;
  html += renderHeaders(entry);
  html += `<div class="loading-body"><div class="loading-spinner"></div><span>Waiting for response…</span></div>`;
  detailEl.innerHTML = html;
  attachCopyListeners();
}

function selectEntry(index) {
  selectedIndex = index;
  renderList();

  const entry = entries[index];

  if (entry._loading) {
    renderLoadingDetail(entry);
    return;
  }

  const detailEl = document.getElementById("detail");

  const url = new URL(entry.request.url);
  const fullPath = `${entry.request.method} ${url.pathname}${url.search}`;
  const status = entry.response ? entry.response.status : 0;
  const statusText = entry.response ? entry.response.statusText : "";
  const sCls = status >= 400 ? "err" : "ok";

  function renderDetail(body) {
    const decoded = decodeCborBody(body);
    let bodyHtml;
    if (decoded) {
      copyTexts["res-body"] = decoded;
      bodyHtml = `<div class="body-section">${copyButton("res-body")}<pre>${syntaxHighlight(decoded)}</pre></div>`;
    } else {
      const raw = `Decode error\n\nRaw body (first 500 chars):\n${(body || "").slice(0, 500)}`;
      copyTexts["res-body"] = raw;
      bodyHtml = `<div class="body-section">${copyButton("res-body")}<pre>${raw}</pre></div>`;
    }

    const headerHtml = `<div class="detail-header"><div class="path">${fullPath}</div><div class="status ${sCls}">${status} ${statusText}</div></div>`;
    detailEl.innerHTML = headerHtml + renderHeaders(entry) + bodyHtml;
    attachCopyListeners();
  }

  if (typeof entry.getContent === "function") {
    entry.getContent((body) => renderDetail(body));
  } else {
    const body = entry.response && entry.response.content && entry.response.content.text;
    renderDetail(body || "");
  }
}

function onRequestStarted(msg) {
  const entry = {
    _loading: true,
    _requestId: msg.requestId,
    request: {
      method: msg.method,
      url: msg.url,
      headers: msg.requestHeaders || []
    },
    response: null
  };
  entries.push(entry);
  pendingRequests.set(msg.requestId, entry);
  renderList();
  if (selectedIndex === entries.length - 1) {
    renderLoadingDetail(entry);
  }
}

function onResponseHeaders(msg) {
  const entry = pendingRequests.get(msg.requestId);
  if (!entry) return;
  entry.response = {
    status: msg.statusCode,
    statusText: "",
    headers: msg.responseHeaders || []
  };
  if (selectedIndex === entries.indexOf(entry)) {
    renderLoadingDetail(entry);
  }
}

function onRequestFinished(harEntry) {
  if (!isCborResponse(harEntry)) return;

  const url = harEntry.request.url;
  const method = harEntry.request.method;

  let matched = null;
  for (const [id, pending] of pendingRequests) {
    if (pending.request.url === url && pending.request.method === method) {
      matched = id;
      break;
    }
  }

  if (matched) {
    const entry = pendingRequests.get(matched);
    pendingRequests.delete(matched);
    const idx = entries.indexOf(entry);

    entry._loading = false;
    entry.request = harEntry.request;
    entry.response = harEntry.response;
    if (typeof harEntry.getContent === "function") {
      entry.getContent = harEntry.getContent.bind(harEntry);
    }

    renderList();
    if (selectedIndex === idx) {
      selectEntry(idx);
    }
  } else {
    entries.push(harEntry);
    renderList();
  }
}

chrome.devtools.network.onRequestFinished.addListener(onRequestFinished);

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

const port = chrome.runtime.connect({ name: "cbor-panel" });
port.onMessage.addListener((msg) => {
  if (msg.type === "request-started") {
    onRequestStarted(msg);
  } else if (msg.type === "response-headers") {
    onResponseHeaders(msg);
  }
});

clearBtn.addEventListener("click", () => {
  entries.length = 0;
  pendingRequests.clear();
  selectedIndex = -1;
  renderList();
  outputEl.textContent = "Select a request to view decoded CBOR";
});

filterInput.addEventListener("input", () => {
  filterText = filterInput.value.toLowerCase();
  filterClear.hidden = !filterInput.value;
  renderList();
});

filterClear.addEventListener("click", () => {
  filterInput.value = "";
  filterText = "";
  filterClear.hidden = true;
  renderList();
});
