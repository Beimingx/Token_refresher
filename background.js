const DEFAULT_INTERVAL_HOURS = 4;       // 默认 4 小时刷新一次
const ALARM_NAME = 'refreshToken';

/* 读取用户配置的间隔 */
async function getIntervalHours () {
  const { intervalHours } = await chrome.storage.local.get({ intervalHours: DEFAULT_INTERVAL_HOURS });
  return intervalHours;
}

/* 建立 / 更新 alarm */
function scheduleAlarm (hours) {
  chrome.alarms.clear(ALARM_NAME, () => {
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: hours * 60 });
    console.log('[Aliyun-Token] alarm scheduled every', hours, 'hour(s)');
  });
}

/* 安装或启动时立即安排 alarm */
(async () => {
  const hrs = await getIntervalHours();
  scheduleAlarm(hrs);
})();

/* 首次安装：写入默认值 */
chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') {
    chrome.storage.local.set({ intervalHours: DEFAULT_INTERVAL_HOURS });
  }
});

/* 用户在 popup 里改了间隔 → 重新排 alarm */
chrome.storage.onChanged.addListener(changes => {
  if (changes.intervalHours) {
    scheduleAlarm(changes.intervalHours.newValue);
  }
});

let currentFetchTabId = null;   // 记录由扩展自动打开的“取 token” tab
let lastToken = null;           // 避免同一个 token 重复广播
let fetchTabs = {};

function openHiddenTabToFetchToken () {
  const url = 'https://home.console.aliyun.com/home/dashboard/ProductAndService?tokenfetch=1';
  chrome.tabs.create({ url, active: false }, tab => {
    fetchTabs[tab.id] = true; // 只记录 tab id
    console.log('[Aliyun-Token] opened hidden tab id', tab.id);
  });
}

// 合并 onMessage 监听，避免误关用户 tab
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SEC_TOKEN' && msg.token) {
    const token = msg.token;
    // 同一个 token 不必再处理
    if (token === lastToken) return;

    lastToken = token;
    chrome.storage.local.set({ CURRENT_TOKEN: token });
    console.log('[Aliyun-Token] new SEC_TOKEN =', token);

    // 广播给所有业务页；忽略 “Receiving end” 错误
    const BROADCAST_URL_PATTERNS = [
      'http://my.console.aliyun.com:3333/overview',
      'https://pre-saenext.console.aliyun.com/overview'
    ];
    BROADCAST_URL_PATTERNS.forEach(pattern => {
      chrome.tabs.query({ url: pattern }, tabs => {
        tabs.forEach(t => {
          chrome.tabs.sendMessage(
            t.id,
            { type: 'NEW_TOKEN', token },
            () => {} // callback 必须给，否则 lastError 报警
          );
        });
      });
    });

    // 只关闭插件自动打开的 tab
    if (sender.tab && fetchTabs[sender.tab.id]) {
      chrome.tabs.remove(sender.tab.id);
      delete fetchTabs[sender.tab.id];
    }
  }
  if (msg.type === 'REQUEST_TOKEN') {
    openHiddenTabToFetchToken();
  }
});


/* alarm 触发 → 打开隐藏 tab 去取新 token */
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === ALARM_NAME) openHiddenTabToFetchToken();
});