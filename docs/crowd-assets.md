# 人群渲染与资产

`src/twin/crowd.js` 为本项目原创、米制比例的学生关节模型。衣服、长裤、双节四肢、膝关节、鞋与鞋底、皮肤、头发、背包和肩带使用共享几何体与实例渲染；近距离才显示耳朵、眼睛和鼻子。不是第三方真人扫描模型，也不是实测人体数据。

体态由 `Twin State` 中的人员位置、路径、楼层与局部烟气决定。弯腰与口鼻防护是可视化姿态；显示层不额外改变疏散算法、接触剂量或评分。人员衣服使用自然灰、蓝、米色，不把风险颜色画在人体上；高风险仅使用脚下的小指示环。局部面部细节采用距离剔除，人群关节以 30 Hz 更新。

查阅了 [three.js 的骨骼动画示例](https://threejs.org/examples/webgl_animation_skinning_blending.html) 及 [three.js MIT 许可](https://github.com/mrdoob/three.js/blob/dev/LICENSE)。官方 Soldier 角色来源为 Mixamo，士兵制服与校园学生不匹配，本项目没有下载或使用该人物资产，也没有以仓库软件许可推定第三方模型许可。

集成：`const crowd = createCrowd(scene)`，每帧调用 `crowd.update(twin, { mode, floor, now, camera, layer })`，场景卸载时调用 `crowd.dispose()`。`now` 单位毫秒。学生模式只显示所在楼层，楼层/顶视模式只显示选中楼层，整体剖面/外观显示各楼层；已到达安全区人员隐藏。所有姿态均跟随 `a.y`，不会改写仿真位置。
