# MultiAI CLI

[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Docs](https://img.shields.io/badge/docs-online-blue)](https://survers.github.io/MultiAI-CLI/zh/)

[文档](https://survers.github.io/MultiAI-CLI/zh/) ·
[Issues](https://github.com/SURVERS/MultiAI-CLI/issues) ·
[English](README.md)

MultiAI CLI 是运行在终端中的 AI 编程 Agent，可以阅读和修改代码、执行命令、
检索文件、使用 Web 与 MCP 工具，并协调专注的子 Agent。MultiAI 账号通过安全
OAuth 提供托管模型目录，同时保留自定义供应商和本地插件。

## 安装

MultiAI CLI 需要 Node.js 24.15.0 或更高版本：

```sh
npm install -g @multiai/cli
multiai --version
```

Windows 还需安装 [Git for Windows](https://gitforwindows.org/)。如果 Git Bash
不在标准目录，请将 `MULTIAI_SHELL_PATH` 设为 `bash.exe` 的绝对路径。

原生构建发布在
[GitHub Releases](https://github.com/SURVERS/MultiAI-CLI/releases)。

## 登录

生产构建已包含公开的原生 OAuth client ID，可直接登录：

```sh
multiai login
```

`multiai login` 使用 Authorization Code + PKCE 和临时 loopback 监听器。
无法使用浏览器时运行 `multiai login --device`。系统 keyring 不可用且明确只想
在当前进程保留凭据时，添加 `--session-only`。

`MULTIAI_OAUTH_CLIENT_ID` 仅用于开发或 staging 覆盖。CLI 构建中不应包含
client secret。完整的安全与账号生命周期行为见
[账号与 OAuth](https://survers.github.io/MultiAI-CLI/zh/guides/account-and-oauth)。

## 快速开始

```sh
cd your-project
multiai
```

账号相关命令：

```sh
multiai account
multiai account --json
multiai logout
```

MultiAI CLI 将应用数据保存在 `~/.multiai`，从 `.multiai/local.toml` 读取项目
本地配置，并识别 `MULTIAI_*` 环境变量。旧 `kimi` 命令、设置和历史记录不会迁移。

## 编辑器集成

MultiAI CLI 通过 stdio 支持
[Agent Client Protocol](https://agentclientprotocol.com/)：

```json
{
  "agent_servers": {
    "MultiAI CLI": {
      "type": "custom",
      "command": "multiai",
      "args": ["acp"],
      "env": {}
    }
  }
}
```

详见[在 IDE 中使用](https://survers.github.io/MultiAI-CLI/zh/guides/ides)与
[`multiai acp` 参考](https://survers.github.io/MultiAI-CLI/zh/reference/multiai-acp)。

## 本地开发

环境要求：Node.js 24.15.0+、pnpm 10.33.0。

```sh
git clone https://github.com/SURVERS/MultiAI-CLI.git
cd MultiAI-CLI
pnpm install
pnpm dev:cli
```

常用检查：

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

完整贡献流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

基于 [MIT License](LICENSE) 发布。
