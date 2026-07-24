# 黄金矿工：西部淘金记

经典黄金矿工浏览器游戏，使用 **Vite + TypeScript + Phaser 4 + React** 构建。生产环境由单个 Cloudflare Worker 提供静态资源和云存档 API，D1 保存跨设备进度。

当前架构保留经典闯关、每日挑战、无尽模式、商店、成就、本地存档、云存档、随机矿脉事件和音频功能，同时将实时玩法模拟与画面渲染彻底分离。正式美术尚未完成时，游戏通过本地原创占位纹理正常运行；后续可按 Manifest 替换 PNG、WebP、Sprite Sheet 或 Phaser Atlas，而不改动游戏规则代码。

## 技术栈

- Vite 8：前端开发与生产构建
- TypeScript 7：严格类型检查
- Phaser 4：矿区、人物、抓钩、物品、粒子、相机和场景生命周期
- React 19：菜单、HUD、商店、结算、设置、云存档入口和无障碍界面
- Cloudflare Workers Static Assets：分发 Vite 构建产物
- Cloudflare D1：匿名跨设备云存档
- Vitest：纯模拟、资源清单、模型和 Worker API 单元测试
- Playwright：桌面端、移动端和资源预览视觉测试
- GitHub Actions：检查、测试、构建、视觉截图和生产部署

## 运行时架构

```text
React 页面、弹窗和低频 HUD
        │ 命令 / HudSnapshot
        ▼
GoldMinerEngine 公开控制接口
        ▼
BootScene → PreloadScene → GameScene
                            │
                            ├─ BackgroundLayers
                            ├─ Miner（唯一权威人物对象）
                            ├─ Rope + Hook
                            ├─ MineItemView
                            └─ EffectsSystem
        ▲
        │ SimulationSnapshot / SimulationEvent
        │
GameSimulation（单一游戏状态真相）
        ▼
model.ts（关卡、生成、重量、计分、连击、商店、成就）
```

`GameSimulation` 是纯 TypeScript，不依赖 React、Phaser、DOM 或 Canvas。Phaser Scene 直接创建并更新 Sprite、Image、Container、Graphics 和 Particle Emitter；不再把隐藏 Canvas 每帧上传成 `CanvasTexture`。渲染器使用 `Phaser.AUTO`，优先 WebGL，并在必要时回退到 Canvas。

## 项目结构

```text
src/
├─ main.tsx                         # 应用入口、云存档与调试路由
├─ GoldMinerGame.tsx                # React 菜单、HUD、商店、结算与设置
├─ components/
│  ├─ ArtImage.tsx                  # React 图片与本地回退
│  └─ GameIcon.tsx                  # 统一图标占位组件
├─ config/artAssets.ts              # React 侧正式资源路径
├─ debug/AssetPreview.tsx           # 开发/视觉测试资源预览页
├─ styles/
│  ├─ main.css
│  ├─ phaser-polish.css
│  ├─ art-pipeline.css
│  └─ cloud-sync.css
├─ game/
│  ├─ config/                       # 世界尺寸、资源 Key、视觉层级
│  ├─ assets/                       # 运行时 Manifest 与占位纹理生成
│  ├─ simulation/                   # 纯游戏模拟和事件
│  ├─ scenes/                       # Boot / Preload / Game Scene
│  ├─ objects/                      # Miner / Hook / Rope / MineItem / Background
│  ├─ systems/                      # Asset / Animation / Effects / Event Bus
│  ├─ engine.ts                     # React 可调用的 Phaser 控制器
│  ├─ canvas-runtime.ts             # 旧导入兼容层，不再进行 Canvas 绘制
│  ├─ audio.ts                      # Web Audio 音乐与音效
│  ├─ model.ts                      # 关卡、物品、商店、成就和计分逻辑
│  └─ storage.ts                    # 版本化 localStorage 存档
├─ cloud/                           # 匿名身份、客户端和同步逻辑
└─ worker/                          # Worker、D1 云存档 API 与类型

public/assets/placeholders/          # 提交到仓库的本地占位图片
art-manifest.json                    # 正式美术规格和替换目标
ASSET_TODO.md                        # P0 / P1 人工美术待办
docs/ARCHITECTURE.md                 # 详细职责和生命周期
docs/ART_PIPELINE.md                 # 美术制作、Atlas、九宫格和压缩流程
migrations/                          # D1 数据库迁移
scripts/                             # 部署、run 状态和视觉拼图脚本
tests/                               # Vitest 与 Playwright 测试
.github/workflows/                   # Check / Test / Build / Visual / Deploy / Run State
```

## 美术资源与回退

业务代码只引用 `src/game/config/assetKeys.ts` 中的 Key。纹理尺寸、Origin、缩放和 fallbackKey 记录在 `src/game/assets/assetManifest.ts`；未来正式交付规格记录在根目录 `art-manifest.json`。

```text
正式文件已配置且加载成功 → 使用正式纹理
正式文件未配置或加载失败 → 使用本地占位纹理
```

占位纹理由 `createPlaceholderTextures.ts` 在预加载阶段集中生成一次。Scene 不包含大型占位绘图方法，也不会每帧生成纹理。React 首页人物使用 `ArtImage` 和 `public/assets/placeholders/menu/miner-portrait-placeholder.svg`，不再依靠复杂 CSS 几何拼接。

开发环境可访问：

```text
http://localhost:5173/?debug=assets
```

资源预览页展示背景层、全部物品、人物动画状态、粒子、React UI 图片、实际纹理尺寸、帧率、Origin、缩放及正式/占位状态。生产界面不会启用该路由；视觉测试通过 `visual=1` 显式开放。

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
npm run test:visual
```

首次运行视觉测试前安装 Chromium：

```bash
npx playwright install chromium
```

视觉测试会截取桌面首页、游戏、暂停、商店，移动首页、游戏、暂停、商店，以及人物动画、物品纹理和 React 占位图片预览。结果保存到 `test-results/visual/`，并按照每 4 张截图生成一张 `contact-sheet-*.png` 拼图。测试还会检查页面异常、控制台错误、资源 404、Canvas 实际尺寸和横向溢出。`visualScreen=shop` 等直达参数只在同时存在 `visual=1` 时生效，不会改变正常生产流程。

## 云存档

首次打开游戏时，浏览器会生成随机 `playerId` 和高强度随机令牌。客户端只保存同步密钥；Worker 在 D1 中只保存令牌的 SHA-256 哈希，不保存明文令牌。

- `GET /api/save/:playerId`：读取云存档
- `PUT /api/save/:playerId`：写入云存档
- `GET /api/health`：服务健康检查

写入采用 revision 乐观并发控制，旧设备覆盖新存档时会返回 `409` 和最新版本。同步密钥等同于存档密码，不能公开分享。

## 分支与自动部署流程

1. 在功能分支修改代码。
2. 分支 push 和针对 `main` 的 Pull Request 会触发 `Check`、`Test`、`Build` 和 `Visual`。
3. `Visual` 生成主要界面截图、资源预览和每 4 张一组的拼图，并上传 Actions artifact。
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
