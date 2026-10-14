# 开源组件与实际接入状态

检索日期：2026-10-13。仅引用官方仓库，保留各组件原有许可证。

|项目|官方仓库|本项目实际用途|
|---|---|---|
|Three.js|https://github.com/mrdoob/three.js |实际使用 GLTFLoader 加载 GLB、OrbitControls、实例化人员、材质与楼层剖切；MIT|
|IfcOpenShell / Bonsai|https://github.com/IfcOpenShell/IfcOpenShell |实际用 Python API 从本项目参数和几何源生成 IFC4，并重新打开做 schema 校验；Bonsai 是可选 Blender IFC工具，当前未安装 Blender。许可证按上游组件分别检查|
|Fire Dynamics Simulator|https://github.com/firemodels/fds |提供设备输出CSV转换器；当前没有安装或运行FDS求解器，默认火烟为软件教学模型|

实际产物：`public/models/dormitory.glb`、`public/models/dormitory.ifc`、`public/models/building.json`。IFC 与 GLB 均从同一参数源生成；当前并未执行 IFC→Blender→GLB 转换，不能声称执行过该环节。

真实项目链路应为：实测/CAD/BIM→IFC→Bonsai/Blender校核与轻量化→带floor与spaceId语义的GLB→绑定空间拓扑→Twin State。项目中提供的 `scripts/blender-optimize.py` 处理已导出的 GLB 并保留 extras，不是 IFC 导入器。

FDS 是 NIST 的火烟仿真求解器。真实 FDS 输出需要配置建筑几何、燃烧参数、网格与设备，运行后用 `scripts/convert-fds.py` 映射到前端。格式样例CSV是人工编写的，不是FDS模拟结果。
