/* -------------------- 常量 -------------------- */
const DEFAULT_INTERVAL_HOURS = 4;          // 默认 4 小时刷新一次
const ALARM_NAME             = 'refreshToken';
const VALIDATION_ALARM_NAME  = 'validateToken';   // token验证定时器
const TOKEN_URL              = 'https://home.console.aliyun.com/home/dashboard/ProductAndService?tokenfetch=1';
const VALIDATION_INTERVAL_MINUTES = 30;    // 每30分钟验证一次token有效性

/* -------------------- 定时及安装逻辑 -------------------- */
async function getIntervalHours () {
  const { intervalHours } = await chrome.storage.local.get({ intervalHours: DEFAULT_INTERVAL_HOURS });
  return intervalHours;
}
function scheduleAlarm (hours) {
  chrome.alarms.clear(ALARM_NAME, () => {
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: hours * 60 });
    console.log('[Aliyun-Token] alarm scheduled every', hours, 'hour(s)');
  });
}

function scheduleValidationAlarm () {
  chrome.alarms.clear(VALIDATION_ALARM_NAME, () => {
    chrome.alarms.create(VALIDATION_ALARM_NAME, { periodInMinutes: VALIDATION_INTERVAL_MINUTES });
    console.log('[Aliyun-Token] validation alarm scheduled every', VALIDATION_INTERVAL_MINUTES, 'minutes');
  });
}

(async () => {
  const hrs = await getIntervalHours();
  scheduleAlarm(hrs);
  scheduleValidationAlarm();        // 启动token验证定时器
  fetchResourceCenterCookie();      // 启动即同步一次 Cookie
})();

chrome.runtime.onInstalled.addListener(d => {
  if (d.reason === 'install') chrome.storage.local.set({ intervalHours: DEFAULT_INTERVAL_HOURS });
});
chrome.storage.onChanged.addListener(ch => {
  if (ch.intervalHours) scheduleAlarm(ch.intervalHours.newValue);
});

/* -------------------- 状态变量 -------------------- */
let fetchTabs   = {};
let lastToken   = null;
let lastCookie  = null;
let retryCount  = 0;
const MAX_RETRY = 3;

/* -------------------- Token 验证和刷新 -------------------- */
async function validateToken () {
  const { CURRENT_TOKEN, CURRENT_TOKEN_TIME } = await chrome.storage.local.get(['CURRENT_TOKEN', 'CURRENT_TOKEN_TIME']);
  
  if (!CURRENT_TOKEN) {
    console.log('[Aliyun-Token] No token found, requesting new token');
    openHiddenTabToFetchToken();
    return;
  }

  // 检查token是否快过期（提前30分钟刷新）
  const tokenAge = Date.now() - (CURRENT_TOKEN_TIME || 0);
  const almostExpired = tokenAge > (3.5 * 60 * 60 * 1000); // 3.5小时
  
  if (almostExpired) {
    console.log('[Aliyun-Token] Token is about to expire, refreshing proactively');
    openHiddenTabToFetchToken();
    return;
  }

  // 使用一个简单的API验证token有效性
  try {
    const response = await fetch('https://ecs.console.aliyun.com/server/region/cn-hangzhou', {
      method: 'HEAD',
      credentials: 'include'
    });
    
    if (response.status === 401 || response.status === 403) {
      console.log('[Aliyun-Token] Token validation failed, refreshing token');
      openHiddenTabToFetchToken();
    } else {
      console.log('[Aliyun-Token] Token validation passed');
    }
  } catch (error) {
    console.log('[Aliyun-Token] Token validation request failed:', error);
  }
}

/* -------------------- 打开后台隐藏页以抓取 TOKEN -------------------- */
function openHiddenTabToFetchToken () {
  // 防止过度重试
  if (retryCount >= MAX_RETRY) {
    console.log('[Aliyun-Token] Max retry attempts reached, waiting for next scheduled refresh');
    retryCount = 0;
    return;
  }
  
  chrome.tabs.create({ url: TOKEN_URL, active: false }, tab => {
    fetchTabs[tab.id] = true;
    retryCount++;
    console.log('[Aliyun-Token] opened hidden tab id', tab.id, 'retry count:', retryCount);
  });
}

/* -------------------- 把 Cookie 真正写回浏览器存储 -------------------- */
async function writeCookiesToStore (arr = []) {
  for (const c of arr) {
    try {
      await chrome.cookies.set({
        url            : `https://${c.domain.replace(/^\./, '')}/`,
        name           : c.name,
        value          : c.value,
        path           : c.path || '/',
        secure         : !!c.secure,
        httpOnly       : !!c.httpOnly,
        sameSite       : c.sameSite || 'no_restriction',
        expirationDate : c.expirationDate,
        partitionKey   : c.partitionKey || undefined          // Chrome 118+
      });
    } catch (e) {
      console.warn('[Aliyun-Token] cookies.set failed', c.name, e);
    }
  }
  console.log('[Aliyun-Token] cookies set by extension');
}

