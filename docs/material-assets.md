# 建筑表面与校园环境资产

宿舍材质采用 Poly Haven 的真实摄影扫描纹理。模型的尺寸与校园布局由软件参数生成，纹理的扫描来源不代表这个场景经过宿舍实测。背景校园是独立的米制环境模型，不参与室内拓扑或疏散计算。

## 本地纹理

所有资产均来自 [Poly Haven 官方资产库](https://polyhaven.com/)，适用其 [CC0 资产许可](https://polyhaven.com/license)。使用官方公开 API 获取单个资产下载地址，设置了 `CampusTwinLocalAssetSetup/1.0` User-Agent；资产保存后，应用运行不调用该 API。API 获取规则参见 [官方 API ToS](https://github.com/Poly-Haven/Public-API/blob/master/ToS.md)。

| 本地前缀 | 官方资产页 | 用途 | 原扫描覆盖范围 |
| --- | --- | --- | --- |
| `white_plaster_02` | [White Plaster 02](https://polyhaven.com/a/white_plaster_02) | 灰白室内墙、天花、外墙 | 1 m |
| `concrete_wall_006` | [Concrete Wall 006](https://polyhaven.com/a/concrete_wall_006) | 楼板、楼梯、屋顶、踢脚 | 2 m |
| `interior_tiles` | [Interior Tiles](https://polyhaven.com/a/interior_tiles) | 走廊与寝室瓷砖 | 1.9 m |
| `fine_grained_wood` | [Fine Grained Wood](https://polyhaven.com/a/fine_grained_wood) | 门、门框、桌柜 | 0.6 m |
| `grey_plaster` | [Grey Plaster](https://polyhaven.com/a/grey_plaster) | 周边建筑立面 | 1 m |
| `asphalt_02` | [Asphalt 02](https://polyhaven.com/a/asphalt_02) | 校园沥青道路 | 3 m |
| `concrete_pavement` | [Concrete Pavement](https://polyhaven.com/a/concrete_pavement) | 宿舍周边广场、人行道 | 1.8 m |
| `campus-dusk-1k.hdr` | [Kiara 9 Dusk](https://polyhaven.com/a/kiara_9_dusk) | 黄昏环境光与玻璃、金属反射 | 全天球 HDR |

每套表面包含原始 1024 × 1024 JPEG 的 diffuse、OpenGL normal、roughness 三张图。HDR 为原始 1K Radiance HDR，约 1.44 MiB。文件均由 `dl.polyhaven.org` 官方 CDN 下载。没有把参考效果图贴在 3D 建筑上。

`materials.js` 对 diffuse 使用 sRGB，normal 与 roughness 使用线性数据，所有表面使用重复包裹。`model.js` 的六面 Box UV 按物理尺寸展开，1 UV 单位为 1 m，因此门和窄墙条不会把整张纹理拉伸到自身尺寸。地砖图旋转 45°以对齐走廊轴线；软件中按约 0.6 m 的地砖假设调整其覆盖范围至 1.7 m。为接近参考图的灰白表面，瓷砖与混凝土在着色器中降低饱和度；法线和粗糙度仍由原扫描图控制。

## 集成与释放

在 GLB 按楼层合并后，对每个克隆材质调用 `applyArchitecturalMaterials(material)`。几何合并保留原有 UV。纹理是场景内共享缓存，卸载完整场景后调用 `disposeArchitecturalTextures()`。不要仅释放原始 GLB 时顺带释放新材质引用的共享贴图。

`createCampus(scene)` 增加并返回 `CampusContext` group，没有独立的动画循环、DOM、网络接入或传感器连接。校园周边采用 8 栋建筑、分层立面、不同照明的窗、路缘、道路标线、台阶、长椅和路灯；树木由不规则枝干与小型曲面叶片构成，避免使用简单球形树冠。几何按材质合并，叶片使用 InstancedMesh，共 17 个绘制对象，约 18.4 万三角面。建议学生视角隐藏背景 group，集中渲染当前楼层。

这套环境没有声称是指定大学的测绘校园。真实宿舍的 IFC/CAD 数据接入后，应按其外墙、标高和室内材质继续校核。
