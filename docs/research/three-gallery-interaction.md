# Three.js 3D 相框展厅：交互与质感调研

> 研究范围：Three.js 官方文档、官方 examples/source，以及 GitHub 原仓库源码。
> 目标：提炼能迁移到本项目 **raw Three.js** 引擎的做法；不引入 R3F，不照搬 Drei。

## 结论摘要

当前展厅“不像真实立体相框”的主要原因，不是某一个材质参数不足，而是空间线索没有形成闭环：

1. **相框需要连续且有倒角的实体轮廓**，内部再分出背板、卡纸、照片、玻璃与压边；仅用几块薄盒子叠在照片周围，边缘高光和层次容易像 UI 卡片。
2. **必须有接收阴影的墙面或台面**。相框的厚度只有通过接触阴影、投影偏移、边缘高光和遮挡关系才能被读出来；贴在相框自身背后的透明阴影贴图不能替代世界空间接触阴影。
3. **PBR 材质必须配环境光照**。木框、金属框与玻璃应该在同一 PMREM 环境里响应不同的粗糙度、金属度、clearcoat 和 transmission。
4. **选中动画应由相框自身的世界变换推导相机目标**。固定写死相机和相框的目标坐标，会在过渡时产生“物体被搬到 UI 插槽”的感觉；相机跟随相框的局部锚点更连贯。
5. **所有动画都用 delta-time 阻尼或弹簧状态推进**。hover、视差、聚焦、翻面、甩动分别维护目标值和速度，避免直接赋值或逐帧固定 lerp 带来的刷新率差异。
6. **200 张照片不能一次性创建完整 3D 相框与全尺寸纹理**。需要可视窗口对象池、纹理懒加载和资源释放；装饰件才适合实例化，照片本身不适合强行合批。

关键参考实现是 pmndrs 官方示例仓库中的 `image-gallery`：它用有真实 Z 厚度的外框、内衬与图片三层结构，配环境光、雾和模糊地面反射；点击时从相框父节点计算世界坐标与四元数，再平滑移动相机。源码：
https://github.com/pmndrs/examples/blob/main/demos/image-gallery/src/App.jsx

## 1. 相框建模：让轮廓先“读成实体”

### 1.1 连续外框优先于四根普通长方体

Three.js `ExtrudeGeometry` 原生支持 `depth`、`bevelThickness`、`bevelSize` 与 `bevelSegments`；`Shape` 又支持 holes，因此可以用“外轮廓减内孔”一次挤出连续框体。这样四角、内沿与外沿能共享一致法线和倒角高光。来源：
https://threejs.org/docs/pages/ExtrudeGeometry.html
https://threejs.org/docs/pages/Shape.html

建议迁移：

- 为 `landscape / portrait / square × walnut / titanium / oak` 预生成 9 份 frame-ring geometry。
- 外轮廓使用轻微圆角矩形，内孔略向内收；`depth` 作为真正框深。
- 建议调参起点：`depth 0.14–0.22`、`bevelThickness 0.018–0.035`、`bevelSize 0.012–0.025`、`bevelSegments 2–3`。这些是本项目的视觉调参起点，不是官方默认值。
- 如果实现连续带孔轮廓成本过高，至少复用 Three.js 官方 `RoundedBoxGeometry`，并把每根框条做出清晰的前沿/内沿高度差；官方实现会生成圆角边缘、正确法线和 UV：
  https://github.com/mrdoob/three.js/blob/dev/examples/jsm/geometries/RoundedBoxGeometry.js

### 1.2 相框内部应是多层真实 Z 结构

pmndrs `image-gallery` 不是一张图片贴在盒子上：外框是有 Z 厚度的 `boxGeometry`，内层框和图片分别放在更靠前的 Z 位置。这种层级直接产生遮挡和边缘视差。来源：
https://github.com/pmndrs/examples/blob/main/demos/image-gallery/src/App.jsx#L67-L101

建议每个相框至少拆成：

- 背板：最深，背面寄语贴图附着其背面。
- 卡纸/mat：比照片略后，粗糙、偏暖、非纯白。
- 照片：独立平面，避免框材质污染照片色彩。
- 玻璃：在照片前方留出小间隙。
- 内压边与外框：前后高度不同，让斜视时出现多道轮廓。

不要靠大幅放大整个相框制造 hover；实体感更依赖层间遮挡、边缘高光和投影变化。

### 1.3 材质差异必须由粗糙度与法线表达

