# 黄金矿工：西部淘金记

经典黄金矿工浏览器游戏，使用 **Vite + TypeScript + Phaser 4** 构建。生产环境由单个 Cloudflare Worker 提供静态资源和云存档 API，D1 保存跨设备进度。

当前版本在保留现代部署架构的同时，恢复了原版完整玩法和西部卡通视觉：精细矿层、异形金块、切面钻石、岩石、宝箱、TNT、移动地鼠、粒子、爆炸、屏幕震动、随机矿脉事件、商店、成就、每日挑战、无尽模式和合成音频。

## 技术栈

- Vite 8：前端开发与生产构建
- TypeScript 7：严格类型检查
- Phaser 4：可见游戏画布、场景生命周期、缩放和输入宿主
- React 19：菜单、HUD、商店、结算、设置和无障碍界面
- Cloudflare Workers Static Assets：分发 Vite 构建产物
- Cloudflare D1：匿名跨设备云存档
- Vitest：纯逻辑与 Worker API 单元测试
- Playwright：桌面端和移动端视觉测试
- GitHub Actions：检查、测试、构建、视觉截图和生产部署

## 项目结构

```text
src/
├─ main.tsx                    # 应用入口与云存档状态入口
├─ GoldMinerGame.tsx           # 菜单、HUD、商店、结算、记录与设置
├─ styles/
│  ├─ main.css                 # 完整西部卡通视觉系统
│  ├─ phaser-polish.css        # Phaser 画面与 HUD 增强
│  └─ cloud-sync.css           # 云存档入口与密钥对话框
├─ game/
│  ├─ engine.ts                # Phaser 4 场景宿主与运行时桥接
│  ├─ canvas-runtime.ts        # 完整玩法、碰撞、事件和程序化美术
│  ├─ audio.ts                 # Web Audio 音乐与音效
│  ├─ model.ts                 # 关卡、物品、商店、成就和计分逻辑
│  └─ storage.ts               # 版本化 localStorage 存档
├─ cloud/
│  ├─ identity.ts              # 匿名同步身份与可迁移同步密钥
│  ├─ CloudSaveClient.ts       # 云存档 API 客户端
│  └─ sync.ts                  # 本地与 D1 自动同步及冲突处理
└─ worker/
   ├─ index.ts                 # Worker 入口和静态资源回退
   ├─ save-api.ts              # D1 云存档 API
   └─ types.ts                 # Worker/D1 最小运行时类型
migrations/                    # D1 数据库迁移
scripts/                       # 部署、run 状态和视觉拼图脚本
tests/                         # 单元测试与 Playwright 视觉测试
.github/workflows/             # Check / Test / Build / Visual / Deploy / Run State
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

首次运行视觉测试前安装 Chromium：

```bash
npx playwright install chromium
npm run test:visual
```

视觉测试会自动截取桌面和移动端主要界面，保存到 `test-results/visual/`，并按照每 4 张截图生成一张 `contact-sheet-*.png` 拼图。GitHub Actions 的 `Visual` 工作流会上传完整目录，方便在合并和部署前直接检查实际 UI。

## 云存档

首次打开游戏时，浏览器会生成随机 `playerId` 和高强度随机令牌。客户端只保存同步密钥；Worker 在 D1 中只保存令牌的 SHA-256 哈希，不保存明文令牌。

- `GET /api/save/:playerId`：读取云存档
- `PUT /api/save/:playerId`：写入云存档
- `GET /api/health`：服务健康检查

写入采用 revision 乐观并发控制，旧设备覆盖新存档时会返回 `409` 和最新版本。同步密钥等同于存档密码，不能公开分享。

## 分支与自动部署流程

1. 在功能分支修改代码。
2. 分支 push 和针对 `main` 的 Pull Request 会触发 `Check`、`Test`、`Build` 和 `Visual`。
3. `Visual` 自动生成 8 张主要界面截图，并每 4 张拼成一张检查图上传为 Actions artifact。
4. 全部通过后合并到 `main`。
5. `main` 的 push 触发 `Deploy Worker`，再次执行检查、测试、构建，然后自动创建或复用名为 `gold-miner-saves` 的 D1 数据库、执行迁移并部署 Worker。
6. `Run State` 自动整理最近的检查、测试、构建、视觉和部署 run，发布到独立的 `run-state` 分支：
   - `.github/run-state/latest-run-id.txt`
   - `.github/run-state/latest-run.json`
   - `.github/run-state/recent-runs.json`

因此可先读取 `run-state` 分支获得 run ID 与状态，再按 ID 检查 jobs、日志和视觉 artifact。

## GitHub 仓库密钥

在仓库 `Settings → Secrets and variables → Actions` 中配置：

- `CLOUDFLARE_ACCOUNT_ID`：Cloudflare Account ID
- `CLOUDFLARE_API_TOKEN`：限定到目标账号的 API Token

API Token 至少需要：

- Account / Workers Scripts / Edit
- Account / D1 / Edit

部署脚本会通过 Cloudflare API 自动查找或创建 D1，因此不需要额外配置 D1 database ID。可选环境变量 `CLOUDFLARE_D1_DATABASE_NAME` 能覆盖默认数据库名，但正常部署不需要设置。
