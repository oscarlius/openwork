---
title: "OpenWork 文档简体中文转换规范（zh-Hans）"
description: "packages/docs 中文副本的目录结构、翻译边界、链接改写规则、术语表与自查命令。供翻译 agent 与人工复核使用，不对最终用户展示。"
noindex: true
---

本文件是 `packages/docs/zh/**` 的唯一转换规范。任何中文页面的新增/修改都必须先读完本文件。
本轮（第一批）已完成：`zh/desktop-app/**`（2）、`zh/integrations/**`（3）、`zh/slack/**`（4），共 9 页，可作为范本。

## 0. 结构定稿（不要改动）

采用 Mintlify v2 `docs.json` 原生的 `navigation.languages`，单站点、单 `docs.json`、中文页面放在 `packages/docs/zh/**`：

```json
{ "navigation": { "languages": [
  { "language": "en", "default": true, "tabs": [ /* 原 12 个 tab，逐字未改 */ ] },
  { "language": "zh-Hans", "tabs": [ /* 中文 tab 组 */ ] }
] } }
```

判据（全部为本地实测，不是记忆）：

- `mint@4.2.868`（= CI pin 的版本，`npm` 上的 `mint` 只是 `@mintlify/cli@4.0.1471` 的壳）自带的 schema 中，
  `@mintlify/validation/dist/mint-config/schemas/v2/properties/navigation/languages.js` 定义了 `language` 枚举（含 `zh-Hans`）、`default`、`banner`、`footer`；
  `divisionNav.js` 的 `LanguageNavigation<T> = BaseLanguageSchema & (... | { tabs: TabNavigation<T>[] } ...)`，
  且 `ExcludedDivisions` 使 `languages` 不能嵌套 `languages`。`navigation` 本身是 `{tabs}|{languages}|{versions}|...` 的**互斥联合**，所以不能同时保留顶层 `tabs` 又加 `languages`。
- URL 由**文件路径**决定，语言分组只决定“这个页面属于哪个语言”：
  `@mintlify/common/dist/navigation/getVersionOrLanguageFromPath.js` 用路径在导航树里匹配页面来回推语言（其 JSDoc 明确 “unlocalized” 返回 undefined），
  官方测试 `activeDivisionMatching.test.js:211-222` 用 `{languages:[{language:"en",default:true,pages:pages("/en")},{language:"es",pages:pages("/es")}]}` 断言 `/es/first` 归属 `es`。
  → 英文页面路径与 `redirects` 一字未动，英文 URL 不变；中文页面 URL 就是我们选的 `zh/**` 路径，`zh-Hans` 代码不会进入 URL。
- 实测退出码：`mint validate` 英文原件基线 RC=0；改成 `languages` 结构后 RC=0；
  对照实验（往中文导航塞一个不存在页面）RC=1 并输出 `"... is referenced in the docs.json navigation but the file does not exist."` → 证明 validate 真的在检查导航页面存在性。
- 候选 (b)「独立 `zh/docs.json`」已被实测否定：在 `packages/docs/zh/` 放一个 `docs.json` 并把它的导航指向一个不存在页面，`mint validate` 仍返回 RC=0，
  说明 CI（`working-directory: packages/docs`）只读根 `docs.json`，嵌套配置是被静默忽略的死文件。
- 候选 (a)「在 `navigation.tabs` 里追加中文 tab」schema 上能过（实测 RC=0），但中文 tab 会和英文 tab 并列出现在英文读者的顶栏，违反“英文读者零感知”，故弃用。

语言码选 `zh-Hans`（不是 `zh`）：`localization.js` 里 `zh` 显示名是 “Chinese”，`zh-Hans` 才是 “Simplified Chinese”，
且 `apps/app/src/i18n/locales/zh.ts:4` 的术语表就叫 `den-i18n-zh-Hans`，保持一致。

残余风险（如实登记）：`mint@4.2.868 broken-links` 在本地 Windows 环境**基线就失败**（未改动英文文档时也是 `found 214 broken links in 67 files`，RC=1），
本地无法用它做门禁；改动前后两次输出的文件集合与链接列表逐项完全一致（69 个条目、214 条链接），证明本结构没有新增断链。
最终以 Linux CI 为准。语言切换器的实际渲染也只能由托管构建证明。

