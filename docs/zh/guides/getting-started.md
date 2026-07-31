# 开始使用

## MultiAI CLI 是什么

MultiAI CLI 是一个运行在终端中的 AI Agent，帮助你完成软件开发任务和日常的终端操作——阅读和修改代码、执行 Shell 命令、搜索文件、抓取网页，并在执行过程中根据反馈自主规划和调整下一步行动。

它适用于以下场景：

- **编写和修改代码**：实现新功能、修复 bug、完成重构
- **理解项目**：探索陌生的代码库，解答架构和实现层面的问题
- **自动化任务**：批量处理文件、运行构建与测试、串联多个脚本

整套 CLI 以 TypeScript 编写，通过 npm 分发，运行在 Node.js 之上。

## 安装

可以通过 npm 全局安装，或从 GitHub Releases 下载原生构建。

::: tip 安装之前
MultiAI CLI 为全交互式 TUI 应用，推荐在支持真彩色与连字的现代终端中运行以获得最佳体验，例如 [Kitty](https://sw.kovidgoyal.net/kitty/) 或 [Ghostty](https://ghostty.org/)。
:::

### npm 安装

需要 Node.js 24.15.0 或更高版本：

```sh
node --version
npm install -g @multiai/cli
```

或用 pnpm：

```sh
pnpm add -g @multiai/cli
```

原生构建可从
[GitHub Releases](https://github.com/SURVERS/MultiAI-CLI/releases) 下载。

> Windows 用户首次启动前还需要安装 [Git for Windows](https://gitforwindows.org/)，MultiAI CLI 会使用其中的 Git Bash 作为 Shell 环境。如果 Git Bash 安装在非标准路径，请把 `MULTIAI_SHELL_PATH` 设为 `bash.exe` 的绝对路径。

## 升级与卸载

安装完成后，验证可执行文件是否就绪：

```sh
multiai --version
```

**升级**：运行 `multiai upgrade`，CLI 会检查最新版本并展示更新选项。选择 `Install update now` 后根据当前安装来源执行升级；也可以直接用包管理器：

```sh
npm install -g @multiai/cli@latest
```

**卸载**：删除下载的原生可执行文件，或卸载 npm 包：

```sh
npm uninstall -g @multiai/cli
```

## 第一次启动

进入项目目录后直接运行 `multiai` 启动交互界面：

```sh
cd your-project
multiai
```

只想执行一条指令而不进入交互界面时，使用 `-p`：

```sh
multiai -p "帮我看一下这个项目的目录结构"
```

继续上一次会话加 `-c`：

```sh
multiai -c
```

首次启动时需要配置 API 来源。在交互界面中输入 `/login` 进入登录流程：

```
/login
```

`/login` 默认使用 Authorization Code + PKCE 打开 MultiAI 浏览器登录，CLI
只在临时 `127.0.0.1` 端口监听回调。无法使用浏览器时选择设备码后备流程，或运行
`multiai login --device`。

Release 构建已包含原生应用签发的公开 client ID。开发和 staging 构建可通过
`MULTIAI_OAUTH_CLIENT_ID` 覆盖该值。CLI 中绝不能配置 client secret。

用 `/account` 查看账号、`/logout` 退出；也可运行 `multiai account` 和
`multiai logout`。

::: tip 使用其他 AI 供应商
如果你想接入 Kimi、Anthropic、OpenAI、Google 或其他外部供应商，需要编辑
`~/.multiai/config.toml` 配置 API 密钥，详见[平台与模型](../configuration/providers.md)。
:::

关于 keyring、token 过期、账号删除、资料变化、额度错误和 `multiai.store` 的精确
应用配置，见[账号与 OAuth](./account-and-oauth.md)。

## 第一个对话

登录完成后，用自然语言描述任务即可。先让它熟悉当前项目：

```
帮我看一下这个项目的目录结构，简单介绍一下每个目录是做什么的
```

MultiAI CLI 会自动调用文件读取、搜索等工具浏览相关内容后给出回答。只读操作默认自动执行无需确认；对于会修改文件或执行 Shell 命令的操作，默认会在执行前征求确认。

也可以直接描述更具体的任务：

```
在 src/utils 里新增一个函数，用来把任意字符串转成 kebab-case，并补一个单元测试
```

MultiAI CLI 会规划步骤、修改代码、运行测试，并在每一步告诉你它做了什么。

::: tip 不知道能做什么？输入 `/help`
随时在输入框输入 `/help`，可以打开内置的命令和快捷键面板，按 `↑`/`↓` 翻看，`Esc` 关闭。退出时输入 `/exit`，或按 `Ctrl-C` 两次，或在输入框为空时按 `Ctrl-D`。
:::

## 常用命令与快捷键速查

第一次使用时，记住下面这些就够了：

**会话相关命令**

| 命令 | 说明 |
| --- | --- |
| `/new` | 开启新会话，清空当前上下文 |
| `/sessions` | 浏览历史会话，选择恢复 |
| `/model` | 切换当前使用的模型 |
| `/compact` | 手动压缩上下文，释放 token |
| `/fork` | 派生当前会话，保留历史独立继续 |

**最常用快捷键**

| 快捷键 | 说明 |
| --- | --- |
| `Esc` | 中断流式输出 / 关闭弹窗 |
| `Ctrl-C` | 中断输出；空闲时连按两次退出 |
| `Shift-Tab` | 切换 Plan 模式 |
| `Ctrl-S` | 输出中途插入消息，无需等待结束 |
| `Ctrl-O` | 折叠 / 展开工具输出和压缩摘要 |

想看完整列表，输入 `/help` 或访问[斜杠命令参考](../reference/slash-commands.md)和[键盘快捷键](../reference/keyboard.md)。

## 数据存放在哪里

MultiAI CLI 的本地数据默认保存在 `~/.multiai/` 下，包含配置文件、会话记录、日志和更新缓存。如需迁移到别处，通过 `MULTIAI_HOME` 环境变量指定新路径。完整说明见[数据路径](../configuration/data-locations.md)和[环境变量](../configuration/env-vars.md)。

## 下一步

- [交互与输入](./interaction.md) — 输入框操作、审批流程、Plan 模式和 YOLO 模式详解
- [会话与上下文](./sessions.md) — 恢复会话、上下文压缩、导出会话
- [常见使用案例](./use-cases.md) — 典型任务的 prompt 示例
