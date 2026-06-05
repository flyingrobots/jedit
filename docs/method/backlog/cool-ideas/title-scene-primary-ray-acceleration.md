# Title Scene Primary-Ray Acceleration

The title-scene mesh path still spends most close-camera render time traversing
the mesh BVH before it reaches triangle tests.

Evidence from `title/perf-scene-facts` after primary front-face culling:

```bash
node --cpu-prof \
  --cpu-prof-dir /tmp/jedit-title-profile-frontface \
  --cpu-prof-name title-dragon-frontface.cpuprofile \
  scripts/title-scene-profile.mjs \
  --scene neon-dispersion.jedit-scene \
  --theme graphite \
  --width 150 \
  --height 43 \
  --frames 60 \
  --warmup 2 \
  --camera-radius 2.6
```

Top self-time:

```text
rayIntersectsBounds        2744.5 ms  33.4%
visitMeshNode               765.4 ms   9.3%
titleMeshTriangleBarycentric 629.4 ms  7.6%
sub                         559.9 ms   6.8%
intersectTitleMeshTriangle  506.5 ms   6.2%
```

Potential next cuts:

- Build a primary-only visible node list per frame or tile.
- Add node-level facing/normal-cone rejection for primary camera rays.
- Render primary rays in coherent tiles so adjacent samples reuse traversal
  posture.
- Cache stable title-frame samples while camera and scene time are unchanged.
- Consider a coarser screen-space silhouette/depth prepass for one-mesh title
  scenes before expensive optical shading.
