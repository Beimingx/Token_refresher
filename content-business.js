console.log('content-business.js loaded');
const TOKEN_EXPIRE_HOURS = 4; // token 有效期（小时）

function isTokenExpired() {
  const lastTime = localStorage.getItem('sec_token_time');
  if (!lastTime) return true;
  const expireMs = TOKEN_EXPIRE_HOURS * 60 * 60 * 1000;
  return (Date.now() - Number(lastTime)) > expireMs;
}

function writeToken(token) {
  const current = localStorage.getItem('sec_token');
  if (!current || current !== token) {
    localStorage.setItem('sec_token', token);
    localStorage.setItem('sec_token_time', Date.now().toString());
    console.log('[Aliyun-Token] token 已写入 localStorage 并刷新页面');
    location.reload();
  } else {
    console.log('[Aliyun-Token] localStorage 已有相同 sec_token，不做写入');
  }
}

// 页面初次加载时，若 localStorage 没有 sec_token 或 token 已过期，则从 chrome.storage.local 取一次
if (!localStorage.getItem('sec_token') || isTokenExpired()) {
  chrome.storage.local.get(['CURRENT_TOKEN', 'CURRENT_TOKEN_TIME'], ({ CURRENT_TOKEN, CURRENT_TOKEN_TIME }) => {
    if (CURRENT_TOKEN && CURRENT_TOKEN_TIME && !isTimestampExpired(CURRENT_TOKEN_TIME)) {
      localStorage.setItem('sec_token', CURRENT_TOKEN);
      localStorage.setItem('sec_token_time', Date.now().toString());
      location.reload();
    } else {
      // 没有 token 或 token 也过期，主动请求后台刷新
      chrome.runtime.sendMessage({ type: 'REQUEST_TOKEN' });
      console.log('[Aliyun-Token] 未检测到有效 token，已请求后台刷新 token');
    }
  });
}

// —— 监听后台推送 ——
chrome.runtime.onMessage.addListener(msg => {
  if (msg.type === 'NEW_TOKEN' && msg.token) {
    // 收到后台推送时，无论如何都写入并刷新
    localStorage.setItem('sec_token', msg.token);
    localStorage.setItem('sec_token_time', Date.now().toString());
    console.log('[Aliyun-Token] token 已被后台推送覆盖并刷新页面');
    location.reload();
  }
});

function isTimestampExpired(ts) {
  const expireMs = TOKEN_EXPIRE_HOURS * 60 * 60 * 1000;
  return (Date.now() - Number(ts)) > expireMs;
}
