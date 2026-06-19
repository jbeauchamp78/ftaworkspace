// FTA Workspace — DEMO mode fetch shim.
// Loaded BEFORE any other app JS when URL has ?demo=1.
// Intercepts every fetch() to /api/* and returns canned data from
// demo-data.json. Mutations update an in-memory store so the UI feels live.
//
// This file does NOT need a backend — could be served from file:// or
// a static host. The whole app runs purely in the browser.
(async function () {
  console.log("[DEMO] Initializing fetch shim...");

  // ---------- STAGE 1: Install holding shim IMMEDIATELY ----------
  // The page's app JS will start firing /api/* calls as soon as it parses.
  // We MUST patch window.fetch before any of those fire — otherwise they hit
  // the real backend and return real customer data. Calls received before
  // demo-data.json finishes loading are queued and drained later.
  const origFetch = window.fetch.bind(window);
  const queued = [];
  let realDispatch = null;

  window.fetch = function (input, opts) {
    const url = typeof input === "string" ? input : input?.url;
    if (!url) return origFetch(input, opts);
    let p = url; let search = "";
    try {
      const u = new URL(url, location.href);
      p = u.pathname;
      search = u.search || "";
    } catch {}
    if (!p.startsWith("/api/")) return origFetch(input, opts);
    if (realDispatch) {
      const method = ((opts && opts.method) || "GET").toUpperCase();
      return Promise.resolve(realDispatch(method, p, opts, search));
    }
    return new Promise((resolve, reject) => {
      queued.push({ input, opts, resolve, reject });
    });
  };
  console.log("[DEMO] Holding shim installed — queueing /api/* until data loads.");

  // ---------- STAGE 2: Load demo data ----------
  let DATA;
  try {
    const r = await origFetch("./demo-data.json?v=0.18-demo-r3");
    DATA = await r.json();
  } catch (e) {
    console.error("[DEMO] Failed to load demo-data.json", e);
    queued.forEach(({ reject }) => reject(new Error("demo data load failed")));
    return;
  }

  // ---------- Heatmap tile catalog (mirrors backend app/heatmap.py) ----------
  const HEATMAP_CATALOG = [
    { name: "Core Infrastructure", tiles: [
      { id:"corp_network",     name:"Corp Network Readiness" },
      { id:"identity_sync",    name:"Identity Sync / Entra Setup" },
      { id:"exchange",         name:"Exchange Online" },
      { id:"teams",            name:"Teams" },
      { id:"onedrive",         name:"OneDrive for Business" },
      { id:"sharepoint",       name:"SharePoint Online" },
    ]},
    { name: "Productivity / Protection", tiles: [
      { id:"m365_apps",        name:"M365 Apps for Enterprise", sku:"E3" },
      { id:"mde",              name:"MDE",                       sku:"E5", kr:"MDE Usage" },
      { id:"intune",           name:"Intune / Endpoint Mgmt",    sku:"E3" },
    ]},
    { name: "Endpoint Management", tiles: [
      { id:"intune_co_mgmt",   name:"Intune Co-Management" },
      { id:"vpn_split",        name:"VPN Split-Tunneling" },
      { id:"intune_autopilot", name:"Intune Autopilot",          sku:"E3" },
      { id:"autopatch",        name:"Windows Autopatch" },
    ]},
    { name: "Mobile / Virtual", tiles: [
      { id:"intune_app_prot",  name:"Intune - App Protection",   sku:"E3" },
      { id:"intune_mdm",       name:"Intune - MDM" },
      { id:"m365_mobile",      name:"M365 Apps on Mobile" },
      { id:"avd",              name:"Azure Virtual Desktop",     sku:"Add-On" },
      { id:"w365_paid",        name:"Windows 365",               sku:"Add-On", kr:"Win365 Paid" },
    ]},
    { name: "Identity Access / Protection", tiles: [
      { id:"mfa",              name:"Multi-Factor Auth",         sku:"E3" },
      { id:"ca",               name:"Conditional Access",        sku:"E3" },
      { id:"sspr",             name:"Self-Service Password Reset", sku:"E3" },
      { id:"pim",              name:"Privileged Identity Mgmt",  sku:"E5" },
      { id:"ca_risk",          name:"Risk-based CA",             sku:"E5" },
      { id:"identity_protect", name:"Identity Protection",       sku:"E5" },
      { id:"access_reviews",   name:"Access Reviews" },
      { id:"entitlement_mgmt", name:"Entitlement Management",    sku:"E5" },
      { id:"aadp_p1",          name:"Entra ID P1" },
      { id:"aadp_p2",          name:"Entra ID P2" },
      { id:"mdi",              name:"MDI",                       sku:"E5", kr:"MDI Usage" },
    ]},
    { name: "Information Protection / Governance", tiles: [
      { id:"mip_p1",           name:"MIP P1",                    sku:"E3" },
      { id:"mip_p2",           name:"MIP P2",                    sku:"E5", kr:"IP P2" },
      { id:"dlp_exo",          name:"DLP for EXO",               sku:"E3" },
      { id:"dlp_spo",          name:"DLP for SPO/OneDrive",      sku:"E3" },
      { id:"dlp_teams",        name:"DLP for Teams",             sku:"E5" },
      { id:"endpoint_dlp",     name:"Endpoint DLP",              sku:"E5" },
      { id:"irm",              name:"Insider Risk Mgmt",         sku:"E5", kr:"IRM" },
      { id:"data_lifecycle",   name:"Data Lifecycle Mgmt",       sku:"E5" },
      { id:"records_mgmt",     name:"Records Management",        sku:"E5" },
      { id:"ediscovery",       name:"eDiscovery (Premium)",      sku:"E5" },
      { id:"mdca",             name:"MDCA",                      sku:"E5", kr:"MDA Usage" },
      { id:"mdo",              name:"MDO",                       sku:"E5", kr:"MDO Usage" },
    ]},
    { name: "Copilot", tiles: [
      { id:"m365_copilot",     name:"M365 Copilot",              sku:"Add-On", kr:"M365 Copilot" },
      { id:"copilot_chat",     name:"Copilot Chat",                            kr:"Copilot Chat" },
      { id:"copilot_agents",   name:"Copilot Agents",            sku:"Add-On", kr:"Copilot Agents" },
      { id:"copilot_security", name:"Copilot for Security (EAP)", sku:"Add-On" },
    ]},
    { name: "Viva Employee Experience", tiles: [
      { id:"viva_pulse",       name:"Pulse" },
      { id:"viva_glint",       name:"Glint",                     sku:"Add-On" },
      { id:"viva_amplify",     name:"Amplify" },
      { id:"viva_connections", name:"Connections" },
      { id:"viva_conn_prem",   name:"Connections Premium",       sku:"Add-On" },
      { id:"viva_learning",    name:"Learning" },
      { id:"viva_learn_prem",  name:"Learning Premium",          sku:"Add-On" },
      { id:"viva_engage",      name:"Engage" },
      { id:"viva_engage_prem", name:"Engage Premium",            sku:"Add-On" },
      { id:"viva_insights",    name:"Insights" },
      { id:"viva_insights_p",  name:"Insights Premium",          sku:"Add-On" },
    ]},
    { name: "Windows + Other", tiles: [
      { id:"win11",            name:"Windows 11" },
      { id:"w365_poc",         name:"Windows 365 POC",                         kr:"Win365 POC" },
      { id:"teams_room",       name:"Teams Room" },
      { id:"teams_phone",      name:"Teams Phone",               sku:"E5",     kr:"Teams Phone" },
      { id:"surface",          name:"Surface" },
    ]},
  ];

  // Mutable in-memory copies.
  const STATE = {
    meta: structuredClone(DATA.meta),
    customers: structuredClone(DATA.customers),
    counters: structuredClone(DATA.counters),
    queue: structuredClone(DATA.queue),
    nextQueueId: 200,
    autoState: "on",
    nonKrByCust: {},   // populated lazily by GET /non-krs
  };

  // ---------- Copilot Ideal Config defaults (DEMO) ----------
  // Mirror Lynx's 10-setting Copilot Ideal Config. Each customer gets a
  // deterministic mix based on a hash of their nickname so the same demo
  // visitor sees the same posture per customer between page loads.
  const IC_CATALOG = [
    { setting_id: "WebSearch",             label: "Web Search",                 workload: "M365 Copilot",   spec: "Web grounding enabled for all users",       good: "100%",       bad: "Disabled" },
    { setting_id: "ChannelReadiness",      label: "Channel Readiness",          workload: "M365 Apps",      spec: ">=50% on Current or Monthly Enterprise",    good: "98%",        bad: "32%" },
    { setting_id: "CopilotFrontier",       label: "Frontier features",          workload: "M365 Copilot",   spec: "Frontier opt-in enabled",                   good: "Enabled",    bad: "Disabled" },
    { setting_id: "CopilotConnectors",     label: "Copilot Connectors",         workload: "Graph",          spec: "At least one connector enabled",            good: "5 connectors", bad: "Disabled" },
    { setting_id: "AnthropicSubProcessor", label: "Anthropic Sub-Processor",    workload: "M365 Copilot",   spec: "Sub-processor approval enabled",            good: "Enabled",    bad: "Not Approved" },
    { setting_id: "AnthropicWXP",          label: "Multimodal (WXP)",           workload: "M365 Apps",      spec: ">=95% multimodal coverage",                 good: "100%",       bad: "62%" },
    { setting_id: "ResearcherNotBlocked",  label: "Copilot App Unblocked",      workload: "Integrated Apps", spec: "Copilot app status = Unblocked",           good: "Unblocked",  bad: "Blocked" },
    { setting_id: "TaskbarPin",            label: "Windows Taskbar Pin",        workload: "Windows",        spec: "Copilot pinned to taskbar (all users)",     good: "Pinned",     bad: "Not Pinned" },
    { setting_id: "FeedbackAndLog",        label: "Feedback + Log Collection",  workload: "M365 Copilot",   spec: ">=95% feedback w/ log enabled",             good: "100%",       bad: "44%" },
    { setting_id: "AIAdminAssigned",       label: "AI Administrator Assigned",  workload: "Entra",          spec: "AI Administrator role assigned",            good: "Assigned",   bad: "Not Assigned" },
  ];
  function _hash(s) { let h = 0; for (let i = 0; i < (s||"").length; i++) h = ((h<<5) - h + s.charCodeAt(i)) | 0; return Math.abs(h); }
  function IC_DEFAULT(custNick) {
    const seed = _hash(custNick || "anon");
    return IC_CATALOG.map((s, i) => {
      // Deterministic per (customer, setting) status — most green, some yellow/red.
      const mix = (seed + i * 31) % 10;
      let status;
      if (mix < 6) status = "green";
      else if (mix < 8) status = "yellow";
      else status = "red";
      const value = status === "green" ? s.good
                   : status === "red"   ? s.bad
                   : "Partially Enabled";
      return {
        setting_id: s.setting_id, label: s.label, workload: s.workload,
        spec: s.spec, status, value, notes: null,
      };
    });
  }

  // ---------- Non-KR defaults (DEMO) ----------
  // Mirror app/non_krs.py NON_KR_WORKLOADS + STATUS_OPTIONS.
  const NONKR_WORKLOADS = [
    "Microsoft 365 Apps", "SharePoint", "OneDrive", "Exchange", "Intune",
    "Entra ID Free", "Teams", "Windows 10/11", "MDE", "IP", "MDO", "DLM",
    "Teams Rooms", "Teams Phone", "D&R", "IR", "Entra ID P2", "IP P1",
    "DLM P1", "Viva", "Viva Insights", "Viva Learning", "Viva Engage",
    "Viva Pulse", "DLM P2", "MDE P1", "Entra ID P1", "D&R P1", "D&R P2",
    "Viva Amplify", "Copilot for M365 Prerequisites",
    "Viva Learning Seeded", "Viva Learning Premium",
    "Viva Insights Seeded", "Viva Insights Premium", "Viva Engage Premium",
    "Viva Amplify Premium", "Security Copilot", "Intune Mobile",
    "Intune Desktop", "Microsoft Entra ID Governance", "Entra GSA",
    "Security Copilot Standalone", "Copilot in Defender", "Copilot in Entra",
    "Copilot in Intune", "Copilot in Purview", "Copilot Analytics", "CC",
  ];
  const NONKR_STATUS_OPTIONS = ["NOT STARTED", "IN PROGRESS", "ONBOARDED", "DEFERRED"];
  function NON_KR_DEFAULT() {
    // Deterministic mix per index — covers most statuses + some MAU/MoM.
    return NONKR_WORKLOADS.map((wl, i) => {
      const m = i % 7;
      let status;
      if (m === 0)      status = "ONBOARDED";
      else if (m === 1) status = "ONBOARDED";
      else if (m === 2) status = "IN PROGRESS";
      else if (m === 3) status = "IN PROGRESS";
      else if (m === 4) status = "DEFERRED";
      else              status = "NOT STARTED";
      const hasData = (i % 3) !== 2;
      const mau = hasData ? Math.round(120 + i * 47 + (i * 13) % 580) : null;
      const mom = hasData ? Math.round((((i * 7) % 40) - 15) * 10) / 10 : null;
      return {
        workload: wl, status, notes: "",
        current_mau: mau, mom_pct: mom,
        fetched_at: hasData ? new Date().toISOString() : null,
        updated_at: null,
      };
    });
  }

  function customerByNick(nick) {
    const n = decodeURIComponent(nick).toLowerCase();
    return STATE.customers.find(
      (c) => (c.nickname || "").toLowerCase() === n
        || (c.display_nickname || "").toLowerCase() === n
        || (c.full_name || "").toLowerCase() === n
    );
  }

  function jsonResp(body, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }
  function emptyOk() { return jsonResp({ ok: true }); }

  // ---------- Route handlers ----------
  // Map of (method, regex/path) -> handler returning JSON.
  const ROUTES = [
    // ----- Read endpoints -----
    ["GET", /^\/api\/health$/, () =>
      jsonResp({ ok: true, customer_count: STATE.customers.length, schema_version: 1 })],
    ["GET", /^\/api\/definitions$/, () => jsonResp({
      kr: {
        epoch: "FY26 H2", effective: "2026-01-01",
        scope: [
          { name: "M365 Copilot Usage", rule: ">=40% MAU vs PAU at 150+ seat baseline" },
          { name: "M365 Copilot Chat", rule: ">=40% MAU vs PAU" },
          { name: "Copilot Agents", rule: ">=150 Agent MAU per tenant (absolute)" },
          { name: "MDE P2 Coverage", rule: ">=80% device coverage" },
          { name: "MDO P2 Coverage", rule: ">=80% mailbox coverage" },
          { name: "MDI Coverage", rule: ">=80% identity coverage" },
          { name: "MDA Coverage", rule: ">=80% app coverage" },
          { name: "Purview IP P2 Usage", rule: ">=40% labeled-content ratio" },
          { name: "Purview IRM Usage", rule: ">=40% IRM MAU vs PAU" },
          { name: "Win365 POC", rule: "Jul baseline + >=25 seat growth" },
          { name: "Win365 Paid", rule: ">=20% Cloud PC MAU vs PAU" },
          { name: "Admin Days", rule: ">=10 admin active days FY-to-date" },
        ],
        notes: [
          "Universal 150-PAU floor (except Copilot KRs).",
          "Active Units = capped (NOT uncapped).",
          "DEMO MODE — rules shown are illustrative.",
        ],
      },
      ideal_config: {
        epoch: "FY26 H2", effective: "2026-01-01",
        scope: [
          { name: "Tenant Search Setting", desc: "Restricted SharePoint Search ON" },
          { name: "Enterprise Data Protection", desc: "EDP enabled for Copilot" },
          { name: "Self-Service Purchase", desc: "Disabled tenant-wide" },
          { name: "Loop Workspaces", desc: "Governed via Syntex" },
          { name: "Copilot Web Search", desc: "Allowed (or per-region policy)" },
          { name: "Sharing Controls", desc: "Limited external sharing" },
          { name: "Sensitivity Labels", desc: "Published + auto-apply for Confidential" },
          { name: "DLP for Copilot", desc: "Active policy excluding labeled docs" },
          { name: "Audit Logging", desc: "Unified audit + Purview Audit (Premium)" },
          { name: "IGI", desc: "Enabled for Frontier readiness" },
        ],
      },
      changelog: [
        { epoch: "FY26 H2", kind: "kr", date: "2026-01-01",
          summary: "Win365 POC threshold 20->25 seats. Admin Days threshold 5->10. (DEMO)" },
        { epoch: "FY26 H2", kind: "config", date: "2026-01-01",
          summary: "Added IGI for Frontier eligibility. (DEMO)" },
      ],
    })],
    ["GET", /^\/api\/tracker$/, () =>
      jsonResp({ meta: STATE.meta, customers: STATE.customers })],
    ["GET", /^\/api\/counters$/, () => jsonResp(STATE.counters)],
    ["GET", /^\/api\/clawpilot\/queue$/, () => jsonResp(STATE.queue)],
    ["GET", /^\/api\/automation\/status$/, () =>
      jsonResp({ state: STATE.autoState, enabled: STATE.autoState === "on" })],
    ["GET", /^\/api\/midas\/snapshot-check$/, () =>
      jsonResp({ ok: true, latest: STATE.meta.snapshot_iso, changed: false })],
    ["GET", /^\/api\/telemetry\/summary$/, () =>
      jsonResp({ distinct_users: 1, opens: 1, refreshes: 0, since: "demo" })],
    ["GET", /^\/api\/skills\/installed$/, () => jsonResp({
      installed: ["spotlight","heatmap-ftbi-sync","bridge-run","dq-refresh",
                  "manage-pecs","manage-assignments","manage-contacts",
                  "ftaworkspace","ideal-config","tenant-profile","ftbi-lookup",
                  "esn-refresh","l1-status-unknown","fta-workspace"],
      root: "(demo)", exists: true,
    })],

    // ----- Non-KR workload tracking -----
    ["GET", /^\/api\/customer\/([^/?]+)\/non-krs$/, (m) => {
      const cust = decodeURIComponent(m[1]);
      STATE.nonKrByCust = STATE.nonKrByCust || {};
      if (!STATE.nonKrByCust[cust]) STATE.nonKrByCust[cust] = NON_KR_DEFAULT();
      return jsonResp({ workloads: STATE.nonKrByCust[cust], options: NONKR_STATUS_OPTIONS });
    }],
    ["PATCH", /^\/api\/customer\/([^/?]+)\/non-krs\/([^/?]+)$/, (m, opts) => {
      const cust = decodeURIComponent(m[1]);
      const wl = decodeURIComponent(m[2]);
      let body = {};
      try { body = JSON.parse(opts?.body || "{}"); } catch {}
      STATE.nonKrByCust = STATE.nonKrByCust || {};
      STATE.nonKrByCust[cust] = STATE.nonKrByCust[cust] || NON_KR_DEFAULT();
      const row = STATE.nonKrByCust[cust].find(r => r.workload === wl);
      if (row) {
        if (body.status !== undefined) row.status = body.status;
        if (body.notes !== undefined) row.notes = body.notes;
        row.updated_at = new Date().toISOString();
      }
      return jsonResp({ ok: true, row });
    }],
    ["POST", /^\/api\/customer\/([^/?]+)\/non-krs\/refresh$/, (m) => {
      const cust = decodeURIComponent(m[1]);
      STATE.nonKrByCust = STATE.nonKrByCust || {};
      // Re-seed the customer's rows with current fetched_at + slight MAU jitter
      // to simulate a fresh MIDAS pull.
      const fresh = NON_KR_DEFAULT();
      const now = new Date().toISOString();
      const existing = STATE.nonKrByCust[cust] || [];
      const byLabel = Object.fromEntries(existing.map(r => [r.workload, r]));
      fresh.forEach((r) => {
        const prev = byLabel[r.workload];
        if (prev) { r.status = prev.status; r.notes = prev.notes; }
        if (r.current_mau != null) {
          r.current_mau = Math.max(0, Math.round(r.current_mau * (0.96 + Math.random() * 0.1)));
          r.fetched_at = now;
        }
      });
      STATE.nonKrByCust[cust] = fresh;
      return jsonResp({ ok: true, workloads_updated: fresh.filter(r=>r.current_mau!=null).length,
                        workloads_with_data: fresh.filter(r=>r.current_mau!=null).length,
                        latest_iso: now.slice(0,10), error: null });
    }],

    // ----- Spotlight draft form (v0.35) -----
    ["GET", /^\/api\/customer\/([^/?]+)\/spotlight-draft$/, (m, opts, search) => {
      const cust = decodeURIComponent(m[1]);
      const params = new URLSearchParams(search || "");
      const krLabel = params.get("kr_label") || "";
      const lowlight = params.get("lowlight") === "true";
      const kind = lowlight ? "lowlight" : "highlight";
      const winType = lowlight ? "REGRESSION" : "KPI WIN";
      const title = `${cust} — ${krLabel || "Workload"} ${winType}`;
      const c = customerByNick(cust);
      const full = c ? (c.full_name || cust) : cust;
      return jsonResp({
        customer_nickname: cust, customer_full_name: full, tpid: c ? c.tpid : null,
        kr_label: krLabel, kind, stage: "draft",
        workload_code: null,
        title: title.slice(0, 80),
        background: `${full} is a FastTrack-engaged customer working on ${krLabel || "Microsoft 365 adoption"} as part of the FY26 deployment plan. (Demo pre-fill — real backend mines MIDAS + FTOP ESN history.)`,
        problem: lowlight
          ? `Adoption regressed against the prior period — the cause is being investigated and a recovery plan is in motion.`
          : `Initial adoption plateaued below the FY26 H2 threshold, creating a need for structured FastTrack engagement to drive measurable usage growth.`,
        solution: `FastTrack delivered targeted workshops, established a recurring cadence with the customer's CSAM/AE, and unblocked the technical and change-management gaps identified in the engagement plan.`,
        fasttrack: `FastTrack Architect led the engagement plan, coordinated specialist hand-offs, and authored the per-cycle ESNs that tracked progress against the KR.`,
        teamwork: `Worked alongside the ${full} CSAM, account team, and FastTrack Specialist Team to align on technical scope, change-management plan, and renewal narrative.`,
        quote: "", quote_attribution: "", reference_link: "",
        secondary_workload_code: null, is_fta: true, is_partner: false, version: 1,
      });
    }],
    ["POST", /^\/api\/customer\/([^/?]+)\/spotlight-draft\/queue$/, (m, opts) => {
      let body = {}; try { body = JSON.parse(opts?.body || "{}"); } catch {}
      if (!body.title) return jsonResp({ ok: false, error: "title is required" });
      // Push into STATE.queue so the cart panel shows it
      STATE.queue.pending = STATE.queue.pending || [];
      const id = STATE.nextQueueId++;
      const cust = decodeURIComponent(m[1]);
      STATE.queue.pending.push({
        id, kind: "spotlight-auto",
        label: `${body.kind === "lowlight" ? "(Lowlight) " : ""}Spotlight - ${cust}${body.kr_label ? " - " + body.kr_label : ""}`,
        prompt: `/spotlight --payload "[demo-staged]/${cust}-${id}.json"`,
        cust, status: "pending", requires_user_confirm: 1,
        trigger: "ui_spotlight_draft", created_at: new Date().toISOString(),
      });
      STATE.queue.count = (STATE.queue.count || 0) + 1;
      return jsonResp({
        ok: true, id, staged_path: `[demo-staged]/${cust}-${id}.json`,
        prompt: `/spotlight --payload "[demo-staged]/${cust}-${id}.json"`,
        requires_user_confirm: 1, auto_submit_enabled: false,
      });
    }],

    // ----- Single-customer refresh (demo: instant success) -----
    ["POST", /^\/api\/customer\/([^/?]+)\/refresh$/, (m) => {
      const cust = decodeURIComponent(m[1]);
      return jsonResp({
        ok: true, scoped_to: cust, scoped: false,
        result: { ok: true, customers_evaluated: 1, krs_updated: 12,
                  snapshot_iso: STATE.meta.snapshot_iso, duration_seconds: 0.2 },
      });
    }],

    // ----- Copilot Ideal Config (per-customer, 10 admin settings) -----
    ["GET", /^\/api\/customer\/([^/?]+)\/ideal-config$/, (m) => {
      const cust = decodeURIComponent(m[1]);
      STATE.icByCust = STATE.icByCust || {};
      if (!STATE.icByCust[cust]) STATE.icByCust[cust] = IC_DEFAULT(cust);
      const settings = STATE.icByCust[cust];
      const green = settings.filter(s => s.status === "green").length;
      const yellow = settings.filter(s => s.status === "yellow").length;
      const red = settings.filter(s => s.status === "red").length;
      const overall = red >= 3 ? "red" : (yellow + red >= 3 ? "yellow" : "green");
      return jsonResp({
        nickname: cust,
        overall_health: overall,
        green_count: green, total_count: settings.length,
        settings,
        data_source: "lynx (demo)",
        snapshot_date: (STATE.meta.snapshot_iso || "").slice(0, 10),
      });
    }],
    ["GET", /^\/api\/ideal-config\/rollup$/, () => {
      // Portfolio rollup used by counter tile + recs pipeline
      let wins = 0;
      STATE.customers.forEach((c) => {
        const k = c.nickname || c.display_nickname;
        STATE.icByCust = STATE.icByCust || {};
        if (!STATE.icByCust[k]) STATE.icByCust[k] = IC_DEFAULT(k);
        const reds = STATE.icByCust[k].filter(s => s.status === "red").length;
        const yels = STATE.icByCust[k].filter(s => s.status === "yellow").length;
        if (reds === 0 && yels < 3) wins += 1;
      });
      return jsonResp({ wins, total: STATE.customers.length });
    }],
    ["PATCH", /^\/api\/customer\/([^/?]+)\/ideal-config\/notes$/, (m, opts) => {
      let body = {}; try { body = JSON.parse(opts?.body || "{}"); } catch {}
      const cust = decodeURIComponent(m[1]);
      STATE.icByCust = STATE.icByCust || {};
      const arr = STATE.icByCust[cust] || [];
      const row = arr.find(r => r.setting_id === body.setting_id);
      if (row) row.notes = body.notes || "";
      return jsonResp({ ok: true });
    }],

    // ----- Customer detail + recommendations -----
    ["GET", /^\/api\/customer\/([^/?]+)$/, (m) => {
      const c = customerByNick(m[1]);
      return c ? jsonResp(c) : jsonResp({ error: "not found" }, 404);
    }],
    ["GET", /^\/api\/recommendations\/([^/?]+)$/, (m) => {
      const c = customerByNick(m[1]);
      if (!c) return jsonResp({ error: "not found" }, 404);
      const recs = [];
      const wins = c.kr_status.filter((k) => k.status === "KPI WIN").length;
      const total = c.kr_status.length;
      recs.push({ priority: "low", kr_label: null,
        title: `Portfolio posture: ${wins}/${total} KRs at win`,
        desc: "Generated in DEMO mode from synthetic data.",
        impact: null, suggested_action: null });
      const reg = c.kr_status.find((k) => k.status === "REGRESSION");
      if (reg) recs.push({
        priority: "high", kr_label: reg.kr_label,
        title: `Regression detected on ${reg.kr_label}`,
        desc: `Current value behind baseline. Open a re-engagement PEC.`,
        impact: "At-risk OKR position",
        suggested_action: "Open a re-engagement PEC and review with the customer." });
      const noPec = c.kr_status.find((k) => k.status === "IN PROGRESS" && k.pec_flag !== "Yes" && k.pec_flag !== "N/A");
      if (noPec) recs.push({
        priority: "med", kr_label: noPec.kr_label,
        title: `${noPec.kr_label}: active motion but no PEC`,
        desc: "Status is IN PROGRESS but PEC column is empty.",
        impact: "Visibility gap; missing PEC could miss FY credit",
        suggested_action: "Use /manage-pecs to create a PEC." });
      const disengage = c.kr_status.find((k) => (k.status === "KPI WIN" || k.status === "KPI MET") && k.pec_flag === "Yes");
      if (disengage) recs.push({
        priority: "low", kr_label: null,
        title: "Disengage candidate",
        desc: `PEC still active despite ${disengage.status}: ${disengage.kr_label}.`,
        impact: "Reduce overhead; free capacity for at-risk workloads",
        suggested_action: "Move this PEC to Disengage in FTOP." });
      return jsonResp({ nickname: c.nickname, recommendations: recs });
    }],

    // ----- PECs popover -----
    ["GET", /^\/api\/customer\/([^/?]+)\/pecs$/, (m) => {
      const c = customerByNick(m[1]);
      if (!c) return jsonResp({ error: "not found" }, 404);
      return jsonResp({
        nickname: c.nickname,
        summary: {
          active: c.pec_active_count || 0,
          closed: c.pec_closed_count || 0,
          total:  c.pec_total_count  || 0,
        },
        pecs: c.pecs || [],
        detail_source: (c.pecs && c.pecs.length) ? "demo" : "empty",
      });
    }],

    // ----- Heatmap GET -----
    ["GET", /^\/api\/customer\/([^/?]+)\/heatmap$/, (m) => {
      const c = customerByNick(m[1]);
      if (!c) return jsonResp({ error: "not found" }, 404);
      // Map KR status -> heatmap state, same logic as backend.
      const KR_TO_HM = {
        "KPI WIN": "ONBOARDED", "KPI MET": "ONBOARDED",
        "IN PROGRESS": "IN_PROGRESS", "INTENT": "INTENT",
        "NO INTENT": "NO_INTENT",
        "REGRESSION": "IN_PROGRESS", "N/A": "NOT_LICENSED",
      };
      const krByLabel = {};
      (c.kr_status || []).forEach((k) => { krByLabel[k.kr_label] = k; });
      const overrides = c._heatmap_overrides || {};
      const cats = HEATMAP_CATALOG.map((cat) => ({
        name: cat.name,
        tiles: cat.tiles.map((t) => {
          const ov = overrides[t.id];
          const kr = t.kr ? krByLabel[t.kr] : null;
          let state, source, note = "", lead = "";
          if (ov && ov.state) {
            state = ov.state; source = ov.source || "override";
            note = ov.note || ""; lead = ov.lead || "";
          } else if (kr) {
            state = KR_TO_HM[kr.status] || "STATUS_UNKNOWN";
            source = "kr"; lead = (ov && ov.lead) || "";
          } else {
            state = "STATUS_UNKNOWN"; source = "default";
            note = (ov && ov.note) || ""; lead = (ov && ov.lead) || "";
          }
          return {
            id: t.id, name: t.name, sku: t.sku || "",
            kr: t.kr || null, state, source, note, lead,
            kr_status: kr ? kr.status : null,
          };
        }),
      }));
      return jsonResp({
        schema: 1, categories: cats,
        customer: { nickname: c.nickname,
                    display_nickname: c.display_nickname,
                    full_name: c.full_name },
      });
    }],

    // ----- Heatmap PATCH (single tile override) -----
    ["PATCH", /^\/api\/customer\/([^/]+)\/heatmap\/([^/]+)$/, async (m, opts) => {
      const c = customerByNick(m[1]);
      if (!c) return jsonResp({ error: "not found" }, 404);
      const tileId = m[2];
      const b = JSON.parse(opts?.body || "{}");
      c._heatmap_overrides = c._heatmap_overrides || {};
      if (!b.state) {
        delete c._heatmap_overrides[tileId];
      } else {
        c._heatmap_overrides[tileId] = {
          state: b.state, note: b.note || "", lead: b.lead || "",
          source: b.source || "override",
        };
      }
      return emptyOk();
    }],

    // ----- Heatmap BULK + FTBI sync (simulated) -----
    ["POST", /^\/api\/customer\/([^/]+)\/heatmap\/bulk$/, async (m, opts) => {
      const c = customerByNick(m[1]);
      if (!c) return jsonResp({ error: "not found" }, 404);
      const b = JSON.parse(opts?.body || "{}");
      c._heatmap_overrides = c._heatmap_overrides || {};
      const envSrc = b.source || "ftbi";
      let written = 0, skippedManual = 0;
      (b.tiles || []).forEach((t) => {
        if (!t.tile_id || !t.state) return;
        const cur = c._heatmap_overrides[t.tile_id];
        // Don't overwrite manual overrides
        if (cur && cur.source === "override" && (t.source || envSrc) !== "override") {
          skippedManual++; return;
        }
        c._heatmap_overrides[t.tile_id] = {
          state: t.state, note: t.note || "",
          lead: t.lead || "", source: t.source || envSrc,
        };
        written++;
      });
      return jsonResp({ ok: true, written, skipped_manual: skippedManual, source: envSrc });
    }],
    ["POST", /^\/api\/customer\/([^/]+)\/heatmap\/ftbi-sync$/, async (m) => {
      const c = customerByNick(m[1]);
      if (!c) return jsonResp({ error: "not found" }, 404);
      // Simulate scrape: pick ~30 currently-unknown tiles and assign plausible
      // states based on the customer's archetype.
      await new Promise((r) => setTimeout(r, 1100));
      const ARCH = c._archetype || "MID_FUNNEL";
      const POOL_BY_ARCH = {
        STAR:              ["ONBOARDED","ONBOARDED","ONBOARDED","IN_PROGRESS","INTENT"],
        AT_RISK:           ["IN_PROGRESS","INTENT","NO_INTENT","NOT_LICENSED","ONBOARDED"],
        NET_NEW:           ["INTENT","INTENT","NO_INTENT","NOT_LICENSED","NOT_LICENSED"],
        COPILOT_FORWARD:   ["ONBOARDED","ONBOARDED","IN_PROGRESS","INTENT","NOT_LICENSED"],
        SECURITY_FIRST:    ["ONBOARDED","ONBOARDED","IN_PROGRESS","INTENT","NOT_LICENSED"],
        COMPETE_PRESSURED: ["IN_PROGRESS","INTENT","NO_INTENT","ONBOARDED","NOT_LICENSED"],
        PLATEAU:           ["ONBOARDED","ONBOARDED","IN_PROGRESS","INTENT","NOT_LICENSED"],
        WHALE:             ["ONBOARDED","IN_PROGRESS","INTENT","NOT_LICENSED","ONBOARDED"],
        REGULATED:         ["ONBOARDED","NOT_LICENSED","NO_INTENT","IN_PROGRESS","INTENT"],
        MID_FUNNEL:        ["IN_PROGRESS","INTENT","ONBOARDED","NOT_LICENSED","NO_INTENT"],
      };
      const pool = POOL_BY_ARCH[ARCH] || POOL_BY_ARCH.MID_FUNNEL;
      const allTiles = [];
      HEATMAP_CATALOG.forEach((cat) => cat.tiles.forEach((t) => allTiles.push(t)));
      c._heatmap_overrides = c._heatmap_overrides || {};
      let written = 0;
      // Shuffle + take 30
      const shuffled = allTiles.slice().sort(() => Math.random() - 0.5).slice(0, 35);
      shuffled.forEach((t) => {
        const cur = c._heatmap_overrides[t.id];
        if (cur && cur.source === "override") return;  // preserve manual
        c._heatmap_overrides[t.id] = {
          state: pool[Math.floor(Math.random() * pool.length)],
          note: "Auto from FTBI tenant-profile (DEMO)",
          lead: "", source: "ftbi",
        };
        written++;
      });
      return jsonResp({ ok: true, demo: true, written });
    }],

    // ----- Spotlights: GET per-customer state -----
    ["GET", /^\/api\/customer\/([^/?]+)\/spotlights$/, (m) => {
      const c = customerByNick(m[1]);
      if (!c) return jsonResp({ error: "not found" }, 404);
      const spotlights = c.spotlights || [];
      // Per-KR cell state — same logic as backend spotlights.py
      const byKr = {};
      const counts = { recommended: 0, recommended_lowlight: 0, in_flight: 0, exists: 0 };
      (c.kr_status || []).forEach((row) => {
        const krLabel = row.kr_label;
        const forKr = spotlights.filter((s) => (s.kr_label || "") === krLabel);
        const pub = forKr.find((s) => (s.stage || "").toLowerCase() === "publish");
        const draft = forKr.find((s) => ["draft","review"].includes((s.stage || "").toLowerCase()));
        // Check cart for in-flight /spotlight items
        const queued = (STATE.queue.pending || []).find((q) =>
          q.kind === "spotlight" && q.cust === c.nickname &&
          ((q.prompt || "").includes(krLabel) || !((q.prompt || "").includes("KR=")))
        );
        let st;
        if (pub) {
          st = { state: "EXISTS", kind: pub.kind || "highlight",
                 spotlight_id: pub.spotlight_id, title: pub.title, url: pub.url };
          counts.exists++;
        } else if (draft) {
          st = { state: "IN_FLIGHT", kind: draft.kind || "highlight",
                 spotlight_id: draft.spotlight_id, title: draft.title,
                 url: draft.url, reason: "draft" };
          counts.in_flight++;
        } else if (queued) {
          st = { state: "IN_FLIGHT", kind: "highlight",
                 queue_id: queued.id, reason: "queued" };
          counts.in_flight++;
        } else if (row.status === "KPI WIN") {
          st = { state: "RECOMMENDED", kind: "highlight" };
          counts.recommended++;
        } else if (row.status === "REGRESSION") {
          st = { state: "RECOMMENDED_LOWLIGHT", kind: "lowlight" };
          counts.recommended_lowlight++;
        } else {
          st = { state: "NONE" };
        }
        byKr[krLabel] = st;
      });
      return jsonResp({
        nickname: c.nickname, spotlights, by_kr: byKr, counts,
        total_spotlights: spotlights.length,
        published_count: spotlights.filter((s) => (s.stage || "").toLowerCase() === "publish").length,
        detail_source: spotlights.length ? "demo" : "empty",
      });
    }],
    // ----- Spotlights: queue (simulated) -----
    ["POST", /^\/api\/customer\/([^/]+)\/spotlights\/queue$/, async (m, opts) => {
      const c = customerByNick(m[1]);
      if (!c) return jsonResp({ error: "not found" }, 404);
      const b = JSON.parse(opts?.body || "{}");
      const krLabel = (b.kr_label || "").trim();
      const isLow = !!b.lowlight;
      const isScan = !!b.scan;
      const flags = []; if (isLow) flags.push("--lowlight"); if (isScan) flags.push("--scan");
      let prompt = `/spotlight ${c.nickname}`;
      if (flags.length) prompt += " " + flags.join(" ");
      if (krLabel) prompt += `  # context: KR=${krLabel}`;
      let label = `Spotlight - ${c.nickname}`;
      if (krLabel) label += ` - ${krLabel}`;
      if (isLow) label = "(Lowlight) " + label;
      const item = {
        id: STATE.nextQueueId++,
        kind: "spotlight", label, prompt,
        cust: c.nickname, status: "pending",
        created_at: new Date().toISOString().replace("T", " ").slice(0, 19),
        sent_at: null, requires_user_confirm: 1,
      };
      STATE.queue.pending.push(item);
      STATE.queue.count = STATE.queue.pending.length;
      STATE.queue.needs_user_count = STATE.queue.pending.filter((p) => p.requires_user_confirm).length;
      return jsonResp({ ok: true, queued: true, queue_id: item.id, prompt, needs_user_confirm: true });
    }],
    // ----- Spotlights: portfolio summary -----
    ["GET", /^\/api\/spotlights\/summary$/, () => {
      let pub = 0, draft = 0, cust = 0, queued = 0, recommended = 0;
      const custsWithPub = new Set();
      STATE.customers.forEach((c) => {
        (c.spotlights || []).forEach((s) => {
          const st = (s.stage || "").toLowerCase();
          if (st === "publish") { pub++; custsWithPub.add(c.nickname); }
          if (st === "draft" || st === "review") draft++;
        });
        const publishedKrs = new Set((c.spotlights || [])
          .filter((s) => (s.stage || "").toLowerCase() === "publish")
          .map((s) => s.kr_label));
        (c.kr_status || []).forEach((k) => {
          if (k.status === "KPI WIN" && !publishedKrs.has(k.kr_label)) recommended++;
        });
      });
      queued = (STATE.queue.pending || []).filter((q) => q.kind === "spotlight").length;
      return jsonResp({
        published: pub, customers_with_spotlight: custsWithPub.size,
        in_flight: draft + queued, in_flight_drafts: draft, in_flight_queued: queued,
        recommended,
      });
    }],
    // ----- Spotlights: bulk index upsert (simulated) -----
    ["POST", /^\/api\/spotlights\/bulk$/, async (m, opts) => {
      const b = JSON.parse(opts?.body || "{}");
      const rows = b.rows || [];
      // For DEMO, just merge into customer's spotlights[] in memory
      let written = 0;
      rows.forEach((r) => {
        const c = customerByNick(r.cust_nickname || "");
        if (!c) return;
        c.spotlights = c.spotlights || [];
        const idx = c.spotlights.findIndex((s) => s.spotlight_id === r.spotlight_id);
        if (idx >= 0) c.spotlights[idx] = { ...c.spotlights[idx], ...r };
        else c.spotlights.push({ ...r });
        written++;
      });
      return jsonResp({ ok: true, written });
    }],

    // ----- PATCH endpoints (customer edits) -----
    ["PATCH", /^\/api\/customer\/([^/]+)\/notes$/, async (m, opts) => {
      const c = customerByNick(m[1]); if (!c) return jsonResp({ error: "not found" }, 404);
      const b = JSON.parse(opts?.body || "{}");
      c.fta_notes = b.fta_notes || ""; return emptyOk();
    }],
    ["PATCH", /^\/api\/customer\/([^/]+)\/display$/, async (m, opts) => {
      const c = customerByNick(m[1]); if (!c) return jsonResp({ error: "not found" }, 404);
      const b = JSON.parse(opts?.body || "{}");
      c.display_nickname = b.display_nickname || c.nickname; return jsonResp(c);
    }],
    ["PATCH", /^\/api\/customer\/([^/]+)\/tpid$/, async (m, opts) => {
      const c = customerByNick(m[1]); if (!c) return jsonResp({ error: "not found" }, 404);
      const b = JSON.parse(opts?.body || "{}");
      c.tpid = b.tpid || null; return jsonResp(c);
    }],

    // ----- KR row writes (notes, status override) -----
    ["PATCH", /^\/api\/customer\/([^/]+)\/kr\/([^/]+)$/, async (m, opts) => {
      const c = customerByNick(m[1]); if (!c) return jsonResp({ error: "not found" }, 404);
      const krLabel = decodeURIComponent(m[2]);
      const row = c.kr_status.find((k) => k.kr_label === krLabel);
      if (!row) return jsonResp({ error: "kr not found" }, 404);
      const b = JSON.parse(opts?.body || "{}");
      if ("kr_notes" in b) row.kr_notes = b.kr_notes;
      if ("status" in b) row.status = b.status;
      if ("pec_flag" in b) row.pec_flag = b.pec_flag;
      return emptyOk();
    }],

    // ----- IC notes -----
    ["PATCH", /^\/api\/customer\/([^/]+)\/ic\/(\d+)$/, async (m, opts) => {
      const c = customerByNick(m[1]); if (!c) return jsonResp({ error: "not found" }, 404);
      const sid = parseInt(m[2], 10);
      const s = (c.ic_settings || []).find((x) => x.setting_id === sid);
      if (!s) return jsonResp({ error: "setting not found" }, 404);
      const b = JSON.parse(opts?.body || "{}");
      if ("fta_note" in b) s.fta_note = b.fta_note;
      if ("color" in b) s.color = b.color;
      return emptyOk();
    }],

    // ----- Refresh endpoints (simulate) -----
    ["POST", /^\/api\/refresh$/, async () => {
      await new Promise((r) => setTimeout(r, 1200));
      STATE.meta.last_refresh_iso = new Date().toISOString();
      return jsonResp({
        ok: true, customers_evaluated: STATE.customers.length,
        krs_updated: 7, krs_skipped_manual: 0, pec_flags_set: 3,
        latest_midas_date: "2026-06-30",
        sources: { midas: { ok: true }, ftop: { ok: true }, lynx: { ok: true } },
        auto_queued: [], duration_seconds: 1.2,
      });
    }],
    ["POST", /^\/api\/counters\/refresh-roster$/, async () => {
      await new Promise((r) => setTimeout(r, 600));
      return jsonResp({ customers: STATE.customers.length, added: 0, removed: 0 });
    }],
    ["POST", /^\/api\/counters\/refresh-kr$/, async () => {
      await new Promise((r) => setTimeout(r, 800));
      return jsonResp({ customers_evaluated: STATE.customers.length, latest_midas_date: "2026-06-30" });
    }],
    ["POST", /^\/api\/counters\/refresh-dq$/, async () => {
      await new Promise((r) => setTimeout(r, 500));
      return jsonResp(STATE.counters.data_quality);
    }],

    // ----- Clawpilot bridge (simulated) -----
    ["POST", /^\/api\/clawpilot\/queue$/, async (_m, opts) => {
      const b = JSON.parse(opts?.body || "{}");
      const item = {
        id: STATE.nextQueueId++,
        kind: b.kind || "manual",
        label: b.label || "Manual task",
        prompt: b.prompt || "",
        cust: b.cust || null,
        status: "pending",
        created_at: new Date().toISOString().replace("T", " ").slice(0, 19),
        sent_at: null,
        requires_user_confirm: b.requires_user_confirm == null ? 1 : (b.requires_user_confirm ? 1 : 0),
      };
      STATE.queue.pending.push(item);
      STATE.queue.count = STATE.queue.pending.length;
      STATE.queue.needs_user_count = STATE.queue.pending.filter((p) => p.requires_user_confirm).length;
      return jsonResp(item);
    }],
    ["PATCH", /^\/api\/clawpilot\/queue\/(\d+)\/approve$/, async (m) => {
      const id = parseInt(m[1], 10);
      const it = STATE.queue.pending.find((p) => p.id === id);
      if (!it) return jsonResp({ error: "not found" }, 404);
      it.requires_user_confirm = 0;
      STATE.queue.needs_user_count = STATE.queue.pending.filter((p) => p.requires_user_confirm).length;
      // Simulate heartbeat completing it 3 seconds later.
      setTimeout(() => {
        const idx = STATE.queue.pending.findIndex((p) => p.id === id);
        if (idx >= 0) {
          const done = STATE.queue.pending.splice(idx, 1)[0];
          done.status = "succeeded";
          done.completed_at = new Date().toISOString().replace("T", " ").slice(0, 19);
          done.summary = "[DEMO] simulated success";
          STATE.queue.completed.unshift(done);
          STATE.queue.count = STATE.queue.pending.length;
        }
      }, 3000);
      return jsonResp(it);
    }],
    ["DELETE", /^\/api\/clawpilot\/queue\/(\d+)$/, async (m) => {
      const id = parseInt(m[1], 10);
      const idx = STATE.queue.pending.findIndex((p) => p.id === id);
      if (idx >= 0) STATE.queue.pending.splice(idx, 1);
      STATE.queue.count = STATE.queue.pending.length;
      STATE.queue.needs_user_count = STATE.queue.pending.filter((p) => p.requires_user_confirm).length;
      return emptyOk();
    }],
    ["POST", /^\/api\/clawpilot\/queue\/(\d+)\/(start|complete|fail)$/, () => emptyOk()],

    // ----- Telemetry POST is a no-op -----
    ["POST", /^\/api\/telemetry\/event$/, () => emptyOk()],
  ];

  // Fallback: anything else returns 200 with {ok:true, demo:"unhandled"}
  function dispatch(method, path, opts, search) {
    for (const [m, re, h] of ROUTES) {
      if (m !== method) continue;
      const match = path.match(re);
      if (match) {
        try { return h(match, opts, search || ""); }
        catch (e) {
          console.warn("[DEMO] handler error", method, path, e);
          return jsonResp({ error: String(e) }, 500);
        }
      }
    }
    console.warn("[DEMO] Unhandled API call:", method, path, "-> returning {}");
    return jsonResp({ ok: true, demo_unhandled: true });
  }

  // ---------- STAGE 3: Activate full dispatch + drain queued calls ----------
  realDispatch = dispatch;
  console.log("[DEMO] Full shim ready. Draining " + queued.length + " queued calls. " + STATE.customers.length + " demo customers loaded.");
  for (const { opts, resolve, reject, input } of queued) {
    try {
      const url = typeof input === "string" ? input : input?.url;
      const u = new URL(url, location.href);
      const method = ((opts && opts.method) || "GET").toUpperCase();
      resolve(dispatch(method, u.pathname, opts, u.search || ""));
    } catch (e) { reject(e); }
  }
  queued.length = 0;

  // ---------- DEMO badge on version pill ----------
  function brand() {
    const tag = document.querySelector(".version-tag");
    if (tag && !tag.textContent.includes("DEMO")) {
      tag.textContent = tag.textContent.replace(/(v[\d.]+) · (\w+)/, "$1 · DEMO");
      tag.style.background = "#fff3cd";
      tag.style.color = "#7a4d00";
      tag.style.borderColor = "#e8b14a";
      tag.title = "DEMO BUILD — shows synthetic data. No backend, no Clawpilot. Safe to share.";
    }
    document.title = "FTA Workspace · DEMO";
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", brand);
  } else {
    brand();
  }
  // Re-brand any time the topbar re-renders.
  new MutationObserver(brand).observe(document.body, { childList: true, subtree: true });

})();
