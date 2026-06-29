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
  listEl.textContent = "";
  entries.forEach((entry, i) => {
    const div = document.createElement("div");
    const status = entry.response ? entry.response.status : 0;
    div.className = "entry " + statusClass(status) + (i === selectedIndex ? " selected" : "");

    const method = entry.request.method;
    const url = new URL(entry.request.url);
    const resource = getResourceName(url.pathname);

    const methodSpan = document.createElement("span");
    methodSpan.className = "method";
    methodSpan.textContent = method;
    const resourceSpan = document.createElement("span");
    resourceSpan.className = "resource";
    resourceSpan.textContent = resource;
    div.appendChild(methodSpan);
    div.appendChild(resourceSpan);

    div.addEventListener("click", () => selectEntry(i));
    listEl.appendChild(div);
  });
  statusEl.textContent = `${entries.length} CBOR response${entries.length !== 1 ? "s" : ""} captured`;
}

function renderHeadersTable(headers) {
  const table = document.createElement("table");
  table.className = "headers-table";
  if (!headers || headers.length === 0) {
    const em = document.createElement("em");
    em.textContent = "No headers";
    return em;
  }
  const headerRow = table.insertRow();
  const th1 = document.createElement("th");
  th1.textContent = "Name";
  const th2 = document.createElement("th");
  th2.textContent = "Value";
  headerRow.appendChild(th1);
  headerRow.appendChild(th2);
  for (const h of headers) {
    const row = table.insertRow();
    const nameCell = row.insertCell();
    nameCell.className = "header-name";
    nameCell.textContent = h.name;
    const valueCell = row.insertCell();
    valueCell.className = "header-value";
    valueCell.textContent = h.value;
  }
  return table;
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

function createDetailsSection(summaryText, content) {
  const details = document.createElement("details");
  details.className = "headers-section";
  const summary = document.createElement("summary");
  summary.textContent = summaryText;
  details.appendChild(summary);
  if (typeof content === "string") {
    const pre = document.createElement("pre");
    pre.textContent = content;
    details.appendChild(pre);
  } else if (content) {
    details.appendChild(content);
  }
  return details;
}

function createHighlightedPre(json) {
  const pre = document.createElement("pre");
  const tokenPattern = /("(?:\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g;
  let lastIndex = 0;
  let match;
  while ((match = tokenPattern.exec(json)) !== null) {
    if (match.index > lastIndex) {
      pre.appendChild(document.createTextNode(json.slice(lastIndex, match.index)));
    }
    const token = match[0];
    let cls = "json-number";
    if (/^"/.test(token)) {
      cls = /:$/.test(token) ? "json-key" : "json-string";
    } else if (/^(?:true|false)$/.test(token)) {
      cls = "json-bool";
    } else if (token === "null") {
      cls = "json-null";
    }
    const span = document.createElement("span");
    span.className = cls;
    span.textContent = token;
    pre.appendChild(span);
    lastIndex = tokenPattern.lastIndex;
  }
  if (lastIndex < json.length) {
    pre.appendChild(document.createTextNode(json.slice(lastIndex)));
  }
  return pre;
}

function renderRequestBody(entry) {
  const postData = entry.request && entry.request.postData;
  if (!postData || !postData.text) return null;

  const decoded = decodeCborBody(postData.text);
  const content = decoded
    ? createHighlightedPre(decoded)
    : (() => { const pre = document.createElement("pre"); pre.textContent = postData.text.slice(0, 1000); return pre; })();

  const details = document.createElement("details");
  details.className = "headers-section";
  const summary = document.createElement("summary");
  summary.textContent = "Request Body";
  details.appendChild(summary);
  details.appendChild(content);
  return details;
}

function renderHeaders(entry, container) {
  const reqHeaders = entry.request ? entry.request.headers : [];
  const resHeaders = entry.response ? entry.response.headers : [];

  container.appendChild(createDetailsSection(`Request Headers (${reqHeaders.length})`, renderHeadersTable(reqHeaders)));

  const reqBody = renderRequestBody(entry);
  if (reqBody) container.appendChild(reqBody);

  container.appendChild(createDetailsSection(`Response Headers (${resHeaders.length})`, renderHeadersTable(resHeaders)));
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

  function renderDetail(body) {
    detailEl.textContent = "";

    const header = document.createElement("div");
    header.className = "detail-header";
    const pathDiv = document.createElement("div");
    pathDiv.className = "path";
    pathDiv.textContent = fullPath;
    const statusDiv = document.createElement("div");
    statusDiv.className = "status " + sCls;
    statusDiv.textContent = `${status} ${statusText}`;
    header.appendChild(pathDiv);
    header.appendChild(statusDiv);
    detailEl.appendChild(header);

    renderHeaders(entry, detailEl);

    const decoded = decodeCborBody(body);
    if (decoded) {
      detailEl.appendChild(createHighlightedPre(decoded));
    } else {
      const pre = document.createElement("pre");
      pre.textContent = `Decode error\n\nRaw body (first 500 chars):\n${(body || "").slice(0, 500)}`;
      detailEl.appendChild(pre);
    }
  }

  if (typeof entry.getContent === "function") {
    entry.getContent((body) => renderDetail(body));
  } else {
    const body = entry.response && entry.response.content && entry.response.content.text;
    renderDetail(body || "");
  }
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
