"""Writes material-flags.json: the Torque material flags of every wearable material.

Torque only used a texture's alpha when its material carried the Translucent
flag (0x4). The GLB conversion drops those flags, so the thumbnail renderer
reads them from this file instead of guessing from the alpha channel.

Run with Blender, which supplies the io_scene_dts add-on's mathutils dependency:
    blender --background --factory-startup --python read-dts-material-flags.py -- \
        material-flags.json <...>/Characters/f_player/f_player.dts <...>/Characters/m_player/m_player.dts
"""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.environ["APPDATA"], "Blender Foundation", "Blender", "5.1", "scripts", "addons"))
from io_scene_dts.DtsShape import DtsShape  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1:]
flags = {}
for path in args[1:]:
    shape = DtsShape()
    with open(path, "rb") as fd:
        shape.load(fd)
    for material in shape.materials:
        flags.setdefault(material.name, set()).add(material.flags)
with open(args[0], "w") as fd:
    json.dump({name: sorted(values) for name, values in sorted(flags.items())}, fd, indent=0)
print(f"Wrote {len(flags)} materials to {args[0]}")