`MeshStandardMaterial` 是 metallic-roughness PBR 材质，官方明确建议搭配 environment map；`bumpMap` / `normalMap` 可表达木纹等不改变轮廓的微表面细节。来源：
https://threejs.org/docs/pages/MeshStandardMaterial.html

建议：

- 胡桃木/橡木：`metalness≈0`，较高 roughness，使用低强度木纹 bump/normal 与轻微 roughness variation；避免只换纯色。
- 钛金属：高 metalness、中低 roughness，必要时使用 anisotropy，但仅在确有拉丝纹理时开启。
- 卡纸：高 roughness、几乎无环境反射；照片保持自己的 sRGB 色彩，不用高金属/clearcoat。
- 所有颜色纹理明确设置 `texture.colorSpace = THREE.SRGBColorSpace`；Three.js 官方文档指出颜色数据需要标注色彩空间。来源：
  https://threejs.org/docs/pages/Texture.html#colorSpace

## 2. 玻璃与反射：反光必须随视角和环境移动

`MeshPhysicalMaterial` 的 transmission 比单纯降低 opacity 更适合薄玻璃；官方说明 transmissive glass 即使高度透明仍保留反射，并要求 transmission 非零时 `opacity = 1`。`thickness = 0` 表示 thin-walled，IOR 默认 1.5。该材质逐像素成本也更高，启用的物理特性越多，开销越大。来源：
https://threejs.org/docs/pages/MeshPhysicalMaterial.html

建议采用两档方案：

- **展厅缩略态（性能优先）**：薄玻璃平面，`MeshPhysicalMaterial` + `clearcoat`，低强度环境反射；可保留一条很淡的动态高光带，但高光位置必须由视角/法线或环境反射驱动，不要像固定贴纸。
- **详情态（质感优先）**：仅选中的一张启用 `transmission 0.85–0.95`、`opacity 1`、`ior≈1.5`、`thickness 0–0.025`、低 roughness；未选中相框退回轻量材质。

玻璃不能完全依赖一张固定斜条。固定斜条可以作为微弱美术补光，但真实主反光应来自 PMREM 环境；否则相框旋转时反光不会正确变化，立即暴露“2D 贴片感”。

## 3. 环境光、色调映射与昼夜

Three.js 官方推荐 PBR 材质使用环境图；`PMREMGenerator` 会生成按粗糙度访问的预过滤环境辐照，`RoomEnvironment` 可以不下载 HDR，直接生成基础室内 IBL。来源：
https://threejs.org/docs/pages/PMREMGenerator.html
https://threejs.org/docs/pages/RoomEnvironment.html
https://threejs.org/docs/pages/MeshStandardMaterial.html

建议：

- 白天和夜晚各维护一个 PMREM 环境，不要每次动画帧重建。
- 白天：大面积冷暖窗光 + 柔和填充；夜晚：暖色主灯 + 更暗的冷色环境。
- 用同一个环境同时驱动木框、金属框和玻璃，让材质差异自然出现。
- 保留 `SRGBColorSpace + ACESFilmicToneMapping`，但逐场景校准 exposure，避免木框暗部被压成黑块。
- 增加真实墙面和窄台面/地面作为光影接收体；CSS 背景可以继续做氛围，但不能承担 3D 接触关系。

Three.js renderer 支持阴影开关、阴影图类型以及 `shadowMap.autoUpdate / needsUpdate`；静止场景可以停止重复更新阴影，只在相框移动、翻转或昼夜切换时标记更新。来源：
https://threejs.org/docs/pages/WebGLRenderer.html

## 4. 接触阴影与地面反射：决定物体有没有“重量”

Three.js 官方 contact-shadow 示例的核心流程是：

1. 从贴近接触面的正交相机渲染深度到 render target；
2. 将深度变为黑色透明阴影；
3. 横向、纵向模糊，且第二次小半径模糊用于减少伪影；
4. 在真实接收平面上叠加阴影。

源码：
https://github.com/mrdoob/three.js/blob/dev/examples/webgl_shadow_contact.html

这比“在每个相框背后放一张径向渐变贴图”更可信，因为阴影会随相框姿态和离墙距离变化。

迁移建议：

- 展厅增加一面真实墙，主相框距墙保留很小距离；使用正常 shadow map 产生右下方柔和投影。
- 对中心/选中相框增加低分辨率 contact-shadow pass，或只在过渡期间更新，结束后冻结。
- 阴影分两层：短距离深色接触阴影 + 大范围浅色投影；不要只有一团均匀黑雾。
- 桌面模式保留台面接触阴影，甩动照片离开桌面时阴影应变浅、变软并稍微偏移。

