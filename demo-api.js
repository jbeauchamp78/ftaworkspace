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

  function FISCAL() {
    return { label: "FY26", start: "2025-07-01", h2_start: "2026-01-01", end: "2026-07-01" };
  }

  function DEMO_INSIGHTS() {
    const custs = STATE.customers || [];
    const picks = [
      { c: custs[0]?.nickname || "Acme", title: "Copilot assisted-hours calculation clarity", date: "2026-04-29T19:31:03Z", via: "portal" },
      { c: null, title: "Automated provisioning for SharePoint / Copilot Lite agents", date: "2026-04-29T19:26:31Z", via: "portal" },
      { c: custs[1]?.nickname || "Globex", title: "Copilot analytics need outcome-based leadership insights", date: "2026-04-10T14:00:57Z", via: "portal" },
      { c: custs[2]?.nickname || "Initech", title: "SharePoint Agent deployment blocked by SPN and support ownership guidance", date: "2026-04-10T13:56:05Z", via: "portal" },
    ];
    return picks.map((x, i) => ({
      cust_nickname: x.c,
      insight_id: `demo-insight-${i + 1}`,
      kr_label: i % 2 ? "Copilot Agents" : "M365 Copilot",
      title: x.title,
      stage: i === 1 ? "It's Draft" : "This needs upvotes!",
      state: "active",
      upvotes: i === 0 ? 2 : 0,
      priority: "P3",
      created_on: x.date,
      last_modified: x.date,
      url: "#demo-insight",
      source: "demo",
      submitted_via: x.via,
      submitter_email: null,
    }));
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
    ["GET", /^\/api\/(?:daily-focus|lab\/daily-focus)$/, () => {
      const demoSignals = {
        "BCBS NC": { email_metadata_mentions: 1, teams_metadata_mentions: 1 },
        "BAPTIST HCS": { teams_metadata_mentions: 1 },
        "CARESOURCE": { email_metadata_mentions: 1 },
        "BCBS MI": { teams_metadata_mentions: 1 },
        "TELADOC": { email_metadata_mentions: 1, teams_metadata_mentions: 1 },
      };
      const focus = (STATE.customers || []).map(c => {
        let score = 0;
        const reasons = [];
        const rows = c.krs || [];
        const regN = rows.filter(k => k.s === "REGRESSION").length;
        const missN = rows.filter(k => ["KPI WIN", "IN PROGRESS"].includes(k.s) && !["Yes", "N/A"].includes(k.p) && !(k.label || "").includes("Admin Days")).length;
        const winN = rows.filter(k => k.s === "KPI WIN").length;
        const dqN = rows.filter(k => ["KPI WIN", "IN PROGRESS", "REGRESSION"].includes(k.s) && (k.c == null) && !(k.label || "").includes("Admin Days")).length;
        const sig = demoSignals[c.nickname] || {};
        const emailN = sig.email_metadata_mentions || 0;
        const teamsN = sig.teams_metadata_mentions || 0;
        if (regN) { score += regN * 30; reasons.push(`${regN} regression(s)`); }
        if (emailN) { score += Math.min(emailN, 3) * 25; reasons.push(`${emailN} prior-day Email signal(s)`); }
        if (teamsN) { score += Math.min(teamsN, 3) * 25; reasons.push(`${teamsN} prior-day Teams signal(s)`); }
        if (missN) { score += missN * 20; reasons.push(`${missN} missing PEC(s)`); }
        if (dqN) { score += dqN * 12; reasons.push(`${dqN} data-quality issue(s)`); }
        if (winN) { score += winN * 8; reasons.push(`${winN} KPI win(s) to harvest`); }
        return { nickname: c.nickname, full_name: c.full_name || c.name || c.nickname, score, reasons };
      }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 10);
      return jsonResp({
        generated_at: new Date().toISOString(),
        focus,
        score_formula: "Score = regressions x30 + prior-day Email signals x25 (max 75) + prior-day Teams signals x25 (max 75) + missing PECs x20 + local data-quality issues x12 + KPI wins x8. Generated during daily refresh and Refresh Now; the Customers tile can refresh the focus list on demand.",
        m365_signal_meta: { demo: true, privacy: "Aggregate customer-level counts only; no email/chat body content stored." },
      });
    }],
    ["GET", /^\/api\/counters$/, () => {
      const counters = structuredClone(STATE.counters);
      let pub = 0;
      const custsWithPub = new Set();
      (STATE.customers || []).forEach((c) => {
        (c.spotlights || []).forEach((s) => {
          if ((s.stage || "").toLowerCase() === "publish") {
            pub++;
            custsWithPub.add(c.nickname);
          }
        });
      });
      counters.spotlights = Object.assign({}, counters.spotlights || {}, {
        published: pub,
        h1_published: 0,
        h2_published: pub,
        customers_with_spotlight: custsWithPub.size,
      });
      return jsonResp(counters);
    }],
    ["GET", /^\/api\/(?:scout|clawpilot)\/queue$/, () => jsonResp(STATE.queue)],
    ["GET", /^\/api\/(?:scout|clawpilot)\/queue\/log/, (m, opts, search) => {
      const sp = new URLSearchParams(search || "");
      const days = parseInt(sp.get("days") || "30", 10);
      const statusFilter = sp.get("status") || "";
      // Synthesize a few completed + a few pending rows for the demo
      const today = new Date();
      const iso = (d) => d.toISOString().slice(0, 19);
      const fake = [
        // Today
        { id: 901, kind: "pec-note",      label: "Engagement Note → REQ-558521-Z7C9B6 (Acme · MDE Usage)",
          prompt: '/pec-engagement-note "Acme" --kr "MDE Usage" --ticket REQ-558521-Z7C9B6 --subject "FT Engagement Note — MDE Usage — 2026-06-20" --body "Customer agreed to expand MDE pilot to 1500 seats by EoQ."',
          cust: "Acme", status: "succeeded", result: "success",
          summary: "Posted PEC Note → REQ-558521-Z7C9B6 (activityid: 9f8b1d2e-…)",
          created_at: iso(new Date(today.getTime() - 1000*60*45)),
          sent_at: iso(new Date(today.getTime() - 1000*60*40)),
          started_at: iso(new Date(today.getTime() - 1000*60*38)),
          completed_at: iso(new Date(today.getTime() - 1000*60*37)),
        },
        { id: 902, kind: "spotlight-sync", label: "Sync spotlights for Globex",
          prompt: "/spotlight-sync Globex",
          cust: "Globex", status: "succeeded", result: "success",
          summary: "Indexed 7 spotlights (4 publish · 3 draft).",
          created_at: iso(new Date(today.getTime() - 1000*60*60*3)),
          completed_at: iso(new Date(today.getTime() - 1000*60*60*3 + 1000*60*2)),
        },
        { id: 903, kind: "pec-draft", label: "Open PEC - Initech - Copilot Chat",
          prompt: '/manage-pecs create PEC for "Initech" on workload "Copilot Chat" (deploy lead: FastTrack) in Triage stage.',
          cust: "Initech", status: "failed", result: "failed",
          summary: "FTOP returned 502 on incident-create. Will retry on next heartbeat.",
          created_at: iso(new Date(today.getTime() - 1000*60*60*5)),
          completed_at: iso(new Date(today.getTime() - 1000*60*60*5 + 1000*60*1)),
        },
        // Yesterday
        { id: 904, kind: "heatmap-ftbi-sync", label: "Sync heatmap for Hooli",
          prompt: "/heatmap-ftbi-sync Hooli",
          cust: "Hooli", status: "succeeded", result: "success",
          summary: "Updated 41 heatmap tiles from FTBI tenant profile.",
          created_at: iso(new Date(today.getTime() - 1000*60*60*30)),
          completed_at: iso(new Date(today.getTime() - 1000*60*60*30 + 1000*60*4)),
        },
        // Pending now
        ...((STATE.queue.pending || []).map(p => ({
          ...p, summary: null, result: null,
          completed_at: null, started_at: null,
        }))),
      ];
      const filtered = statusFilter ? fake.filter(r => r.status === statusFilter) : fake;
      // Group by date local
      const groups = {};
      filtered.forEach(r => {
        const ts = r.completed_at || r.sent_at || r.created_at;
        if (!ts) return;
        const d = new Date(ts);
        const key = d.toISOString().slice(0, 10);
        const dayMs = 24 * 60 * 60 * 1000;
        const diff = Math.floor((Date.now() - d.getTime()) / dayMs);
        let label;
        if (diff === 0) label = "Today";
        else if (diff === 1) label = "Yesterday";
        else if (diff < 7) label = d.toLocaleDateString([], { weekday: "long" });
        else label = d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
        if (!groups[key]) groups[key] = { date: key, label, items: [] };
        groups[key].items.push(r);
      });
      const groupList = Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
      return jsonResp({
        groups: groupList,
        meta: {
          filtered: filtered.length, total: filtered.length,
          retention_days: 30, window_days: days, limit: 500,
          db_size_kb: 84.2,
          oldest_iso: filtered[filtered.length - 1]?.created_at,
          newest_iso: filtered[0]?.completed_at,
        },
      });
    }],
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
    ["GET", /^\/api\/customer\/([^/?]+)\/insight-draft$/, (m, opts, search) => {
      const cust = decodeURIComponent(m[1]);
      const params = new URLSearchParams(search || "");
      const krLabel = params.get("kr_label") || "";
      const wl = krLabel || "M365 Copilot";
      return jsonResp({
        ok: true,
        draft: {
          title: `[${wl}] Product gap observed at customer engagement`,
          scenario: `During FastTrack engagement with ${cust}, the customer encountered a limitation while deploying ${wl}.\n\nReplace this with the specific scenario — what they were trying to do, what happened, what was the FastTrack guidance.`,
          impact: `Blocks ${wl} adoption for ${cust}. If widespread, blocks adoption across the FastTrack portfolio.`,
          desired_outcome: "Replace with the specific product capability needed — e.g., 'support for X scenario in Y feature', 'admin control for Z policy'.",
          workload_hint: wl,
          kr_label: krLabel || null,
          priority: "P3",
          blocked: false,
          _context: { cust_nickname: cust, kr_label: krLabel || null },
        },
      });
    }],
    ["POST", /^\/api\/customer\/([^/?]+)\/insight-draft\/queue$/, (m, opts) => {
      const cust = decodeURIComponent(m[1]);
      let body = {}; try { body = JSON.parse(opts?.body || "{}"); } catch {}
      if (!body.title) return jsonResp({ ok: false, error: "title is required" });
      if (!body.scenario || !body.impact || !body.desired_outcome) {
        return jsonResp({ ok: false, error: "scenario, impact, and desired_outcome are required" });
      }
      STATE.queue.pending = STATE.queue.pending || [];
      const id = STATE.nextQueueId++;
      const nowSql = new Date().toISOString().replace("T", " ").slice(0, 19);
      STATE.queue.pending.push({
        id, kind: "insight-draft",
        label: `Insight - ${cust}${body.kr_label ? " - " + body.kr_label : ""}`,
        prompt: `/insight create "${cust}"\n# Workspace pre-fill draft staged at: [demo-staged]/${cust}-${id}.json`,
        cust, status: "pending", requires_user_confirm: 1,
        trigger: "ui_insight_draft", created_at: nowSql,
      });
      STATE.queue.count = (STATE.queue.count || 0) + 1;
      return jsonResp({ ok: true, id, prompt: `/insight create "${cust}"`, requires_user_confirm: 1 });
    }],
    ["POST", /^\/api\/customer\/([^/?]+)\/insight-draft\/prompt$/, (m, opts) => {
      const cust = decodeURIComponent(m[1]);
      let body = {}; try { body = JSON.parse(opts?.body || "{}"); } catch {}
      if (!body.title) return jsonResp({ ok: false, error: "title is required" });
      if (!body.scenario || !body.impact || !body.desired_outcome) {
        return jsonResp({ ok: false, error: "scenario, impact, and desired_outcome are required" });
      }
      const staged = `[demo-staged]/${cust}-${Date.now()}.json`;
      return jsonResp({
        ok: true,
        staged_path: staged,
        prompt: `/insight create "${cust}"\n# Workspace pre-fill draft staged at: ${staged}\n# (Skill drives its own M365 mining + preview; this is reference.)`,
        requires_user_confirm: true,
        mode: "copy_to_scout",
      });
    }],
    ["GET", /^\/api\/insights\/summary$/, () => {
      // Demo: synthesize a small but believable count
      const inFlight = (STATE.queue.pending || []).filter(p => p.kind === "insight-draft").length;
      const rows = DEMO_INSIGHTS();
      return jsonResp({
        total_active: rows.length + inFlight,
        h1_active: 0,
        h2_active: rows.length,
        in_flight: inFlight,
        from_workspace: inFlight,
        customers_touched: new Set(rows.map(r => r.cust_nickname).filter(Boolean)).size,
        fiscal: FISCAL(),
      });
    }],
    ["GET", /^\/api\/insights\/portfolio$/, () => {
      return jsonResp({ insights: DEMO_INSIGHTS(), count: DEMO_INSIGHTS().length, fiscal: FISCAL() });
    }],
    ["POST", /^\/api\/feedback\/submit$/, (m, opts) => {
      let body = {}; try { body = JSON.parse(opts?.body || "{}"); } catch {}
      const t = (body.type || "").toLowerCase();
      if (!["bug","idea","question"].includes(t)) return jsonResp({ ok: false, error: "type must be bug|idea|question" });
      if (!body.title) return jsonResp({ ok: false, error: "title is required" });
      if (!body.body) return jsonResp({ ok: false, error: "body is required" });
      return jsonResp({ ok: true, install_id: "demo-install-id", path: "[demo] usage_events.csv" });
    }],
    // ----- Drill panel data feeds (v0.69 demo parity) -----
    ["GET", /^\/api\/ideal-config\/rollup$/, () => {
      const items = STATE.customers.map((c) => {
        const ic = c.ideal_config || {};
        const green = ic.green_count != null ? ic.green_count
                    : (ic.settings ? ic.settings.filter(s => s.status === "green").length : 7);
        const total = ic.total_count != null ? ic.total_count
                    : (ic.settings ? ic.settings.length : 10);
        const overall = green === total ? "green" : green >= 6 ? "yellow" : "red";
        return { nickname: c.nickname, overall, green_count: green, total_count: total };
      });
      return jsonResp({ items });
    }],
    ["GET", /^\/api\/counters\/dq-list\/(\w+)$/, (m) => {
      const key = m[1];
      // Build demo lists from the customer set + DQ counts in meta
      const dq = STATE.counters?.data_quality || {};
      const count = dq[key] || 0;
      const items = [];
      const pool = STATE.customers.slice(0, count + 2);
      const titles = {
        esn_missing_or_expired: (c) => ({
          name: c.nickname, customer: c.nickname, workload: "Enterprise Status Note",
          entity: "account", id: c.ftop_account_id,
          extra: `ESN last touched 45+ days ago — past next-update`,
        }),
        l1_status_unknown: (c) => ({
          name: c.nickname, customer: c.nickname, workload: "Microsoft 365 Copilot",
          entity: "ftop_serviceintents", id: null,
          extra: `Workload Intent row L1 = "Status Unknown"`,
        }),
        l1_ip_without_engagement_start: (c) => ({
          name: c.nickname, customer: c.nickname, workload: "MDE Usage",
          entity: "ftop_serviceintents", id: null,
          extra: `L1 = In Progress, Engagement Start = blank`,
        }),
        l1_ip_without_target_date: (c) => ({
          name: c.nickname, customer: c.nickname, workload: "Insider Risk Management",
          entity: "ftop_serviceintents", id: null,
          extra: `L1 = In Progress, Target Date = blank`,
        }),
        l1_blocked_next_action_late: (c) => ({
          name: c.nickname, customer: c.nickname, workload: "Windows 365",
          entity: "ftop_serviceintents", id: null,
          extra: `L1 = Blocked, Next Action overdue`,
        }),
      };
      const mkr = titles[key];
      if (mkr) {
        for (let i = 0; i < Math.min(count, pool.length); i++) {
          items.push(mkr(pool[i]));
        }
      }
      return jsonResp({
        items,
        view_url: `https://fasttrack365.crm.dynamics.com/main.aspx#dq/${key}`,
      });
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
      // v0.62: format created_at like the backend ("YYYY-MM-DD HH:MM:SS"
      // without a 'Z' suffix) so the cart panel's fmtTime parses correctly
      // instead of rendering "Invalid Date".
      const nowSql = new Date().toISOString().replace("T", " ").slice(0, 19);
      STATE.queue.pending.push({
        id, kind: "spotlight-draft",
        label: `${body.kind === "lowlight" ? "(Lowlight) " : ""}Spotlight - ${cust}${body.kr_label ? " - " + body.kr_label : ""}`,
        prompt: `/spotlight "${cust}"\n# Workspace pre-fill draft staged at: [demo-staged]/${cust}-${id}.json`,
        cust, status: "pending", requires_user_confirm: 0,
        trigger: "ui_spotlight_draft", created_at: nowSql,
      });
      STATE.queue.count = (STATE.queue.count || 0) + 1;
      return jsonResp({
        ok: true, id, staged_path: `[demo-staged]/${cust}-${id}.json`,
        prompt: `/spotlight "${cust}"\n# Workspace pre-fill draft staged at: [demo-staged]/${cust}-${id}.json`,
        requires_user_confirm: 0, auto_submit_enabled: false,
      });
    }],

    // ----- PEC draft form (v0.39) -----
    ["GET", /^\/api\/customer\/([^/?]+)\/pec-draft$/, (m, opts, search) => {
      const cust = decodeURIComponent(m[1]);
      const params = new URLSearchParams(search || "");
      const krLabel = params.get("kr_label") || "";
      const c = customerByNick(cust);
      const full = c ? (c.full_name || cust) : cust;
      const today = new Date().toISOString().slice(0, 10);
      const KR_LABELS_DEMO = [
        {label:"M365 Copilot", code:963720010},
        {label:"Copilot Chat", code:963720011},
        {label:"Copilot Agents", code:963720012},
        {label:"MDE Usage", code:963720021},
        {label:"MDO", code:963720022},
        {label:"MDI", code:963720023},
        {label:"MDA", code:963720024},
        {label:"Insider Risk Management", code:963720031},
        {label:"Information Protection", code:963720032},
        {label:"DLP", code:963720033},
        {label:"Windows 365 POC", code:963720040},
        {label:"Admin Days", code:963720001},
      ];
      const krCat = KR_LABELS_DEMO.map(w => ({...w, category:"kr"}));
      const nonKrCat = NONKR_WORKLOADS.map(w => ({label:w, code:null, category:"non-kr"}));
      const ticked = [];
      if (krLabel) {
        const match = [...krCat, ...nonKrCat].find(w => w.label.toLowerCase() === krLabel.toLowerCase());
        if (match) ticked.push({...match, deploy_lead:"FastTrack"});
      }
      return jsonResp({
        draft: {
          customer_nickname: cust, customer_full_name: full,
          tpid: c ? c.tpid : null,
          tpid_account_id: c ? c.tpid_account_id : null,
          tenant_account_id: c ? c.ftop_account_id : null,
          title: `${full} — ${krLabel || "Engagement"} — ${today}`.slice(0, 120),
          workloads: ticked,
          area_manager_email: null,
          specialist_email: "",
          notes: `(Demo pre-fill — backend pulls KR status + MIDAS context here.)`,
          stage: "triage", fy: 26,
          domain: c ? c.ftop_defaultdomain : null,
        },
        workload_catalog: [...krCat, ...nonKrCat],
        deploy_leads: ["FastTrack","Unified/CSA","ISD","Partner","Customer","No Deployment Lead"],
      });
    }],
    ["POST", /^\/api\/customer\/([^/?]+)\/pec-draft\/queue$/, (m, opts) => {
      let body = {}; try { body = JSON.parse(opts?.body || "{}"); } catch {}
      if (!body.title) return jsonResp({ ok: false, error: "title is required" });
      if (!body.workloads || body.workloads.length === 0) return jsonResp({ ok: false, error: "at least one workload is required" });
      const cust = decodeURIComponent(m[1]);
      STATE.queue.pending = STATE.queue.pending || [];
      const id = STATE.nextQueueId++;
      const wl0 = body.workloads[0];
      const more = body.workloads.length > 1 ? ` (+${body.workloads.length - 1} more)` : "";
      STATE.queue.pending.push({
        id, kind: "pec-draft-create",
        label: `PEC create - ${cust} - ${wl0.label}${more}`,
        prompt: `/manage-pecs create PEC for "${cust}" in Triage stage.\n# Workspace pre-fill draft staged at: [demo-staged]/pec-${cust}-${id}.json`,
        cust, status: "pending", requires_user_confirm: 0,
        trigger: "ui_pec_draft", created_at: new Date().toISOString(),
      });
      STATE.queue.count = (STATE.queue.count || 0) + 1;
      return jsonResp({
        ok: true, id,
        staged_path: `[demo-staged]/pec-${cust}-${id}.json`,
        prompt: `/manage-pecs create PEC for "${cust}" in Triage stage`,
        requires_user_confirm: 0, auto_submit_enabled: false,
      });
    }],

    // ----- KR history chart (v0.42) -----
    ["GET", /^\/api\/customer\/([^/?]+)\/kr-history$/, (m, opts, search) => {
      const cust = decodeURIComponent(m[1]);
      const c = customerByNick(cust);
      if (!c) return jsonResp({ nickname: cust, months: [], series: [], thresholds: {} });
      // Synthesize 12 months of monthly history from the customer's current
      // kr_status rows. Walk linearly from baseline → current.
      const THRESHOLDS = {
        "M365 Copilot":   { value: 0.40, scale: "ratio",    unit: "% MAU/PAU" },
        "Copilot Chat":   { value: 0.20, scale: "ratio",    unit: "% MAU/PAU" },
        "Copilot Agents": { value: 750,  scale: "absolute", unit: "agent MAU" },
        "MDA Usage":      { value: 0.20, scale: "ratio",    unit: "% coverage" },
        "MDA Admin Days": { value: 10,   scale: "absolute", unit: "admin days" },
        "MDI Usage":      { value: 0.20, scale: "ratio",    unit: "% coverage" },
        "MDI Admin Days": { value: 10,   scale: "absolute", unit: "admin days" },
        "MDE Usage":      { value: 0.20, scale: "ratio",    unit: "% coverage" },
        "MDE Admin Days": { value: 10,   scale: "absolute", unit: "admin days" },
        "MDO Usage":      { value: 0.20, scale: "ratio",    unit: "% coverage" },
        "MDO Admin Days": { value: 10,   scale: "absolute", unit: "admin days" },
        "IP P2":          { value: 0.20, scale: "ratio",    unit: "% labeled" },
        "IRM":            { value: 0.20, scale: "ratio",    unit: "% MAU/PAU" },
        "Win365 Paid":    { value: 0.40, scale: "ratio",    unit: "% MAU/PAU" },
        "Win365 POC":     { value: 25,   scale: "absolute", unit: "seat growth" },
      };
      const now = new Date("2026-06-30");
      const months = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
      const series = (c.kr_status || []).map((kr) => {
        const t = THRESHOLDS[kr.kr_label];
        if (!t) return null;
        // Normalize all numerics safely — kr_status uses ratio (0..1) for
        // most workloads and absolute for Agents / Win365 POC / Admin Days.
        const cv = kr.current_value;
        const bv = kr.baseline_value;
        const mc = kr.mau_curr || kr.current_mau || null;
        const current  = (typeof cv === "number" && !isNaN(cv)) ? cv : (t.scale === "ratio" ? 0.10 : 5);
        const baseline = (typeof bv === "number" && !isNaN(bv)) ? bv : (t.scale === "ratio" ? Math.max(0, current * 0.3) : Math.max(0, current * 0.3));
        const curMau   = (typeof mc === "number" && !isNaN(mc)) ? mc : (t.scale === "absolute" ? current : 200);
        const baseMau  = Math.max(0, curMau * 0.4);
        const points = months.map((m, i) => {
          const frac = i / Math.max(1, months.length - 1);
          const jitter = (Math.sin(i * 0.9 + kr.kr_label.length) + 1) * 0.04 - 0.04;
          const val = baseline + (current - baseline) * frac + jitter * (t.scale === "ratio" ? 1 : 5);
          const mau = Math.round(baseMau + (curMau - baseMau) * frac + jitter * 100);
          return {
            month: m,
            iso: `${m}-${i === months.length - 1 ? "30" : "28"}`,
            value: Math.max(0, val),
            mau: Math.max(0, mau),
          };
        });
        return { kr_label: kr.kr_label, points, threshold: t };
      }).filter(Boolean);

      // v0.69: also include Non-KR series in the demo so the chart's Non-KR
      // mode actually has data to draw. In production this comes from the
      // (deferred) non_kr_status_history table. For demo we synthesize from
      // STATE.nonKrByCust[c.nickname] which already has current_mau values.
      STATE.nonKrByCust = STATE.nonKrByCust || {};
      if (!STATE.nonKrByCust[cust]) STATE.nonKrByCust[cust] = NON_KR_DEFAULT();
      const nkRows = STATE.nonKrByCust[cust] || [];
      nkRows.forEach((nk) => {
        if (nk.current_mau == null) return;
        const curMau = Math.max(1, nk.current_mau);
        const baseMau = Math.max(0, curMau * (0.45 + ((nk.workload.length % 5) * 0.05)));
        const points = months.map((m, i) => {
          const frac = i / Math.max(1, months.length - 1);
          const jitter = (Math.sin(i * 0.7 + nk.workload.length) + 1) * 60 - 60;
          const mau = Math.round(baseMau + (curMau - baseMau) * frac + jitter);
          return {
            month: m,
            iso: `${m}-${i === months.length - 1 ? "30" : "28"}`,
            value: null,
            mau: Math.max(0, mau),
          };
        });
        // Non-KR series have NO threshold — that's the toggle's signal.
        series.push({ kr_label: nk.workload, points, threshold: null });
      });

      return jsonResp({ nickname: cust, months, series, thresholds: THRESHOLDS });
    }],

    // ----- PEC Disengage (v0.42) -----
    ["GET", /^\/api\/pec\/disengage-options$/, () => jsonResp({
      reasons: [
        "no intent or opportunity",
        "intent & non-ft direct deployment lead",
        "deployment completed by ft",
        "customer disengaged",
        "account team unresponsive",
        "successful engagement",
        "customer not ready",
        "escalated engagement",
      ],
      handshakes: [
        "discussion with account team",
        "discussion account team + partner",
        "account team unresponsive/email sent",
      ],
    })],
    ["POST", /^\/api\/customer\/([^/?]+)\/kr\/([^/?]+)\/pec-disengage$/, (m, opts) => {
      const cust = decodeURIComponent(m[1]);
      const kr = decodeURIComponent(m[2]);
      let body = {}; try { body = JSON.parse(opts?.body || "{}"); } catch {}
      STATE.queue.pending = STATE.queue.pending || [];
      const id = STATE.nextQueueId++;
      STATE.queue.pending.push({
        id, kind: "pec-disengage",
        label: `Disengage PEC - ${cust} - ${kr}`,
        prompt: `/manage-pecs disengage PEC for "${cust}" on KR "${kr}", reason: "${body.reason}", handshake: "${body.handshake}".`,
        cust, status: "pending", requires_user_confirm: 0,
        trigger: "ui_pec_disengage", created_at: new Date().toISOString(),
      });
      STATE.queue.count = (STATE.queue.count || 0) + 1;
      return jsonResp({ ok: true, id, prompt: `/manage-pecs disengage PEC ...` });
    }],
    ["POST", /^\/api\/customer\/([^/?]+)\/kr\/([^/?]+)\/pec-advance$/, (m, opts) => {      const cust = decodeURIComponent(m[1]);
      const kr = decodeURIComponent(m[2]);
      let body = {}; try { body = JSON.parse(opts?.body || "{}"); } catch {}
      const stage = (body.target_stage || "").toLowerCase();
      if (stage !== "engage" && stage !== "disengage") {
        return jsonResp({ ok: false, error: "target_stage must be 'engage' or 'disengage'" });
      }
      if (stage === "disengage" && (!body.reason || !body.handshake)) {
        return jsonResp({ ok: false, error: "reason and handshake required for disengage" });
      }
      STATE.queue.pending = STATE.queue.pending || [];
      const id = STATE.nextQueueId++;
      const kind = stage === "engage" ? "pec-advance" : "pec-disengage";
      const label = stage === "engage"
        ? `Advance PEC → Engage - ${cust} - ${kr}`
        : `Disengage PEC - ${cust} - ${kr}`;
      const prompt = stage === "engage"
        ? `/manage-pecs advance PEC for "${cust}" on KR "${kr}" from Triage to Engage. (Please confirm before writing.)`
        : `/manage-pecs disengage PEC for "${cust}" on KR "${kr}", reason: "${body.reason}", handshake: "${body.handshake}".`;
      STATE.queue.pending.push({
        id, kind, label, prompt, cust,
        status: "pending", requires_user_confirm: 0,
        trigger: "ui_pec_advance", created_at: new Date().toISOString(),
      });
      STATE.queue.count = (STATE.queue.count || 0) + 1;
      return jsonResp({ ok: true, id, prompt, target_stage: stage });
    }],

    // ----- PEC engagement note: resolve target ticket -----
    ["GET", /^\/api\/customer\/([^/?]+)\/kr\/([^/?]+)\/pec-note\/resolve$/, (m) => {
      const cust = decodeURIComponent(m[1]);
      const kr = decodeURIComponent(m[2]);
      const c = customerByNick(cust);
      const pecs = (c && c.pecs) || [];
      const active = pecs.filter(p => !(p.state || "").toLowerCase() || (p.state || "").toLowerCase() === "active");
      // Crude workload-match for demo
      const krLow = kr.toLowerCase();
      let chosen = active.find(p =>
        (p.workload || "").toLowerCase().split(/\W+/).some(w => w && krLow.includes(w))
      ) || active[0] || null;
      if (!chosen) return jsonResp({ ok: false, error: `no active PEC for ${kr}`, candidates: active });
      return jsonResp({
        ok: true,
        ticket: chosen.ticket, incident_id: chosen.incident_id,
        workload: chosen.workload, title: chosen.title, stage: chosen.stage,
        last_modified: chosen.last_modified, candidates: active,
      });
    }],
    // ----- PEC engagement note: queue the note -----
    ["POST", /^\/api\/customer\/([^/?]+)\/kr\/([^/?]+)\/pec-note$/, (m, opts) => {
      const cust = decodeURIComponent(m[1]);
      const kr = decodeURIComponent(m[2]);
      let body = {}; try { body = JSON.parse(opts?.body || "{}"); } catch {}
      const note = (body.body || "").trim();
      if (!note) return jsonResp({ ok: false, error: "body is required" });
      if (note.length > 4000) return jsonResp({ ok: false, error: "body too long (max 4000)" });
      const ticket = (body.ticket || "DEMO-PEC-0001").trim();
      const today = new Date().toISOString().slice(0, 10);
      const subj = (body.subject || `FT Engagement Note — ${kr} — ${today}`).trim();
      STATE.queue.pending = STATE.queue.pending || [];
      const id = STATE.nextQueueId++;
      STATE.queue.pending.push({
        id, kind: "pec-note",
        label: `Engagement Note → ${ticket} (${cust} · ${kr})`,
        prompt: `/pec-engagement-note "${cust}" --kr "${kr}" --ticket ${ticket} --subject ${JSON.stringify(subj)} --body ${JSON.stringify(note)}`,
        cust, status: "pending", requires_user_confirm: 0,
        trigger: "ui_pec_note", created_at: new Date().toISOString(),
      });
      STATE.queue.count = (STATE.queue.count || 0) + 1;
      return jsonResp({ ok: true, id, ticket, subject: subj, status_date: today });
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
      const pecs = c.pecs || [];
      let triage = 0, engage = 0, disengage = 0, other = 0;
      pecs.forEach(p => {
        const st = (p.state || "").toLowerCase();
        if (st && st !== "active") return;
        const stg = (p.stage || "").toLowerCase();
        if (stg.includes("triage")) triage++;
        else if (stg.includes("engage") && !stg.includes("dis")) engage++;
        else if (stg.includes("disengage")) disengage++;
        else other++;
      });
      return jsonResp({
        nickname: c.nickname,
        summary: {
          active: c.pec_active_count || 0,
          closed: c.pec_closed_count || 0,
          total:  c.pec_total_count  || 0,
          triage, engage, disengage, other_active: other,
        },
        pecs,
        detail_source: pecs.length ? "demo" : "empty",
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
        sent_at: null, requires_user_confirm: 0,
      };
      STATE.queue.pending.push(item);
      STATE.queue.count = STATE.queue.pending.length;
      STATE.queue.needs_user_count = STATE.queue.pending.filter((p) => p.requires_user_confirm).length;
      return jsonResp({ ok: true, queued: true, queue_id: item.id, prompt, needs_user_confirm: false });
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
        published: pub,
        h1_published: 0,
        h2_published: pub,
        customers_with_spotlight: custsWithPub.size,
        in_flight: draft + queued, in_flight_drafts: draft, in_flight_queued: queued,
        recommended,
        fiscal: FISCAL(),
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

    // ----- Spotlight: manually logged (FTA already created in FTOP) -----
    ["POST", /^\/api\/spotlights\/manual$/, async (m, opts) => {
      const b = JSON.parse(opts?.body || "{}");
      const nick = (b.cust_nickname || "").trim();
      const title = (b.title || "").trim();
      if (!nick || !title) return jsonResp({ ok: false, error: "cust_nickname and title are required" });
      const c = customerByNick(nick);
      if (!c) return jsonResp({ ok: false, error: "customer not found" }, 404);
      c.spotlights = c.spotlights || [];
      const id = `manual-${Math.random().toString(36).slice(2,14)}`;
      const now = new Date().toISOString();
      c.spotlights.push({
        spotlight_id: id, cust_nickname: nick,
        title, kr_label: b.kr_label || null,
        stage: b.stage || "Publish", kind: b.kind || "highlight",
        created_on: now, last_modified: now, url: b.url || null,
        source: "manual",
      });
      return jsonResp({ ok: true, spotlight_id: id, source: "manual" });
    }],

    // ----- PEC manual mark / clear -----
    ["PATCH", /^\/api\/customer\/([^/]+)\/kr\/([^/]+)\/pec-flag$/, async (m, opts) => {
      const nick = decodeURIComponent(m[1]);
      const kr   = decodeURIComponent(m[2]);
      const b = JSON.parse(opts?.body || "{}");
      const flag = (b.flag || "").trim();
      const c = customerByNick(nick);
      if (!c) return jsonResp({ ok: false, error: "customer not found" }, 404);
      const row = (c.kr_status || []).find(k => k.kr_label === kr);
      if (!row) return jsonResp({ ok: false, error: `KR row not found: ${kr}` }, 404);
      row.pec_flag = flag;
      row.pec_flag_source = flag ? "manual" : null;
      return jsonResp({ ok: true, pec_flag: flag, source: row.pec_flag_source });
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

    // ----- Scout bridge (simulated; accepts legacy Clawpilot route too) -----
    ["POST", /^\/api\/(?:scout|clawpilot)\/queue$/, async (_m, opts) => {
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
    ["PATCH", /^\/api\/(?:scout|clawpilot)\/queue\/(\d+)\/approve$/, async (m) => {
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
    ["DELETE", /^\/api\/(?:scout|clawpilot)\/queue\/(\d+)$/, async (m) => {
      const id = parseInt(m[1], 10);
      const idx = STATE.queue.pending.findIndex((p) => p.id === id);
      if (idx >= 0) STATE.queue.pending.splice(idx, 1);
      STATE.queue.count = STATE.queue.pending.length;
      STATE.queue.needs_user_count = STATE.queue.pending.filter((p) => p.requires_user_confirm).length;
      return emptyOk();
    }],
    // Clear all pending items (used by the cart panel's "Clear pending"
    // button). Mirrors the live backend's DELETE-where-status=pending.
    ["POST", /^\/api\/(?:scout|clawpilot)\/queue\/clear$/, async () => {
      STATE.queue.pending = [];
      STATE.queue.count = 0;
      STATE.queue.needs_user_count = 0;
      return jsonResp({ ok: true, count: 0 });
    }],
    ["POST", /^\/api\/(?:scout|clawpilot)\/queue\/(\d+)\/(start|complete|fail)$/, () => emptyOk()],

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
      tag.title = "DEMO BUILD — shows synthetic data. No backend, no Scout. Safe to share.";
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
