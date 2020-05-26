
'use strict';

import { Tile }                       from './tile/tile';
import { Mesher }                     from './mesh';
import { defaultParams }              from './tile/terrain';
import { Rasterizer }                                                                           from './tile/pixel';
import {
    BufferAttribute,
    BufferGeometry, DataTexture,
    DoubleSide,
    Line,
    LineBasicMaterial, Mesh, MeshBasicMaterial,
    MeshPhongMaterial, PlaneBufferGeometry, RGBAFormat,
    Vector3
} from 'three';

let WorldMap = function()
{
    this.tiles = new Map();
    this.tileDimension = 512;

    this.mesher = new Mesher();
    this.mesh = null;

    this.rasterizer = new Rasterizer(this.tileDimension);
    this.noiseTile = null;
};

WorldMap.prototype.seedWorld = function(seed)
{
    // Init generators, voronoi and buffers.
    let mesher = this.mesher;
    let mesh = mesher.generateGoodMesh(16384,
        { width: 1, height: 1 }
    );
    console.log(mesh);
    this.mesh = mesh;

    let rasterizer = this.rasterizer;
    rasterizer.precomputeNoiseTile(5);
    this.noiseTile = rasterizer.noiseTile;
};

WorldMap.prototype.stepTileGeneration = function(tile)
{
    if (!tile.ready)
        tile.stepGeneration();

    return tile.ready;
};

WorldMap.prototype.loadTile = function(i, j)
{
    let c = {
        params: defaultParams,
        mesh: this.mesh
    };
    let t = new Tile(i, j, this.tileDimension, c);
    t.setNoiseTile(this.noiseTile);

    // t.processHeightMap();
    // t.placeObjects();
    // t.renderToRaster();
    this.tiles.set(`${i},${j}`, t);
};

WorldMap.prototype.generateIfNeeded = function(scene, camera)
{
    let p = camera.position;
    const x = p.x;
    const y = p.y;
    const i = Math.round(x);
    const j = Math.round(y);
    const tid = `${i},${j}`;
    let t = this.tiles.get(tid);
    // console.log(t);

    if (!t)
    {
        t = new Tile(i, j, this.tileDimension, { params: defaultParams, mesh: this.mesh });
        t.setNoiseTile(this.noiseTile);
        this.tiles.set(tid, t);
    }
    else if (!t.ready)
    {
        t.stepGeneration();
    }
    else if (!t.presentInScene)
    {
        t.presentInScene = true;
        if (!t.p)
        {
            let buffer = this.makeImageBufferFromRaster(t, t.getRaster());
            let p = this.addThreeMesh(
                scene, t.getCountry(), t.triMesh, t.dimension, t.dimension, buffer, t.coordX, t.coordY
            );
            t.p = p;
        }
        else
        {
            scene.add(t.p);
        }
    }

    this.tiles.forEach((tile, id) => {
        if (tile.presentInScene && id !== `${i},${j}` && tile.p) {
            scene.remove(tile.p);
            tile.presentInScene = false;
        }
    });
};

WorldMap.prototype.genWorld = function()
{
    return new Promise(resolve =>
    {
        setTimeout(() =>{
            // this.loadTile(0, 0);
            // this.loadTile(0, 1);
            // this.loadTile(1, 0);
            // this.loadTile(1, 1);
            resolve();
        }, 1);
    })
};

WorldMap.prototype.getTiles = function ()
{
    return this.tiles;
};

WorldMap.prototype.makeImageBufferFromRaster = function(
    tile, heightBuffer
)
{
    const width = tile.dimension;
    const height = tile.dimension;
    let rb = heightBuffer;
    let buffer = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < height; ++i) for (let j = 0; j < width; ++j)
    {
        let s = i * width + j;
        let stride = s * 4;
        let si = (width - i - 1) * width + j;
        let v = rb[si] >> 0;
        buffer[stride    ] = v > 0 ? v : 0;
        buffer[stride + 1] = v > 0 ? v : 0;
        buffer[stride + 2] = v > 0 ? v : 255;
        buffer[stride + 3] = 255;
    }

    return buffer;
};

WorldMap.prototype.addThreeMesh = function(
    scene,
    country, triMesh,
    rasterWidth, rasterHeight,
    buffer, cx, cy)
{
    function place(o) {
        o.position.x = cx;
        o.position.y = cy;
    }

    // Rivers
    // let rivers = [...country.coasts, ...country.rivers];
    let rivers = [...country.rivers];
    for (let i = 0; i < rivers.length; ++i) {
        const r = rivers[i];
        let m = new LineBasicMaterial({color: 0xff0000});
        let pts = [];
        for (let j = 0; j < r.length; ++j) {
            let p = r[j];
            pts.push(new Vector3(p[0], p[1], 0.1));
        }
        let g = new BufferGeometry().setFromPoints(pts);
        let l = new Line(g, m);
        place(l);
        scene.add(l);
    }

    // HeightMap
    let geometry = new BufferGeometry();
    let positions = new Float32Array(triMesh.length * 3 * 3);
    for (let i = 0; i < triMesh.length; ++i) {
        let ti = triMesh[i];
        positions[9 * i]     = ti[0][0];
        positions[9 * i + 1] = ti[0][1];
        positions[9 * i + 2] = ti[0][2] / 4;

        positions[9 * i + 3] = ti[1][0];
        positions[9 * i + 4] = ti[1][1];
        positions[9 * i + 5] = ti[1][2] / 4;

        positions[9 * i + 6] = ti[2][0];
        positions[9 * i + 7] = ti[2][1];
        positions[9 * i + 8] = ti[2][2] / 4;
    }

    let positionAttribute = new BufferAttribute(positions, 3);
    geometry.setAttribute('position', positionAttribute);
    geometry.computeVertexNormals();
    let material = new MeshPhongMaterial(
        {
            color: 0x00ff00, side: DoubleSide,
            shininess: 0
            // wireframe: true
        }
    );
    let cube = new Mesh(geometry, material);
    place(cube);
    // scene.add(cube);

    let dataTexture = new DataTexture(buffer, rasterWidth, rasterHeight, RGBAFormat);
    let p = new Mesh(
        new PlaneBufferGeometry(1, 1),
        new MeshBasicMaterial({
            // color: 0x0000ff,
            transparent: true, opacity: 0.5,
            map: dataTexture
        })
    );
    p.scale.y = -1;
    p.position.set(0, 0, 0);
    place(p);
    scene.add(p);
    return p;
};

export { WorldMap }
