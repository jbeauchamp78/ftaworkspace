// FTA Workspace — DEMO mode fetch shim (v2, 2026-09-22).
//
// WHAT CHANGED AND WHY
// --------------------
// The previous shim hand-wrote ~65 route handlers. The app now exposes ~90
// paths the UI actually calls, and every new feature meant another handler
// nobody remembered to add — so the demo silently fell three months behind
// (FY27 KRs, campaigns, customer actions, deployments and the PEC tile were
// all missing, and the build was reading a stale static-v3 fork on top).
//
// This version is a REPLAYER. scripts/gen_demo_v2.py harvests the live LAB
// response for every endpoint, keeps its structure and regenerates every
// value, and writes them into demo-data.json keyed "METHOD /path". The shim
// looks a response up rather than constructing one, so the demo matches the
// app's real shapes by construction and re-syncs by re-running the generator.
//
// Mutations still behave: PATCH/POST update an in-memory copy of the replayed
// payloads so clicking a status, typing a note, or queueing an action visibly
// changes the UI. A read-only demo would misrepresent the tool.
//
// NO BACKEND. NO REAL DATA. Safe to serve from file:// or a public static host.
(async function () {
  console.log("[DEMO] Initializing fetch shim (v2 replayer)...");

  // ---------- STAGE 1: holding shim, installed synchronously ----------
  // The app fires /api/* calls the moment it parses, which is BEFORE
  // demo-data.json can load. Anything arriving early is queued, never passed
  // through — a pass-through would hit a real backend and, on a machine with
  // LAB running, show real customer data inside the demo.
  const origFetch = window.fetch.bind(window);
  const queued = [];
  let realDispatch = null;

  function parse(input) {
    const url = typeof input === "string" ? input : input?.url;
    if (!url) return null;
    try {
      const u = new URL(url, location.href);
      return { path: u.pathname, search: u.search || "" };
    } catch { return { path: url, search: "" }; }
  }

  window.fetch = function (input, opts) {
    const bits = parse(input);
    if (!bits || !bits.path.startsWith("/api/")) return origFetch(input, opts);
    const method = ((opts && opts.method) || "GET").toUpperCase();
    if (realDispatch) return Promise.resolve(realDispatch(method, bits.path, opts, bits.search));
    return new Promise((resolve, reject) => queued.push({ input, opts, resolve, reject }));
  };
  console.log("[DEMO] Holding shim installed — queueing /api/* until data loads.");

  // ---------- STAGE 2: load the replay table ----------
  let DATA;
  try {
    const r = await origFetch("./demo-data.json", { cache: "no-store" });
    DATA = await r.json();
  } catch (e) {
    console.error("[DEMO] demo-data.json failed to load", e);
    DATA = { routes: {}, roster: [], meta: {} };
  }

  // Deep clone so mutations never corrupt the pristine replay table — a
  // reviewer reloading the page must get the original state back.
  const ROUTES = JSON.parse(JSON.stringify(DATA.routes || {}));
  const ROSTER = DATA.roster || [];
  console.log(`[DEMO] ${Object.keys(ROUTES).length} routes, ${ROSTER.length} customers.`);

  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status, headers: { "Content-Type": "application/json" },
    });
  const ok = (extra) => json(Object.assign({ ok: true, demo: true }, extra || {}));

  // Unhandled calls are counted AND exposed on window so a harness can assert
  // the count is zero. A console.warn alone is easy to miss and awkward to
  // assert on reliably.
  const UNHANDLED = [];
  window.__demoUnhandled = UNHANDLED;

  // ------------------------------------------------------------------
  // Mutation store, keyed the way the app keys things so a write and the
  // subsequent read agree.
  // ------------------------------------------------------------------
  const MUT = {
    todos: {},        // `${cust}|${slot}`   -> {label,status,notes}
    krs: {},          // `${cust}|${kr}`     -> {...}
    notes: {},        // cust                -> fta_notes
    heatmap: {},      // `${cust}|${tile}`   -> {status,notes}
    campaign: {},     // `${cust}|${cid}`    -> {status,notes}
    campaignNote: {}, // cid                 -> note
    fy27: {},         // `${cust}|${krKey}`  -> {...}
    cfg: {},          // `${cust}|${kr}|${cond}|${cfg}` -> {...}
    wl: {},           // `${cust}|${workload}` -> {...}
    blockers: null,
  };

  // ------------------------------------------------------------------
  // GET: replay table lookup, with graceful degradation.
  //
  // Lookup order matters. An exact hit is always preferred; the sibling
  // fallback exists so a customer the generator could not reach still renders
  // something structurally valid instead of throwing in the UI.
  // ------------------------------------------------------------------
  function replay(path) {
    if (ROUTES["GET " + path]) return ROUTES["GET " + path];
    const dec = decodeURIComponent(path);
    if (ROUTES["GET " + dec]) return ROUTES["GET " + dec];

    const m = dec.match(/^\/api\/customer\/([^/]+)(\/.*)?$/);
    if (m) {
      const tail = m[2] || "";
      const sib = Object.keys(ROUTES).find(k =>
        k.startsWith("GET /api/customer/") &&
        (tail ? k.endsWith(tail) : k.split("/").length === 4));
      if (sib) return ROUTES[sib];
    }
    return null;
  }

  function applyMutations(path, body) {
    if (body == null || typeof body !== "object") return body;
    const out = JSON.parse(JSON.stringify(body));

    // /api/tracker carries todos + notes + kr_status for every customer, so
    // every in-place edit the reviewer makes has to be re-applied on read.
    if (path === "/api/tracker" && Array.isArray(out.customers)) {
      for (const c of out.customers) {
        if (MUT.notes[c.nickname] != null) c.fta_notes = MUT.notes[c.nickname];
        for (const t of c.todos || []) {
          const k = `${c.nickname}|${t.slot}`;
          if (MUT.todos[k]) Object.assign(t, MUT.todos[k]);
        }
        for (const k of Object.keys(c.kr_status || {})) {
          const mk = `${c.nickname}|${k}`;
          if (MUT.krs[mk]) Object.assign(c.kr_status[k], MUT.krs[mk]);
        }
      }
    }
    if (path === "/api/portfolio/blockers" && MUT.blockers != null) out.text = MUT.blockers;

    // Campaign edits live in two shapes: per-customer status/notes maps and a
    // programme-level note.
    if (path === "/api/campaigns/portfolio" && Array.isArray(out.campaigns)) {
      for (const c of out.campaigns) {
        c.status_by_customer = c.status_by_customer || {};
        c.notes_by_customer = c.notes_by_customer || {};
        for (const [mk, v] of Object.entries(MUT.campaign)) {
          const i = mk.lastIndexOf("|");
          const cust = mk.slice(0, i), cid = mk.slice(i + 1);
          if (String(cid) !== String(c.campaign_id)) continue;
          if (v.status != null) c.status_by_customer[cust] = v.status;
          if (v.notes != null) c.notes_by_customer[cust] = v.notes;
        }
        if (MUT.campaignNote[c.campaign_id] != null) c.note = MUT.campaignNote[c.campaign_id];
        const vals = Object.values(c.status_by_customer || {});
        c.engaged = vals.filter(v => v && v !== "NOT STARTED" && v !== "N/A").length;
        c.untouched = Math.max(0, (ROSTER.length || 0) - c.engaged);
      }
    }

    const cm = path.match(/^\/api\/customer\/([^/]+)(\/.*)?$/);
    if (cm) {
      const cust = decodeURIComponent(cm[1]);
      const tail = cm[2] || "";
      if (tail === "" && MUT.notes[cust] != null) out.fta_notes = MUT.notes[cust];
      if (tail === "/heatmap" && Array.isArray(out.tiles)) {
        for (const t of out.tiles) {
          const k = `${cust}|${t.tile_id || t.id}`;
          if (MUT.heatmap[k]) Object.assign(t, MUT.heatmap[k]);
        }
      }
      if (tail === "/fy27-krs" && Array.isArray(out.krs)) {
        for (const kr of out.krs) {
          const k = `${cust}|${kr.kr_key}`;
          if (MUT.fy27[k]) Object.assign(kr, MUT.fy27[k]);
          for (const cond of kr.conditions || []) {
            for (const cfg of cond.configs || []) {
              const ck = `${cust}|${kr.kr_key}|${cond.condition_id || cond.id}|${cfg.config_id || cfg.id}`;
              if (MUT.cfg[ck]) Object.assign(cfg, MUT.cfg[ck]);
            }
          }
        }
      }
      if (tail === "/fy27-workloads" && Array.isArray(out.workloads)) {
        for (const w of out.workloads) {
          const k = `${cust}|${w.workload || w.name}`;
          if (MUT.wl[k]) Object.assign(w, MUT.wl[k]);
        }
      }
    }
    return out;
  }

  function readBody(opts) {
    try { return opts && opts.body ? JSON.parse(opts.body) : {}; }
    catch { return {}; }
  }

  // ------------------------------------------------------------------
  // Write routes, most-specific first.
  // ------------------------------------------------------------------
  const WRITES = [
    [/^\/api\/todo$/, (m, b) => {
      const k = `${b.nickname}|${b.slot}`;
      MUT.todos[k] = Object.assign({}, MUT.todos[k], b.fields || {});
      return ok(Object.assign({ slot: b.slot }, MUT.todos[k]));
    }],
    [/^\/api\/customer\/([^/]+)\/notes$/, (m, b) => {
      MUT.notes[decodeURIComponent(m[1])] = b.fta_notes ?? b.notes ?? "";
      return ok();
    }],
    [/^\/api\/customer\/([^/]+)\/(display|tpid)$/, () => ok()],
    [/^\/api\/customer\/([^/]+)\/kr\/([^/]+)\/pec-(flag|note|advance|disengage)$/, () =>
      ok({ demo_note: "Recorded in DEMO only — no FTOP write." })],
    [/^\/api\/customer\/([^/]+)\/kr\/([^/]+)$/, (m, b) => {
      const k = `${decodeURIComponent(m[1])}|${decodeURIComponent(m[2])}`;
      MUT.krs[k] = Object.assign({}, MUT.krs[k], b);
      return ok();
    }],
    [/^\/api\/customer\/([^/]+)\/heatmap\/bulk$/, (m, b) => {
      const cust = decodeURIComponent(m[1]);
      for (const t of (b.tiles || [])) MUT.heatmap[`${cust}|${t.tile_id || t.id}`] = t;
      return ok({ updated: (b.tiles || []).length });
    }],
    [/^\/api\/customer\/([^/]+)\/heatmap\/ftbi-sync$/, () =>
      ok({ synced: 7, demo_note: "DEMO: synthetic FTBI sync, nothing queried." })],
    [/^\/api\/customer\/([^/]+)\/heatmap\/([^/]+)$/, (m, b) => {
      MUT.heatmap[`${decodeURIComponent(m[1])}|${decodeURIComponent(m[2])}`] = b;
      return ok();
    }],
    [/^\/api\/campaign-status$/, (m, b) => {
      const k = `${b.nickname}|${b.campaign_id}`;
      MUT.campaign[k] = Object.assign({}, MUT.campaign[k], b);
      return ok();
    }],
    [/^\/api\/campaign-note$/, (m, b) => {
      MUT.campaignNote[b.campaign_id] = b.notes ?? b.note ?? "";
      return ok();
    }],
    [/^\/api\/customer\/([^/]+)\/fy27-config\/([^/]+)\/([^/]+)\/([^/]+)$/, (m, b) => {
      MUT.cfg[`${decodeURIComponent(m[1])}|${m[2]}|${m[3]}|${decodeURIComponent(m[4])}`] = b;
      return ok();
    }],
    [/^\/api\/customer\/([^/]+)\/fy27-kr\/([^/]+)$/, (m, b) => {
      MUT.fy27[`${decodeURIComponent(m[1])}|${m[2]}`] = b;
      return ok();
    }],
    [/^\/api\/customer\/([^/]+)\/fy27-workload\/([^/]+)$/, (m, b) => {
      MUT.wl[`${decodeURIComponent(m[1])}|${decodeURIComponent(m[2])}`] = b;
      return ok();
    }],
    [/^\/api\/customer\/([^/]+)\/non-krs\/([^/]+)$/, () => ok()],
    [/^\/api\/customer\/([^/]+)\/ideal-config\/notes$/, () => ok()],
    [/^\/api\/portfolio\/blockers$/, (m, b) => {
      MUT.blockers = b.text ?? b.blockers ?? "";
      return ok({ text: MUT.blockers });
    }],
    // Draft/queue submissions: accept and acknowledge. The cart handlers
    // below own anything that has to become a visible queue item.
    [/^\/api\/customer\/([^/]+)\/(insight|spotlight|pec)-draft(\/(queue|prompt))?$/, () =>
      ok({ queued: true, demo_note: "Staged in DEMO only." })],
    [/^\/api\/customer\/([^/]+)\/spotlights\/queue$/, () => ok({ queued: true })],
    [/^\/api\/spotlights\/([^/]+)\/publish-execute$/, () =>
      ok({ published: true, demo_note: "DEMO only — no FTOP write." })],
    [/^\/api\/spotlights\/(manual|bulk)$/, () => ok()],
    [/^\/api\/insights\/(bulk|sync-ftfeedback)$/, () => ok()],
    [/^\/api\/(kr|scout\/focus|daily-focus)$/, () => ok()],
    // Refresh-style POSTs report success without pretending to have done real
    // work: the demo has no backend to refresh from, and inventing new numbers
    // on each press would make the demo look non-deterministic.
    [/^\/api\/(refresh|campaigns\/refresh|customer-actions\/refresh|pecs\/refresh|deployments\/refresh|counters\/refresh-[a-z-]+|insights\/refresh-ftbi|spotlights\/sync-ftop|fy27\/(toi|evidence)\/refresh)$/,
      () => ok({ demo_note: "Refresh is a no-op in DEMO — all data is synthetic." })],
    [/^\/api\/customer\/([^/]+)\/(refresh|non-krs\/refresh|logo\/resolve)$/,
      () => ok({ demo_note: "Refresh is a no-op in DEMO." })],
    [/^\/api\/telemetry\/event$/, () => ok()],
    [/^\/api\/feedback\/submit$/, () => ok({ id: "DEMO-FBK-1042" })],
    [/^\/api\/ftop\/start-edge-cdp$/, () =>
      ok({ started: false, demo_note: "DEMO build has no Edge/CDP integration." })],
    [/^\/api\/backup$/, () => ok({ demo_note: "No database to back up in DEMO." })],
  ];

  // ------------------------------------------------------------------
  // Queue. Stateful because the cart is one of the first things a reviewer
  // clicks, and an inert cart reads as a broken feature.
  // ------------------------------------------------------------------
  const seedQueue = ROUTES["GET /api/scout/queue"] || {};
  const QUEUE = {
    pending: Array.isArray(seedQueue.pending) ? seedQueue.pending.slice() : [],
    nextId: 9000,
  };
  const queueBody = () => Object.assign({}, seedQueue, {
    ok: true,
    pending: QUEUE.pending,
    count: QUEUE.pending.length,
    needs_user_count: QUEUE.pending.filter(p => p && p.requires_user_confirm).length,
  });

  function dispatch(method, path, opts, search) {
    try {
      if (method === "GET") {
        if (/^\/api\/(scout|clawpilot)\/queue$/.test(path)) return json(queueBody());
        // Synthetic snapshot freshness. Deliberately NOT harvested: this
        // endpoint proxies an external system and was returning 502 at build
        // time, so harvesting it would have baked an outage into the demo.
        if (path === "/api/midas/snapshot-check" || path === "/api/ftbi/snapshot-check") {
          return json({
            ok: true, fresh: true, demo: true,
            snapshot_date: new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10),
            age_days: 6,
            note: "DEMO: synthetic snapshot state — no upstream system is queried.",
          });
        }
        const body = replay(path);
        if (body !== null) return json(applyMutations(path, body));
        UNHANDLED.push(`GET ${path}`);
        console.warn("[DEMO] Unhandled API call:", method, path);
        return json({ ok: true, demo_unhandled: true });
      }

      let m;
      if (path.match(/^\/api\/(?:scout|clawpilot)\/queue$/) && method === "POST") {
        const b = readBody(opts);
        const item = Object.assign(
          { id: QUEUE.nextId++, status: "pending", created_at: new Date().toISOString() }, b);
        QUEUE.pending.unshift(item);
        return json({ ok: true, id: item.id, item });
      }
      if (path.match(/^\/api\/(?:scout|clawpilot)\/queue\/clear$/)) {
        QUEUE.pending = [];
        return json({ ok: true, count: 0 });
      }
      if ((m = path.match(/^\/api\/(?:scout|clawpilot)\/queue\/(\d+)$/)) && method === "DELETE") {
        QUEUE.pending = QUEUE.pending.filter(p => p.id !== +m[1]);
        return json({ ok: true });
      }
      if ((m = path.match(/^\/api\/(?:scout|clawpilot)\/queue\/(\d+)\/(approve|start|complete|fail|retry|open-scout)$/))) {
        const id = +m[1], verb = m[2];
        const it = QUEUE.pending.find(p => p.id === id);
        if (it) {
          if (verb === "approve") it.approved = true;
          if (verb === "start") it.status = "running";
          if (verb === "complete") QUEUE.pending = QUEUE.pending.filter(p => p.id !== id);
        }
        return json({ ok: true, demo: true });
      }
      if (path.match(/^\/api\/(?:scout|clawpilot)\/queue\/retry-failed$/)) return json({ ok: true });

      for (const [rx, h] of WRITES) {
        const mm = path.match(rx);
        if (mm) return h(mm, readBody(opts), search);
      }

      // Any other write is accepted so the UI's optimistic paths complete, but
      // recorded so the coverage harness can see what is unmodelled.
      UNHANDLED.push(`${method} ${path}`);
      console.warn("[DEMO] Unhandled API call:", method, path);
      return json({ ok: true, demo_unhandled: true });
    } catch (e) {
      console.warn("[DEMO] handler error", method, path, e);
      return json({ ok: false, error: String(e) }, 500);
    }
  }

  // ---------- STAGE 3: activate and drain ----------
  realDispatch = dispatch;
  console.log(`[DEMO] Full shim ready. Draining ${queued.length} queued calls.`);
  for (const { input, opts, resolve, reject } of queued) {
    try {
      const bits = parse(input);
      const method = ((opts && opts.method) || "GET").toUpperCase();
      resolve(dispatch(method, bits.path, opts, bits.search));
    } catch (e) { reject(e); }
  }
  queued.length = 0;

  // ---------- DEMO badge ----------
  // Runs on a MutationObserver because the topbar re-renders, so this is the
  // LAST writer of document.title — whatever it sets is what the tab shows.
  // The "FTA Workspace - X" shape must match index.html's convention in both
  // files or the last writer silently wins and the environments disagree.
  //
  // THREE THINGS HERE ARE LOAD-BEARING. A naive version of this function
  // pegged the main thread so hard the page never became interactive:
  //
  //   1. WRITE ONLY ON CHANGE. Assigning textContent ALWAYS replaces the text
  //      node, even when the new string is identical — which is a childList
  //      mutation inside document.body, which re-enters this very observer.
  //      In the bundle the tag is still the placeholder "v… · —" when this
  //      first runs; that does not match the version regex, so replace() was
  //      a no-op, the "DEMO" guard never became satisfied, and every pass
  //      rewrote the same string and retriggered itself forever. (It looked
  //      fine on LAB only because LAB's tag was already populated by then.)
  //   2. DISCONNECT WHILE MUTATING. Belt and braces for the same hazard — our
  //      own writes must not be able to re-enter the callback at all.
  //   3. NO DEPENDENCE ON THE REGEX MATCHING. If the tag has not been filled
  //      in yet, leave it alone and catch it on a later mutation, rather than
  //      writing a string that cannot contain the marker we then look for.
  let observer = null;
  function setText(el, value) {
    if (el && el.textContent !== value) el.textContent = value;
  }
  function brand() {
    if (observer) observer.disconnect();
    try {
      const tag = document.querySelector(".version-tag");
      if (tag && !tag.textContent.includes("DEMO")) {
        const next = tag.textContent.replace(/(v[\d.]+)\s*·\s*\S+/, "$1 · DEMO");
        // Only touch it once the replace actually achieved something.
        if (next !== tag.textContent && next.includes("DEMO")) {
          setText(tag, next);
          tag.style.background = "#fff3cd";
          tag.style.color = "#7a4d00";
          tag.style.borderColor = "#e8b14a";
          tag.title = "DEMO BUILD — synthetic data, no backend. Safe to share.";
        }
      }
      if (document.title !== "FTA Workspace - DEMO") {
        document.title = "FTA Workspace - DEMO";
      }
    } finally {
      if (observer) observer.observe(document.body, { childList: true, subtree: true });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", brand);
  else brand();
  observer = new MutationObserver(brand);
  observer.observe(document.body, { childList: true, subtree: true });
})();
