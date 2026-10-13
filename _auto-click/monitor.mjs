// 超星学习通 自动挂机脚本 v1.1.0
// 1) 保持视频播放：被暂停后在 1.5 秒内自动续播（页面内保活钩子 + 6 秒巡检双保险）
// 2) 视频弹题：自动选一个选项并提交（一直卡着就依次换下一个选项）
// 3) 视频播完 / 视频被「章节测验」顶掉：自动目录跳转下一节继续播放
// 4) 「章节测验」不做，留给你手动完成
// 5) 每 20 分钟输出一次心跳日志（带本次前进秒数，⚠ 表示没推进）
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const VERSION = '1.1.0';
const PORT = process.env.CDP_PORT || 9222;
const INTERVAL = Number(process.env.INTERVAL_MS || 6000);
const LOG = fileURLToPath(new URL('./monitor.log', import.meta.url));

// v1.1.0 修复：Node 版本不够时给出明确提示，而不是 "WebSocket is not defined"
if (typeof fetch !== 'function' || typeof WebSocket !== 'function') {
  console.error(`[错误] 需要 Node.js 22 或更高版本（当前 ${process.version}）。`);
  console.error('       请到 https://nodejs.org 下载安装 LTS 版本，然后重新运行。');
  process.exit(1);
}

function tick() {
  const R = [];
  const now = Date.now();
  const G = globalThis;
  const HB = 20 * 60 * 1000; // 心跳间隔 20 分钟
  const vis = el => { const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
  const txt = el => (el.textContent || '').replace(/\s+/g, ' ').trim();
  const tryPlay = vv => { try { const p = vv.play(); if (p && p.catch) p.catch(() => { }); } catch (e) { } };
  const POPUP_SEL = '.ans-videoquiz-box,[class*=videoquiz],[class*=video-quiz],[class*=quiz-box],[class*=quizBox]';
  const popupIn = d => { if (!d) return null; try { return [...d.querySelectorAll(POPUP_SEL)].find(vis) || null; } catch (e) { return null; } };

  // ---- 定位视频 ----
  const cards = (document.querySelector('#iframe') || {}).contentDocument;
  let modDoc = null, v = null, mi = null;
  if (cards) {
    mi = [...cards.querySelectorAll('iframe')].find(f => (f.src || '').includes('/ananas/modules/video/')) || null;
    if (mi) { modDoc = mi.contentDocument; if (modDoc) v = modDoc.querySelector('video'); }
  }
  const cur = v ? Math.round(v.currentTime) : -1;
  const dur = v ? Math.round(v.duration || 0) : 0;

  const scopes = [['module', modDoc], ['cards', cards], ['top', document]];
  const pf = document.querySelector('#popFrameId');
  if (pf && pf.contentDocument) scopes.push(['pop', pf.contentDocument]);

  // ---- 章节变化时重置状态（必须在 __sawVideo 赋值之前）----
  const chap = (location.search.match(/chapterId=(\d+)/) || [])[1] || '';
  if (G.__chap !== chap) {
    G.__chap = chap; G.__endDone = false; G.__navAt = 0; G.__navWarned = false;
    G.__hbAt = 0; G.__hbCur = -1; G.__sawVideo = false; G.__noVideo = 0;
  }
  if (v) G.__sawVideo = true;
  // 视频元素连续两轮消失（module 还在）也算播放结束，避免刚好错过结束瞬间
  G.__noVideo = (mi && !v) ? (G.__noVideo || 0) + 1 : 0;

  // ---- 页面内保活：一旦被暂停立刻续播（任何位置有弹题都不抢）----
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
        const docs = [m.contentDocument, c, document];
        const pf2 = document.querySelector('#popFrameId');
        if (pf2 && pf2.contentDocument) docs.push(pf2.contentDocument);
        const busy = docs.some(d => { try { return [...d.querySelectorAll('.ans-videoquiz-box,[class*=videoquiz],[class*=video-quiz],[class*=quiz-box],[class*=quizBox]')].some(vvVis); } catch (e) { return false; } });
        if (busy) return;
        const p = vv.play(); if (p && p.catch) p.catch(() => { });
      } catch (e) { }
    }, 1500);
  }

  // ---- 视频弹题 ----
  let qbox = null, qscope = '';
  for (const [n, d] of scopes) {
    const e = popupIn(d);
    if (e) { qbox = e; qscope = n; break; }
  }
  // 兜底：选择器没认出来时，只要页面上有可见的「提交/确定」按钮，且附近有 2~10 个选项，就按弹题处理
  if (!qbox && v && v.paused) {
    for (const [n, d] of scopes) {
      if (!d) continue;
      const sbtn = [...d.querySelectorAll('a,button,div,span')].filter(e => vis(e) && /^(提交|确定|确认)$/.test(txt(e)));
      if (!sbtn.length) continue;
      let box = sbtn[0].parentElement;
      for (let i = 0; i < 4 && box; i++) {
        const opts = [...box.querySelectorAll('li,label,[class*=opt]')].filter(vis);
        if (opts.length >= 2 && opts.length <= 10 && txt(box).length < 600) { qbox = box; qscope = n + '/兜底'; break; }
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
      if (c.length >= 2 && c.length <= 10) { opts = c; break; }
    }
    const idx = opts.length ? (G.__optIdx || 0) % opts.length : 0;
    if (opts.length) { try { (opts[idx].querySelector('input') || opts[idx]).click(); } catch (e) { } }
    const sub = [...qbox.querySelectorAll('button,[class*=submit],[class*=btn],a,div')]
      .filter(e => vis(e) && /^(提交|确定|确认)$/.test(txt(e)));
    // 先选中、稍后再提交（部分弹题需要间隔才注册选中状态）
    if (sub.length) setTimeout(() => { try { sub[sub.length - 1].click(); } catch (e) { } }, 800);
    G.__optIdx = idx + 1;
    R.push('弹题[' + qscope + ']「' + q.slice(0, 50) + '」选' + (idx + 1) + '/' + opts.length + (sub.length ? ' 已提交' : ' 未找到提交键'));
  }

  // ---- 视频结束（真结束 / 视频模块消失 / 视频元素连续消失）→ 目录跳转下一节 ----
  const endedNow = (dur > 0 && cur >= dur - 1) || (G.__sawVideo && (!mi || G.__noVideo >= 2));
  if (endedNow && !G.__endDone) {
    G.__endDone = true;
    G.__navAt = now + (dur > 0 && cur >= dur - 1 ? 1500 : 30000);
    R.push('✅ 视频结束 → ' + (dur > 0 && cur >= dur - 1 ? '1.5 秒后' : '30 秒后') + '目录跳转下一节');
  }

  if (G.__navAt && now > G.__navAt) {
    const cid = (location.search.match(/chapterId=(\d+)/) || [])[1] || '';
    const nodes = [...document.querySelectorAll('#coursetree .posCatalog_select')];
    const i = nodes.findIndex(n => n.id === 'cur' + cid);
    if (i < 0) {
      // 当前页不是课程主页（例如测验开在别的标签页）→ 放弃本次跳转，不刷日志
      G.__navAt = 0;
      if (!G.__navWarned) { G.__navWarned = true; R.push('ℹ️ 当前页面没有课程目录，跳过自动跳转'); }
    } else {
      G.__navAt = 0;
      let tgt = null;
      for (let k = i + 1; k < nodes.length; k++) { if (/^cur/.test(nodes[k].id)) { tgt = nodes[k]; break; } }
      if (tgt) {
        try { (tgt.querySelector('.posCatalog_name') || tgt).click(); R.push('→ 已目录跳转「' + txt(tgt).slice(0, 14) + '」'); }
        catch (e) { G.__navAt = now + 20000; R.push('→ 目录节点点击失败，20 秒后重试'); }
      } else { G.__navAt = now + 20000; R.push('→ 目录里找不到下一节节点，20 秒后重试'); }
    }
  }

  // ---- 续播 + 心跳 ----
  if (v) {
    if (v.paused && !qbox && (dur === 0 || cur < dur - 2)) {
      const b = modDoc && modDoc.querySelector('.vjs-big-play-button');
      if (b && vis(b)) { try { b.click(); R.push(cur === 0 ? '自动开始播放' : '自动续播'); } catch (e) { R.push('续播失败'); } }
      else { tryPlay(v); R.push(cur === 0 ? '自动开始播放' : '自动续播'); }
    }
    if (!G.__hbAt || now - G.__hbAt >= HB) {
      const prev = G.__hbCur;
      const delta = prev >= 0 ? cur - prev : null;
      G.__hbAt = now; G.__hbCur = cur;
      R.push('心跳 ' + cur + '/' + dur + 's ' + (v.paused ? '已暂停' : '播放中')
        + (delta === null || delta < 0 ? '' : ' Δ' + delta + 's')
        + (delta !== null && delta >= 0 && delta <= 5 ? ' ⚠未推进' : ''));
    }
  }

  return R.join(' ‖ ');
}

