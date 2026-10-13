// 超星自动挂机脚本（省心版）
// 1) 每 20 分钟报一次心跳（是否在正常播放）
// 2) 视频弹题 -> 自动选一个选项并提交（卡住就换下一个选项）
// 3) 视频播完 -> 打开「章节测验」，自动作答并提交；90 秒后点「下一节」继续
// 4) 意外暂停 -> 自动续播
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PORT = process.env.CDP_PORT || 9222;
const INTERVAL = Number(process.env.INTERVAL_MS || 6000);
const LOG = fileURLToPath(new URL('./monitor.log', import.meta.url));

function tick() {
  const R = [];
  const now = Date.now();
  const vis = el => { const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
  const txt = el => (el.textContent || '').replace(/\s+/g, ' ').trim();
  const G = globalThis;
  const HB = 20 * 60 * 1000; // 心跳间隔 20 分钟

  // 定位视频
  const cards = (document.querySelector('#iframe') || {}).contentDocument;
  let modDoc = null, v = null, mi = null;
  if (cards) {
    mi = [...cards.querySelectorAll('iframe')].find(f => (f.src || '').includes('/ananas/modules/video/')) || null;
    if (mi) { modDoc = mi.contentDocument; if (modDoc) v = modDoc.querySelector('video'); }
  }
  const cur = v ? Math.round(v.currentTime) : -1;
  const dur = v ? Math.round(v.duration || 0) : 0;
  if (v) G.__sawVideo = true;

  const scopes = [['module', modDoc], ['cards', cards], ['top', document]];
  const pf = document.querySelector('#popFrameId');
  if (pf && pf.contentDocument) scopes.push(['pop', pf.contentDocument]);

  // 章节变化时重置状态
  const chap = (location.search.match(/chapterId=(\d+)/) || [])[1] || '';
  if (G.__chap !== chap) { G.__chap = chap; G.__endDone = false; G.__navAt = 0; G.__hbAt = 0; G.__hbCur = -1; G.__sawVideo = false; }

  // 页面内保活：一旦被暂停立刻续播（有弹题时不抢）
  if (!G.__ka) {
    G.__ka = true;
    setInterval(() => {
      try {
        const c = document.querySelector('#iframe') && document.querySelector('#iframe').contentDocument;
        if (!c) return;
        const m = [...c.querySelectorAll('iframe')].find(f => (f.src || '').includes('/ananas/modules/video/'));
        const vv = m && m.contentDocument && m.contentDocument.querySelector('video');
        if (!vv || !vv.paused) return;
        const vvVis = e => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
        const popup = [...m.contentDocument.querySelectorAll('.ans-videoquiz-box,[class*=videoquiz],[class*=quiz-box],[class*=quizBox]')].some(vvVis);
        if (!popup) vv.play();
      } catch (e) { }
    }, 1500);
  }

  // 2) 视频弹题
  let qbox = null, qscope = '';
  for (const [n, d] of scopes) {
    if (!d) continue;
    for (const s of ['.ans-videoquiz-box', '[class*=videoquiz]', '[class*=video-quiz]', '[class*=quiz-box]', '[class*=quizBox]']) {
      let e = []; try { e = [...d.querySelectorAll(s)].filter(vis); } catch (x) { }
      if (e.length) { qbox = e[0]; qscope = n; break; }
    }
    if (qbox) break;
  }
  // 弹题兜底：选择器没认出来时，只要页面上有可见的「提交/确定」按钮就按弹题处理
  if (!qbox && v && v.paused) {
    for (const [n, d] of scopes) {
      if (!d) continue;
      const sbtn = [...d.querySelectorAll('a,button,div,span')].filter(e => vis(e) && /^(提交|确定|确认)$/.test(txt(e)));
      if (!sbtn.length) continue;
      let box = sbtn[0].parentElement;
      for (let i = 0; i < 4 && box; i++) {
        const opts = [...box.querySelectorAll('li,label,[class*=opt]')].filter(vis);
        if (opts.length >= 2) { qbox = box; qscope = n + '/兜底'; break; }
        box = box.parentElement;
      }
      if (qbox) break;
    }
  }

  if (qbox) {
    const q = txt(qbox).slice(0, 120);
    if (G.__lastQ !== q) { G.__lastQ = q; G.__optIdx = 0; }
    let opts = [];
    for (const s of ['li', '[class*=opt]', '[class*=option]', 'label']) {
      const c = [...qbox.querySelectorAll(s)].filter(vis);
      if (c.length >= 2) { opts = c; break; }
    }
    const idx = opts.length ? (G.__optIdx || 0) % opts.length : 0;
    if (opts.length) { try { (opts[idx].querySelector('input') || opts[idx]).click(); } catch (e) { } }
    const sub = [...qbox.querySelectorAll('button,[class*=submit],[class*=btn],a,div')]
      .filter(e => vis(e) && /^(提交|确定|确认)$/.test(txt(e)));
    if (sub.length) { try { sub[sub.length - 1].click(); } catch (e) { } }
    G.__optIdx = idx + 1;
    R.push('弹题[' + qscope + ']「' + q.slice(0, 50) + '」选' + (idx + 1) + '/' + opts.length + (sub.length ? ' 已提交' : ' 未找到提交键'));
  }

  // 3) 章节测验：不自动作答（用户自己完成）

  // 3b) 视频结束（或视频模块整体消失，例如被章节测验顶掉）-> 目录跳转下一节
  const endedNow = (dur > 0 && cur >= dur - 1) || (G.__sawVideo && !mi);
  if (endedNow && !G.__endDone) {
    G.__endDone = true;
    G.__navAt = now + (dur > 0 && cur >= dur - 1 ? 1500 : 30000);
    R.push('✅ 视频结束 → ' + (dur > 0 && cur >= dur - 1 ? '1.5 秒后' : '30 秒后') + '目录跳转下一节');
  }
  if (G.__navAt && now > G.__navAt) {
    G.__navAt = 0;
    const cid = (location.search.match(/chapterId=(\d+)/) || [])[1] || '';
    const nodes = [...document.querySelectorAll('#coursetree .posCatalog_select')];
    const i = nodes.findIndex(n => n.id === 'cur' + cid);
    let tgt = null;
    for (let k = i + 1; i >= 0 && k < nodes.length; k++) { if (/^cur/.test(nodes[k].id)) { tgt = nodes[k]; break; } }
    if (tgt) { try { (tgt.querySelector('.posCatalog_name') || tgt).click(); R.push('→ 已目录跳转「' + txt(tgt).slice(0, 14) + '」'); } catch (e) { G.__navAt = now + 20000; R.push('→ 目录节点点击失败，20 秒后重试'); } }
    else { G.__navAt = now + 20000; R.push('→ 目录里找不到下一节节点，20 秒后重试'); }
  }

  // 4) 续播 + 心跳
  if (v) {
    if (v.paused && !qbox && (dur === 0 || cur < dur - 2)) {
      const b = modDoc && modDoc.querySelector('.vjs-big-play-button');
      try { if (b && vis(b)) b.click(); else v.play(); R.push(cur === 0 ? '自动开始播放' : '自动续播'); }
      catch (e) { R.push('续播失败'); }
    }
    if (!G.__hbAt || now - G.__hbAt >= HB) {
      const prev = G.__hbCur;
      const delta = prev >= 0 ? cur - prev : null;
      G.__hbAt = now; G.__hbCur = cur;
      R.push('心跳 ' + cur + '/' + dur + 's ' + (v.paused ? '已暂停' : '播放中')
        + (delta === null ? '' : ' Δ' + delta + 's') + (delta !== null && delta <= 5 ? ' ⚠未推进' : ''));
    }
  }

  return R.join(' ‖ ');
}

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((ok, bad) => {
    ws.addEventListener('open', ok, { once: true });
    ws.addEventListener('error', () => bad(new Error('ws-fail')), { once: true });
  });
  let id = 0; const pend = new Map();
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  });
  return {
    ws,
    send: (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); })
  };
}

