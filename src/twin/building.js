// Parameterized reference building. Coordinates and edge lengths are in metres.
// This is an assumed dormitory layout, not a survey of a specific building.
export const building = Object.freeze({
  id: 'dorm-01', name: '1号学生宿舍楼', floors: 6, length: 48, depth: 18,
  storeyHeight: 3.3, corridorWidth: 2.4, roomWidth: 4.2, roomDepth: 6.8,
  wallThickness: .2, doorWidth: 1, stairWidth: 1.4,
  provenance: 'reference-parameterized', surveyed: false, units: 'm',
  description: '根据参考图建立的六层双面宿舍，采用米制尺寸假设，未经实测校核。',
});
export const spaces = [], connections = [];
const addEdge = (a,b,kind='passage',width=2.4) => connections.push({a,b,kind,width,capacity:kind==='door'?2:kind==='stairs'?3:6});
for(let f=1;f<=building.floors;f++) {
  const y=(f-1)*building.storeyHeight;
  for(let i=0;i<10;i++) {
    const x=-18.9+i*4.2;
    const cid=`F${f}-C${i}`;
    spaces.push({id:cid,name:`${f}层${i<3?'西侧':i>6?'东侧':'中央'}走廊`,kind:'corridor',floor:f,x,y,z:0,area:10.08});
    if(i) addEdge(`F${f}-C${i-1}`,cid);
    for(const side of [-1,1]) {
      // The central bay is a transverse circulation hall, not a bedroom.
      if(i===5)continue;
      const number=f*100+(side===-1?i+1:i+11);
      const id=`R${number}`;
      spaces.push({id,name:`${number}宿舍`,number,kind:'room',floor:f,x,y,z:side*4.6,side,area:28.56});
      addEdge(id,cid,'door',1);
    }
  }
  for(const [key,x,z,c] of [['W',-23,0,0],['E',23,0,9],['N',2.1,-10,5]]) {
    const id=`F${f}-S${key}`;
    spaces.push({id,name:`${f}层${{W:'西侧',E:'东侧',N:'北侧'}[key]}楼梯`,kind:'stairs',floor:f,x,y,z,area:16});
    addEdge(`F${f}-C${c}`,id,'passage',1.8);
    if(f>1) addEdge(`F${f-1}-S${key}`,id,'stairs',1.4);
  }
}
for(const [key,x,z,from] of [['W',-27,0,'F1-SW'],['E',27,0,'F1-SE'],['N',2.1,-15,'F1-SN'],['S',2.1,12,'F1-C5']]) {
  const id=`EXIT-${key}`;
  spaces.push({id,name:`${{W:'西侧',E:'东侧',N:'北侧',S:'南侧'}[key]}出口`,kind:'exit',floor:1,x,y:0,z,area:20});
  addEdge(from,id,'exit',1.8);
}
export const spaceById=Object.fromEntries(spaces.map(n=>[n.id,n]));
export const adjacent=Object.fromEntries(spaces.map(n=>[n.id,[]]));
connections.forEach(e=>{
  const a=spaceById[e.a],b=spaceById[e.b];
  e.length=Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)*(e.kind==='stairs'?1.9:1);
  e.key=[e.a,e.b].sort().join('|');
  adjacent[e.a].push({to:e.b,edge:e});adjacent[e.b].push({to:e.a,edge:e});
});
export const exits=spaces.filter(s=>s.kind==='exit');
export const rooms=spaces.filter(s=>s.kind==='room');
