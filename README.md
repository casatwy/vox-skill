# vox Skill

[English](./README.en.md)

本仓库维护独立的 `vox` Skill，并生成 Codex、Claude Code、Gemini CLI 与 OpenClaw 四个平台产物。

- Skill id：`vox`
- Skill 版本：`0.1.0`
- 最低 CLI：`0.1.0`
- npm / bin：`@casatwy/vox` / `vox`
- marketplace：`vox-official`
- GitHub：`casatwy/vox-skill`
- ClawHub：`@casatwy/vox`
- 产品文档：<https://vox.reka.cc/docs>

`vox/SKILL.md` 是唯一人工编辑的 Skill 指令源，`vox/manifest.json` 是版本事实来源。`plugins/`、`skills/`、provider metadata 和 marketplace 文件均由生成器维护。

## 使用边界

Skill 只处理当前用户明确提供的一条 URL 或一个精确本地音视频文件路径，不扫描目录、不推断附件、不接受 glob、stdin、批量、特殊文件或断点续传。URL 交给服务端自动识别，不在 Skill 内维护来源 allowlist。只有用户明确选择语言时才传 `--language`。

## 用户命令

安装 CLI：

```bash
npm install -g @casatwy/vox@^0.1.0
```

隐藏式登录与状态：

```bash
vox auth login
vox auth status
vox auth logout
```

转写：

```bash
vox transcribe 'https://example.com/media'
vox transcribe --file './audio.mp3'
vox transcribe --file './recording' --mime-type audio/mpeg
```

安装和检查 Skill：

```bash
vox skill install --platform codex
vox skill install --platform claude
vox skill install --platform gemini
vox skill install --platform openclaw
vox skill status
vox skill status --platform codex
```

API key 不进入 argv 或复制命令。交互登录由 `vox auth login` 隐藏读取；自动化仅使用 `VOX_API_KEY`。Base URL 的覆盖仅用于明确的开发请求，优先级为 `--base-url`、`VOX_BASE_URL`、Vox 配置、`https://vox.reka.cc`。本地配置位于 `~/.config/vox`。

## 维护命令

```bash
pnpm install
pnpm generate
pnpm generate:check
pnpm validate
pnpm test
```

正式发布流程保留自动版本分配、恢复状态和安全验证，但本仓当前只完成本地 `0.1.0` 初始化；不得从文档命令推断发布授权。
