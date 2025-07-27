console.log('content-business.js loaded');

const TOKEN_EXPIRE_HOURS  = 4;
const COOKIE_EXPIRE_HOURS = 4;

function isTokenExpired() {
  const lastTime = localStorage.getItem('sec_token_time');
  if (!lastTime) return true;
  const expireMs = TOKEN_EXPIRE_HOURS * 60 * 60 * 1000;
  return (Date.now() - Number(lastTime)) > expireMs;
}
function isTimestampExpired(ts) {
  const expireMs = TOKEN_EXPIRE_HOURS * 60 * 60 * 1000;
  return (Date.now() - Number(ts)) > expireMs;
}

function writeToken (tok) {
  const cur = localStorage.getItem('sec_token');
  if (cur !== tok) {
    localStorage.setItem('sec_token', tok);
    localStorage.setItem('sec_token_time', Date.now());
    console.log('[Aliyun-Token] token stored');
    scheduleReload();
  }
}

/* ---------- cookie 时间 ---------- */
function isCookieExpired () {
  const t = localStorage.getItem('aliyun_cookie_time');
  return !t || Date.now() - Number(t) > COOKIE_EXPIRE_HOURS * 3600000;
}

/* ---------- 首次启动：localStorage → chrome.storage.local → 后台 ---------- */
if (!localStorage.getItem('sec_token') || isTokenExpired()) {
  chrome.storage.local.get(['CURRENT_TOKEN', 'CURRENT_TOKEN_TIME'], res => {

    /* ① chrome.storage.local 有且未过期 → 直接写入并刷新 */
    if (res.CURRENT_TOKEN && res.CURRENT_TOKEN_TIME && !isTimestampExpired(res.CURRENT_TOKEN_TIME)) {
      writeToken(res.CURRENT_TOKEN);      // 内部会调用 scheduleReload()
    }

    /* ② 仍然缺失或过期 → 向后台请求新 token */
    else {
      chrome.runtime.sendMessage({ type: 'REQUEST_TOKEN' });
      console.log('[Aliyun-Token] 未检测到有效 token，已请求后台刷新');
    }
  });
}


if (!localStorage.getItem('aliyun_cookie') || isCookieExpired())
  chrome.runtime.sendMessage({ type: 'REQUEST_COOKIE' });

/* ---------- 消息监听 ---------- */
chrome.runtime.onMessage.addListener(msg => {

  if (msg.type === 'NEW_TOKEN' && msg.token) {
    writeToken(msg.token);
  }

  if (msg.type === 'NEW_COOKIE' && msg.cookieArr) {
    /* 把 cookie 数组交给后台写入（包括 HttpOnly/分区） */
    chrome.runtime.sendMessage({ type: 'WRITE_COOKIES', cookies: msg.cookieArr });

    /* 仅做本地缓存，方便下次启动判断过期 */
    localStorage.setItem('aliyun_cookie',      msg.cookieStr);
    localStorage.setItem('aliyun_cookie_time', Date.now());
    console.log('[Aliyun-Token] cookie handed back to BG for set');
    scheduleReload();
  }
});

/* ---------- utils ---------- */
let reloadPending = false;
function scheduleReload () {
  if (reloadPending) return;
  reloadPending = true;
  setTimeout(() => location.reload(), 0);
}
