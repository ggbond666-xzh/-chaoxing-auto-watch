# Chaoxing Auto-Watch

![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-lightgrey)
![Node](https://img.shields.io/badge/node-%E2%89%A522-brightgreen)

A **zero-dependency** Node script that drives your own Chrome/Edge browser through the **Chrome DevTools Protocol** to keep Chaoxing (超星学习通) course videos playing automatically.

It does not intercept or forge any network request — it simply clicks the page for you.

## Features

- **Auto start / resume** — if the video gets paused (anti-idle checks, buffering, accidental clicks) the script clicks play again. A 1.5 s in-page keep-alive hook plus a 6 s polling loop.
- **Auto answer pop-up questions** — when a mid-video quiz appears, it picks an option and clicks submit. Falls back to "any visible 提交 button" when the known selectors do not match.
- **Auto advance to the next section** — when a video ends (or the content area is replaced by the chapter quiz), it clicks the next item in the course catalog so playback continues.
- **Heartbeat log** — one line every 20 minutes, including how many seconds of video actually elapsed. `⚠未推进` means it is genuinely stuck.
- **Chapter quizzes are left to you** on purpose.

## Requirements

| Need | Notes |
|---|---|
| Windows 10 / 11 | The launcher is a `.cmd` file |
| Node.js ≥ 22 | Uses global `WebSocket` / `fetch`; install the [LTS build](https://nodejs.org) |
| Google Chrome **or** Microsoft Edge | The launcher auto-detects the usual install paths, Chrome first |

## Quick start

1. Download this repository (`Code` → `Download ZIP`) and extract it.
2. Double-click `chaoxing-auto.cmd`.
3. On first run it opens a browser window with a **debug port and a dedicated profile directory** (your everyday browser is untouched). **Log in to Chaoxing in that window.**
4. The script takes over automatically. **Closing the black console window stops it.**

## Changing course / chapter

Put the target URL into `_auto-click\url.txt` (a single line). If the file is missing, the launcher opens the Chaoxing home page instead — just click into any course and the script will take over.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `CDP_PORT` | `9222` | Debugging port; must match the launcher flag |
| `INTERVAL_MS` | `6000` | Polling interval in milliseconds |

## How it works

- Launch flags: `chrome.exe --remote-debugging-port=9222 --user-data-dir=<project>\_auto-click\p` — a dedicated profile keeps your login state isolated from your daily browser.
- The script connects over CDP, walks nested iframes to find the video module (`ananas/modules/video`) and controls the `<video>` element.
- Pop-up answers and catalog navigation are plain **DOM clicks**. Catalog advancement uses the node-id convention `cur` + `chapterId` to locate the next sibling section.
- Log file: `_auto-click\monitor.log`.

## FAQ

**`[ERROR] Node.js not found`** — install Node.js LTS with default options, then reopen the console window.

**Stuck on the chapter quiz page** — the script advances when the video module is replaced by the `work` module. If it gets stuck, the catalog structure of that chapter differs; open an issue with `_auto-click\monitor.log`.

**Video keeps pausing and resuming** — that is Chaoxing's anti-idle pause; the script clicks play again within 1.5 s. Continuous "自动续播" lines with no progress usually mean a network/route problem — switch the player's 线路 setting.

**Task point never completes** — either the daily watch-time cap was hit ("今日视频观看时长已达上限"), or your school only records time on the web build and you need the mobile app once.

**Can I just drag the progress bar?** — No. Dragging is not counted as watch time; this script plays at 1× speed for that reason.

**Which browser?** — Chrome is preferred, Edge is used as a fallback (same flags).

## Known limitations

- Only **video** sections auto-advance; document / survey / discussion sections are left to you.
- Pop-up questions are answered with the **first option** — it may be wrong.
- Depends on page DOM structure; a Chaoxing front-end update may break the selectors.

## Disclaimer

For personal study assistance and automation learning only. Using this tool may violate the platform's terms of service or your school's rules. You are solely responsible for any consequences. Do not use it commercially or for bulk course farming.

## License

[MIT](LICENSE)