/* -------------------- 读取浏览器里已存在的 Cookie -------------------- */
function fetchResourceCenterCookie () {
  const queryList = [
    { domain: 'aliyun.com' },
    { domain: 'aliyun.com', partitionKey: {} }               // Chrome 120+ 分区 Cookie
  ];

  const safeGetAll = (query, cb) => {
    try { chrome.cookies.getAll(query, cb); }
    catch (e) { query.partitionKey ? cb([]) : console.error(e); }
  };

  let pending = queryList.length;
  let merged  = [];

  queryList.forEach(q => safeGetAll(q, list => {
    if (list && list.length) merged = merged.concat(list);
    if (--pending === 0) handleCookies(merged);
  }));

  function handleCookies (cookies) {
    console.log('[Aliyun-Token] cookies fetched', cookies);
    if (!cookies.length) return;

    /* 根据 name 去重，保留最后一次出现的值 */
    const map = new Map();
    cookies.forEach(c => map.set(c.name, c.value));
    const cookieStr = [...map].map(([k, v]) => `${k}=${v}`).join('; ');

    if (cookieStr === lastCookie) return;
    lastCookie = cookieStr;

    /* 写入浏览器 Cookie 存储，确保包含 HttpOnly / Partitioned 字段 */
    writeCookiesToStore(cookies);

    /* 本地持久化 + 广播到业务页 */
    chrome.storage.local.set({ CURRENT_COOKIE: cookieStr, CURRENT_COOKIE_TIME: Date.now() });
    console.log('[Aliyun-Token] new COOKIE =', cookieStr);
    broadcastCookie(cookieStr, cookies);
  }
}

/* -------------------- 广播函数 -------------------- */
function getUrlPatterns () {
  const mf = chrome.runtime.getManifest();
  return {
    tokenOnly : mf.token_only_url_patterns   || [],
    tokenPlus : mf.token_cookie_url_patterns || []
  };
}
function broadcastToken (token) {
  const { tokenOnly, tokenPlus } = getUrlPatterns();
  const patterns = Array.from(new Set([...tokenOnly, ...tokenPlus]));
  patterns.forEach(p => {
    chrome.tabs.query({ url: p }, tabs => {
      tabs.forEach(t => chrome.tabs.sendMessage(t.id, { type: 'NEW_TOKEN', token }));
    });
  });
}
function broadcastCookie (cookieStr, cookieArr) {
  const { tokenPlus } = getUrlPatterns();
  tokenPlus.forEach(p => {
    chrome.tabs.query({ url: p }, tabs => {
      tabs.forEach(t => chrome.tabs.sendMessage(
        t.id,
        { type: 'NEW_COOKIE', cookieStr, cookieArr }
      ));
    });
  });
}

/* -------------------- 消息监听 -------------------- */
chrome.runtime.onMessage.addListener((msg, sender) => {
  /* content-home.js 带来了最新 TOKEN */
  if (msg.type === 'SEC_TOKEN' && msg.token) {
    if (sender.tab && fetchTabs[sender.tab.id]) {
      chrome.tabs.remove(sender.tab.id);
      delete fetchTabs[sender.tab.id];
    }
    if (msg.token !== lastToken) {
      lastToken = msg.token;
      retryCount = 0; // 重置重试计数器
      chrome.storage.local.set({ CURRENT_TOKEN: msg.token, CURRENT_TOKEN_TIME: Date.now() });
      console.log('[Aliyun-Token] new SEC_TOKEN =', msg.token);
      broadcastToken(msg.token);
      fetchResourceCenterCookie();
    }
    return;
  }

  /* 业务页把 Cookie 数组回传给后台(兼容旧业务页) */
  if (msg.type === 'WRITE_COOKIES' && Array.isArray(msg.cookies)) {
    writeCookiesToStore(msg.cookies);
    return;
  }

  /* 业务页主动请求 TOKEN / COOKIE */
  if (msg.type === 'REQUEST_TOKEN')  openHiddenTabToFetchToken();
  if (msg.type === 'REQUEST_COOKIE') fetchResourceCenterCookie();
  
  /* 业务页报告token失效 */
  if (msg.type === 'TOKEN_EXPIRED') {
    console.log('[Aliyun-Token] Business page reported token expired, refreshing immediately');
    openHiddenTabToFetchToken();
  }
});

/* -------------------- alarm 触发 -------------------- */
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === ALARM_NAME) {
    openHiddenTabToFetchToken();
    fetchResourceCenterCookie();
    console.log('[Aliyun-Token] regular alarm triggered, fetching new token and cookie');
  } else if (alarm.name === VALIDATION_ALARM_NAME) {
    validateToken();
    console.log('[Aliyun-Token] validation alarm triggered');
  }
});
