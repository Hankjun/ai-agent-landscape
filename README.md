# AI Agent 全景地图

面向 AI 产品开发者与研究者，把分散的智能体产品、资讯和学习资料组织成一个可浏览的入口。

**[在线体验](https://hankjun.github.io/ai-agent-landscape/)** · [报告问题](https://github.com/Hankjun/ai-agent-landscape/issues)

AI Agent landscape, news timeline and knowledge hub, built with vanilla JavaScript and JSON.

## 可以做什么

- **全景图**：按阵营查看 Agent 节点，打开产品官网、文档与知识库。
- **资讯时间轴**：按 Agent 和来源类型筛选资讯，保留原文链接。
- **知识库**：浏览每个 Agent 的 Markdown 学习资料和信息源。
- **数据维护**：通过 JSON 文件维护产品目录，通过 Python 脚本采集 RSS 资讯。

当前目录包含 Claude、Gemini、Codex、豆包、通义千问、腾讯元宝、Kimi、MiniMax 和 Hermes Agent。产品信息以数据文件中的更新时间为准。

## 快速开始

需要 Git 和 Python 3。前端无需 Node.js、构建步骤或模型 API Key。

```bash
git clone https://github.com/Hankjun/ai-agent-landscape.git
cd ai-agent-landscape
python3 -m http.server 8877 --bind 127.0.0.1
```

打开 [http://localhost:8877](http://localhost:8877)。请使用 HTTP 服务访问，前端通过 `fetch()` 读取 JSON 和 Markdown 文件。

## 项目结构

| 路径 | 用途 |
| --- | --- |
| `index.html` | 页面入口 |
| `assets/app.js` | SVG 全景图、时间轴与知识库交互 |
| `assets/styles.css` | 页面样式 |
| `data/agents.json` | Agent 元数据、阵营和节点坐标 |
| `data/news.json` | 资讯条目 |
| `data/sources.json` | 前端展示的信息源目录 |
| `knowledge/*.md` | 每个 Agent 的知识库 |
| `scripts/fetch_news.py` | RSS 采集、去重和数据更新 |

## 更新资讯

采集脚本使用 Python 标准库和系统 `curl`，需要能够访问对应 RSS 站点。

```bash
# 先查看单个 Agent 的采集结果，不写入数据
python3 scripts/fetch_news.py --agent claude --limit 5 --dry-run

# 确认后写入 data/news.json
python3 scripts/fetch_news.py --agent claude --limit 5
```

- RSS 抓取配置在脚本的 `RSS_FEEDS` 中；修改 `data/sources.json` 不会自动改变采集配置。
- 采集按 URL 去重。部分来源是社区聚合，相关性和摘要需要人工检查。
- 更新资讯不会同步更新 `agents.json` 的产品资料或知识库内容。
- 定时执行需要在自己的运行环境配置；克隆仓库不会获得维护者环境中的定时任务。
- 部署时，先检查 `git diff`，再提交并推送。脚本的 `--deploy` 会执行 Git 提交与推送。

## 新增 Agent

1. 在 `data/agents.json` 的 `agents` 数组增加条目，保持 ID 唯一、阵营 ID 有效。
2. 新建 `knowledge/<id>.md`，补充官方资料、学习路径和实战记录。
3. 在 `data/sources.json` 增加展示信息源；如需自动采集，再修改 `RSS_FEEDS`。
4. 本地检查全景图节点、资讯筛选和知识库能否正常打开。

新增阵营时还需同步修改 `assets/app.js` 中的 `REGIONS` 布局配置。

## 当前范围与后续方向

这是静态信息导航和研究整理项目。目录同时覆盖通用助手、编程 Agent 与 Agent 平台，分类用于导航，不代表统一基准测试或能力排名。采集结果也不等于全部资讯。

后续可优先完善数据校验、来源失效提示、更新时间一致性和移动端体验。

## 反馈与贡献

欢迎通过 Issue 提交失效链接、资料更正和收录建议。请附上原始来源、相关 Agent 和发现日期。提交 PR 时说明修改的数据文件及本地验证结果。

维护者：[Hank / 汉克](https://github.com/Hankjun)。