Drei `MeshReflectorMaterial` 的源码展示了高质量模糊平面反射的代价：需要虚拟相机、深度纹理、至少一个离屏 render target，并可能额外执行 blur pass。来源：
https://github.com/pmndrs/drei/blob/master/src/core/MeshReflectorMaterial.tsx

因此本项目不应照搬高分辨率实时反射。更合适的做法是：

- 只给台面/展厅窄地面做低强度、低分辨率、强 roughness 的模糊反射；
- 只在镜头或对象运动时更新；
- 移动端关闭平面反射，保留 IBL + 阴影。

## 5. 相机、视差与选中动画

### 5.1 用相框局部锚点生成聚焦相机

pmndrs `image-gallery` 点击相框后，会先更新世界矩阵，再从相框父节点的局部点计算世界相机位置，并读取世界四元数；每帧对 camera position 和 quaternion 做阻尼。这样无论相框原来在哪、如何旋转，相机都沿连续空间关系靠近它。来源：
https://github.com/pmndrs/examples/blob/main/demos/image-gallery/src/App.jsx#L37-L56

raw Three.js 迁移方式：

```js
// 每个 frame.root 下预设一个不可见 focusAnchor
frame.focusAnchor.position.set(0, 0, focusDistance);

frame.root.updateWorldMatrix(true, true);
frame.focusAnchor.getWorldPosition(cameraTargetPosition);
frame.focusAnchor.getWorldQuaternion(cameraTargetQuaternion);

camera.position.lerp(cameraTargetPosition, alpha);
camera.quaternion.slerp(cameraTargetQuaternion, alpha);
```

Three.js `Object3D` 提供 `getWorldPosition`、`getWorldQuaternion`、`localToWorld`；`Quaternion.slerp` 用于球面旋转插值。来源：
https://threejs.org/docs/pages/Object3D.html
https://threejs.org/docs/pages/Quaternion.html#slerp

优先替换当前“相框移到固定详情坐标 + 相机移到固定坐标”的双重硬编码。让相框只做必要的轻微构图调整，相机完成主要靠近动作，空间连续性会明显提升。

### 5.2 适当增大 FOV，恢复透视深度

pmndrs `image-gallery` 使用 70° FOV，并通过前后错位、雾和地面反射强化深度。来源：
https://github.com/pmndrs/examples/blob/main/demos/image-gallery/src/App.jsx#L11-L34

本项目不必照抄 70°；但当前极窄 FOV 会压缩前后距离，使相框像平面排版。建议从 **38–52°** 试起，同时重新校准相机距离和相框间距。这个区间是针对当前视觉风格的推导建议，不是来源默认。

### 5.3 视差应来自相机和对象的相对运动

高质量视差建议拆成三层：

- 指针移动：相机位置做极小 X/Y 平移；
- 展厅组：向相反方向做更小旋转；
- hover 相框：依据命中点做局部倾斜、Z 向抬升，并改变阴影/反射，而不是统一放大很多。

`PresentationControls` 的源码把拖动 delta 按 viewport 宽高归一化，再限制极角/方位角，并用 delta-time damping 平滑旋转和缩放；松手时可以 snap 回初始姿态。来源：
https://github.com/pmndrs/drei/blob/master/src/web/PresentationControls.tsx

raw Three.js 只需要迁移状态机思想：

- `pointer -> targetRotation/targetPosition`
- `target -> current` 使用阻尼
- `pointerup -> snapTarget`
- `grab / grabbing` 光标与状态同步

不要复制 React hook 或手势库代码。

### 5.4 所有过渡使用帧率无关阻尼

Three.js `MathUtils.damp(x, y, lambda, dt)` 明确使用 delta time，保证不同刷新率下运动一致。旋转使用 quaternion slerp，翻面角度则单独维护角速度和 snap 目标。来源：
https://threejs.org/docs/pages/MathUtils.html#damp
https://threejs.org/docs/pages/Quaternion.html#slerp

建议动效节奏：

- hover：120–180ms 感知速度，位移小、响应快；
- 点击聚焦：650–950ms，相机先启动，其他相框延迟 40–80ms 后退；
- 翻到背面：保留拖拽角速度，松手吸附到 0 或 π；接近吸附点时加阻尼，不做线性匀速；
- 关闭：沿原相机/相框路径返回，不从屏幕底部重新“生成”画廊。

这些时间是本项目调参建议；来源提供的是实现机制，不是这些具体数值。

## 6. Hover、点击和命中范围

