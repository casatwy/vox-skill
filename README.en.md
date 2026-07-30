# vox Skill

[中文](./README.md)

This repository maintains the independent `vox` Skill and generates artifacts for Codex, Claude Code, Gemini CLI, and OpenClaw.

- Skill id: `vox`
- Skill version: `0.1.0`
- Minimum CLI: `0.1.0`
- npm / bin: `@casatwy/vox` / `vox`
- Marketplace: `vox-official`
- GitHub: `casatwy/vox-skill`
- ClawHub: `@casatwy/vox`
- Product docs: <https://vox.reka.cc/docs>

`vox/SKILL.md` is the only hand-edited Skill instruction source. `vox/manifest.json` is the version source of truth. The generator owns `plugins/`, `skills/`, provider metadata, and marketplace files.

## Usage boundary

The Skill handles exactly one URL or one exact local audio/video file path supplied in the current request. It does not scan directories, infer attachments, or accept globs, stdin, batches, special files, or resumable uploads. URLs are passed to server-side automatic detection; the Skill does not maintain a source allowlist. It adds `--language` only when the user explicitly selects a language.

## User commands

Install the CLI:

```bash
npm install -g @casatwy/vox@^0.1.0
```

Use hidden-input login and inspect status:

```bash
vox auth login
vox auth status
vox auth logout
```

Transcribe:

```bash
vox transcribe 'https://example.com/media'
vox transcribe --file './audio.mp3'
vox transcribe --file './recording' --mime-type audio/mpeg
```

Install or inspect the Skill:

```bash
vox skill install --platform codex
vox skill install --platform claude
vox skill install --platform gemini
vox skill install --platform openclaw
vox skill status
vox skill status --platform codex
```

API keys never belong in argv or copied commands. `vox auth login` reads an interactive key through hidden input; automation uses only `VOX_API_KEY`. Base URL overrides are for explicit development requests only, in this order: `--base-url`, `VOX_BASE_URL`, Vox configuration, then `https://vox.reka.cc`. Local configuration lives under `~/.config/vox`.

## Maintainer commands

```bash
pnpm install
pnpm generate
pnpm generate:check
pnpm validate
pnpm test
```

The release workflow retains automatic version allocation, recovery state, and security verification. This repository currently contains only the local `0.1.0` initialization; documentation does not authorize a release.
