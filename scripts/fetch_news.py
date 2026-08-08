#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI Agent 全景地图 — 资讯采集脚本
抓取各 Agent 的 RSS 信息源 → 合并去重 → 写入 data/news.json

用法:
  python3 scripts/fetch_news.py              # 抓取全部
  python3 scripts/fetch_news.py --agent claude  # 只抓某个 agent
  python3 scripts/fetch_news.py --deploy     # 抓取后自动 git commit + push
  python3 scripts/fetch_news.py --limit 5    # 每源最多取 N 条
"""
import argparse
import json
import os
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NEWS_PATH = os.path.join(BASE, "data", "news.json")
AGENTS_PATH = os.path.join(BASE, "data", "agents.json")

USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AI-Agent-Landscape/1.0"

# 各 Agent 的 RSS 信息源（官方一手信源优先，rss 为 None 表示暂未找到该源）
# 无官方 RSS 的用 hnrss.org 聚合（Hacker News 关键词过滤）作为社区信源补充
# keywords: 仅当条目标题包含任一关键词时才收录（过滤弱相关）
RSS_FEEDS = {
    "claude": [
        {"name": "HN: Anthropic/Claude", "rss": "https://hnrss.org/newest?q=anthropic+OR+claude", "type": "Hacker News", "keywords": ["anthropic", "claude"]},
    ],
    "gemini": [
        {"name": "Google AI Blog", "rss": "https://blog.google/technology/ai/rss/", "type": "官方博客"},
        {"name": "Google Developers Blog", "rss": "https://developers.googleblog.com/feeds/posts/default", "type": "开发者博客"},
    ],
    "codex": [
        {"name": "OpenAI Blog", "rss": "https://openai.com/news/rss.xml", "type": "官方博客"},
    ],
    "qwen": [
        {"name": "HN: Qwen", "rss": "https://hnrss.org/newest?q=qwen", "type": "Hacker News", "keywords": ["qwen", "通义"]},
    ],
    "doubao": [
        {"name": "HN: ByteDance/Doubao/Coze", "rss": "https://hnrss.org/newest?q=bytedance+OR+doubao+OR+coze", "type": "Hacker News", "keywords": ["bytedance", "doubao", "coze", "豆包", "扣子", "volcano"]},
    ],
    "yuanbao": [
        {"name": "HN: Tencent/Hunyuan", "rss": "https://hnrss.org/newest?q=tencent+hunyuan+OR+tencent+yuanbao", "type": "Hacker News", "keywords": ["tencent", "hunyuan", "yuanbao", "元宝", "混元"]},
    ],
    "kimi": [
        {"name": "HN: Moonshot AI", "rss": "https://hnrss.org/newest?q=moonshot", "type": "Hacker News", "keywords": ["moonshot", "kimi"]},
    ],
    "minimax": [
        {"name": "HN: MiniMax", "rss": "https://hnrss.org/newest?q=minimax", "type": "Hacker News", "keywords": ["minimax"]},
    ],
    "hermes": [
        {"name": "HuggingFace Blog", "rss": "https://huggingface.co/blog/feed.xml", "type": "社区"},
        {"name": "HN: NousResearch", "rss": "https://hnrss.org/newest?q=nousresearch", "type": "Hacker News", "keywords": ["nous", "hermes"]},
    ],
}

TYPE_MAP = {
    "官方博客": "官方博客",
    "开发者博客": "官方博客",
    "社区": "社区",
    "Hacker News": "社区",
}

def http_get(url, timeout=25):
    """用 curl 抓取（python urllib 在本机 Hermes 终端环境会挂起）"""
    try:
        result = subprocess.run(
            ["curl", "-s", "--max-time", str(timeout), "-A", USER_AGENT, "-L", url],
            capture_output=True, text=True, timeout=timeout + 10,
        )
    except subprocess.TimeoutExpired:
        raise TimeoutError(f"curl 超时: {url}")
    if result.returncode != 0:
        raise RuntimeError(f"curl 失败 rc={result.returncode}: {url}")
    return result.stdout

def clean_html(text):
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:300]

def parse_rss(xml_text, feed_name, feed_type):
    """解析 RSS/Atom 条目，返回 [{date,title,url,summary}]"""
    items = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        print(f"  [skip] {feed_name}: XML 解析失败 {e}")
        return items
    # RSS 2.0: root/channel/item ; Atom: root/entry (带 namespace)
    channel = root.find("channel")
    nodes = channel.findall("item") if channel is not None else root.findall("{http://www.w3.org/2005/Atom}entry")
    for node in nodes:
        title = node.findtext("title") or (node.findtext("{http://www.w3.org/2005/Atom}title") or "")
        link = node.findtext("link") or (node.findtext("{http://www.w3.org/2005/Atom}link") or "")
        if not link and node.find("{http://www.w3.org/2005/Atom}link") is not None:
            link = node.find("{http://www.w3.org/2005/Atom}link").get("href", "")
        desc = node.findtext("description") or (node.findtext("{http://www.w3.org/2005/Atom}summary") or "")
        pub = node.findtext("pubDate") or (node.findtext("{http://www.w3.org/2005/Atom}updated") or "")
        if not title or not link:
            continue
        # 日期归一化: 尝试多种格式
        ts = None
        for fmt in ("%a, %d %b %Y %H:%M:%S %z", "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d"):
            try:
                ts = datetime.strptime(pub.strip(), fmt)
                break
            except (ValueError, AttributeError):
                continue
        if ts is None:
            ts = datetime.now(timezone.utc)
        items.append({
            "date": ts.strftime("%Y-%m-%d"),
            "title": clean_html(title)[:160],
            "url": link.strip(),
            "summary": clean_html(desc)[:280],
            "_feed": feed_name,
            "_type": TYPE_MAP.get(feed_type, feed_type),
        })
    return items

def load_json(path, default):
    if not os.path.exists(path):
        return default
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--agent", default=None, help="只抓指定 agent id")
    ap.add_argument("--limit", type=int, default=10, help="每源最多取 N 条")
    ap.add_argument("--deploy", action="store_true", help="抓取后 git commit + push")
    ap.add_argument("--dry-run", action="store_true", help="只打印不写文件")
    args = ap.parse_args()

    agents_data = load_json(AGENTS_PATH, {})
    news = load_json(NEWS_PATH, {"items": []})
    existing = {item["url"]: item for item in news.get("items", [])}

    agent_ids = [args.agent] if args.agent else list(RSS_FEEDS.keys())
    stats = []
    added = 0
    for aid in agent_ids:
        if aid not in RSS_FEEDS:
            print(f"[skip] 未配置 RSS 源: {aid}")
            continue
        feeds = RSS_FEEDS[aid]
        if not feeds:
            print(f"[info] {aid}: 暂无 RSS 源（公众号/无 RSS 站点需手动录入）")
            continue
        for feed in feeds:
            try:
                xml_text = http_get(feed["rss"])
            except Exception as e:
                print(f"[fail] {aid} / {feed['name']}: {e}")
                stats.append((aid, feed["name"], 0, 0))
                continue
            items = parse_rss(xml_text, feed["name"], feed["type"])[: args.limit]
            new_in_feed = 0
            for it in items:
                if it["url"] in existing:
                    continue
                # HN 聚合源关键词过滤（标题需包含任一关键词）
                kw = feed.get("keywords")
                if kw and not any(k.lower() in it["title"].lower() for k in kw):
                    continue
                existing[it["url"]] = {
                    "date": it["date"],
                    "agent": aid,
                    "source_type": it["_type"],
                    "source_name": it["_feed"],
                    "title": it["title"],
                    "url": it["url"],
                    "summary": it["summary"],
                    "tags": [],
                }
                new_in_feed += 1
                added += 1
            print(f"[ok]   {aid} / {feed['name']}: 抓取 {len(items)} 条，新增 {new_in_feed} 条")
            stats.append((aid, feed["name"], len(items), new_in_feed))
            time.sleep(0.5)

    if added == 0:
        print("\n无新增条目（可能已全部收录）")
    else:
        print(f"\n共新增 {added} 条")

    items = sorted(existing.values(), key=lambda x: x["date"], reverse=True)
    news["items"] = items
    news["updated"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    if args.dry_run:
        print(f"[dry-run] 将写入 {len(items)} 条到 {NEWS_PATH}")
        return

    with open(NEWS_PATH, "w", encoding="utf-8") as f:
        json.dump(news, f, ensure_ascii=False, indent=2)
    print(f"[write] {NEWS_PATH} 共 {len(items)} 条")

    if args.deploy:
        os.chdir(BASE)
        for cmd in (
            "git add -A",
            f"git commit -m 'chore: 资讯采集更新 {news['updated']}' || echo 'nothing to commit'",
            "git push",
        ):
            code = os.system(cmd)
            if code != 0:
                print(f"[deploy] 命令失败: {cmd}")

if __name__ == "__main__":
    main()