Three.js `Raycaster` 支持通过 layers 忽略无关对象，并返回最近交点；`intersectObjects` 默认可递归，装饰子网格越多，命中成本和行为越难控制。来源：
https://threejs.org/docs/pages/Raycaster.html

pmndrs `image-gallery` 只让外层相框 mesh 负责事件，内衬与图片主动禁用 raycast；这样 hover/click 始终对应同一个“相框”交互实体。来源：
https://github.com/pmndrs/examples/blob/main/demos/image-gallery/src/App.jsx#L81-L96

raw Three.js 建议：

- 每张可交互相框仅保留一个简单 hit proxy（薄 box），放到专用 interaction layer。
- 玻璃、卡纸、照片、阴影、装饰全部从 raycast 列表排除。
- `pointerdown` 记录对象与坐标；移动超过阈值进入 drag/orbit，不再触发 click。
- hover 退出要以当前最近命中对象为准，不要依赖复杂子 mesh 的 enter/leave 顺序。

## 7. 时间轴滚动与“相框依次进入镜头”

Drei `ScrollControls` 把 DOM scroll 映射为 0–1 offset，并用 damping 平滑；还提供 `range / curve / visible` 三种窗口函数，使每一段内容可以独立获得线性进度、0→1→0 的波峰进度和可见状态。源码：
https://github.com/pmndrs/drei/blob/master/src/web/ScrollControls.tsx

raw Three.js 可直接迁移数学，不迁移 React 组件：

```js
const start = from - margin;
const end = start + distance + margin * 2;
const range = offset < start ? 0 : offset > end ? 1 : (offset - start) / (end - start);
const curve = Math.sin(range * Math.PI);
const visible = offset >= start && offset <= end;
```

用法：

- `range` 控制相框沿路径进入；
- `curve` 控制离镜头最近时的抬升、旋转回正和阴影加深；
- `visible` 控制对象池绑定与纹理加载；
- scroll 原始值先阻尼成 `offset`，再驱动相框，避免滚轮阶跃。

pmndrs 的 infinite-scroll 示例还把 `scroll delta` 阻尼成 Z 向位移和图像状态，说明速度本身可以成为视觉输入，而不只是位置。来源：
https://github.com/pmndrs/examples/blob/main/demos/infinite-scroll/src/App.jsx#L21-L33

## 8. 性能：面向 200 张照片的实现边界

### 8.1 不要一次创建 200 套完整相框

建议维护 7–9 个 `FrameView` 对象池，只绑定当前焦点前后若干条 memory。时间轴使用上述 `visible` 窗口；详情态额外保留选中项。离开窗口时解除照片纹理并复用 mesh。

原因：

- 当前每个相框包含多根框条、内沿、玻璃、反光、背板、阴影与支架；200 套会带来大量对象、材质与 draw calls。
- 200 张独立照片各有独立纹理，不适合把整个相框合成一个 `InstancedMesh`。

### 8.2 共享静态资源，实例化重复装饰

Three.js `InstancedMesh` 用于相同 geometry/material、不同 transform 的大量对象，可减少 draw calls。来源：
https://threejs.org/docs/pages/InstancedMesh.html

建议：

- 缓存 9 份 frame geometry 和每种材质族，不在每张照片里重复 new。
- 爪印、叶片、挂钉、远景装饰可用 `InstancedMesh`。
- 照片、背面寄语纹理和需要独立透明排序的玻璃不要勉强实例化。

### 8.3 纹理懒加载与释放

Three.js 文档要求不再使用纹理时调用 `Texture.dispose()`；anisotropy 越高，纹理采样成本越高。来源：
https://threejs.org/docs/pages/Texture.html

建议：

- 只为可视窗口加载 display texture；远处先用 thumbnail。
- 详情打开后再升级到高分辨率纹理，关闭后按 LRU 回收。
- 相框解绑 memory 时释放不再缓存的 photo/back canvas texture。
- 背面寄语 CanvasTexture 延迟到首次翻面时创建。

### 8.4 控制像素比与多通道效果

pmndrs `image-gallery` 把 DPR 限制在 `[1, 1.5]`；这类充满 PBR、透明玻璃、阴影和反射的场景，像素数对 GPU 成本影响很大。来源：
https://github.com/pmndrs/examples/blob/main/demos/image-gallery/src/App.jsx#L11-L12

建议：

