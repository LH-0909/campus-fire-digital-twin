# 校园消防数字孪生应急疏散平台

Vue 3 + Three.js + ECharts + Node.js + SQLite。含登录、指挥大屏、第一/第三人称学生演练、教师管理与预案复盘。

**公开演示：[打开校园消防数字孪生平台](https://lh-0909.github.io/campus-fire-digital-twin/)**

公开版通过 GitHub Pages 发布，保留账号、密码、验证码和三角色入口的完整登录界面。演示账号为 `teacher`、`student`、`admin`，密码均为 `Campus@2026`；也可使用演示账号按钮直接进入。公开版在当前浏览器校验演示账号和验证码，不代表真实身份或服务器权限。记录仅保存在访问者的浏览器，可导出。没有传感器连接、云端共享数据库或跨用户实时协同。

已有演示会话时可点击右上角退出；[直接打开登录页](https://lh-0909.github.io/campus-fire-digital-twin/?login=1)也能显示登录界面。

## 启动

需要 Node.js 22.13+（当前验证版本24.19）。

```sh
pnpm install
pnpm dev -- --port 5174 --strictPort
```

打开 http://127.0.0.1:5174 。登录服务包含在 Vite 开发服务中。三个本地演示账号：`teacher`、`student`、`admin`；密码均为 `Campus@2026`，选择对应入口。也可点击明确标注的演示账号按钮进入。

生产本机运行：

```sh
pnpm build
pnpm start
```

地址 http://127.0.0.1:8787 。普通 `pnpm preview` 不含登录API。账户、哈希密码、会话与演练摘要保存在 `.local/campus.sqlite`，不提交此目录。图形验证码、入口角色、HttpOnly会话、登录失败限流和退出均为实际服务逻辑。当前没有学校SSO、账号注册或密码邮件找回。

GitHub Actions 在每次推送 `main` 时测试、构建并部署公开版。构建设置 `VITE_PUBLIC_DEMO=true`、`VITE_BASE_PATH=/campus-fire-digital-twin/`。公开模式使用独立浏览器演示适配器；本地服务器版本的认证流程保持有效。

## 可操作功能

- 登录页：按夜景参考图重建，独立背景图片与真实表单控件；三角色入口、密码显示、验证码刷新、记住我、演示账号。
- 数字孪生：加载实际GLB，支持整体剖面、完整外观、1–6F剖切。烟气图层显示浓度场、峰值和图例；人员图层可点选或按编号定位、跟踪轨迹并切换所在楼层；路线图层比较四出口距离，绿色推荐、蓝色备选，含跨层楼梯路径，封闭出口后自动重算。
- 学生端：默认第三人称，可切换第一人称。开始前自由探索房间，墙体、家具、门扇参与碰撞。WASD移动、Shift疾走、方向键转向、拖动环视、滚轮调整第三人称距离；V切换视角，C弯腰，F防护，E操作附近房门或下楼，R切换引导。楼梯平台提供上楼/下楼选择，移动端方向按钮支持持续按住。相机靠墙会缩短距离，角色随移动与防护调整姿态。正式演练才记录动作和风险暴露。
- 教师端：新建演练（火源、策略、随机种子）、状态筛选、虚拟人员列表、场景与尺寸说明、评分、服务端历史摘要。
- 复盘：每2秒保存状态快照，可拖动回放和倍速播放；同条件实际运行就近疏散与拥堵分流，计算时间、等待、完成率、风险暴露和规则评分。
- 外部火烟CSV：数据校验与帧间插值。`public/data/field-template.csv` 是人工格式样例，非FDS结果。支持FDS设备CSV转换，未运行FDS求解器。
- 传感器：仅保留标准Twin State消息契约与校验函数，没有传感器连接或MQTT部署。

## 建筑真实性与模型链路

当前建筑是根据参考图创建的米制参数化宿舍模型：主楼48×18m、6层、层高3.3m、走廊2.4m、宿舍开间4.2m/进深6.8m、108间宿舍、3处楼梯、4个出口。楼梯与阳台有外扩。参数未经现场测量、消防规范或物理实验校核，不能声称与某栋真实宿舍1:1一致。

同一参数源生成 `public/models/building.json`、`dormitory.glb`（约3.79MiB）和 `dormitory.ifc`（约16.21MiB）。IFC4含6个楼层、186个室内空间和21,477个构件；已用IfcOpenShell重新打开并通过schema校验，报告见 `artifacts/ifc-validation.json`。构件带楼层和空间ID，斜梯梁、扶手的完整旋转也保留在IFC中。

```sh
pnpm model:generate
python scripts/generate-ifc.py
```

IFC脚本需要`ifcopenshell`和`numpy`。本机已在Codex bundled Python安装并验证。当前GLB直接从相同几何源导出，未执行IFC→Blender→GLB转换。`scripts/blender-optimize.py`为可选GLB优化步骤，Blender未安装/未运行。真实建筑链路需用实测CAD/BIM替换参数源，在Bonsai/Blender校核后绑定拓扑。

新版建筑补齐窗框、墙裙、消防箱、照明管、门扇五金、六人寝具、双跑楼梯和平台。运行时加载本地真实扫描PBR贴图，使用HDR环境光、阴影、环境遮蔽与抗锯齿；实体剖切替代整墙透明。关门操作会旋转真实门扇。拓扑边使用与建筑一致的实际行走折线，人员及学生下楼共用两跑楼梯路径，路线距离按折线计算。

模型、人员与火烟全部共用Twin State。默认火烟仍是拓扑扩散教学模型，不是CFD；火焰使用体积射线采样展示，烟气按空间指数可视化，不能作为物理预测值。人群使用图上的容量与动态A*，不是经过验证的连续人群动力学。人物采用衣裤、四肢、头发和背包的关节实例网格，仍属于简化模型。当前实现没有达到参考图照片级人物或真实宿舍测绘1:1。登录背景是参考图衍生的概念图，不是实际校园数据。

## 验证

```sh
pnpm test
pnpm build
```

自动测试覆盖认证/角色/会话/限流、疏散连通性、出口封闭与恢复、确定性、快照、学生碰撞/防护、外部场数据插值、全部199条路径的实体通行，以及图层区分、四出口备选、人员过滤、规范化移动、任意附近房门、双向楼梯、第三人称角色和公开演示记录隔离。浏览器截图与模型校验报告保存在本地 `artifacts/`，不会随仓库发布。

`pnpm test:browser` 是可供自行运行的Edge自动化回归脚本，须先启动5174端口服务。旧MVP文件保留为 `src/App.legacy.vue`、`src/style.legacy.css`、`src/simulation.js`、`tests/browser.legacy.mjs` 与 `docs/legacy-mvp.md`。

进一步说明：[开源来源](docs/open-source.md)、[Twin接口与数据单位](docs/twin-contract.md)、[图片资产与提示词](docs/assets.md)、[真实扫描材质来源](docs/material-assets.md)、[本次模型与渲染改进](docs/realism-update.md)。
