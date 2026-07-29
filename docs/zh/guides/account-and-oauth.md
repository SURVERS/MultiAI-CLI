# OAuth 与账户

MultiAI CLI 以公开的原生 OAuth 客户端登录：客户端有 `client_id`，但没有 client
secret。浏览器登录使用 Authorization Code + PKCE（由客户端生成的一次性证明），
无法使用 loopback 浏览器回调时则可以改用设备登录。

## 在 multiai.store 中配置应用

在 `multiai.store` 中创建一个 OAuth 应用，并准确填写以下值：

| 设置 | 值 |
| --- | --- |
| 名称 | `MultiAI CLI` |
| 应用类型 | 在设备上——IDE、CLI 或应用 |
| Redirect URI | `http://127.0.0.1:1/oauth/callback` |
| 权限 | 登录、资料、email、余额与限额、API 密钥列表、模型访问 |
| 设备授权 | 开启 |
| Client secret | 不创建、不使用 |

只注册上表中的 IPv4 loopback 地址。不要添加 `localhost` 或 IPv6 回调。运行时，
CLI 会监听动态的 `127.0.0.1` 端口；注册的端口 `1` URI 用来标识 MultiAI 预期的
原生 loopback 回调模式。

创建应用后，复制公开的 `client_id`。生产构建会嵌入该值；开发与 staging 构建可以覆盖：

```sh
MULTIAI_OAUTH_CLIENT_ID=YOUR_PUBLIC_CLIENT_ID multiai login
```

默认 issuer 为 `https://multiai.store`；`MULTIAI_OAUTH_ISSUER` 只应在受控的开发
或 staging 环境中使用。

## 登录并查看账户

浏览器登录是默认方式。CLI 会启动临时 loopback listener、打开授权页、校验回调，
然后关闭 listener：

```sh
multiai login
```

如果回调无法到达终端，请使用设备流程，并在浏览器中确认显示的代码：

```sh
multiai login --device
```

两种流程都会请求 `openid profile email account:read keys:read ai:invoke`。TUI 中
对应的命令是 `/login`、`/login --device` 与 `/login --session-only`。Web 和 VS Code
也提供相同的浏览器、设备与 session-only 选项。

使用以下命令查看当前资料、wallet、订阅限额、已授予 scopes、连接过期时间与脱敏
API 密钥：

```sh
multiai account
multiai account --json
```

TUI 中的 `/account` 会显示同一账户视图。`/usage` 仍用于显示本地会话 token 与
上下文窗口，不用于显示 MultiAI wallet。

## 身份与资料变更

稳定的账户身份是 OpenID Connect 组合 `(iss, sub)`（issuer 与 subject）。Email、
显示名称、头像与 Telegram 都是资料属性，不是身份标识。

MultiAI CLI 会在登录后以及每次 token refresh 后刷新 `/oauth/userinfo`。账户面板从
`/api/oauth/v1/snapshot` 加载钱包、限额、连接信息和脱敏密钥。因此，修改 email、名称、
头像或 Telegram 不会退出登录，显示资料会在下次 refresh 时更新。CLI 不存储 Telegram。如果服务器
返回新的 `sub`，CLI 会将其视为另一个账户。

## Token 存储与 session-only 模式

Refresh token 通过系统 keyring 存储在 Windows Credential Manager、macOS Keychain
或 Linux Secret Service 中。Access token、ID token claims、资料与账户快照只保留
在进程内存中。MultiAI CLI 不会把 OAuth token 写入明文文件。

如果 keyring 不可用，交互式客户端可以提供仅限当前进程的会话。非交互式终端必须
明确选择：

```sh
multiai login --session-only
multiai login --device --session-only
```

进程退出后，该会话随即结束。首次启动时，MultiAI CLI 只删除可识别的旧凭据文件
`~/.kimi-code/credentials/kimi-code.json`，并忽略 `~/.kimi-code` 中的其他内容。

## 过期、撤销与账户状态

Access token 过期通常对用户不可见：客户端只执行一次同步 refresh，并只重试失败
请求一次。Refresh token 在闲置 30 天或总寿命达到 90 天后过期，此时必须重新进行
交互式登录。

以下情况会清除本地会话、移除 `managed:multiai` 模型，并回到普通的未登录状态：

- 账户被删除、封禁或不可用；
- 连接被撤销、密码被重置或 MFA 被关闭；
- OAuth 客户端被归档；
- Token rotation 结果不明确、返回 `invalid_grant`，或无法安全提交；
- Refresh 后的 identity token 未通过签名或 claims 校验。

退出登录时，客户端会先尝试撤销 refresh token；即使 issuer 不可用，也始终清除
本地会话与托管配置：

```sh
multiai logout
```

## 余额、scopes 与速率限制

HTTP `402 insufficient_quota` 表示 MultiAI 余额已用完。客户端会保留登录状态，不
refresh token，并引导用户前往 `https://multiai.store/account` 充值。

`insufficient_scope` 同样不会清除会话。请在 `multiai.store` 中更新 OAuth 应用权限；
重复登录无法授予应用本身没有请求的权限。遇到 HTTP `429` 时，客户端会遵守
`Retry-After`，不会把速率限制转换为 logout。

## 安全校验

MultiAI CLI 会在授权前加载 OAuth metadata，并拒绝位于其他 origin 的 authorization、
token、device、revocation、user-info 或 JWKS endpoint。ID token 必须使用 RS256，
并通过 `kid`、JWKS signature、`iss`、`aud`、`exp`、`iat`、`nonce` 与 claim type
校验；允许的时钟偏差为 60 秒。

Callback URL、authorization code、PKCE verifier、device code、user code，以及以
`ma-oauth-` 开头的值都会从诊断日志中脱敏。

## 登录后的模型

认证完成后，MultiAI CLI 会读取 `/v1/models` 并创建 `multiai/<model-id>` 别名。
目录可能不提供上下文长度或其他 capabilities；缺失值保持未知，不会由客户端猜测。
这些别名的请求通过 OpenAI-compatible `/v1/responses` endpoint 发送。