- 桌面默认 `Math.min(devicePixelRatio, 1.5)`；高性能设备可动态升到 2。
- 反射、contact shadow 分辨率与主 canvas 解耦。
- 玻璃 transmission 只给选中项开启。
- 静态时冻结阴影/反射更新；动画期间恢复。
- 通过 `renderer.info.render.calls / triangles` 与 `renderer.info.memory.textures` 做验收，而不是只看肉眼帧率。renderer info 来源：
  https://threejs.org/docs/pages/WebGLRenderer.html

## 9. 建议实施顺序

### P0：先恢复“立体相框”

1. 加真实墙面与台面/窄地面接收体。
2. 把框条改为连续有倒角的 ring geometry，或至少做真实内外沿。
3. 重建背板、卡纸、照片、玻璃的 Z 分层。
4. 使用 PMREM 环境，让木、金属、玻璃共享光照。
5. 调整 FOV 到 38–52° 区间并重做前后构图。

### P1：再恢复“高级交互”

1. 给每个相框添加 `focusAnchor`，从世界变换推导相机位置与 quaternion。
2. hover 改为微抬升 + 局部倾斜 + 阴影/反光变化，降低整框缩放。
3. 点击与关闭使用同一条可逆相机路径。
4. 翻面保留角速度、阻尼和 0/π 吸附。
5. 时间轴采用阻尼 scroll offset + range/curve/visible。

### P2：最后加质感特效与扩容

1. 中心相框/桌面增加可冻结的 contact shadow。
2. 只在需要时启用低分辨率模糊反射。
3. 建立 7–9 个相框对象池、纹理 LRU 和背面贴图懒生成。
4. 粒子与重复装饰改为 InstancedMesh。

## 10. 视觉验收标准

- 相框静止时，仅看侧边、内沿与墙面阴影就能判断其厚度。
- 相框左右旋转时，框边高光、玻璃反射、照片遮挡和墙面阴影同时变化。
- hover 不出现“网页卡片放大”感；相框像被轻轻托起，重量仍然存在。
- 点击后相机沿相框空间靠近，物体不会突然跳到固定 UI 位置。
- 关闭能沿原路径回到展厅，前后相框层级持续可追踪。
- 白天与夜晚不仅背景颜色不同，框材质、玻璃反光和投影颜色也随环境变化。
- 200 条数据下，常驻完整 3D 相框数量保持在对象池上限，GPU 纹理数量不会随滚动单向增长。

## 来源索引

- Three.js `ExtrudeGeometry`：https://threejs.org/docs/pages/ExtrudeGeometry.html
- Three.js `Shape`：https://threejs.org/docs/pages/Shape.html
- Three.js `RoundedBoxGeometry` source：https://github.com/mrdoob/three.js/blob/dev/examples/jsm/geometries/RoundedBoxGeometry.js
- Three.js `MeshStandardMaterial`：https://threejs.org/docs/pages/MeshStandardMaterial.html
- Three.js `MeshPhysicalMaterial`：https://threejs.org/docs/pages/MeshPhysicalMaterial.html
- Three.js `PMREMGenerator`：https://threejs.org/docs/pages/PMREMGenerator.html
- Three.js `RoomEnvironment`：https://threejs.org/docs/pages/RoomEnvironment.html
- Three.js contact shadows example source：https://github.com/mrdoob/three.js/blob/dev/examples/webgl_shadow_contact.html
- Three.js `WebGLRenderer`：https://threejs.org/docs/pages/WebGLRenderer.html
- Three.js `MathUtils`：https://threejs.org/docs/pages/MathUtils.html
- Three.js `Quaternion`：https://threejs.org/docs/pages/Quaternion.html
- Three.js `Object3D`：https://threejs.org/docs/pages/Object3D.html
- Three.js `Raycaster`：https://threejs.org/docs/pages/Raycaster.html
- Three.js `InstancedMesh`：https://threejs.org/docs/pages/InstancedMesh.html
- Three.js `Texture`：https://threejs.org/docs/pages/Texture.html
- pmndrs image gallery：https://github.com/pmndrs/examples/blob/main/demos/image-gallery/src/App.jsx
- pmndrs infinite scroll：https://github.com/pmndrs/examples/blob/main/demos/infinite-scroll/src/App.jsx
- Drei `PresentationControls` source：https://github.com/pmndrs/drei/blob/master/src/web/PresentationControls.tsx
- Drei `ScrollControls` source：https://github.com/pmndrs/drei/blob/master/src/web/ScrollControls.tsx
- Drei `MeshReflectorMaterial` source：https://github.com/pmndrs/drei/blob/master/src/core/MeshReflectorMaterial.tsx
