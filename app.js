/* app.js - 状态管理与事件绑定 */
(function () {
  const { render } = window.Topology;
  const { clearPackets, runLoginSequence, startLoopingFlow } = window.Animations;

  const state = {
    selectedClient: "A",
    hsCount: 3,
    derpCount: 2,
    loggedIn: { A: false, B: false },
    connection: null, // null | 'direct' | 'relay'
    busy: false,
    positions: null,
  };

  // --- UI 引用 ---
  const $ = (id) => document.getElementById(id);
  const statusMsg = $("status-message");
  const connState = $("conn-state");
  const hsMetric = $("hs-metric");
  const derpMetric = $("derp-metric");

  function setStatus(text) { statusMsg.textContent = text; }
  function setConnState(text) { connState.textContent = text; }

  // --- 连线高亮 ---
  function clearEdgeHighlights() {
    document.querySelectorAll("#layer-edges .edge").forEach((e) => {
      e.classList.remove("active-login", "active-direct", "active-relay");
    });
    // 删除临时添加的 direct / relay 路径
    document.querySelectorAll(".edge.temp").forEach((e) => e.remove());
  }

  function highlightLoginEdges(clientKey) {
    const suffix = clientKey === "A" ? "a" : "b";
    const client = state.positions[clientKey === "A" ? "clientA" : "clientB"];
    // 客户端 ↔ SAAS（身份认证链路）
    ensureTempEdge(`edge-${suffix}-saas`, client, state.positions.saas, "active-login");
    // 客户端 ↔ Gateway（Headscale 集群入口）
    ensureTempEdge(`edge-${suffix}-gw`, client, state.positions.gateway, "active-login");
    // SaaS ↔ Gateway 以及 Gateway ↔ 每个 HS（基础边高亮）
    const saasGw = document.getElementById("edge-saas-gw");
    if (saasGw) saasGw.classList.add("active-login");
    state.positions.hs.forEach((_, i) => {
      const e = document.getElementById(`edge-gw-hs-${i}`);
      if (e) e.classList.add("active-login");
    });
  }

  function ensureTempEdge(id, from, to, cls) {
    let line = document.getElementById(id);
    if (!line) {
      line = window.Topology.svgEl("line", {
        id, class: `edge temp ${cls}`,
        x1: from.x, y1: from.y, x2: to.x, y2: to.y,
      });
      document.getElementById("layer-edges").appendChild(line);
    } else {
      line.classList.add(cls);
    }
  }

  function refreshLoginHighlights() {
    ["A", "B"].forEach((c) => { if (state.loggedIn[c]) highlightLoginEdges(c); });
  }

  // --- 整体重渲染 ---
  function rerender() {
    render(state);
    hsMetric.textContent = state.hsCount;
    derpMetric.textContent = state.derpCount;
    refreshLoginHighlights();
    if (state.connection === "direct") drawDirect();
    if (state.connection === "relay") drawRelay();
  }

  // --- 场景：登录 ---
  async function doLogin() {
    if (state.busy) return;
    const c = state.selectedClient;
    if (state.loggedIn[c]) { setStatus(`客户端 ${c} 已登录`); return; }
    state.busy = true;
    setButtonsDisabled(true);
    setStatus(`客户端 ${c} 发起登录：SaaS 验证 → gRPC 请求 Headscale Gateway → 下发 PreAuthKey → 客户端注册`);
    setConnState("登录中…");
    await runLoginSequence(state, c);
    state.loggedIn[c] = true;
    setStatus(`客户端 ${c} 身份验证成功`);
    setConnState(bothLoggedIn() ? "已登录" : "部分登录");
    rerender();
    state.busy = false;
    setButtonsDisabled(false);
  }

  function bothLoggedIn() { return state.loggedIn.A && state.loggedIn.B; }

  // --- 场景：直连 ---
  function drawDirect() {
    const a = state.positions.clientA;
    const b = state.positions.clientB;
    ensureTempEdge("edge-direct-ab", a, b, "active-direct");
    startLoopingFlow([a, b], { color: "#22c55e", color2: "#86efac", duration: 1400, interval: 500 });
    startLoopingFlow([b, a], { color: "#22c55e", color2: "#86efac", duration: 1400, interval: 500 });
  }

  function simulateDirect() {
    if (!bothLoggedIn()) { setStatus("请先让客户端 A 与 B 都完成登录"); return; }
    clearPackets(); clearEdgeHighlights();
    state.connection = "direct";
    refreshLoginHighlights();
    drawDirect();
    setStatus("网络直连已建立：P2P 数据链路畅通");
    setConnState("直连成功 (P2P)");
  }

  // --- 场景：中继 ---
  function drawRelay() {
    const a = state.positions.clientA;
    const b = state.positions.clientB;
    const d1 = state.positions.derp[0];
    const dLast = state.positions.derp[state.positions.derp.length - 1];
    // 路径：A -> d1 -> dLast -> B （若只有 1 个 DERP 则 A -> d1 -> B）
    const path = state.positions.derp.length > 1 ? [a, d1, dLast, b] : [a, d1, b];
    for (let i = 0; i < path.length - 1; i++) {
      ensureTempEdge(`edge-relay-${i}`, path[i], path[i + 1], "active-relay");
    }
    startLoopingFlow(path, { color: "#ef4444", color2: "#fca5a5", duration: 1600, interval: 420 });
    const rev = [...path].reverse();
    startLoopingFlow(rev, { color: "#ef4444", color2: "#fca5a5", duration: 1600, interval: 420 });
  }

  function simulateRelay() {
    if (!bothLoggedIn()) { setStatus("请先让客户端 A 与 B 都完成登录"); return; }
    clearPackets(); clearEdgeHighlights();
    state.connection = "relay";
    refreshLoginHighlights();
    drawRelay();
    setStatus("直连失败，已切换至 DERP 中继：数据经中继服务器转发");
    setConnState("中继成功 (DERP)");
  }

  // --- 重置 ---
  function resetAll() {
    clearPackets(); clearEdgeHighlights();
    state.loggedIn = { A: false, B: false };
    state.connection = null;
    state.busy = false;
    setStatus("系统已重置");
    setConnState("未连接");
    rerender();
    setButtonsDisabled(false);
  }

  function setButtonsDisabled(v) {
    ["btn-login", "btn-direct", "btn-relay", "btn-reset"].forEach((id) => ($(id).disabled = v));
  }

  // --- 事件绑定 ---
  function bind() {
    document.querySelectorAll("#client-toggle .seg").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#client-toggle .seg").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.selectedClient = btn.dataset.client;
      });
    });
    $("hs-slider").addEventListener("input", (e) => {
      state.hsCount = +e.target.value;
      $("hs-count").textContent = state.hsCount;
      resetAll();
    });
    $("derp-slider").addEventListener("input", (e) => {
      state.derpCount = +e.target.value;
      $("derp-count").textContent = state.derpCount;
      resetAll();
    });
    $("btn-login").addEventListener("click", doLogin);
    $("btn-direct").addEventListener("click", simulateDirect);
    $("btn-relay").addEventListener("click", simulateRelay);
    $("btn-reset").addEventListener("click", resetAll);
  }

  // --- 初始化 ---
  bind();
  rerender();
})();
