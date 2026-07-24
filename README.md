# 黄金矿工：西部淘金记

经典黄金矿工浏览器游戏，现已迁移为 **Vite + TypeScript + Phaser 4**。生产环境由单个 Cloudflare Worker 提供静态资源与云存档 API，D1 保存跨设备进度，不再依赖 ChatGPT Sites、Next.js、Vinext 或 React。

## 技术栈

- Vite 8：前端开发与生产构建
- TypeScript 7：严格类型检查
- Phaser 4：场景、输入、渲染、补间与游戏循环
- Cloudflare Workers Static Assets：分发 Vite 构建产物
- Cloudflare D1：匿名跨设备云存档
- Vitest：纯逻辑与 Worker API 单元测试
- GitHub Actions：独立检查、测试、构建，以及 main 分支自动部署

## 项目结构

```text
src/
├─ main.ts                    # DOM 外壳、模式切换、存档与 Phaser 启动
├─ styles/main.css            # 响应式界面
├─ game/
│  ├─ GoldMinerScene.ts       # Phaser 场景、抓钩状态机、碰撞与绘制
│  ├─ model.ts                # 确定性关卡、物品、商店和计分纯逻辑
│  └─ storage.ts              # 版本化 localStorage 本地存档
├─ cloud/
│  ├─ identity.ts             # 匿名同步身份与可迁移同步密钥
│  └─ CloudSaveClient.ts      # 云存档读取、写入与冲突处理
└─ worker/
   ├─ index.ts                # Worker 入口和静态资源回退
   ├─ save-api.ts             # D1 云存档 API
   └─ types.ts                # Worker/D1 最小运行时类型
migrations/                   # D1 数据库迁移
scripts/                      # 部署配置与 Actions run 状态采集
.github/workflows/            # Check / Test / Build / Deploy / Run State
```

## 本地开发

需要 Node.js 22.13 或更高版本。

```bash
npm install
npm run dev
```

完整 Worker + 本地 D1 预览：

```bash
npm run build:client
npx wrangler d1 migrations apply DB --local
npx wrangler dev
```

质量命令：

```bash
npm run check
npm test
npm run build
```

## 云存档

首次打开游戏时，浏览器会生成随机 `playerId` 和高强度随机令牌。客户端只保存同步密钥；Worker 在 D1 中只保存令牌的 SHA-256 哈希，不保存明文令牌。

- `GET /api/save/:playerId`：读取云存档
- `PUT /api/save/:playerId`：写入云存档
- `GET /api/health`：服务健康检查

写入采用 revision 乐观并发控制，旧设备覆盖新存档时会返回 `409` 和最新版本。同步密钥等同于存档密码，不能公开分享。

## 分支与自动部署流程

1. 在功能分支修改代码。
2. 分支 push 和针对 `main` 的 Pull Request 会分别触发三个独立工作流：`Check`、`Test`、`Build`。
3. 三项通过后合并到 `main`。
4. `main` 的 push 触发 `Deploy Worker`，再次执行检查、测试、构建，然后自动创建或复用名为 `gold-miner-saves` 的 D1 数据库、执行迁移并部署 Worker。
5. `Run State` 在上述工作流完成后自动整理最近 12 次 run，发布到独立的 `run-state` 分支：
   - `.github/run-state/latest-run-id.txt`
   - `.github/run-state/latest-run.json`
   - `.github/run-state/recent-runs.json`

因此可先读取 `run-state` 分支获得 run ID 与状态，再按 ID 检查 jobs 和日志。

## GitHub 仓库密钥

在仓库 `Settings → Secrets and variables → Actions` 中配置：

- `CLOUDFLARE_ACCOUNT_ID`：Cloudflare Account ID
- `CLOUDFLARE_API_TOKEN`：限定到目标账号的 API Token

API Token 至少需要：

- Account / Workers Scripts / Edit
- Account / D1 / Edit

部署脚本会通过 Cloudflare API 自动查找或创建 D1，因此不需要额外配置 D1 database ID。可选环境变量 `CLOUDFLARE_D1_DATABASE_NAME` 能覆盖默认数据库名，但正常部署不需要设置。
