
# Pixel terrain generator

This generates an infinite pixelated fantasy map.

[Alpha demo](https://madblade.github.io/terrain)

Experimental approach used in [spix](https://github.com/madblade/spix).

# Approach

1. Generate a **tileable voronoi-based map** (adapted from the approach by M. O’Leary)
2. **Rasterize** the map, rivers and cities
3. Apply tileable noise for trees, high-frequency hills, etc.
4. Store the result in a **height buffer**
   - Additional buffers can be used for trees / city plans / rivers

Everything is done in a **progressive** fashion in order to respect the real-time budget.

The approach is **interactive** (non-blocking, real-time generation).

# Sources

- [Generating fantasy maps](http://mewo2.com/notes/terrain/), Martin O’Leary

- [Polygonal Map Generation for Games](http://www-cs-students.stanford.edu/~amitp/game-programming/polygon-map-generation/),
  Amit Patel

- [Tileable Perlin noise](https://gamedev.stackexchange.com/a/23705), gamedev.stackexchange

- [js-rasterizer](https://github.com/delphifirst/js-rasterizer), Yang Cao

- [Discrete circles, rings and spheres](https://doi.org/10.1016/0097-8493(94)90164-3), Eric Andres

# Enhancement

Multiple enhancements would be welcome!

- [ ] Soften / fix tile borders!
  - see Tile.stepGeneration, I suspect we should work around the particular the FieldModifier.peaky step
  - in world.js, set WorldMap.DEBUG_THREE to get an idea with the 3D height map
- [ ] Fix rasterizing artifacts on rivers
- [ ] Advanced city rasterizing
- [ ] Add high altitude lakes?
