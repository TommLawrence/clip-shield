/**
 * ClipShield companion side panel.
 *
 * Uses the SAME @clipshield/privacy-core engine as the web workspace. All
 * redaction is deterministic and local. The optional semantic inspection uses
 * Chrome's built-in Prompt API (window.LanguageModel) when available; when it
 * is not, the deterministic workflow continues and the panel reports that
 * semantic inspection is unavailable.
 *
 * Raw selected content and the rehydration mapping live only in memory for the
 * lifetime of this panel. Nothing is written to chrome.storage. Copying
 * sanitized text is a user-initiated action only — there is no automatic
 * clipboard write, hidden transmission or remote code execution.
 */
import { detectFindings, buildRedaction, mergeSemanticProposals } from "@privacy-core/redaction";
import { detectOtFindings } from "@privacy-core/ot-guardrail";

const app = document.getElementById("app");

// Theme preference lives in this extension origin only (localStorage), is
// non-sensitive, and is independent of the web workspace's theme state.
function getTheme() {
  try {
    return localStorage.getItem("clipshield-ext-theme") === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}
function applyTheme(next) {
  document.documentElement.classList.toggle("light", next === "light");
}
function setTheme(next) {
  try {
    localStorage.setItem("clipshield-ext-theme", next);
  } catch {
    /* storage may be unavailable; theme still applies for this session */
  }
  applyTheme(next);
}
function themeIcon() {
  return getTheme() === "light"
    ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>'
    : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
}
applyTheme(getTheme());

// HTML entities are built from char codes so the literal sequences never
// appear in source (and cannot be misread by tooling).
const AMP = String.fromCharCode(38);
const entity = (name) => AMP + name + ";";
const ENTITY_MAP = {
  "&": entity("amp"),
  "<": entity("lt"),
  ">": entity("gt"),
  '"': entity("quot"),
  "'": entity("#39"),
};
function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (ch) => ENTITY_MAP[ch] || ch);
}

let state = {
  raw: "",
  findings: [],
  // "balanced" masks high-confidence personal/credential/financial/health/education/network
  // categories; "strict" additionally masks infrastructure, serials, addresses and
  // business-confidential identifiers. Both keep every finding reviewable.
  policy: "balanced",
  otFindings: [],
  semanticAvailable: typeof window !== "undefined" && "LanguageModel" in window,
  semanticNote: null,
};

function render() {
  const redaction = state.raw ? buildRedaction(state.raw, state.findings) : { sanitized: "", mapping: [], maskedCount: 0 };
  const included = state.findings.filter((finding) => finding.include).length;

  app.innerHTML = [
    '<header><div class="header-row"><div><h1>ClipShield <span>Companion</span></h1>',
    '<p class="tag">Local deterministic redaction · no cloud inference</p></div>',
    `<button id="theme" class="theme-btn" title="Toggle light or dark theme" aria-label="Toggle theme">${themeIcon()}</button></div></header>`,

    '<section class="card"><div class="row">',
    '<label class="switch-label"><span>Strict protection</span>',
    '<span class="hint">Also mask equipment, serials, addresses & business IDs</span></label>',
    '<label class="toggle">',
    `<input type="checkbox" id="profile" ${state.policy === "strict" ? "checked" : ""} />`,
    '<span class="track"></span></label></div></section>',

    '<section class="card"><div class="card-head"><h2>Selection</h2>',
    '<button id="paste" class="btn ghost">Paste</button></div>',
    `<textarea id="raw" placeholder="Select text on any page, right-click and choose Protect selection with ClipShield. Or paste it here.">${escapeHtml(state.raw)}</textarea></section>`,

    '<section class="card"><div class="card-head"><h2>Detected entities</h2>',
    `<span class="count">${included} of ${state.findings.length} masked</span></div>`,
    state.findings.length === 0
      ? `<p class="empty">${state.raw ? "No sensitive patterns detected. Review below before sharing." : "Nothing scanned yet."}</p>`
      : `<ul class="findings">${state.findings
          .map(
            (finding, index) =>
              `<li><label class="finding"><input type="checkbox" data-idx="${index}" ${finding.include ? "checked" : ""} />` +
              `<span class="cat">${escapeHtml(finding.label)}</span><code class="val">${escapeHtml(finding.value)}</code>` +
              `${finding.profileOnly ? '<span class="badge ot">OT</span>' : ""}</label></li>`,
          )
          .join("")}</ul>`,
    `<button id="semantic" class="btn ghost full" ${!state.raw ? "disabled" : ""}>${
      state.semanticAvailable ? "Run optional local semantic inspection (Prompt API)" : "Semantic inspection unavailable on this browser"
    }</button>`,
    state.semanticNote ? `<p class="note">${escapeHtml(state.semanticNote)}</p>` : "",
    "</section>",

    '<section class="card"><div class="card-head"><h2>Sanitized preview</h2>',
    `<span class="count">${redaction.maskedCount} masked</span></div>`,
    `<pre class="sanitized">${escapeHtml(redaction.sanitized || "—")}</pre>`,
    '<div class="actions"><button id="copy" class="btn primary" ${!redaction.sanitized ? "disabled" : ""}>Copy sanitized text</button>',
    '<button id="workspace" class="btn ghost">Open ClipShield web workspace</button></div></section>',

    state.otFindings.length
      ? '<section class="card"><div class="card-head"><h2>OT safety observations</h2>' +
        `<span class="count">${state.otFindings.length}</span></div><ul class="ot">` +
        state.otFindings
          .map(
            (finding) =>
              `<li><span class="cat sev-${finding.severity}">${finding.severity}</span> ${escapeHtml(finding.label)} <code>${escapeHtml(finding.evidence)}</code></li>`,
          )
          .join("") +
        "</ul><p class=\"note\">Detection only. Never disable, bypass, reset or override a safety mechanism based on this output.</p></section>"
      : "",

    "<footer><p>Raw content stays in memory in this panel. Nothing is stored or sent anywhere.</p></footer>",
  ].join("");

  bind();
}

