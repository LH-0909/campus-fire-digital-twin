"""Optimize a GLB in Blender and preserve floor/space extras.
Usage: blender --background --python scripts/blender-optimize.py -- input.glb output.glb
For real IFC import, use Bonsai in Blender, export GLB with floor and spaceId
extras first, then pass that exported GLB here. This script is not an IFC importer.
"""
import bpy,sys
from pathlib import Path
args=sys.argv[sys.argv.index('--')+1:]
if len(args)!=2:raise ValueError('Expected input.glb output.glb')
src,dst=map(lambda s:Path(s).resolve(),args)
if not src.is_file() or src.suffix.lower()!='.glb':raise ValueError('Input must be an existing GLB')
if src==dst:raise ValueError('Output must differ from input')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(src))
for obj in bpy.context.scene.objects:
    if obj.type!='MESH':continue
    # Remove loose geometry without collapsing measured wall/door dimensions.
    bpy.context.view_layer.objects.active=obj;obj.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=.00001)
    bpy.ops.object.mode_set(mode='OBJECT');obj.select_set(False)
dst.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(dst),export_format='GLB',export_extras=True,export_yup=True,export_apply=True)
print('Optimized GLB:',dst)
