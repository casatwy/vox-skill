# 发布审核恢复

在 Skill 仓库运行维护者命令。审核失败摘要包含目标版本与简短原因码。

- `tag_pushed` 下精确版本、发布者身份和文件指纹匹配，且唯一终态失败为 `security.status_not_clean` / `suspicious`：提示 `make fix-forward`，仍须通过现有完整预检与确认，不自动归档或发布。
- 审核等待或网络失败：`make publish RESUME=1`，恢复同一版本。
- 身份、文件指纹或其他终态冲突：停止并检查证据，不自动换版本。

保留恢复状态、不可变 tag 与原始子进程输出；只有 pass/clean、指纹与隔离安装验证通过才能推进远端 master。本地模拟测试不证明 ClawHub 审核通过。

Terminal-security fix-forward also supports `synced-descendant`: identical local/remote master, failed release as a strict ancestor, and changed canonical content. Confirmation rechecks all evidence and source snapshots. Private archives retain the recovery path, local/remote commits and canonical tree hash. Normal publishing checks matching archives even with identical Git pointers, and rejects source/tag/fingerprint/verdict drift. Legacy failed-head archives remain supported. This recovery change does not publish Vox.
