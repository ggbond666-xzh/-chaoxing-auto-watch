# 超星学习通 视频挂机助手

A zero-dependency Node script that drives your own Chrome via the DevTools Protocol to keep Chaoxing (学习通) course videos playing automatically.

零依赖的 Node 脚本：用 Chrome DevTools Protocol 驱动你本机的 Chrome，自动完成学习通网课视频的播放流程。

## 功能

- **自动开始 / 续播**：视频被暂停（防挂机、缓冲、误触）后自动点回播放。页面内 1.5 秒保活钩子 + 每 6 秒巡检双重保障
- **弹题自动作答**：视频弹题出现后自动选一个选项并点击提交（**默认选第一个选项，不判断对错**）；选择器认不出时，只要页面上有可见的「提交」按钮也会按弹题处理
- **播完自动下一节**：视频播放结束、或内容区被「章节测验」替换导致视频消失时，自动点击课程目录里的**下一节**继续播放
- **心跳日志**：每 20 分钟输出一行，带本次前进秒数；出现 `⚠未推进` 就是真卡住了
- **不做章节测验**：留给你手动完成

## 环境要求

| 需要 | 说明 |
|---|---|
| Windows 10 / 11 | 启动器是 `.cmd` |
| Node.js ≥ 22 | 用到全局 `WebSocket` / `fetch`，装 LTS 版即可：https://nodejs.org |
| Google Chrome | 脚本会自动检测几个常见安装路径 |

## 快速开始

1. 下载本仓库（`Code` → `Download ZIP`，解压）
2. 双击 `chaoxing-auto.cmd`
3. 首次运行会自动打开一个**带调试端口、独立配置目录**的 Chrome 窗口（不影响你日常用的浏览器），**在这个窗口里登录学习通**
4. 登录后脚本自动接管。**关闭那个黑色命令行窗口 = 停止挂机**

## 换课程 / 换章节

把目标页面地址写进 `_auto-click\url.txt`（一行即可）：

```
https://mooc1.chaoxing.com/mycourse/studentstudy?chapterId=xxxx&courseId=xxxx...
```

不写这个文件时默认打开学习通首页 `https://i.chaoxing.com/base`，你在浏览器里手动点进课程，脚本照样接管。

## 工作原理

- 启动参数：`chrome.exe --remote-debugging-port=9222 --user-data-dir=<本目录>\_auto-click\p`，用独立配置目录，登录态保存在 `p` 里（**不要提交到 Git**）
- 脚本通过 CDP 连接该窗口，跨 iframe 定位视频模块 `ananas/modules/video`，读取并控制 `<video>` 元素
- 弹题作答与目录跳转都通过 DOM 点击完成，**不修改任何请求、不注入伪造数据**
- 日志文件：`_auto-click\monitor.log`

## 已知限制

- 只对**视频**章节自动跳转；纯文档 / 问卷 / 讨论章节会停下等你
- 弹题默认选第一项，可能不是正确答案（需要判断对错时改成人工介入）
- 学习通有**每日有效观看时长上限**（页面会提示「今日视频观看时长已达上限」），达到后继续播放不再计入任务点
- 部分学校网页端只记时长、不更新完成状态，这种情况需要用 App 补播
- 拖动进度条**不会**被计入观看时长，本脚本按 1 倍速真实播放

## 免责声明

本项目仅供个人学习辅助与自动化技术学习交流使用。使用本工具可能违反平台服务条款或学校规定，由此产生的一切后果由使用者自行承担。请勿用于商业用途或大规模刷课。

## License

MIT
