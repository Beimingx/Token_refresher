console.log('content-business.js loaded');
function writeToken(token) {
  const current = localStorage.getItem('sec_token');
  if (!current) {
    localStorage.setItem('sec_token', token);
    console.log('[Aliyun-Token] token 已写入 localStorage 并刷新页面');
    location.reload();
  } else if (current !== token) {
    localStorage.setItem('sec_token', token);
    console.log('[Aliyun-Token] token 已更新并刷新页面');
    location.reload();
  } else {
    console.log('[Aliyun-Token] localStorage 已有相同 sec_token，不做写入');
  }
}

// 页面初次加载时，若 localStorage 没有 sec_token，则从 chrome.storage.local 取一次
if (!localStorage.getItem('sec_token')) {
  chrome.storage.local.get('CURRENT_TOKEN', ({ CURRENT_TOKEN }) => {
    if (CURRENT_TOKEN) {
      localStorage.setItem('sec_token', CURRENT_TOKEN);
      location.reload();
    } else {
      // 没有 token，主动请求后台刷新
      chrome.runtime.sendMessage({ type: 'REQUEST_TOKEN' });
      console.log('[Aliyun-Token] 未检测到 token，已请求后台刷新 token');
    }
  });
}

// —— 监听后台推送 ——
chrome.runtime.onMessage.addListener(msg => {
  if (msg.type === 'NEW_TOKEN' && msg.token) {
    // 收到后台推送时，无论如何都写入并刷新
    localStorage.setItem('sec_token', msg.token);
    console.log('[Aliyun-Token] token 已被后台推送覆盖并刷新页面');
    location.reload();
  }
});
