# Memories · 3D 相册

一个具有拟物质感和空间交互的沉浸式 3D 回忆相册。它既可以记录人物，也可以记录动物；照片、日期、地点、年龄和寄语共同组成一段可以翻阅、整理与分享的回忆。

🌐 在线体验：[album.mabenjiang.xyz](https://album.mabenjiang.xyz)

## 功能

- **3D 回忆展厅**：浏览具有真实厚度、玻璃反光和材质差异的立体相框。
- **相框正反面**：旋转相框，在背面查看拍摄日期、地点、年龄和手写寄语。
- **收藏桌面**：将相框摆放在桌面上，支持拖拽、叠放和重新整理。
- **成长时间轴**：按月份组织回忆，从时间维度回看人物或动物的变化。
- **自动装框**：上传照片后读取元数据、生成缩略图并选择合适的相框方向与材质。
- **昼夜展厅**：根据设备本地时间切换窗边日光或暖色夜灯。
- **回忆彩蛋**：连续点击空白区域触发爪印动画，并可能发现隐藏回忆。
- **纪念卡**：将照片、日期、相框和寄语生成可分享的竖版图片。
- **本地优先**：照片和档案保存在当前浏览器的 IndexedDB 中。

项目预置 3 张柴犬照片作为交互示例，用户可以删除示例并上传自己的照片。

## 技术栈

- Next.js 16
- React 19
- Three.js
- Dexie / IndexedDB
- Vitest
- Cloudflare Workers Static Assets

## 本地运行

需要 Node.js 24 或兼容版本。

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 测试与构建

```bash
npm test
npm run build
```

生产构建会静态导出到 `out/`。

## Cloudflare 部署

首次部署前登录 Wrangler：

```bash
npx wrangler login
```

预检并发布：

```bash
npm run deploy:dry-run
npm run deploy
```

Worker 与自定义域名配置位于 [`wrangler.jsonc`](./wrangler.jsonc)。

## 数据与隐私

当前版本没有用户账号、云数据库或对象存储。用户上传的照片、档案和编辑结果默认只保存在当前浏览器中；清理站点数据或更换设备后不会自动同步。

后续如需多设备同步，可在现有架构上接入 Cloudflare D1、R2 和身份认证。