## 1. 目录与路径映射

- `packages/docs/<rel>.mdx` → `packages/docs/zh/<rel>.mdx`，`<rel>` 逐字保持，不改名、不合并、不拆分层级。
  例：`start-here/foo.mdx` → `zh/start-here/foo.mdx`（URL `/zh/start-here/foo`）。
- 导航里写 `zh/<rel>`（无 `.mdx` 后缀、无前导斜杠），与英文导航的写法保持同一风格。
- 中文 tab 的**顺序**必须与它所镜像的英文 tab 顺序一致（英文 `languages[0]` 永远排第一，`default: true` 只能有一个）。
- 冻结的 tab 显示名映射（只允许新增，禁止改名/重排；未列出的先征询）：

| 英文 tab | 中文 tab | 本轮状态 |
| --- | --- | --- |
| Start here | 从这里开始 | 未开始 |
| Desktop App | 桌面应用 | 已建（组：开始使用） |
| Integrations | 集成 | 已建 |
| Slack | Slack | 已建（组：OpenWork in Slack（私有 alpha）） |
| AI Gateway | AI 网关 | 未开始 |
| MCP Gateway | MCP 网关 | 未开始 |
| Dashboards | 仪表盘 | 未开始 |
| SSO | SSO | 未开始 |
| Self-host | 自托管 | 未开始 |
| API | 不提供 | 见 §3，`openapi` 引用不复制 |
| Roadmap | 已提供 | 见 §3（状态 token 逐字保留） |
| Changelog | 禁止 | 见 §3，翻译会打挂 CI |

- group 名同样按语义译：`Get started`→`开始使用`、`Connect services`→`连接服务`、`Skills`→`技能`、
  `Models and providers`→`模型与提供商`、`Do work with it`→`用它干活`、`Use it in the browser`→`在浏览器中使用`、
  `Troubleshooting`→`问题排查`、`Overview`→`概览`、`Usage and cost`→`用量与费用`。

## 2. frontmatter：译什么、不译什么

| 字段 | 处理 | 理由 |
| --- | --- | --- |
| `title` | 译 | 页面可见标题，也是 `<title>` |
| `description` | 译 | SEO/摘要文案 |
| `sidebarTitle` | 译；原文没有就不要新增 | 侧栏可见文案 |
| `keywords` | **保留全部英文原词**，末尾追加中文搜索词 | 搜索召回要靠中英两边；删英文词会丢检索 |
| `icon` / `iconType` / `tag` / `mode` / `tag` | 原样复制，不译不改值 | 是枚举/图标名，不是文案 |
| `openapi` | 原样复制路径字符串 | CI 生成物引用 |
| `noindex` | 中文页面**不要**加（默认可索引）；只有内部说明类文件才加 | — |
| `deprecated` / `hidden` / `version` | 与原件保持一致 | 状态字段 |

字段顺序、引号风格、`---` 围栏都与原件一致；不要在 frontmatter 里增删字段种类。

## 3. 绝对不译、不复制的东西

- `changelog.mdx`：**禁止**建中文副本、禁止翻译。它被 `scripts/check-changelog-output.mjs:20`、
  `scripts/release/release-notes-from-changelog.mjs:15` 解析，并被 `.github/workflows/changelog.yml:62,162,195` grep/提交。动了就红。
- `roadmap.mdx`：**已提供中文副本**（2026-10-17 覆盖本条早先的「不译」裁定）。约束：状态 token（`Live`/`Preview`/`Partial`/`Building`/`Next`/`Exploring`）逐字保留、只在组件里给中文释义，因为它们对应 `/admin` feature registry 的口径；规范条目本身没有脚本解析。残留风险：英文 roadmap 更新频繁而中文副本会漂，改动英文页时需同步 `zh/roadmap.mdx`。
- `changelog.mdx`：**不译**（`scripts/check-changelog-output.mjs`、`scripts/release/release-notes-from-changelog.mjs` 与 `.github/workflows/changelog.yml` 会解析并提交它）。
- `openapi.json`、`packages/sdk/src/gen/**`：CI 生成物，不改不复制。
- `docs.json` 的 `markdown.instructions`：给 AI agent 读的英文提示，不译。
- `snippets/**`（`openwork-connect-installer.jsx`、`openwork-downloads.jsx`）：不是页面而是被 `import` 的组件，
  且 `scripts/check-connect-installer-parity.mjs:9,13,93` 逐 token 比对它与英文文档。中文页面**直接 import 同一个英文 snippet**，不复制、不改文案。
