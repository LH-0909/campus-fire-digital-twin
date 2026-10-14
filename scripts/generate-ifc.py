"""Create an IFC4 semantic model from the exact parameterized GLB box source.
Requires Python + ifcopenshell + numpy. Not a surveyed/as-built building.
Run from repository root after node scripts/generate-model.mjs.
"""
import json, math
from pathlib import Path
import numpy as np
import ifcopenshell
import ifcopenshell.api
import ifcopenshell.validate

root=Path(__file__).resolve().parent.parent
source=json.loads((root/'public/models/building.json').read_text(encoding='utf-8'))
components=json.loads((root/'artifacts/model-source/components.json').read_text(encoding='utf-8'))
model=ifcopenshell.file(schema='IFC4')
run=lambda operation, **kw: ifcopenshell.api.run(operation,model,**kw)
project=run('root.create_entity',ifc_class='IfcProject',name='Campus Dormitory - Parameterized Reference')
run('unit.assign_unit',units=[run('unit.add_si_unit',unit_type='LENGTHUNIT'),run('unit.add_si_unit',unit_type='AREAUNIT'),run('unit.add_si_unit',unit_type='VOLUMEUNIT')])
context=run('context.add_context',context_type='Model')
body=run('context.add_context',context_type='Model',context_identifier='Body',target_view='MODEL_VIEW',parent=context)
site=run('root.create_entity',ifc_class='IfcSite',name='Reference campus')
building=run('root.create_entity',ifc_class='IfcBuilding',name='Dormitory 01')
run('aggregate.assign_object',products=[site],relating_object=project)
run('aggregate.assign_object',products=[building],relating_object=site)
storeys={}
for floor in range(1,7):
    storey=run('root.create_entity',ifc_class='IfcBuildingStorey',name=f'{floor}F')
    storey.Elevation=(floor-1)*3.3
    storeys[floor]=storey
run('aggregate.assign_object',products=list(storeys.values()),relating_object=building)
ps=run('pset.add_pset',product=building,name='Pset_TwinProvenance')
run('pset.edit_pset',pset=ps,properties={'BuildingId':'dorm-01','Source':'Reference image + assumed metric dimensions','Surveyed':False,'LengthM':48.,'DepthM':18.,'StoreyHeightM':3.3})

def geometry(product,w,d,h,x,z,y,rotation=0,three_matrix=None):
    # Convert Three.js Y-up to IFC Z-up: (x, y, z) -> (x, -z, y).
    # Local box is centred on XY, extruded upwards.
    point=model.createIfcCartesianPoint((0.,0.))
    profile=model.createIfcRectangleProfileDef('AREA',None,model.createIfcAxis2Placement2D(point,None),float(w),float(d))
    solid=model.createIfcExtrudedAreaSolid(profile,model.createIfcAxis2Placement3D(model.createIfcCartesianPoint((0.,0.,0.)),None,None),model.createIfcDirection((0.,0.,1.)),float(h))
    rep=model.createIfcShapeRepresentation(body,'Body','SweptSolid',[solid])
    product.Representation=model.createIfcProductDefinitionShape(None,None,[rep])
    m=np.eye(4);c,s=math.cos(rotation),math.sin(rotation)
    m[:3,:3]=[[c,-s,0],[s,c,0],[0,0,1]]
    m[:3,3]=[x,-z,y-h/2]
    if three_matrix is not None:
        # Transform full Three.js orientation, including sloping stair rails.
        # GLTF matrices are column-major, IFC local axes are X, -Z, Y.
        three=np.array(three_matrix,dtype=float).reshape((4,4),order='F')
        axis=np.array([[1.,0.,0.],[0.,0.,-1.],[0.,1.,0.]])
        m[:3,:3]=axis @ three[:3,:3] @ axis.T
        m[:3,3]=axis @ three[:3,3] + m[:3,:3] @ np.array([0.,0.,-h/2])
    run('geometry.edit_object_placement',product=product,matrix=m,is_si=True)

for space in source['spaces']:
    if space['kind']=='exit':continue
    p=run('root.create_entity',ifc_class='IfcSpace',name=space['id'])
    p.LongName=space['name']
    run('aggregate.assign_object',products=[p],relating_object=storeys[space['floor']])
    dimensions={'room':(4.2,6.8),'corridor':(4.2,2.4),'stairs':(4.,4.)}[space['kind']]
    geometry(p,*dimensions,3.05,space['x'],space['z'],space['y']+1.525)
    ps=run('pset.add_pset',product=p,name='Pset_TwinSpace')
    run('pset.edit_pset',pset=ps,properties={'SpaceId':space['id'],'Floor':space['floor'],'Kind':space['kind'],'AreaM2':float(space['area'])})

by_floor={f:[] for f in storeys}
for item in components:
    kind=item.get('kind')
    material=item['material']
    ifc_class='IfcStairFlight' if kind=='stairs' else 'IfcSlab' if kind=='slab' or material=='slab' else 'IfcDoor' if kind=='door' else 'IfcWindow' if material=='glass' else 'IfcWall' if material=='wall' else 'IfcFurnishingElement' if material in ['wood','mattress','blanket'] else 'IfcBuildingElementProxy'
    p=run('root.create_entity',ifc_class=ifc_class,name=item['id'])
    if 'vertices' in item:
        vertices=np.array(item['vertices'],dtype=float).reshape((-1,3))
        transform=np.array(item['matrix'],dtype=float).reshape((4,4),order='F')
        points=np.column_stack((vertices,np.ones(len(vertices)))) @ transform.T
        coordinates=[(float(v[0]),float(-v[2]),float(v[1])) for v in points]
        faces=[tuple(i+1 for i in item['indices'][j:j+3]) for j in range(0,len(item['indices']),3)]
        tess=model.createIfcTriangulatedFaceSet(model.createIfcCartesianPointList3D(coordinates),None,False,faces,None)
        p.Representation=model.createIfcProductDefinitionShape(None,None,[model.createIfcShapeRepresentation(body,'Body','Tessellation',[tess])])
        run('geometry.edit_object_placement',product=p,matrix=np.eye(4),is_si=True)
    else:
        geometry(p,item['width'],item['depth'],item['height'],0,0,0,three_matrix=item['matrix'])
    by_floor[item['floor']].append(p)
    # Tag supports exact mapping of IFC elements back to the geometry source.
    if hasattr(p,'Tag'):p.Tag=item.get('spaceId') or item['name']
for floor,products in by_floor.items():run('spatial.assign_container',products=products,relating_structure=storeys[floor])
path=root/'public/models/dormitory.ifc'
model.write(str(path))
reopened=ifcopenshell.open(str(path))
logger=ifcopenshell.validate.json_logger()
ifcopenshell.validate.validate(reopened,logger)
errors=[s for s in logger.statements if s['level']=='error']
(root/'artifacts/ifc-validation.json').write_text(json.dumps({'schema':reopened.schema,'storeys':len(reopened.by_type('IfcBuildingStorey')),'spaces':len(reopened.by_type('IfcSpace')),'components':len(components),'errors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
if errors:raise RuntimeError(f'IFC schema validation failed: {len(errors)} errors, see artifacts/ifc-validation.json')
print(f'IFC4 created and validated: {path.stat().st_size/1048576:.2f} MB, {len(components)} elements')