const conns = new Map();
const logIt = s => {
  const line = `[${new Date().toLocaleTimeString()}] ${s}`;
  console.log(line);
  try { appendFileSync(LOG, line + '\n'); } catch (e) { }
};

logIt('挂机脚本启动 间隔=' + INTERVAL / 1000 + 's 心跳=20min 端口=' + PORT);
for (;;) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const pages = list.filter(t => t.type === 'page');
    const alive = new Set();
    for (const p of pages) {
      alive.add(p.id);
      let c = conns.get(p.id);
      if (!c) { try { c = await connect(p.webSocketDebuggerUrl); conns.set(p.id, c); } catch (e) { continue; } }
      let r = null;
      try {
        r = await c.send('Runtime.evaluate', { expression: `(${tick.toString()})()`, returnByValue: true, userGesture: true, awaitPromise: true });
      } catch (e) { try { c.ws.close(); } catch (x) { } conns.delete(p.id); continue; }
      const val = r && r.result && r.result.result ? r.result.result.value : null;
      if (val) logIt('[' + p.url.replace(/^https?:\/\/[^/]+/, '').slice(0, 26) + '] ' + val);
    }
    for (const [id, c] of [...conns]) if (!alive.has(id)) { try { c.ws.close(); } catch (e) { } conns.delete(id); }
  } catch (e) {
    logIt('ERR ' + (e && e.message ? e.message : String(e)));
  }
  await new Promise(r => setTimeout(r, INTERVAL));
}
