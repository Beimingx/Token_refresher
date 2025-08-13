# Aliyun SEC_TOKEN Auto Refresher

一个自动获取和刷新阿里云 SEC_TOKEN 和 Cookie 的 Chrome 浏览器扩展程序。

## 🚀 功能特性

- **自动 Token 刷新**：定时从阿里云控制台获取最新的 SEC_TOKEN
- **Cookie 自动同步**：自动抓取并同步阿里云相关的 Cookie 信息
- **多环境支持**：支持生产环境、测试环境和本地开发环境
- **智能验证**：定时验证 Token 有效性，提前刷新过期 Token
- **自动注入**：将获取的 Token 和 Cookie 自动注入到指定的业务页面
- **可配置间隔**：支持自定义刷新间隔时间（1-24小时）
- **重试机制**：内置重试逻辑，确保 Token 获取的可靠性

## 🎯 适用场景

- 阿里云控制台开发调试
- SAE（Serverless 应用引擎）本地开发

## 📦 安装方式

### 1. 下载源码
```bash
git clone <repository-url>
cd sae_token_refresher
```

### 2. 加载到 Chrome
1. 打开 Chrome 浏览器，访问 `chrome://extensions/`
2. 开启右上角的"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择项目文件夹

### 3. 配置权限
扩展安装后会自动获取必要的权限，包括：
- 存储权限（storage）
- 定时器权限（alarms）
- 标签页管理（tabs）
- 脚本注入（scripting）
- Cookie 访问（cookies）

## ⚙️ 配置说明

### 支持的域名范围

#### Token 获取源
- `https://home.console.aliyun.com/*` - 阿里云控制台主页

#### Token 注入目标（仅注入 Token）
- `http://my.console.aliyun.com:3333/*`
- `http://localhost:3333/*`

#### Cookie + Token 注入目标
- `http://localhost:3334/*`
- `http://my.console.aliyun.com:3334/*`

### 配置选项

点击浏览器工具栏中的扩展图标，可以配置：

- **刷新间隔**：设置 Token 自动刷新的时间间隔（默认 4 小时）
- **状态查看**：查看当前 Token 状态和上次更新时间


## 🔧 自定义域名配置

如果需要为扩展添加新的域名支持，需要修改 `manifest.json` 文件中的相关配置：

### 1. 添加新的访问权限

在 `host_permissions` 数组中添加新域名：

```json
"host_permissions": [
  "https://home.console.aliyun.com/*",
  "http://my.console.aliyun.com:3333/*",
  "http://localhost:3333/*",
  "http://localhost:3334/*",
  "https://*.aliyun.com/*",
  "https://your-new-domain.com/*"  // 添加新域名
]
```

### 2. 配置 Token 注入范围

根据需要将新域名添加到对应的数组中：

#### 仅注入 Token 的域名
```json
"token_only_url_patterns": [
  "http://my.console.aliyun.com:3333/*",
  "http://localhost:3333/*",
  "https://your-new-domain.com/api/*"  // 添加新域名
]
```

#### 同时注入 Token 和 Cookie 的域名
```json
"token_cookie_url_patterns": [
  "http://localhost:3334/*",
  "http://my.console.aliyun.com:3334/*",
  "https://your-new-domain.com/admin/*"  // 添加新域名
]
```

### 3. 添加 Content Script 支持

如果新域名需要运行 content script，在 `content_scripts` 数组中添加配置：

```json
{
  "matches": [
    "http://my.console.aliyun.com:3333/*",
    "http://my.console.aliyun.com:3334/*",
    "http://localhost:3333/*",
    "http://localhost:3334/*",
    "https://your-new-domain.com/*"  // 添加新域名
  ],
  "js": ["content-business.js"],
  "run_at": "document_idle",
  "all_frames": true
}
```

### 4. 重新加载扩展

修改配置后需要：
1. 在 `chrome://extensions/` 页面找到扩展
2. 点击"重新加载"按钮
3. 如果添加了新的权限，可能需要重新授权

### ⚠️ 注意事项

- 确保新添加的域名是你有权访问的
- 添加通配符域名（如 `*`）可能带来安全风险
- 生产环境建议使用具体的域名而非通配符
- 某些企业环境可能限制扩展的域名访问权限
  
## 🔧 工作原理

### 1. Token 获取流程
1. 定时打开阿里云控制台隐藏标签页
2. 通过 content script 从页面脚本中提取 SEC_TOKEN
3. 将 Token 存储到本地并广播给业务页面
4. 自动关闭隐藏标签页

### 2. Cookie 同步机制
1. 从浏览器 Cookie 存储中读取阿里云相关的 Cookie
2. 处理 HttpOnly 和分区 Cookie
3. 去重并格式化 Cookie 字符串
4. 广播到需要 Cookie 的业务页面

### 3. 验证和重试
- 每 30 分钟验证一次 Token 有效性
- Token 过期前 30 分钟主动刷新
- 最大重试 3 次，防止过度请求

## 📁 项目结构

```
sae_token_refresher/
├── manifest.json          # 扩展清单文件
├── background.js          # 后台服务脚本（主要逻辑）
├── content-home.js        # 阿里云控制台页面内容脚本
├── content-business.js    # 业务页面内容脚本
├── popup.html            # 扩展弹窗界面
├── popup.js              # 弹窗交互脚本
└── README.md             # 项目说明文档
```

### 核心文件说明

- **`background.js`**: 扩展的核心逻辑，负责定时任务、Token 获取、Cookie 同步和消息中转
- **`content-home.js`**: 在阿里云控制台页面运行，提取 SEC_TOKEN
- **`content-business.js`**: 在业务页面运行，接收并使用 Token/Cookie
- **`popup.js`**: 处理扩展设置界面的用户交互

## 🔄 消息通信机制

扩展内部使用 Chrome Extension Message API 进行通信：

### 消息类型
- `SEC_TOKEN`: content-home 向 background 发送获取到的 Token
- `NEW_TOKEN`: background 向业务页面广播新 Token
- `NEW_COOKIE`: background 向业务页面广播新 Cookie
- `REQUEST_TOKEN`: 业务页面请求刷新 Token
- `REQUEST_COOKIE`: 业务页面请求刷新 Cookie
- `TOKEN_EXPIRED`: 业务页面报告 Token 已过期

## ⚠️ 注意事项

1. **权限要求**: 扩展需要访问阿里云相关域名，请确保在企业环境中获得相应授权
2. **网络依赖**: 需要能够正常访问阿里云控制台
3. **版本兼容**: 基于 Manifest V3，需要 Chrome 88+ 版本
4. **安全性**: Token 仅在本地存储，不会上传到任何服务器

## 🐛 故障排除

### Token 获取失败
1. 检查是否能正常访问阿里云控制台
2. 确认浏览器已登录阿里云账号

### Cookie 同步问题
1. 确认目标页面 URL 在配置的域名范围内
2. 检查浏览器 Cookie 设置是否正常

## 📝 版本历史

### v1.0.0
- 初始版本发布
- 支持基本的 Token 自动刷新功能
- 支持多环境配置
- 添加 Token 验证机制

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- 提交 Issue
- 发起 Pull Request

---

**⚡ 让阿里云开发更高效！**
