
'use strict';

import { Tile }          from './tile/tile';
import { Mesher }        from './mesh';
import { defaultParams } from './tile/terrain';

let WorldMap = function()
{
    this.tiles = new Map();
    this.tileDimension = 2048;

    this.mesher = new Mesher();
    this.mesh = null;
};

WorldMap.prototype.seedWorld = function(seed)
{
    // Init generators, voronoi and buffers.
    let mesher = this.mesher;
    let mesh = mesher.generateGoodMesh(16384,
{ width: 1, height: 1 }
    );
    this.mesh = mesh;
};

WorldMap.prototype.loadTile = function(i, j)
{
    let c = {
        params: defaultParams,
        mesh: this.mesh
    };
    let t = new Tile(i, j, this.tileDimension);
    t.processHeightMap();
    t.placeObjects();
    t.renderToRaster();
    this.tiles.set(`${i},${j}`, t);
};

WorldMap.prototype.genWorld = function()
{
    this.loadTile(0, 0);
    this.loadTile(0, 1);
    this.loadTile(1, 0);
    this.loadTile(1, 1);
};

WorldMap.prototype.getTiles = function ()
{
    return this.tiles;
};

export { WorldMap }
