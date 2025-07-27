const $hours = document.getElementById('hours');
const $status = document.getElementById('status');

/* 取当前配置 */
chrome.storage.local.get({ intervalHours: 4 }, ({ intervalHours }) => {
  $hours.value = intervalHours;
});

/* 保存 */
document.getElementById('save').addEventListener('click', () => {
  const val = Number($hours.value);
  if (!val || val <= 0) {
    $status.textContent = '请输入大于 0 的数字';
    $status.style.color = 'red';
    return;
  }
  chrome.storage.local.set({ intervalHours: val }, () => {
    $status.textContent = '已保存，下次触发将按新间隔执行';
    $status.style.color = 'green';
  });
});

// 显示当前 token
const $token = document.getElementById('current_token');
chrome.storage.local.get('CURRENT_TOKEN', ({ CURRENT_TOKEN }) => {
  if ($token) {
    $token.textContent = '当前 token：' + (CURRENT_TOKEN || '无');
  }
});

// 显示 token 上次更新时间
const $tokenTime = document.getElementById('refresh_time');
chrome.storage.local.get('CURRENT_TOKEN_TIME', ({ CURRENT_TOKEN_TIME }) => {
  if ($tokenTime) {
    if (CURRENT_TOKEN_TIME) {
      const date = new Date(Number(CURRENT_TOKEN_TIME));
      $tokenTime.textContent = '上次更新时间：' + date.toLocaleString();
    } else {
      $tokenTime.textContent = '上次更新时间：无';
    }
  }
});