/*
  运行环境：content script（隔离世界）。
  思路：不注入任何 <script>，而是遍历当前文档里所有 <script> 标签的 textContent，
        用正则把 SEC_TOKEN 拿出来，绕过 CSP。
*/

(function findToken() {
    if (window.__ALIYUN_TOKEN_SENT__) return;        // 防重复
  window.__ALIYUN_TOKEN_SENT__ = true;
  const LOG_PREFIX = '[Aliyun-Token][content-home]';

  function debug(...args) {
    console.log(LOG_PREFIX, ...args);
  }

  /* 提取函数：返回 token 字符串或 null */
  function extractFromScripts() {
    const scripts = document.querySelectorAll('script');
    const regexp = /SEC_TOKEN\s*[:=]\s*["']([A-Za-z0-9\-_]+)["']/;

    for (const s of scripts) {
      if (!s.textContent) continue;
      const m = s.textContent.match(regexp);
      if (m && m[1]) {
        debug('token extracted from a <script>');
        return m[1];
      }
    }
    return null;
  }

  /* 主逻辑：最多轮询 5 秒，100ms 一次 */
  let retry = 0;
  const maxRetry = 50; // 50 * 100ms = 5 秒
  const timer = setInterval(() => {
    const token = extractFromScripts();
    if (token) {
      debug('Found SEC_TOKEN =', token);
      chrome.runtime.sendMessage({ type: 'SEC_TOKEN', token });
      clearInterval(timer);
    } else if (++retry >= maxRetry) {
      debug('Failed to find SEC_TOKEN after 5 seconds');
      clearInterval(timer);
    }
  }, 100);
})();
