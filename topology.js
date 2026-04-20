/* topology.js - SVG 节点/连线 渲染 */
(function (global) {
  const SVG_NS = "http://www.w3.org/2000/svg";

  // 图标 SVG path（简洁线稿）
  const ICONS = {
    cloud: '<path d="M7 17a4 4 0 0 1 .4-7.98A6 6 0 0 1 19 10a3.5 3.5 0 0 1-.5 7H7z" fill="none" stroke="#3b82f6" stroke-width="1.6" stroke-linejoin="round"/>',
    server:
      '<rect x="5" y="4" width="14" height="6" rx="1.5" fill="none" stroke="#22c55e" stroke-width="1.6"/>' +
      '<rect x="5" y="13" width="14" height="6" rx="1.5" fill="none" stroke="#22c55e" stroke-width="1.6"/>' +
      '<circle cx="8" cy="7" r="0.9" fill="#22c55e"/>' +
      '<circle cx="8" cy="16" r="0.9" fill="#22c55e"/>',
    router:
      '<rect x="4" y="12" width="16" height="7" rx="1.5" fill="none" stroke="#ef4444" stroke-width="1.6"/>' +
      '<circle cx="8" cy="15.5" r="0.9" fill="#ef4444"/>' +
      '<path d="M12 12V7" stroke="#ef4444" stroke-width="1.6" stroke-linecap="round"/>' +
      '<path d="M9 6a3 3 0 0 1 6 0" stroke="#ef4444" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
      '<path d="M7 7a5 5 0 0 1 10 0" stroke="#ef4444" stroke-width="1.3" fill="none" stroke-linecap="round" opacity="0.6"/>',
    laptop:
      '<rect x="5" y="5" width="14" height="9" rx="1.2" fill="none" stroke="#f59e0b" stroke-width="1.6"/>' +
      '<path d="M3 17h18l-1.3 2H4.3L3 17z" fill="none" stroke="#f59e0b" stroke-width="1.6" stroke-linejoin="round"/>',
    gateway:
      '<rect x="3" y="8" width="18" height="8" rx="1.6" fill="none" stroke="#a78bfa" stroke-width="1.6"/>' +
      '<path d="M7 12h10" stroke="#a78bfa" stroke-width="1.4" stroke-linecap="round"/>' +
      '<path d="M9 10l-2 2 2 2M15 10l2 2-2 2" stroke="#a78bfa" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  };

  // 布局常量
  const LAYOUT = {
    saas: { x: 410, y: 90 },
    gateway: { x: 200, y: 190 },
    clientA: { x: 200, y: 635 },
    clientB: { x: 620, y: 635 },
    hsX: 200,
    derpX: 620,
    colTop: 275,
    colBottom: 520,
    slotSpacing: 60,
    cluster: { x: 80, y: 140, w: 240, h: 420 },
  };

  // 按给定数量居中布局纵列
  function verticalPositions(count, topY, bottomY, spacing) {
    const total = (count - 1) * spacing;
    const center = (topY + bottomY) / 2;
    const startY = center - total / 2;
    return Array.from({ length: count }, (_, i) => startY + i * spacing);
  }

  // 创建 SVG 元素
  function svgEl(tag, attrs, innerHTML) {
    const el = document.createElementNS(SVG_NS, tag);
    if (attrs) for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (innerHTML !== undefined) el.innerHTML = innerHTML;
    return el;
  }

  // 创建一个 "图标 + 标签胶囊" 节点
  function createNode({ x, y, type, label, iconSize = 28, pillW = 120 }) {
    const g = svgEl("g", { class: `node node-${type}`, transform: `translate(${x},${y})` });
    // 图标：viewBox 24x24，缩放
    const iconG = svgEl("g", {
      transform: `translate(${-iconSize / 2}, ${-iconSize / 2 - 16}) scale(${iconSize / 24})`,
    });
    const iconType = {
      saas: "cloud", hs: "server", derp: "router", client: "laptop", gateway: "gateway",
    }[type];
    iconG.innerHTML = ICONS[iconType];
    g.appendChild(iconG);
    // 标签胶囊
    const pillH = 26;
    const pillY = 16;
    g.appendChild(svgEl("rect", {
      class: `node-pill ${type}`,
      x: -pillW / 2, y: pillY, width: pillW, height: pillH, rx: pillH / 2, ry: pillH / 2,
    }));
    const text = svgEl("text", { class: "node-label", x: 0, y: pillY + pillH / 2 + 1 });
    text.textContent = label;
    g.appendChild(text);
    return g;
  }

  // 创建一条连线（边）
  function createEdge(x1, y1, x2, y2, id) {
    return svgEl("line", {
      class: "edge", id, x1, y1, x2, y2,
    });
  }

  // 根据状态重新渲染整体拓扑
  function render(state) {
    const framesLayer = document.getElementById("layer-frames");
    const edgesLayer = document.getElementById("layer-edges");
    const halosLayer = document.getElementById("layer-halos");
    const nodesLayer = document.getElementById("layer-nodes");
    framesLayer.innerHTML = "";
    edgesLayer.innerHTML = "";
    halosLayer.innerHTML = "";
    nodesLayer.innerHTML = "";

    const hsYs = verticalPositions(state.hsCount, LAYOUT.colTop, LAYOUT.colBottom, LAYOUT.slotSpacing);
    const derpYs = verticalPositions(state.derpCount, LAYOUT.colTop, LAYOUT.colBottom, LAYOUT.slotSpacing);

    const positions = {
      saas: { ...LAYOUT.saas },
      gateway: { ...LAYOUT.gateway },
      clientA: { ...LAYOUT.clientA },
      clientB: { ...LAYOUT.clientB },
      hs: hsYs.map((y) => ({ x: LAYOUT.hsX, y })),
      derp: derpYs.map((y) => ({ x: LAYOUT.derpX, y })),
    };
    state.positions = positions;

    // Headscale 集群边框 + 标题（放在最底层）
    const cf = LAYOUT.cluster;
    framesLayer.appendChild(svgEl("rect", {
      class: "cluster-frame",
      x: cf.x, y: cf.y, width: cf.w, height: cf.h, rx: 14, ry: 14,
    }));
    const title = svgEl("text", { class: "cluster-title", x: cf.x + cf.w / 2, y: cf.y - 6 });
    title.textContent = "Headscale 集群";
    framesLayer.appendChild(title);

    // 基础连线（灰色虚线）
    // SAAS ↔ Gateway（SaaS 只与 Gateway 通信）
    edgesLayer.appendChild(createEdge(positions.saas.x, positions.saas.y, positions.gateway.x, positions.gateway.y, "edge-saas-gw"));
    // Gateway ↔ 每个 HS（集群内部）
    positions.hs.forEach((p, i) => {
      edgesLayer.appendChild(createEdge(positions.gateway.x, positions.gateway.y, p.x, p.y, `edge-gw-hs-${i}`));
    });
    // SAAS ↔ 每个 DERP
    positions.derp.forEach((p, i) => {
      edgesLayer.appendChild(createEdge(positions.saas.x, positions.saas.y, p.x, p.y, `edge-saas-derp-${i}`));
    });
    // 客户端提示线（淡）
    edgesLayer.appendChild(createEdge(positions.clientA.x, positions.clientA.y - 24, positions.gateway.x, positions.gateway.y + 18, "edge-a-gw-hint"));
    edgesLayer.appendChild(createEdge(positions.clientB.x, positions.clientB.y - 24, positions.derp[positions.derp.length - 1].x, positions.derp[positions.derp.length - 1].y + 18, "edge-b-derplast"));

    // 光晕（登录后高亮）
    ["A", "B"].forEach((c) => {
      const p = c === "A" ? positions.clientA : positions.clientB;
      const halo = svgEl("circle", {
        id: `halo-${c}`, cx: p.x, cy: p.y, r: 40,
        fill: "url(#haloGreen)", opacity: state.loggedIn[c] ? 1 : 0,
      });
      halosLayer.appendChild(halo);
    });

    // 节点
    nodesLayer.appendChild(createNode({ x: positions.saas.x, y: positions.saas.y, type: "saas", label: "SAAS 控制网站", pillW: 108 }));
    nodesLayer.appendChild(createNode({ x: positions.gateway.x, y: positions.gateway.y, type: "gateway", label: "Headscale Gateway", pillW: 128 }));
    positions.hs.forEach((p, i) => {
      nodesLayer.appendChild(createNode({ x: p.x, y: p.y, type: "hs", label: `HEADSCALE ${i + 1}`, pillW: 104 }));
    });
    positions.derp.forEach((p, i) => {
      nodesLayer.appendChild(createNode({ x: p.x, y: p.y, type: "derp", label: `中继服务器 ${i + 1}`, pillW: 106 }));
    });
    ["A", "B"].forEach((c) => {
      const p = c === "A" ? positions.clientA : positions.clientB;
      const statusG = svgEl("g", { transform: `translate(${p.x}, ${p.y - 38})` });
      const st = svgEl("text", { class: `status-text ${state.loggedIn[c] ? "on" : "off"}`, x: 0, y: 0 });
      st.textContent = state.loggedIn[c] ? "已登录" : "未登录";
      statusG.appendChild(st);
      nodesLayer.appendChild(statusG);
      nodesLayer.appendChild(createNode({ x: p.x, y: p.y, type: "client", label: `LARKTUN 客户端 ${c}`, pillW: 128 }));
    });
  }

  global.Topology = { render, svgEl, LAYOUT };
})(window);
