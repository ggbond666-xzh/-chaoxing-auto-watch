# 超星学习通 视频挂机助手

![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-lightgrey)
![Node](https://img.shields.io/badge/node-%E2%89%A522-brightgreen)

零依赖的 Node 脚本：用 **Chrome DevTools Protocol** 驱动你本机的浏览器，自动完成学习通网课视频的播放流程——不注入伪造数据、不改请求，只是"替你点鼠标"。

> A zero-dependency Node script that drives your own Chrome/Edge via the DevTools Protocol to keep Chaoxing (学习通) course videos playing.

---

## 功能

| 能力 | 说明 |
|---|---|
| **自动开始 / 续播** | 视频被暂停（防挂机、缓冲、误触）后自动点回播放。页面内 **1.5 秒保活钩子** + 每 **6 秒**巡检，双重保障 |
| **弹题自动作答** | 弹题出现后自动选一个选项并点击提交；选择器认不出时，只要页面上有可见的「提交」按钮也会按弹题处理 |
| **播完自动下一节** | 视频播放结束、或内容区被「章节测验」替换导致视频消失时，自动点击课程目录里的**下一节**继续播放 |
| **心跳日志** | 每 20 分钟输出一行，带本次前进秒数；出现 `⚠未推进` 才是真卡住 |
| **不做章节测验** | 故意留给你手动完成 |

## 环境要求

| 需要 | 说明 |
|---|---|
| Windows 10 / 11 | 启动器是 `.cmd` |
| Node.js ≥ 22 | 用到全局 `WebSocket` / `fetch`，装 [LTS 版](https://nodejs.org) 即可 |
| Google Chrome **或** Microsoft Edge | 启动器会自动检测常见安装路径，优先 Chrome |

## 快速开始

1. 下载本仓库（`Code` → `Download ZIP`，解压）
2. 双击 `chaoxing-auto.cmd`
3. 首次运行会自动打开一个**带调试端口、独立配置目录**的浏览器窗口（不影响你日常用的浏览器），**在这个窗口里登录学习通**
4. 登录后脚本自动接管。**关闭那个黑色命令行窗口 = 停止挂机**

## 目录结构

```
chaoxing-auto-watch/
├── chaoxing-auto.cmd          # 启动器：检测 Node/浏览器 → 起调试窗口 → 跑脚本
├── _auto-click/
│   ├── monitor.mjs            # 脚本本体（零依赖，核心就这一个文件）
│   ├── eval.mjs               # 调试小工具：在页面里执行任意 JS 并回显
│   ├── url.txt.example        # 课程地址示例（复制成 url.txt 生效）
│   ├── p/                     # 首次运行自动生成：浏览器配置+登录态（勿提交）
│   └── monitor.log            # 运行日志
├── README.md
├── README.en.md
├── LICENSE
└── .gitignore
```

## 换课程 / 换章节

把目标页面地址写进 `_auto-click\url.txt`（一行即可）：

```
https://mooc1.chaoxing.com/mycourse/studentstudy?chapterId=xxxx&courseId=xxxx...
```

不写这个文件时默认打开学习通首页 `https://i.chaoxing.com/base`，你在浏览器里手动点进课程，脚本照样接管。

## 可配置项

通过环境变量调整（可以写在 `chaoxing-auto.cmd` 里的 `set` 行）：

| 变量 | 默认值 | 作用 |
|---|---|---|
| `CDP_PORT` | `9222` | 调试端口，和启动器的 `--remote-debugging-port` 保持一致 |
| `INTERVAL_MS` | `6000` | 巡检间隔（毫秒），越小救回暂停越快、日志越密 |

心跳间隔固定 20 分钟，写在 `monitor.mjs` 的 `HB` 常量里。

## 工作原理

- 启动参数：`chrome.exe --remote-debugging-port=9222 --user-data-dir=<项目>\_auto-click\p`
  —— 用**独立配置目录**，登录态存在 `p` 里，和你日常浏览器完全隔离
- 脚本通过 CDP 连接该窗口，跨多层 iframe 定位视频模块 `ananas/modules/video`，读取并控制 `<video>` 元素
- 弹题作答与目录跳转都通过 **DOM 点击**完成；目录跳转靠节点 id 规则 `cur`+`chapterId` 找同级下一节
- 日志文件：`_auto-click\monitor.log`

## 常见问题

**Q：提示 `[ERROR] Node.js not found`？**
装 [Node.js LTS](https://nodejs.org)，安装时保持默认选项（会自动加进 PATH），装完**重新打开** cmd 窗口。

**Q：卡在「章节测验」页面不动了？**
脚本判定"视频消失 + 模块变成 work（测验）"后会跳下一节。如果卡住，多半是那一章的目录节点结构与预期不同，把 `_auto-click\monitor.log` 发出来即可定位。

**Q：视频反复"暂停→播放"？**
这是学习通的防挂机暂停，脚本 1.5 秒内会点回播放。日志里出现连续多行"自动续播"且进度不涨，才是网络/线路问题，可在播放器里换「线路」。

**Q：任务点一直显示"待完成"？**
两种常见原因：① 页面提示「今日视频观看时长已达上限」——学习通有**每日有效时长上限**，到点后继续播放不再计入；② 部分学校网页端只记时长、不更新完成状态，需要用 App 补播。

**Q：能否拖进度条快速刷完？**
不能。进度条拖动**不计入观看时长**，任务点不会完成，本脚本按 1 倍速真实播放。

**Q：想用 Edge 而不是 Chrome？**
启动器已内置 Edge 兜底（Chrome 找不到时自动用 `msedge.exe`），两者启动参数相同。

**Q：换到另一台电脑怎么用？**
复制 `chaoxing-auto.cmd` + `_auto-click`（**跳过 `p` 文件夹**，它是本机登录态，复制过去无效）→ 新电脑装 Node.js 与 Chrome/Edge → 双击启动器 → 第一次重新登录即可。

## 已知限制

- 只对**视频**章节自动跳转；纯文档 / 问卷 / 讨论章节会停下等你
- 弹题默认选第一项，**可能不是正确答案**（需要判断对错时必须人工介入）
- 依赖页面 DOM 结构，学习通前端改版可能导致选择器失效
- 平台可能检测异常行为，**请自行评估风险并遵守学校规定**

## 免责声明

本项目仅供个人学习辅助与自动化技术学习交流使用。使用本工具可能违反平台服务条款或学校规定，由此产生的一切后果由使用者自行承担。请勿用于商业用途或大规模刷课。

## License

[MIT](LICENSE)
