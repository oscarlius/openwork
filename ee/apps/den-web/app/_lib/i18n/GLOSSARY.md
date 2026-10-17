# OpenWork Den 界面文案约定（en / zh）

本文件是 `ee/apps/den-web` 消息表的唯一约定来源。`den-locale.ts`、`messages/en.ts`、
`messages/zh.ts` 的头部注释都指向这里；改文案前先读它，再加 key。

## 1. 为什么简体中文是「可选」的

- `en` 是**唯一默认值**。没有 cookie、cookie 值非法、`denLocaleSelection` 特性不可用、
  服务端读取失败，全部解析为 `en`。
- 原因不是审美：`evals/specs` 里约 48 个 spec 真导航到本应用，内含近千条英文
  `label:` 无障碍断言。默认渲染变中文会让这批 spec 全红。
- `denLocaleSelection`（`packages/features/src/registry.ts`，`default: false`）关闭时，
  cookie 不但被忽略，还会被 `DenLocaleBootstrap` 清除，所以「关掉这个特性」等于
  不发版就把所有页面退回英文。
- 因此：**flag off 路径必须与今天的英文渲染逐字节等价**。这是本项目对 den-web 文案
  改动的硬验收项。

## 2. 接缝与调用形态

| 场景 | 取 `t` 的方式 |
| --- | --- |
| 服务端组件（RSC） | `const t = createDenT(await resolveDenLocale())`，从 `../../_lib/i18n/messages` 导入 `createDenT`，从 `../../_lib/i18n/server` 导入 `resolveDenLocale` |
| 客户端组件 | `const t = useDenT()`，从 `../../../_lib/i18n/client` 导入 |
| 语言切换 | `useSetDenLocale()`，只接受 `en` / `zh`，写 cookie `openwork.den.locale` 后 `router.refresh()` |

两侧签名、key 集合、占位符集合完全一致（`pnpm -C ee/apps/den-web i18n:check` 校验）。
本应用**没有** `@/` 路径别名，import 一律相对路径。

- `en.ts` 是 schema：`const en = { … } as const`，`DenMessageKey = keyof typeof en`。
- `zh.ts` 是 `const zh: Record<DenMessageKey, string> = { … }`，缺键或多键都会让
  `pnpm -C ee/apps/den-web typecheck` 直接失败。
- `en` 里的值必须是**该处在汉化之前屏幕上真实显示的英文原文**（逐字，含大小写、
  省略号、破折号、句内前导空格）。它同时是英文回归的对照物。

## 3. key 命名与前缀分配

形状：`region.interfaceElement.semantics`，小写驼峰段，点号分隔（实测 172 个 key 中
165 个为三段，少量两段与四段用于分组下的细分）。前缀按区域分配，新增前先在此登记：

| 前缀 | 归属区域 | 实测 key 数 |
| --- | --- | --- |
| `denShell.*` | 导航外壳、侧栏、组织切换、页面标题、语言切换器 | 86 |
| `denDesktopPolicies.*` | 桌面策略屏 | 26 |
| `denTeam.*` | 团队与成员屏 | 20 |
| `denGateway.*` | MCP / AI 网关与用量覆盖提示 | 14 |
| `denWorkflow.*` | 工作流图与流程屏 | 10 |
| `denPluginAccess.*` | 插件/技能访问授权屏 | 9 |
| `denRoot.*` | 根 layout 的 metadata 与社交预览 | 4 |
| `denPermissions.*` | 权限编辑区 | 2 |
| `denDashboard.*` | dashboard layout 的 metadata | 1 |

尚未分配、后续要用的区域：`denAdmin.*`（`app/admin`）、`denMcp.*`（`app/mcp` 同意页）、
`denConnect.*`（`app/connect`）、`denSso.*`（`app/sso`）、`denWorkbot.*`、`denSetup.*`。
新增前缀时把这张表一起改，别只在代码里造名字。

## 4. 中文术语表（与 `apps/app/src/i18n/locales/zh.ts` 头部保持一致）

- **worker = 工作进程**，**workspace = 工作区**。两个概念在英文里是不同词，中文不许
  共用一个译名；同句并现时分别翻译。库里曾有 工作者 / 工作进程 / 工作区 三种混用，
  「工作者」是拟人化误译，禁止使用。
- Skills → 技能；Plugins → 插件；Commands → 命令；Sessions → 会话；Apps → 应用；
  Library → 资源库；model provider → 模型提供商（禁止「供应商」「服务商」）；
  API key → API 密钥（禁止「秘钥」）；audit log → 审计日志；desktop app → 桌面应用；
  gateway → 网关；self-host → 自托管；you → 你。
- 保留英文不译：OpenWork、OpenWork Cloud、OpenWork Connect、OpenWork Den、OpenCode、
  OpenPackage、Codex、Claude Code、Cursor、MCP、SSO、SCIM、OIDC、OAuth、API、AI、
  Workbot、Slack、Google Workspace、Microsoft 365、Entra、Okta、Docker、AWS、Azure、GCP。
  MCP 是协议名，任何时候不得译成「应用」。

## 5. 排版

- 中文与英文单词、数字、占位符之间加**半角空格**：`共 {count} 条查询`、`已加载 3 个模型提供商`。
- 中文句读用全角：，。：；？！「」；括号内是中文用（），是纯英文或代码用半角 ()。
- 省略号用「……」；破折号用「——」且两侧不加空格。
- 按钮/菜单/标签用名词或动词短语、不加句号；成句说明加句号。
- 禁止机翻腔：「被」字句、「进行…中」、「让我们」、「请」字滥用、英文语序直译。

## 6. 不许汉化（保留英文并写进 justification）

`className`、`data-testid`、图标名、发往 API/IPC 的字段值、协议字面量与蛇形枚举值、
只进日志或调试面板的内部错误、`console.*`、注释与 JSDoc、评测夹具与演示假数据、
TS 字面量类型 union、正则与路径。判断「错误文案该不该译」的唯一标准是：它是否会
渲染到界面上（顺着 catch → toast/边界的路径看一遍）。

## 7. 日期、数字与 `Intl`

`den-format.ts` 的每个包装函数都收一个 `englishLocale` 参数，等于**该调用点在引入
i18n 之前写死的那个字面量**（本应用多为 `"en-US"`，少数为 `"en"`）；`locale === en`
时原样返回它，只有 `zh` 才替换成 `"zh-CN"`。这样英文下的 `Intl` 输出逐字节不变，
不必逐个日期/金额重新回归。新增格式化点请沿用这个形状，不要直接写 `new Intl.*("zh-CN")`。

## 8. 验收命令（改完必须真跑）

```
pnpm -C ee/apps/den-web i18n:check   # key 集合、占位符、汉字、allowlist 腐化
pnpm -C ee/apps/den-web typecheck    # zh.ts 的类型强制 + 悬空 key
pnpm -C ee/apps/den-web lint         # eslint --max-warnings=0
```

`i18n:check` 还会反向检查白名单：被登记为「品牌名/纯标点」的 key 一旦真的长出汉字，
同样报错，白名单不许悄悄腐烂。