- `self-host/evaluate-with-docker-compose.mdx` 的镜像引用行：`scripts/release/pin-compose-images.mjs:31` 会读它，
  译文必须把镜像/标签行原样保留（该行一字不改，前后中文另起行）。
- `images/**`、`logo/**`：文件不复制，引用路径不改写（继续用 `/images/...` 绝对路径）。
- 一切代码块、行内代码、命令、URL、环境变量、配置键、工具名（`search_capabilities`、`execute_capability`、`list_skills`、`get_skill`）、
  API 路径（`/v1/integrations/slack/<connectionId>/events`）、Slack/云控制台的英文 UI 字面量（`**Event Subscriptions**`、`**Save Changes**`、`Settings > Account`）。

## 4. 正文与组件的翻译边界

- ``` 围栏（本轮 9 页共 8 行围栏）**整块原样复制**，包括语言标注（```text / ```sh / ```json）和块内空行。
  范本：`zh/slack/overview.mdx` 里那段给智能体的英文提示——它是要交给 agent 执行的原文，逐字保留。
- Mintlify/JSX 组件：只改**可见文案**与属性里的**文案值**；标签名、嵌套层级、数量、数值属性（`cols={2}`）、`icon`、`type` 一律不动。
  - 可改：`<Card title="MCP 集成" ...>`、`<Step title="安装">`、`<Tabs title="...">`、`<Accordion header="...">`。
  - 不改：`icon`、`href` 的路径部分（按 §5 处理）、`cols`、`groupId`、`sync`、`type`。
  - `<Note>`/`<Tip>`/`<Warning>`/`<Frame>`/`<Steps>` 的数量和顺序必须与原件完全一致。
- 表格：表头与单元格文案译；分隔行 `| --- | --- |` 的列数必须与原件相同；行内的反引号片段、客户端名（OpenCode、Cursor、Codex、Claude Code、VS Code）保持英文。
- 标题层级与数量不变；**不要**为了中文通顺而增删 `##` 小节。
- 中文标题**不要**手写 `#锚点`：Mintlify 用 `@sindresorhus/slugify` + `getUnicodeId` 把非 ASCII 标题转成百分号编码 slug
  （`@mintlify/common/dist/slugify.js` 注释：“slugify doesn't support percent-encoded characters, like Chinese, Korean, etc.”），
  中文标题的锚点是 `%E4%BD%A0%E5%A5%BD` 这类字符串，手抄必然出错。

## 5. 链接改写规则（最容易出事的一节）

对中文副本里的每个链接，按下表处理：

| 原件链接 | 中文副本写法 | 说明 |
| --- | --- | --- |
| `/integrations/mcp`（目标**已有**中文副本） | `/zh/integrations/mcp` | 指向中文副本，**必须去掉 `#fragment`**（见 §4 锚点条款） |
| `/slack/overview#ask-your-agent-to-set-it-up`（目标已有副本且带锚点） | `/zh/slack/overview` | 去锚点；若该锚点是理解前提，把句子改成“参见本页‘让智能体帮你设置’一节” |
| `/start-here/downloads`（目标**还没有**中文副本） | `/start-here/downloads` | 保持英文路径原样（可含 `#fragment`），指向英文页。**禁止**指向尚不存在的 `/zh/...` |
| `<Card href="/model-context-protocol/cursor">` | 同上一条规则处理 | `href` 属性也走这张表 |
| `https://`、`mailto:`、`openwork://`、`cursor://`、`vscode:`、图片、`/openapi.json` | 逐字不改 | 外部/生成物引用 |
| 相对路径写法（原件几乎全是绝对路径） | 不要新增相对链接 | 一律用 `/...` 或 `/zh/...` |

补充铁律：