// v1.1.0 修复：WS 关闭/报错时拒绝所有挂起请求，并给每次调用加超时，
// 避免 await 永久挂住导致整个循环静默停摆（旧版最严重的问题）
async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((ok, bad) => {
    ws.addEventListener('open', ok, { once: true });
    ws.addEventListener('error', () => bad(new Error('ws-fail')), { once: true });
  });
  let id = 0;
  const pend = new Map();
  const failAll = err => { for (const [, p] of pend) p.reject(err); pend.clear(); };
  ws.addEventListener('message', e => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { pend.get(m.id).resolve(m); pend.delete(m.id); }
  });
  ws.addEventListener('close', () => failAll(new Error('ws-closed')));
  ws.addEventListener('error', () => failAll(new Error('ws-error')));
  return {
    ws,
    send: (method, params = {}, timeoutMs = 12000) => new Promise((resolve, reject) => {
      const i = ++id;
      const timer = setTimeout(() => { pend.delete(i); reject(new Error('cdp-timeout')); }, timeoutMs);
      pend.set(i, {
        resolve: m => { clearTimeout(timer); resolve(m); },
        reject: e => { clearTimeout(timer); reject(e); }
      });
      try { ws.send(JSON.stringify({ id: i, method, params })); }
      catch (e) { clearTimeout(timer); pend.delete(i); reject(e); }
    })
  };
}

