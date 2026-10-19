# Barbarian prototype

Created in Blender for the Rook character trial. This is an original mesh reconstruction
of the requested character, not a downloaded Supercell or Sketchfab model. The Archer
asset was a visual reference only; none of its geometry or textures were copied.

- Editable scene: `barbarian.blend`.
- Rebuild: `blender --background --python scripts/build-barbarian.py` from the repo root.
- Runtime: `public/models/barbarian/barbarian.glb`, with embedded image textures.
- Portrait and full-body render are generated alongside the GLB.
- Static full-body mesh with a separate head pivot. No skeletal rig or locomotion clips.
- Fixed classic costume; wardrobe overrides are intentionally hidden for this prototype.

The character design references Clash of Clans, owned by Supercell. This file does not
grant rights to Supercell's character design. The mesh and texture construction script
is included for editing and review.
