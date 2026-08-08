# AI Agent 全景地图

跟踪全网 AI Agent 智能体的全景地图站：**Landscape 可视化 → 资讯时间轴 → 每 Agent 知识库** 三位一体。

## 当前跟踪对象（9 个首批）

| Agent | 公司 | 阵营 |
|---|---|---|
| Claude | Anthropic | 前沿实验室 · 美国 |
| Gemini | Google | 前沿实验室 · 美国 |
| Codex | OpenAI | 前沿实验室 · 美国 |
| 豆包 | 字节跳动 | 中国大厂 · 生态矩阵 |
| 通义千问 | 阿里云 | 中国大厂 · 生态矩阵 |
| 腾讯元宝 | 腾讯 | 中国大厂 · 生态矩阵 |
| Kimi | 月之暗面 | 中国新锐 · 模型驱动 |
| MiniMax | MiniMax | 中国新锐 · 模型驱动 |
| Hermes Agent | Nous Research | 开源 · 独立系 |

> 架构为数据驱动，新增 Agent 只需在 `data/agents.json` 加一条 + 新建 `knowledge/<id>.md`，全景图/时间轴/知识库自动扩展。

## 目录结构

```
├── index.html            # 单页应用（三视图）
├── assets/
│   ├── styles.css        # 设计系统（深灰 #0c0c0e + 紫罗兰 #8B5CF6）
│   └── app.js            # 逻辑（SVG 全景图 / 时间轴 / 知识库渲染）
├── data/
│   ├── agents.json       # Agent 元数据 + Landscape 坐标 + 阵营
│   ├── news.json         # 时间轴资讯（按日期倒序）
│   └── sources.json      # 每 Agent 推荐信息源（priority 1=必追）
├── knowledge/
│   └── <agent-id>.md     # 每 Agent 知识库（教程 + Challenge + 信息源）
└── scripts/
    └── fetch_news.py     # RSS 采集 → 更新 news.json（配合 cron）
```

## 更新机制

### 1. 新增/修改 Agent
编辑 `data/agents.json`（位置/阵营/特性），新增知识库文件 `knowledge/<id>.md`。

### 2. 时间轴资讯（半自动）
```bash
# 抓取所有 RSS 信息源，合并去重后写入 data/news.json
python3 scripts/fetch_news.py
```
已在 Hermes 配置定时任务（cron）自动执行。

### 3. 部署（GitHub Pages）
```bash
git add -A && git commit -m "update" && git push
```

## 本地预览

```bash
cd "AI-Agent全景地图" && python3 -m http.server 8877
# 打开 http://localhost:8877
```

## 设计语言

深灰近黑底（#0c0c0e）· 紫罗兰单主色（#8B5CF6）· Inter 无衬线 · 薄边框 · 无边阴影/渐变/玻璃态 · 留白宽松。