const conns = new Map();
const logIt = s => {
  const line = `[${new Date().toLocaleTimeString()}] ${s}`;
  console.log(line);
  try { appendFileSync(LOG, line + '\n'); } catch (e) { }
};

logIt(`挂机脚本 v${VERSION} 启动 | 端口=${PORT} 巡检=${INTERVAL / 1000}s 心跳=20min`);

let failCount = 0; // v1.1.0：浏览器关掉后不再每轮刷 ERR
for (;;) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`, { signal: AbortSignal.timeout(5000) })).json();
    if (failCount >= 3) logIt('✅ 已重新连上调试端口');
    failCount = 0;
    const pages = list.filter(t => t.type === 'page');
    const alive = new Set();
    for (const p of pages) {
      alive.add(p.id);
      let c = conns.get(p.id);
      if (!c) { try { c = await connect(p.webSocketDebuggerUrl); conns.set(p.id, c); } catch (e) { continue; } }
      let r = null;
      try {
        r = await c.send('Runtime.evaluate', { expression: `(${tick.toString()})()`, returnByValue: true, userGesture: true, awaitPromise: true });
      } catch (e) {
        try { c.ws.close(); } catch (x) { }
        conns.delete(p.id);
        continue;
      }
      const val = r && r.result && r.result.result ? r.result.result.value : null;
      if (val) logIt('[' + p.url.replace(/^https?:\/\/[^/]+/, '').slice(0, 26) + '] ' + val);
    }
    for (const [tid, c] of [...conns]) if (!alive.has(tid)) { try { c.ws.close(); } catch (e) { } conns.delete(tid); }
  } catch (e) {
    failCount++;
    if (failCount === 3) logIt('⚠️ 连不上调试端口（浏览器关了？）—— 会继续重试，不再重复刷日志。错误：' + (e && e.message ? e.message : String(e)));
  }
  await new Promise(r => setTimeout(r, failCount >= 3 ? 30000 : INTERVAL));
}
