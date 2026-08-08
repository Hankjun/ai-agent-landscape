#!/bin/bash
# AI Agent 全景地图 — 每日资讯自动抓取 + 发布
# 由 Hermes cron 调用：python3 fetch_news.py --deploy（抓取 → 合并 → commit → push）
cd "/Users/hank/Desktop/01_Projects_项目/AI-Agent全景地图" || exit 1
python3 scripts/fetch_news.py --deploy 2>&1
