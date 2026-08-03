# Source content

Non-destructive production files live here and remain outside the runtime bundle.

```text
blender/characters
blender/environments
blender/modules
blender/props
blender/wells
textures
audio
concept
```

Use metres, apply transforms before export, and follow the naming rules in the architecture document. Runtime-ready files are written to `content/exported/` by the asset pipeline and are not committed until an asset delivery strategy is selected.
