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

// Pure detection/formatting helpers live in format.js (loaded before this file).
const { escapeHtml, isCborResponse, syntaxHighlight, getResourceName, statusClass, decodeCborBody, parseCookies } = Format;

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

    let inner = `<span class="method">${escapeHtml(method)}</span><span class="resource">${escapeHtml(resource)}</span>`;
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

// Render a Name/Value table from {name, value} rows (headers, cookies, …).
function renderNameValueTable(rows) {
  if (!rows || rows.length === 0) return "<em>No headers</em>";
  let html = '<table class="headers-table"><tr><th>Name</th><th>Value</th></tr>';
  for (const r of rows) {
    html += `<tr><td class="header-name">${escapeHtml(r.name)}</td><td class="header-value">${escapeHtml(r.value)}</td></tr>`;
  }
  html += "</table>";
  return html;
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
    : `<pre>${escapeHtml(raw)}</pre>`;

  return renderSection({
    title: "Request Body",
    copyId: "req-body",
    copyText: raw,
    body: content,
  });
}

// Render a collapsible <details> section with a copy button and body markup.
// `copyText` is registered under `copyId` for the copy handler.
function renderSection({ title, count, copyId, copyText, body }) {
  copyTexts[copyId] = copyText;
  const label = count != null ? `${title} (${count})` : title;
  return `<details class="headers-section"><summary>${label}</summary><div class="body-section">${copyButton(copyId)}${body}</div></details>`;
}

function renderCookies(entry) {
  const reqHeaders = entry.request ? entry.request.headers : [];
  const cookies = parseCookies(reqHeaders);
  if (cookies.length === 0) return "";

  return renderSection({
    title: "Cookies",
    count: cookies.length,
    copyId: "req-cookies",
    copyText: cookies.map(c => `${c.name}=${c.value}`).join("\n"),
    body: renderNameValueTable(cookies),
  });
}

function renderHeaders(entry) {
  const reqHeaders = entry.request ? entry.request.headers : [];
  const resHeaders = entry.response ? entry.response.headers : [];

  let html = renderSection({
    title: "Request Headers",
    count: reqHeaders.length,
    copyId: "req-headers",
    copyText: reqHeaders.map(h => `${h.name}: ${h.value}`).join("\n"),
    body: renderNameValueTable(reqHeaders),
  });
  html += renderRequestBody(entry);
  html += renderCookies(entry);
  if (resHeaders.length > 0) {
    html += renderSection({
      title: "Response Headers",
      count: resHeaders.length,
      copyId: "res-headers",
      copyText: resHeaders.map(h => `${h.name}: ${h.value}`).join("\n"),
      body: renderNameValueTable(resHeaders),
    });
  }
  return html;
}

// Build the top ".detail-header" block (path + status line) for a detail view.
function renderDetailHeader(entry, statusHtml) {
  const url = new URL(entry.request.url);
  const fullPath = `${entry.request.method} ${url.pathname}${url.search}`;
  return `<div class="detail-header"><div class="path">${escapeHtml(fullPath)}</div>${statusHtml}</div>`;
}

function renderLoadingDetail(entry) {
  const detailEl = document.getElementById("detail");

  let html = renderDetailHeader(entry, `<div class="status loading">Pending…</div>`);
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
      bodyHtml = `<div class="body-section">${copyButton("res-body")}<pre>${escapeHtml(raw)}</pre></div>`;
    }

    const statusHtml = `<div class="status ${sCls}">${status} ${escapeHtml(statusText)}</div>`;
    detailEl.innerHTML = renderDetailHeader(entry, statusHtml) + renderHeaders(entry) + bodyHtml;
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