function bind() {
  const raw = document.getElementById("raw");
  raw.addEventListener("input", () => {
    state.raw = raw.value;
    rescan();
  });

  document.getElementById("profile").addEventListener("change", (event) => {
    state.policy = event.target.checked ? "strict" : "balanced";
    rescan();
  });

  document.querySelectorAll("input[data-idx]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const index = Number(checkbox.dataset.idx);
      state.findings[index].include = checkbox.checked;
      render();
    });
  });

  document.getElementById("paste").addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        state.raw = text;
        rescan();
      }
    } catch {
      /* clipboard read may be blocked; the textarea remains editable */
    }
  });

  document.getElementById("copy").addEventListener("click", async () => {
    const redaction = buildRedaction(state.raw, state.findings);
    if (!redaction.sanitized) return;
    try {
      await navigator.clipboard.writeText(redaction.sanitized);
      flash(document.getElementById("copy"), "Copied");
    } catch {
      flash(document.getElementById("copy"), "Copy blocked");
    }
  });

  document.getElementById("workspace").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "open-workspace" });
  });

  document.getElementById("semantic").addEventListener("click", runSemantic);
  const themeBtn = document.getElementById("theme");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      setTheme(getTheme() === "light" ? "dark" : "light");
      render();
    });
  }
}

function rescan() {
  if (!state.raw.trim()) {
    state.findings = [];
    state.otFindings = [];
    render();
    return;
  }
  state.findings = detectFindings(state.raw, { customTerms: [], policy: state.policy });
  state.otFindings = detectOtFindings(state.raw);
  render();
}

async function runSemantic() {
  if (!state.semanticAvailable) {
    state.semanticNote =
      "Chrome's Prompt API (window.LanguageModel) is not available on this browser. The deterministic redaction workflow above still works.";
    render();
    return;
  }
  try {
    state.semanticNote = "Running local semantic inspection…";
    render();
    const session = await window.LanguageModel.create();
    const prompt =
      "List sensitive entities (personal names, emails, phone numbers, credentials, service accounts, host or infrastructure identifiers, financial identifiers, patient or student identifiers) in the text as a JSON array of objects with value and category. Output JSON only. Text:\n" +
      '"""' +
      state.raw +
      '"""';
    const raw = await session.prompt(prompt);
    session.destroy?.();
    let proposals = [];
    try {
      proposals = JSON.parse(raw);
      if (!Array.isArray(proposals)) proposals = [];
    } catch {
      proposals = [];
    }
    const before = state.findings.length;
    state.findings = mergeSemanticProposals(state.raw, state.findings, proposals);
    const added = state.findings.length - before;
    state.semanticNote =
      added > 0
        ? `Local semantic inspection completed (Prompt API). ${added} proposal${added === 1 ? "" : "s"} added for review — confirm each before masking.`
        : "Local semantic inspection completed (Prompt API). No new proposals beyond the deterministic findings. Review manually.";
    render();
  } catch (error) {
    state.semanticNote = `Semantic inspection failed locally: ${error?.message || error}. Deterministic redaction is unchanged.`;
    render();
  }
}

function flash(button, label) {
  const original = button.textContent;
  button.textContent = label;
  button.disabled = true;
  setTimeout(() => {
    button.textContent = original;
    button.disabled = false;
  }, 1200);
}

// On load, ask the background service worker for any selection that opened us.
chrome.runtime.sendMessage({ type: "ready" }, (response) => {
  if (chrome.runtime.lastError) {
    render();
    return;
  }
  if (response?.type === "selection" && response.text) {
    state.raw = response.text;
  }
  rescan();
});