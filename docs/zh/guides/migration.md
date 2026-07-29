# 旧版本数据

MultiAI CLI 使用新的产品身份、命令、package namespace 与 home directory。它不会从
Kimi Code 或 `kimi-cli` 导入设置与历史记录。

::: warning 移除
MultiAI CLI 1.0.0 不再包含旧版迁移 workspace 与 `migrate` 命令。
:::

## MultiAI CLI 使用的位置

新数据只会写入 MultiAI 路径：

- 全局数据与配置：`~/.multiai`；
- workspace 配置：`.multiai/local.toml`；
- 命令：`multiai`；
- 环境变量：`MULTIAI_*`。

旧的 `kimi` 命令、`~/.kimi-code`、`.kimi-code/local.toml` 与产品级 `KIMI_*` 设置
都不是 alias，也不会被读取。

## 清理旧凭据

首次启动时，MultiAI CLI 只检查 `~/.kimi-code/credentials/kimi-code.json`。如果该
文件可识别为以前的托管 OAuth 凭据文件，客户端会将其删除，避免遗留过期的明文 token。

`~/.kimi-code` 下的其他文件与目录不会被修改。确认不再需要旧应用后，请自行保留、
归档或删除该目录。

## 设置 MultiAI

安装 MultiAI CLI 后，以新的原生 OAuth 客户端登录：

```sh
multiai login
```

请在 `~/.multiai` 下重新配置 custom provider 与本地 plugin。MultiAI 仍支持外部 Kimi
模型 provider，但它与已移除的 Kimi 产品账户及迁移流程相互独立。账户配置与 token
行为请阅读 [OAuth 与账户](./account-and-oauth.md)。
