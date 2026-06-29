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

function renderList() {
  listEl.innerHTML = "";
  entries.forEach((entry, i) => {
    const div = document.createElement("div");
    div.className = "entry" + (i === selectedIndex ? " selected" : "");

    const method = entry.request.method;
    const url = new URL(entry.request.url);
    const path = url.pathname + url.search;
    const status = entry.response ? entry.response.status : "?";

    div.innerHTML = `<span class="method">${method}</span><span class="url">${path}</span><span class="status-code ${status >= 400 ? 'error' : ''}">${status}</span>`;
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

function renderHeaders(entry) {
  const reqHeaders = entry.request ? entry.request.headers : [];
  const resHeaders = entry.response ? entry.response.headers : [];

  return `<details class="headers-section"><summary>Request Headers (${reqHeaders.length})</summary>${renderHeadersTable(reqHeaders)}</details>` +
         `<details class="headers-section"><summary>Response Headers (${resHeaders.length})</summary>${renderHeadersTable(resHeaders)}</details>`;
}

function selectEntry(index) {
  selectedIndex = index;
  renderList();

  const entry = entries[index];
  const detailEl = document.getElementById("detail");

  entry.getContent((body, encoding) => {
    let bodyHtml;
    try {
      let buffer;
      if (encoding === "base64" || /^[A-Za-z0-9+/=\s]+$/.test(body)) {
        const clean = body.replace(/\s/g, "");
        const bin = atob(clean);
        buffer = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buffer[i] = bin.charCodeAt(i);
      } else {
        const enc = new TextEncoder();
        buffer = enc.encode(body);
      }

      const decoded = CBOR.decode(buffer.buffer || buffer);
      const json = JSON.stringify(decoded, (key, val) => {
        if (val instanceof ArrayBuffer) {
          return `<binary ${val.byteLength} bytes>`;
        }
        return val;
      }, 2);
      bodyHtml = `<pre>${syntaxHighlight(json)}</pre>`;
    } catch (e) {
      bodyHtml = `<pre>Decode error: ${e.message}\n\nRaw body (first 500 chars):\n${body.slice(0, 500)}</pre>`;
    }

    detailEl.innerHTML = renderHeaders(entry) + bodyHtml;
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