1. 判断“目标是否已有中文副本”的唯一依据是 `packages/docs/zh/<目标路径>.mdx` **文件是否存在**。不确定就留给英文页。
2. 每个 `/zh/...` 链接都必须命中真实文件，且必须出现在 `zh-Hans` 导航里，否则 CI 的 `mint validate` 会失败。
3. 一位读者的语言不应被链接随意切换：中文页之间的跳转尽量落在 `/zh/**`；落到英文页是可以接受的降级，落到不存在的页面不行。

## 6. 术语表（优先级高于直觉，与 `apps/app/src/i18n/locales/zh.ts` 一致）

| 英文 | 中文 | 备注 |
| --- | --- | --- |
| Skills | 技能 | `zh.ts:4` 明文规定 |
| Plugins | 插件 | |
| Commands | 命令 | |
| Sessions | 会话 | |
| Apps | 应用 | |
| Library | 资源库 | `activity.browse_library`→“浏览资源库” |
| model provider | 模型提供商 | `account.providers_connected`→“模型提供商” |
| API key | API 密钥 | |
| audit log | 审计日志 | `app.error_audit_load` |
| desktop app | 桌面应用 | `automations.sign_in_banner` |
| gateway | 网关 | AI 网关 / MCP 网关 / 技能网关 |
| self-host | 自托管 | |
| agent | 智能体 | |
| sign in / sign out | 登录 / 退出登录 | |
| settings / account | 设置 / 账户 | `settings.tab_cloud_account`→“账户” |
| workspace | 工作区 | |
| you / your | 你 / 你的 | 不用“您”，与 app 语言包口径一致 |

**保留英文**：OpenWork、OpenWork Den、OpenWork Cloud、OpenWork Connect、OpenCode、OpenPackage、Codex、Claude Code、Claude Desktop、
Cursor、ChatGPT、Gemini、VS Code、Windsurf、Zed、MCP、Mintlify、Electron、Slack、Google Workspace、Microsoft 365、AWS、GCP、Azure、
Docker、Kubernetes、API、OAuth、JSON、YAML、SAML、SCIM、RBAC、SSO、token、manifest、alpha、beta。
产品/客户端名永远不加中文括注。

排版：

- 中文与英文/数字之间加半角空格：`在 Slack 中设置 OpenWork`、`30 秒`、`45 分钟`。
- 标点用全角：`，。；：？！、`。中英文混排时，句内分隔用顿号 `、`，句末用 `。`。
- 括注中文用 `（）`；包名、命令、纯英文括注用半角 `()`，例如 `（私有 alpha）` 与 `opencode-openwork(2.0)` 里的英文部分。
- 省略号用 `……`，不用 `...`（代码块内除外）。
- 直引号 `"..."` 在正文改为 `“...”`；`--`/`—` 的 UI 路径分隔按原件保留（`Settings › Account`、`Connectors → Slack`）。
- 标题不做首字母大写变换，也不给中文加粗之外的强调符号；`**bold**` 的对应位置保持加粗。
- 数字、单位、百分比保持原值，不做本地化改写。

## 7. 每个 agent 交付前必须跑的自查

前置：`npx -y mint@4.2.868 validate`（只读校验，禁止 `install`）。若本地 mint 缓存缺 `package.json` 导致 npx 报 `ENOENT`，
可直接跑缓存里的入口：`node <npm-cache>/_npx/<hash>/node_modules/mint/index.js validate`（本轮就是这么跑的）。

1. `cd packages/docs && node <mint> validate` → **必须 RC=0**。这是唯一能在本地证明“中文导航引用的文件都存在、docs.json 结构合法”的门禁。
2. `node <mint> broken-links` → 与**改动前基线**逐项对比，不得新增条目（本地基线本身 RC=1、214 条，见 §0 残余风险）。
3. 机械一致性（把下面脚本存到仓库外，例如 `D:/tmp/check-zh-parity.mjs`，从 `packages/docs` 目录跑）：

