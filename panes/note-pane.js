/**
 * note-pane.js — a registry pane for schema:TextDocument / Article / CreativeWork.
 *
 * A self-contained port of hub's NotePane: click-to-edit title + markdown body
 * with debounced autosave (PUT) and delete. It exports the SLIP-48 / LOSOS pane
 * contract, so the SAME module renders in hub AND in the solid-apps desktops
 * (chrome / win98 / ubuntu) via their shared pane dispatch (src/panes.js).
 *
 * Self-contained on purpose (no hub-internal imports) so it loads from the
 * registry on any host. Writes go through the host-provided fetch (ctx.fetch)
 * or the shared xlogin session — on solid-apps.github.io that's one session
 * across every shell, so a note edited here saves under your logged-in pod.
 */

const NOTE_CLASSES = [
  "http://schema.org/TextDocument", "http://schema.org/Article", "http://schema.org/CreativeWork",
  "https://schema.org/TextDocument", "https://schema.org/Article", "https://schema.org/CreativeWork",
];
const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

export const label = "Note";
export const icon  = "📄";
export const meta  = {
  id: "https://solid-apps.github.io/registry/panes/note-pane.js",
  name: "Note (markdown)",
  forClass: "http://schema.org/TextDocument",
};

const ln = (s) => String(s || "").split(/[#/:]/).pop();
const isNoteType = (v) =>
  typeof v === "string" && (NOTE_CLASSES.includes(v) || ["TextDocument", "Article", "CreativeWork"].includes(ln(v)));

// SLIP-48 canHandle(subject, store): used by hub's registry. The desktop
// dispatches by registry forClass and doesn't re-check this, but keeping it
// correct means the one module is genuinely interchangeable.
export function canHandle(subject, store) {
  if (subject?.termType && subject.termType !== "NamedNode") return false;
  if (!store?.statementsMatching) return false;
  return store.statementsMatching(subject, undefined, undefined)
    .some((s) => s.predicate?.value === RDF_TYPE && isNoteType(s.object?.value));
}

// LOSOS render(subject, store, container, rawData, ctx). chrome/hub both call
// with the parsed doc as rawData and a host ctx (auth/fetch) as the 5th arg.
export async function render(subject, _store, container, rawData, ctx) {
  injectStyles();
  const url = subject?.value || (typeof subject === "string" ? subject : null);
  const doc = rawData;
  if (!doc || !url) { container.innerHTML = `<div class="np-empty">Couldn’t load this note.</div>`; return; }

  // Tolerant field reading — different note apps serialise title/body under
  // different keys; pick whichever the doc actually has (and write back to it).
  const titleKey = ["headline", "name", "schema:headline", "schema:name", "title"].find((k) => doc[k] != null) || "headline";
  const bodyKey  = ["text", "articleBody", "schema:text", "content", "body"].find((k) => doc[k] != null) || "text";
  const af = (ctx && ctx.fetch) || (window.xlogin && window.xlogin.authFetch) || fetch;

  const save = debounce(async () => {
    doc[titleKey] = container.querySelector("#np-title")?.value ?? doc[titleKey];
    doc[bodyKey]  = container.querySelector("#np-body")?.value ?? doc[bodyKey];
    doc.datePublished = new Date().toISOString();
    setStatus("saving");
    try {
      const r = await af(url, { method: "PUT", headers: { "Content-Type": "application/ld+json" }, body: JSON.stringify(doc) });
      if (!r.ok) throw new Error("HTTP " + r.status);
      setStatus("saved");
      container.dispatchEvent(new CustomEvent("pane:change", { detail: { url, doc } }));
    } catch (e) { setStatus("err", e.message); }
  }, 600);

  draw();

  function draw() {
    container.innerHTML = `
      <div class="np-meta">
        <span><b>Saved</b> · <span id="np-status" class="np-saved">in sync</span></span>
        <span class="np-rel">${esc(fmtRel(doc.datePublished))}</span>
        <span class="np-url">${esc(url)}</span>
        <button class="np-del" id="np-del" title="Delete">🗑</button>
      </div>
      <input class="np-title" id="np-title" value="${esc(doc[titleKey] || "")}" placeholder="Untitled note" />
      <textarea class="np-body" id="np-body" placeholder="Write in markdown — # headers, **bold**, *italic*, [links](url)…">${esc(doc[bodyKey] || "")}</textarea>
    `;
    container.querySelector("#np-title").addEventListener("input", save);
    container.querySelector("#np-body").addEventListener("input", save);
    container.querySelector("#np-del").addEventListener("click", async () => {
      if (!confirm("Delete this note?")) return;
      try {
        const r = await af(url, { method: "DELETE" });
        if (!r.ok && r.status !== 404) throw new Error("HTTP " + r.status);
        container.dispatchEvent(new CustomEvent("pane:delete", { detail: { url } }));
      } catch (e) { setStatus("err", e.message); }
    });
  }
  function setStatus(kind, msg) {
    const el = container.querySelector("#np-status");
    if (!el) return;
    if (kind === "saving") { el.className = "np-saving"; el.textContent = "saving…"; }
    else if (kind === "saved") { el.className = "np-saved"; el.textContent = "in sync"; }
    else { el.className = "np-err"; el.textContent = "save error: " + (msg || ""); }
  }
}

function esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function fmtRel(iso) {
  const d = new Date(iso); if (isNaN(d.getTime())) return "";
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  const days = Math.floor(diff / 86400);
  return days < 7 ? days + "d ago" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function debounce(fn, ms) { let t; return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); }; }

function injectStyles() {
  if (document.getElementById("note-pane-css")) return;
  const s = document.createElement("style");
  s.id = "note-pane-css";
  s.textContent = `
.np-meta{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--line,#e2e6eb);font:12px var(--sans,system-ui,sans-serif);color:var(--text-dim,#5e5c64);flex-wrap:wrap}
.np-rel{color:var(--text-faint,#9a9a96)}
.np-url{color:var(--text-faint,#9a9a96);font-family:var(--mono,ui-monospace,monospace);font-size:11px;margin-left:auto;word-break:break-all}
.np-saved{color:#26a269}.np-saving{color:#e5a50a}.np-err{color:#c01c28}
.np-del{background:transparent;border:0;cursor:pointer;font-size:14px;line-height:1}
.np-title{display:block;width:100%;box-sizing:border-box;border:0;border-bottom:1px solid var(--line,#e2e6eb);padding:12px 14px;font:700 18px var(--sans,system-ui,sans-serif);outline:none;background:transparent;color:var(--text,#222)}
.np-body{display:block;width:100%;box-sizing:border-box;min-height:300px;border:0;padding:12px 14px;font:14px/1.55 var(--mono,ui-monospace,monospace);outline:none;resize:vertical;background:transparent;color:var(--text,#222)}
.np-empty{padding:30px;text-align:center;color:#999;font:14px var(--sans,system-ui,sans-serif)}
`;
  document.head.appendChild(s);
}

export default { label, icon, meta, canHandle, render };
