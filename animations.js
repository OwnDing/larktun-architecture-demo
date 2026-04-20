/* animations.js - 数据包动画与场景编排 */
(function (global) {
  const { svgEl } = global.Topology;

  // 活动数据包集合
  const packets = [];
  let rafId = null;

  function now() { return performance.now(); }

  // 单次从 from 飞到 to 的数据包动画
  function sendPacket({ from, to, color = "#5b8bff", duration = 700, size = 5, onDone, loop = false }) {
    const layer = document.getElementById("layer-packets");
    const circle = svgEl("circle", {
      class: "packet", r: size, cx: from.x, cy: from.y,
      fill: color, style: `color:${color}`,
    });
    layer.appendChild(circle);
    const p = {
      el: circle, from, to, color, duration, loop,
      start: now(), onDone, size,
    };
    packets.push(p);
    if (!rafId) rafId = requestAnimationFrame(tick);
    updateFlowCount();
    return p;
  }

  function tick() {
    const t = now();
    for (let i = packets.length - 1; i >= 0; i--) {
      const p = packets[i];
      let progress = (t - p.start) / p.duration;
      if (progress >= 1) {
        if (p.loop && !p.stopped) {
          p.start = t;
          progress = 0;
        } else {
          p.el.remove();
          packets.splice(i, 1);
          if (p.onDone) p.onDone();
          continue;
        }
      }
      const x = p.from.x + (p.to.x - p.from.x) * progress;
      const y = p.from.y + (p.to.y - p.from.y) * progress;
      p.el.setAttribute("cx", x);
      p.el.setAttribute("cy", y);
    }
    updateFlowCount();
    if (packets.length > 0) rafId = requestAnimationFrame(tick);
    else rafId = null;
  }

  function updateFlowCount() {
    const el = document.getElementById("flow-count");
    if (el) el.textContent = String(packets.length);
  }

  // 清理全部数据包与循环任务
  function clearPackets() {
    packets.forEach((p) => {
      p.stopped = true;
      p.el.remove();
    });
    packets.length = 0;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    updateFlowCount();
    // 同时清理已注册的持续任务
    clearLoops();
  }

  // 持续循环任务（直连/中继）管理
  const loops = [];
  function registerLoop(cancelFn) { loops.push(cancelFn); }
  function clearLoops() {
    loops.forEach((fn) => fn && fn());
    loops.length = 0;
  }

  // 顺序执行多步数据包，返回 Promise
  function playSequence(steps) {
    return steps.reduce((promise, step) => {
      return promise.then(
        () => new Promise((resolve) => {
          sendPacket({ ...step, onDone: resolve });
        })
      );
    }, Promise.resolve());
  }

  // 场景一：登录信令流
  // client -> SAAS -> HS -> SAAS -> client -> HS -> client
  function runLoginSequence(state, clientKey) {
    const pos = state.positions;
    const client = clientKey === "A" ? pos.clientA : pos.clientB;
    const saas = pos.saas;
    // 随机挑一个 HS（保持一致性，这里选最接近客户端的）
    const hsIdx = Math.min(state.hsCount - 1, Math.floor(state.hsCount / 2));
    const hs = pos.hs[hsIdx];

    const blue = "#5b8bff";
    const green = "#22c55e";

    return playSequence([
      { from: client, to: saas, color: blue, duration: 700 },
      { from: saas, to: hs, color: blue, duration: 650 },
      { from: hs, to: saas, color: blue, duration: 650 },
      { from: saas, to: client, color: blue, duration: 700 },
      { from: client, to: hs, color: blue, duration: 700 },
      { from: hs, to: client, color: green, duration: 700 },
    ]);
  }

  // 在一条路径上持续循环发送数据包
  function startLoopingFlow(waypoints, { color, color2, duration = 900, interval = 350 }) {
    let stopped = false;
    let timer = null;
    const colorSeq = color2 ? [color, color2] : [color];
    let idx = 0;

    function emit() {
      if (stopped) return;
      const c = colorSeq[idx++ % colorSeq.length];
      // 沿多个 waypoint 逐段飞行
      (function hop(i) {
        if (stopped || i >= waypoints.length - 1) return;
        sendPacket({
          from: waypoints[i], to: waypoints[i + 1], color: c,
          duration: duration / (waypoints.length - 1),
          onDone: () => hop(i + 1),
        });
      })(0);
      timer = setTimeout(emit, interval);
    }
    emit();

    const cancel = () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
    registerLoop(cancel);
    return cancel;
  }

  global.Animations = {
    sendPacket, playSequence, clearPackets, runLoginSequence, startLoopingFlow,
  };
})(window);