```js
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
const ROOT = process.cwd();                       // packages/docs
const zhRoot = join(ROOT, "zh");
const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : join(d, n).endsWith(".mdx") ? [join(d, n)] : []));
const zhFiles = walk(zhRoot);
const fences = (t) => t.split("\n").filter((l) => l.startsWith("```")).length;                 // 围栏行数
const tags = (t) => (t.match(/<[A-Z][A-Za-z]*/g) || []).length;                                 // 组件开标签数
const images = (t) => [...new Set(t.match(/images\/[^)"'\s]+/g) || [])].sort().join(",");       // 图片引用集合
let bad = 0;
for (const p of zhFiles) {
  const rel = relative(zhRoot, p).replace(/\\/g, "/");
  const en = join(ROOT, rel);
  if (!existsSync(en)) { console.log("ORPHAN", rel); bad++; continue; }                 // 中文必须有英文原件
  const z = readFileSync(p, "utf8"), e = readFileSync(en, "utf8");
  for (const [k, a, b] of [["fences", fences(z), fences(e)], ["tags", tags(z), tags(e)], ["images", images(z), images(e)]])
    if (a !== b) { console.log("DRIFT", k, rel, a, "!=", b); bad++; }
  const body = z.replace(/^---[\s\S]*?---/, "");                                          // 中文链接必须命中文件
  for (const m of body.matchAll(/\]\((\/zh\/[^)#\s]+)(#[^)]*)?\)/g)) {
    if (!existsSync(join(ROOT, m[1].slice(1) + ".mdx"))) { console.log("BADLINK", rel, m[1]); bad++; }
    if (m[2]) { console.log("ZH-FRAGMENT", rel, m[0]); bad++; }                            // /zh 链接不许带锚点
  }
}
const nav = JSON.parse(readFileSync(join(ROOT, "docs.json"), "utf8")).navigation.languages;
const zhTabs = nav.find((l) => !l.default).tabs;
const pages = zhTabs.flatMap((t) => t.pages).flatMap((e) => (typeof e === "string" ? [e] : e.pages));  // 展平 zh-Hans 导航
for (const p of zhFiles) { const r = "zh/" + relative(zhRoot, p).replace(/\\/g, "/").replace(/\.mdx$/, ""); if (!pages.includes(r)) { console.log("UNNAVED", r); bad++; } }
console.log(bad ? `FAIL ${bad}` : "ALL PASS");
process.exit(bad ? 1 : 0);
```

4. 残留英文成句检测（口径：**去掉 frontmatter、``` 围栏块、行内反引号、链接目标、裸 URL、JSX 标签后**，
   用 `([A-Za-z']+ ){6,}` 找连续 6 个及以上英文单词）。命中数必须为 0；
   若命中且确属代码/命令/UI 字面量，改成行内反引号包裹而不是删除内容。本轮 9 页命中 0。
5. `node scripts/check-connect-installer-parity.mjs`：本轮未触碰 `snippets/**` 与 `cloud/run-in-the-cloud/cloud-mcp.mdx`，
   结果与改动前完全相同（注意：该脚本在本工作区**基线就 RC=1**，缺 `opencode mcp logout openwork` 那条断言，与中文文档无关）。
6. 英文文档零改动确认：`git diff` 里 `packages/docs/**` 只允许出现 (i) 新增 `zh/**`，(ii) `docs.json` 中 `navigation` 键的形状变化。
   任何 `start-here/**`、`cloud/**`、`self-host/**`、`ai-gateway/**`、`model-context-protocol/**`、`dashboards/**`、`integrations/**`、
   `desktop-app/**`、`slack/**`、`changelog.mdx`、`roadmap.mdx`、`snippets/**`、`images/**`、`openapi.json` 的改动都是越界。

## 8. 后续 agent 最容易犯错的 3 点

1. **锚点**：把 `/cloud/...#use-a-connection-in-another-mcp-client` 这类链接顺手改成 `/zh/...#<同一个英文 fragment>`。
   中文标题的 slug 是百分号编码的中文，英文 fragment 永远对不上 → CI 断链。规则：`/zh/**` 链接一律不带 `#`。
2. **指向尚未存在的中文页**：想当然把所有内部链接都加 `/zh/` 前缀。目标副本不存在时必须保留英文路径。
   `mint validate` 只检查导航里的页面，不检查正文链接；正文断链要靠 §7 第 3 条脚本和 CI。
3. **动到“不可译物”**：为了中文通顺而重写代码块/命令行、删掉 ``` 围栏、把 `snippets/**` 复制成 `.zh.jsx`、
   改 `images/` 路径、给 `keywords` 只留中文、或者顺手翻译 `changelog.mdx`。这些都会撞已存在的 CI/脚本门禁（§0、§3 列了具体行号）。
