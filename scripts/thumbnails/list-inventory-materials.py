"""Writes the material names of every furnishing .dts under the vSide inventory root.

Feeds stage-furnishings.mjs, which finds the textures those materials need.
Run with Blender, which supplies the io_scene_dts add-on's mathutils dependency:
    blender --background --factory-startup --python list-inventory-materials.py -- \
        E:\__vSide\Assets\For_UE5\Inventory inventory-materials.json
"""
import glob
import json
import os
import sys

sys.path.insert(0, os.path.join(os.environ["APPDATA"], "Blender Foundation", "Blender", "5.1", "scripts", "addons"))
from io_scene_dts.DtsShape import DtsShape  # noqa: E402

root, out_path = sys.argv[sys.argv.index("--") + 1:][:2]
out = {}
for item in sorted(os.listdir(root)):
    folder = os.path.join(root, item)
    if not item.isdigit() or not os.path.isdir(folder):
        continue
    entries = []
    for dts in glob.glob(os.path.join(folder, "**", "*.dts"), recursive=True):
        entry = {"dts": os.path.relpath(dts, folder)}
        try:
            shape = DtsShape()
            with open(dts, "rb") as fd:
                shape.load(fd)
            entry["materials"] = [m.name for m in shape.materials]
        except Exception as error:  # a damaged shape shouldn't stop the sweep
            entry["error"] = str(error)
        entries.append(entry)
    out[item] = entries
with open(out_path, "w") as fd:
    json.dump(out, fd, indent=0)
print(f"Listed {len(out)} inventory items")
