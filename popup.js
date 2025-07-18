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

// 显示当前 token 和更新时间
chrome.storage.local.get(['CURRENT_TOKEN'], ({ CURRENT_TOKEN }) => {
  const $token = document.getElementById('current_token');
  if ($token) {
    $token.textContent = CURRENT_TOKEN || '无';
  }
  const $update = document.getElementById('update_time');
  if ($update) {
    const t = localStorage.getItem('sec_token_update_time');
    $update.textContent = t ? new Date(Number(t)).toLocaleString() : '未知';
  }
});
