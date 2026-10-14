# Twin State 接口

版本 `twin-state/1`，建筑 `dorm-01`，坐标单位米，Three.js Y向上，时间为演练秒。空间ID以 `public/models/building.json` 为准。

预留 MQTT 主题：`campus/dorm-01/twin/state`。浏览器通过后端桥接后的 JSON WebSocket 订阅；当前没有 MQTT 客户端、传感器连接或已部署桥接服务。

```json
{"version":"twin-state/1","buildingId":"dorm-01","fields":{"R302":{"temperature":68,"smoke":0.35,"fire":0.2}}}
```

`temperature` 单位摄氏度；`smoke`、`fire` 为0–1归一化展示指数。不能把烟气指数直接解释成mg/m³、%/m或能见度。`src/twin/adapters.js` 的 `applyTwinMessage` 负责校验与原子应用消息，未知空间、非法值和错误版本均拒绝。

外部火烟CSV列：`time,space_id,temperature_c,smoke_index,fire_index`。时间帧必须含一致空间集合，数值必须有限，空间必须存在，重复帧/空间拒绝。文件缺少的空间显示22℃和零烟火，导入仅适用于覆盖范围内的回放。数据帧间线性插值，文件结束后保持末帧。

导入真实 GLB 的条件：米制、Y向上、楼层节点extras.floor为1–6，坐标必须匹配现有场景拓扑。目前只支持替换相同空间布局的几何，不会自动从未知GLB推导房间、拓扑或建筑尺寸。

建筑尺寸均为参考图参数化假设：48×18m、六层、层高3.3m、走廊2.4m、宿舍4.2×6.8m、楼梯1.4m、门宽1m。未经现场实测或消防规范校核。
