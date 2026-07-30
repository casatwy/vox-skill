# vox Skill 0.1.0

- Introduce the independent `vox` Skill for Codex, Claude Code, Gemini CLI, and OpenClaw.
- Require `@casatwy/vox` CLI 0.1.0 and explicit `vox transcribe` commands for one user-provided URL or one exact local file.
- Keep interactive API keys out of argv, isolate configuration under `~/.config/vox`, and use only `VOX_API_KEY` for automation.
- Generate consistent `vox-official`, `casatwy/vox-skill`, and `@casatwy/vox` provider metadata.
