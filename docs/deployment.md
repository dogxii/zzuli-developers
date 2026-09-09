# 部署说明

ZZULI.dev 是静态站点，推荐部署到 Cloudflare Pages。

## Cloudflare Pages

推荐使用 Pages 的 Git 集成，不需要在仓库里配置部署 Token。Cloudflare 连接 GitHub 仓库后，按下面配置即可：

- Root directory：`frontend`
- Build command：`npm run build`
- Build output directory：`build`
- Environment variables：`NODE_VERSION=22`

如果使用 Wrangler 直接上传构建产物，才需要额外准备 `CLOUDFLARE_ACCOUNT_ID` 和可部署 Pages 的 `CLOUDFLARE_API_TOKEN`，然后上传 `frontend/build`。

## 数据采集

站点构建时只读取 `data/*.json`，前端不会在用户访问时请求 GitHub 或 Cloudflare API。

- `collect-blog-posts.yml`：采集博客文章
- `collect-github-activity.yml`：采集成员 GitHub 贡献日历，使用 `GITHUB_TOKEN`
- `collect-site-stats.yml`：采集站点访问统计，需要仓库 Secrets：
  - `CLOUDFLARE_API_TOKEN`

Cloudflare 访问统计接入：

1. 在 Cloudflare Dashboard 打开 `My Profile` -> `API Tokens` -> `Create Token` -> `Custom token`。
2. 权限选择 `Account` -> `Account Analytics` -> `Read`，并把 Token 的 Account Resources 限制到本站所在账户。
3. 把 API Token 写入 GitHub Secrets：`CLOUDFLARE_API_TOKEN`。
4. `collect-site-stats.yml` 内的 `CLOUDFLARE_ACCOUNT_TAG` 与 `CLOUDFLARE_WEB_ANALYTICS_SITE_TAG` 分别是 Cloudflare Account ID 和 Web Analytics site tag；两者不是密钥，变更站点时一并更新。
5. 在 Cloudflare Dashboard 的 Web Analytics 中把该站点切换为「Enable with JS Snippet installation」，不要同时启用自动注入。站点在 `frontend/src/app.html` 中只加载一个 Cloudflare beacon。
6. 手动运行 `Collect site stats` workflow。成功后会更新 `data/site-stats.json`，首页会显示近 30 天的访问与页面浏览。

本地测试：

```bash
set -a
source .env
set +a
npm --prefix frontend run collect:site-stats
```

本地 `.env` 只用于你自己运行采集脚本，不要提交。仓库提供了 `.env.example` 作为模板；前端页面构建不需要这些 Token。

站点统计默认读取最近 30 天 Cloudflare Web Analytics 的 RUM 数据（按 site tag）：

- `visits`：访问次数，不等于独立访客；一次访问可包含多个页面浏览。
- `pageViews`：页面浏览次数。
- 不展示「累计独立访客」或 Zone 请求数，避免把机器人、同一人跨天的独立 IP 汇总和真实用户访问混为一谈。

采集和 Cloudflare Dashboard 使用同一套 Web Analytics 数据源，固定按 site tag 查询滚动 30 天，并使用 `bot: 0` 排除机器人；Dashboard 应保持 `Exclude Bots = Yes`，才能和首页保持相同口径。
