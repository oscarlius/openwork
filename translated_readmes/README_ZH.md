# OpenWork

OpenWork 是 Claude Cowork 与 Codex 的免费开源替代品：一款面向 macOS、Windows 和 Linux 的桌面应用，让 AI 智能体在你自己的文件上完成真正的工作。它基于 [OpenCode](https://opencode.ai) 构建，可使用任意模型——50+ 家模型提供商、你自己的 API 密钥，或通过 Ollama 运行的本地模型——并支持团队共享技能和 MCP 服务器。

[**下载 OpenWork**](https://openworklabs.com/download) · [GitHub 发布记录](https://github.com/different-ai/openwork/releases) · [文档](https://openworklabs.com/docs)

其他语言版本：[English](../README.md) · [繁體中文](./README_ZH_hk.md) · [日本語](./README_JA.md)

在 Codex、Claude Code、Cursor 或其他兼容的智能体中添加一个 OpenWork MCP，就能在你的工具、队友和设备之间复用同一批技能、MCP 和已连接的服务。一次创建，可以分享给同事或朋友，也可以只留给自己。

需要专属工作区时，桌面应用随时可用，但它并非必需——用你已经在用的智能体就能使用 OpenWork。对于规模较大的组织，管理界面让你可以发布能力、管理访问权限，并配置共享或按用户划分的连接。

<img width="1481" height="842" alt="OpenWork desktop app" src="https://github.com/user-attachments/assets/66a8dd9b-5260-488c-957d-e54331e78c1c" />

## 为什么选择 OpenWork，而不是 Claude Cowork

- **免费且开源。** 桌面应用采用 MIT 许可；在本地使用不需要 OpenWork 账号。
- **任意模型。** 自带 API 密钥、用 ChatGPT 登录，或通过 Ollama 及任何兼容 OpenAI 的服务器运行本地模型。参见[添加自定义 LLM](https://openworklabs.com/docs/start-here/connect-your-stack/add-a-custom-llm)。
- **可在 macOS、Windows 和 Linux 上运行**，是桌面应用，而不是 CLI。
- **文件始终留在本地。** 云端是可选的。
- **与团队共享技能和 MCP 服务器。** 参见[与团队共享技能](https://openworklabs.com/docs/start-here/do-work-with-it/share-your-setup)和[共享 MCP 连接](https://openworklabs.com/docs/cloud/share-with-your-team/shared-mcp-connections)。
- **自行部署**团队控制平面，运行在你自己的基础设施上。参见[自行部署](https://openworklabs.com/docs/start-here/self-host)。
- **沿用你的 Cowork 配置。** 技能、兼容 Claude 的插件以及 MCP 服务器都能迁移过来。参见[从 Claude Cowork 迁移](https://openworklabs.com/docs/start-here/migrate-from-claude-cowork)。

## 用你的 AI 智能体安装

已经在用 AI 智能体？复制下面这段提示词，粘贴到 Claude Code、Cursor、Codex、ChatGPT，或任何能在你的电脑上执行命令的智能体里。

```text
Install OpenWork on my computer, set up my first workspace, and open it ready to use. Follow the steps in https://openworklabs.com/start.md?v=hero
```

1. 安装 OpenWork
2. 创建你的工作区
3. 打开后即可开始运行

## 在任意智能体中使用 OpenWork

OpenWork MCP 会把分配给你的技能、插件、MCP 连接，以及 Google Workspace 和 Microsoft 365 的能力带进任何兼容的智能体。

它提供四个工具：`search_capabilities` 找出你能用的能力，`execute_capability` 执行它们，`list_skills` / `get_skill` 列出你的技能并直接读取某个 SKILL.md。添加这个 MCP 后，客户端会打开浏览器，你可以登录并选择自己的 OpenWork 组织。

### Codex

```bash
codex mcp add openwork --url https://api.openworklabs.com/mcp/agent
```

### Claude Code

```bash
claude mcp add --transport http openwork https://api.openworklabs.com/mcp/agent
```

### OpenCode

把下面这段加到 `opencode.json`：

```json
{
  "mcp": {
    "openwork": {
      "type": "remote",
      "enabled": true,
      "url": "https://api.openworklabs.com/mcp/agent",
      "oauth": {}
    }
  }
}
```

### 任意 MCP 客户端

使用这个远程 MCP 服务器 URL：

```text
https://api.openworklabs.com/mcp/agent
```

## OpenWork Den

OpenWork Den 是在团队或组织范围内管理 OpenWork 的控制平面。

- 大规模提供推理能力，并控制哪些成员和团队可以使用每个模型提供商。
- 在一个地方邀请同事、创建团队并管理访问权限。
- 设置桌面策略、限制本地模型访问，并控制你的组织可以使用哪些应用版本。
- 通过应用市场发布技能和插件，再把它们分配给组织、某个团队或具体的人。
- 导入 Agent Plugins 或兼容 Anthropic 的插件，让它们支持的技能与远程 MCP 通过 OpenWork MCP 对外可用。

<img width="1546" height="915" alt="OpenWork Den organization control plane" src="https://github.com/user-attachments/assets/033dbbfe-5661-4f7c-869c-46278406d6cc" />

## 许可证 <a id="licensing"></a>

本仓库按目录拆分授权，方式与 GitLab 类似：

- **`ee/` 之外的所有内容都是 MIT**——桌面应用和核心平台都是开源的，任何用途都免费。
- **`ee/` 之下的所有内容（OpenWork Den——组织控制平面）都适用 [OpenWork EE License](../ee/LICENSE)**，这是一种源码可见（source-available）的许可。代码公开，方便你确切核对自己要部署的东西。生产环境使用需要 [OpenWork 订阅](https://openworklabs.com/pricing)，但有几项例外：**最多 5 个用户的组织免费**、**任何规模都可免费评估 30 天**，开发和测试则始终免费。此外，每个 `ee/` 版本在发布两年后都会转为 MIT 许可。

在本许可证采用之前发布的版本仍沿用其原始许可证（FSL-1.1-MIT）。参见[定价](https://openworklabs.com/pricing)和[订阅条款](https://openworklabs.com/terms/subscription)。

## 文档

[阅读 OpenWork 文档。](https://openworklabs.com/docs)

## 开始上手（贡献者）

从全新克隆到跑起开发构建的最快路径。

### 前置条件

- **Node 24**——版本已在 [`.nvmrc`](../.nvmrc) 中固定（`nvm use` 会自动读取）。
- **pnpm 11**——在 `package.json`（`packageManager`）中固定；运行 `corepack enable` 即可自动使用固定版本。绝不要使用 npm 或 yarn。

### 首次运行

```bash
git clone https://github.com/different-ai/openwork.git
cd openwork
corepack enable
pnpm install
pnpm dev   # 启动带热重载的 Electron 桌面应用
```

编码智能体和测试不应该在你的屏幕上打开那个窗口：它们改用无头 Chrome 来使用应用（参见[无头 Web](#headless-web-no-electron)和 `AGENTS.md`）。

### 仓库结构

| 路径 | 存放内容 |
| --- | --- |
| `apps/` | 桌面应用：React UI（`apps/app`）、Electron 外壳（`apps/desktop`）以及 `openwork-server`（`apps/server`）（MIT） |
| `packages/` | 共享核心包（MIT） |
| `ee/` | OpenWork Den——组织控制平面、MCP 网关和推理服务（EE License，参见[许可证](#licensing)） |
| `evals/` | 基于 `@openwork/testkit` 构建的可执行测试规格——见 [`evals/README.md`](../evals/README.md) |
| `worlds/` | 供 `pnpm world` 使用的声明式开发/测试环境定义 |
| `docs/` | 运维、功能和发布文档 |
| `.opencode/skills/` | 仓库智能体技能（测试、发布、Daytona 等） |

### 测试

所有可执行的覆盖都在 `evals/specs/**/*.test.ts` 里；驱动应用的流程用 `.e2e.test.ts`。

```bash
pnpm --dir evals install --frozen-lockfile   # 只需执行一次
pnpm evals:pr specs/<name>.test.ts           # 不依赖应用的 PR 通道规格
pnpm evals:e2e <name> --local                # 驱动应用的 E2E 流程，在本地运行
```

运行期可观察的变更需要在 PR 上附上测试证据。`AGENTS.md` 和 [`evals/README.md`](../evals/README.md) 说明了验证约定与术语。

### 提交 Pull Request

1. 从 `dev`（默认分支）切出分支，并把 PR 提向 `dev`。
2. 尽量缩小 diff，并为运行期可观察的变更附上或更新测试证据。
3. 阅读 [CONTRIBUTING.md](../CONTRIBUTING.md) 了解许可条款。贡献即表示你同意 DCO；`ee/` 下的贡献适用 [CLA](../legal/individual-contributor-license-agreement.md)，无需另外签署任何东西。

## 本地开发

单个检出请继续使用 `pnpm dev`；没有额外环境变量时，它会复用已有的共享开发配置。

要同时运行多个 git worktree，请使用：

```bash
pnpm dev:worktree
```

这会设置 `OPENWORK_DEV_PROFILE=auto`，从 worktree 路径推导出稳定的配置名，让 Electron 自行选择一个空闲的 CDP 端口，并向 Vite 请求一个空闲的开发服务器端口。你也可以指定具名配置，例如 `OPENWORK_DEV_PROFILE=my-feature OPENWORK_ELECTRON_REMOTE_DEBUG_PORT=0 PORT=0 pnpm dev`。

`dev:worktree` 还会把 `OPENWORK_ELECTRON_USE_MOCK_KEYCHAIN=1` 设为默认值。全新的配置里没有保存任何凭据，所以在 macOS 上，一旦 Chromium 持久化经过身份验证的 Cookie，真实钥匙串就会弹出提示，而这个模态框会阻塞 Electron 的主循环，直到你把它关掉。如果你确实想让隔离配置使用系统钥匙串，请设置 `OPENWORK_ELECTRON_USE_MOCK_KEYCHAIN=0`。

开发启动时会打印形如 `[openwork] dev profile=... cdp=http://127.0.0.1:9823` 的横幅；用它找到配置目录，并把其中的 CDP URL 传给本地工具。

如果第二个实例拿不到配置锁，现在它会直接说明原因并退出，而不是带着一个已打开的 CDP 端口却没有窗口地悬在那里。

### 无头 Web（不使用 Electron） <a id="headless-web-no-electron"></a>

要在浏览器里运行 OpenWork UI 并连接本地的 `openwork-server`（不含桌面外壳）：

```bash
pnpm world up dev-app-web --detach
pnpm world up dev-app-web --detach -- --browser   # 同时在无头 Chrome 中打开，并打印一个 cdp 地址
```

`pnpm dev:headless-web` 是同一个脚本的兼容别名。该别名默认仍在前台运行，并接受 `--detach`；`world up` 除非显式带上 `--detach`，否则也是前台运行。

这是一个隔离的启动器：

- 写入 `tmp/headless-server.json`，绝不读取 `~/.config/openwork/server.json`
- 自动授权所选的工作区根目录，重启时合并（而不是重写）该配置，因此你通过 UI 添加的工作区在 `--replace` 之后仍然保留
- 用固定注入 UI 的属主 bearer 令牌启动 Vite + `openwork-server`。崩溃重启后已打开的标签页依旧可用。带特权的主机令牌只留在服务器进程里，绝不会被内联进 Vite 产物。
- 以同源方式代理 Den Cloud 调用：Vite 提供 `/api/den`（转发给 Den 控制平面），应用通过 `VITE_DEN_API_BASE_URL` 把 Den API 固定到这里，因此云端调用不会被 CORS 拦截，加载时还会清除过期的 `localStorage` 基础 URL
- 在 `tmp/dev-headless-web.json`（权限 `0600`）发布仅属主可用的运行时清单，并且只允许来自 Web 应用自身源的浏览器调用访问本地服务器——而不是你打开的任何网站都能调用
- 默认使用固定端口（Web 为 `5178`，服务器为 `8778`；被占用时回退到空闲端口，可用 `OPENWORK_WEB_PORT` / `OPENWORK_PORT` 覆盖）
- 作为 `dev-app-web` 是单实例的；再次启动前先用 `pnpm world down dev-app-web` 停掉它
- 让 Vite 和后端共用同一个脚本生命周期，因此任意一方退出都会停掉另一方，而不是留下孤儿进程
- 在 detached 模式下会等待健康检查通过，打印不含密钥的输出以及回执和日志路径，然后退出

脚本专属的选项必须写在 `--` 之后：

```bash
pnpm world up dev-app-web --detach -- --replace
pnpm world up dev-app-web --detach -- --replace --keep-tokens
```

`--replace` 会用全新令牌重启无头运行时；加上 `--keep-tokens` 可以保留之前的令牌。这个脚本也接受 `--rotate-tokens`。它们都不是通用的 `world` 选项。

打开打印出来的 Web URL。无头 Web 里的云端登录使用**复制/粘贴**交接方式（托管的 Den 无法把会话授权重定向回 `http://127.0.0.1`）：

1. Account → Sign in（会打开 Den；粘贴输入框会在 Settings 中打开）
2. 在 Den 上登录
3. 复制 Den 显示的 OpenWork 链接 / 一次性代码
4. 把它粘贴到 **Paste sign-in code** 下方 → Finish sign-in

在 `pnpm dev:web-local` 运行时，用 `OPENWORK_DEV_DEN_PROXY_TARGET=http://127.0.0.1:3005` 把 Den 指向本地技术栈。设置 `OPENWORK_DEV_HEADLESS_WEB_DEN_PROXY=0` 可关闭 Den 相关接线。

其他已提交的脚本包括 `worlds/live-app-web.ts` 和 `worlds/live-desktop.ts`。两者都刻意复用已安装的生产环境状态，并且需要在 `--` 之后加上各自的专属开关，例如 `pnpm world up live-desktop -- --allow-shared-state`。用 `pnpm world list` 可列出脚本和正在运行的回执。无头的生产 world 被硬性限制在回环地址；远程访问/公开托管的设置会被拒绝，因为它的浏览器会话使用的是生产凭据。
