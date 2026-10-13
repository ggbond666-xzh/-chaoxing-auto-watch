// 用法: node eval.mjs "<JS表达式>"   —— 通过调试端口在目标页面里执行并返回结果
const expr = process.argv.slice(2).join(' ');
const PORT = process.env.CDP_PORT || 9222;
const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
const pages = list.filter(t => t.type === 'page');
const page = pages.find(t => t.url.includes('chaoxing')) || pages[0];
if (!page) { console.log('NO_PAGE'); process.exit(2); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((ok, bad) => {
  ws.addEventListener('open', ok, { once: true });
  ws.addEventListener('error', () => bad(new Error('ws error')), { once: true });
});
let id = 0; const pend = new Map();
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
});
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true, userGesture: true });
const out = r.result && r.result.exceptionDetails ? ('EXCEPTION: ' + JSON.stringify(r.result.exceptionDetails.exception)) : (r.result && r.result.result ? r.result.result.value : r);
console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 1));
ws.close();
