
'use strict';

import { Tile } from './tile/tile';

let WorldMap = function()
{
    this.tiles = new Map();
    this.tileDimension = 2048;
};

WorldMap.prototype.seedWorld = function(seed)
{
    // Init generators, voronoi and buffers.
};

WorldMap.prototype.loadTile = function(i, j)
{
    let t = new Tile(i, j, this.tileDimension);
    this.tiles.set(`${i},${j}`, t);
};

export { WorldMap }
