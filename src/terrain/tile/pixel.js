import { Random }              from './random';
import { SimplexNoise, TileablePerlinNoise } from './noise';

let Rasterizer = function()
{
    this.dimension = 512;
    this.chunkHeight = 16;
    this.chunkWidth = 16;
    this.biomeDimension = this.dimension / this.chunkHeight;

    this.heightBuffer = [];
    this.chunkBiomes = [];
    this.surfaceBuffer = [];

    this.noiseTile = [];
    this.noiseTileDimension = 256;
    this.noiseTileReady = false;

    this.rng = new Random('simplex')
    this.sng = new SimplexNoise(this.rng);
    this.tpng = new TileablePerlinNoise(this.rng);
};

Rasterizer.prototype.computeTriMesh = function(
    mesh
)
{
    let pts = mesh.pts;
    let tris = mesh.tris;
    let tidx = mesh.triPointIndexes;
    let values = mesh.buffer;
    let nbInteriorTris = mesh.nbInteriorTris;

    let triMesh = [];
    let z = new Float64Array(mesh.nbTriPointIndexes);
    let zPass = new Uint8Array(mesh.nbTriPointIndexes);

    // Compute point heights
    for (let i = 0; i < tris.length; ++i)
    {
        let t = tris[i];
        // let v = i >= nbInteriorTris ? -0.01 : values[i];
        let v = values[i];
        if (i >= nbInteriorTris)
        {
            // console.log(values[i]);
        }
        if (t.length !== 3) continue;
        const ti = tidx[i];
        for (let j = 0; j < 3; ++j) {
            const index = ti[j];
            let p = t[j];
            if (!z[index])
            {
                z[index] = v;
                zPass[index] = 1;
            } else {
                let ov = z[index];
                if (Math.sign(v) !== Math.sign(ov)) {
                    z[index] = Math.min(ov, v);
                    zPass[index] = 1;
                } else {
                    z[index] = ov + v;
                    zPass[index] += 1;
                }
            }
            z[index] += v;
            zPass[index]++;
        }
    }

    // for (let i = 0; i < z.length; ++i)
    // {
    //     let count = zPass[i];
    //     if (count < 1) continue;
    //     z[i] /= count;
    // }

    // Compute 3D tris
    for (let i = 0; i < tris.length; ++i)
    {
        let t = tris[i];
        if (t.length !== 3) continue;
        const ti = tidx[i];
        let newTri = [];
        // let v = values[i];
        for (let j = 0; j < 3; ++j)
        {
            let p = t[j];
            let x = p[0]; let y = p[1];
            // let index = `${x.toFixed(5)},${y.toFixed(5)}`;
            const index = ti[j];
            let height = z[index] / zPass[index];
            newTri.push([x, y, height]);
        }
        triMesh.push(newTri);
    }

    return triMesh;
}

Rasterizer.prototype.putPixel = function(x, y, v)
{
    let buffer = this.heightBuffer;
    const w = this.dimension;
    buffer[y * w + x] = v;
};

// https://en.wikipedia.org/wiki/Midpoint_circle_algorithm
// Algorithm from Eric Andres, “Discrete circles, rings and spheres”
Rasterizer.prototype.drawCircle = function(centerX, centerY, radius)
{
    let x; let y; let d;
    x = 0; y = radius; d = radius - 1;

    const v = -1;
    while (y >= x)
    {
        this.putPixel(centerX + x, centerY + y, v);
        this.putPixel(centerX + y, centerY + x, v);
        this.putPixel(centerX - x, centerY + y, v);
        this.putPixel(centerX - y, centerY + x, v);

        this.putPixel(centerX + x, centerY - y, v);
        this.putPixel(centerX + y, centerY - x, v);
        this.putPixel(centerX - x, centerY - y, v);
        this.putPixel(centerX - y, centerY - x, v);

        if (d >= 2 * x)
        {
            d -= 2 * x + 1;
            ++x;
        }
        else if (d < 2 * (radius - y))
        {
            d += 2 * y - 1;
            --y;
        }
        else
        {
            d += 2 * (y - x - 1);
            --y;
            ++x;
        }
    }
}

// from https://github.com/delphifirst/js-rasterizer
// Copyright (c) 2016 Yang Cao
Rasterizer.prototype.drawTriangle = function(vertex1, vertex2, vertex3)
{
    // The first element in each vertex is always position
    // Here the vertex position is homogenized
    let v1h = vertex1;
    let v2h = vertex2;
    let v3h = vertex3;

    const minX = Math.min(v1h[0], v2h[0], v3h[0]);
    const maxX = Math.max(v1h[0], v2h[0], v3h[0]);
    const minY = Math.min(v1h[1], v2h[1], v3h[1]);
    const maxY = Math.max(v1h[1], v2h[1], v3h[1]);

    let f12 = (x, y) => (v1h[1] - v2h[1]) * x
            + (v2h[0] - v1h[0]) * y
            + v1h[0] * v2h[1] - v2h[0] * v1h[1];

    let f23 = (x, y) => (v2h[1] - v3h[1]) * x
            + (v3h[0] - v2h[0]) * y
            + v2h[0] * v3h[1] - v3h[0] * v2h[1];

    let f31 = (x, y) => (v3h[1] - v1h[1]) * x
            + (v1h[0] - v3h[0]) * y
            + v3h[0] * v1h[1] - v1h[0] * v3h[1];

    const startY = Math.floor(minY); const startX = Math.floor(minX);
    const endY = Math.ceil(maxY); const endX = Math.ceil(maxX);
    const alphaDen = f23(v1h[0], v1h[1]);
    const betaDen = f31(v2h[0], v2h[1]);
    const gammaDen = f12(v3h[0], v3h[1]);
    for (let y = startY; y <= endY; ++y)
    {
        const offset = this.dimension * y;
        for (let x = startX; x <= endX; ++x)
        {
            const alpha = f23(x, y) / alphaDen;
            const beta = f31(x, y) / betaDen;
            const gamma = f12(x, y) / gammaDen;

            if (alpha > 0 && beta > 0 && gamma > 0)
            {
                const h =  255 * (alpha * v1h[2] + beta * v2h[2] + gamma * v3h[2]);
                // if (h < 0) h = 255;
                this.heightBuffer[offset + x] = h;
                    // h;
            }
        }
    }
};

Rasterizer.prototype.initBuffers = function(triMesh)
{
    const width = this.dimension;
    const height =  this.dimension;
    this.heightBuffer = new Int32Array(width * height);
    this.chunkBiomes = new Int32Array(width / this.chunkWidth * height / this.chunkHeight);
};

Rasterizer.prototype.heightPass = function (triMesh)
{
    this.initBuffers(triMesh);
    const width = this.dimension;
    const height =  this.dimension;

    const nbTris = triMesh.length;
    for (let i = 0; i < nbTris; ++i)
    {
        let t = triMesh[i];

        if (t.length !== 3) continue;

        let pixelA = { x: (0.5 + t[0][0]) * width - 0.5, y: (0.5 + t[0][1]) * height - 0.5, z: t[0][2] };
        let pixelB = { x: (0.5 + t[1][0]) * width - 0.5, y: (0.5 + t[1][1]) * height - 0.5, z: t[1][2] };
        let pixelC = { x: (0.5 + t[2][0]) * width - 0.5, y: (0.5 + t[2][1]) * height - 0.5, z: t[2][2] };

        this.drawTriangle(
            [pixelA.x, pixelA.y, pixelA.z],
            [pixelB.x, pixelB.y, pixelB.z],
            [pixelC.x, pixelC.y, pixelC.z],
        );
    }
}

Rasterizer.prototype.precomputeNoiseTile = function(nbOctaves)
{
    // Noise tile = 256
    const height = this.noiseTileDimension;
    const width = this.noiseTileDimension;
    let tpng = this.tpng;
    this.noiseTile = new Float32Array(width * height);
    let buffer = this.noiseTile;

    const freq = 1 / 256;
    const wf = (width * freq) >> 0;

    for (let y = 0; y < height; ++y)
    {
        const offset = width * y;
        for (let x = 0; x < width; ++x)
        {
            buffer[offset + x] = tpng.sumOctaves(x * freq, y * freq, nbOctaves, wf)
        }
    }

    // Normalize
    let min = Infinity; let max = -Infinity;
    for (let i = 0; i < buffer.length; ++i) {
        let bi = buffer[i];
        if (bi > max) max = bi;
        if (bi < min) min = bi;
    }

    const range = max - min;
    for (let i = 0; i < buffer.length; ++i) {
        buffer[i] = (buffer[i] - min) / range;
    }

    this.noiseTileReady = true;
}

Rasterizer.prototype.noisePass = function(factor)
{
    if (!this.noiseTileReady) {
        this.precomputeNoiseTile(5);
    }

    if (this.dimension % this.noiseTileDimension !== 0)
    {
        throw Error('Map dimension must be a multiple of the noise kernel dimension.');
    }

    let buffer = this.heightBuffer; let pattern = this.noiseTile;
    const height = this.dimension; const heightN = this.noiseTileDimension;
    const width = this.dimension; const widthN = this.noiseTileDimension;

    for (let y = 0; y < height; ++y)
    {
        const offset = width * y;
        const offsetNoise = widthN * (y % heightN);
        for (let x = 0; x < width; ++x)
        {
            // TODO only if >= water level
            if (buffer[offset + x] < 0) continue;
            buffer[offset + x] -= factor * pattern[offsetNoise + (x % widthN)];
        }
    }

    // TODO compute chunk biome
    // const chunkW = this.chunkWidth;
    // const chunkH = this.chunkHeight;
    // const biomeDimension = this.biomeDimension;
    // if (x % chunkW === chunkW / 2 && y % chunkH === chunkH / 2) {
    //     this.chunkBiomes[(x % chunkW) * biomeDimension + y % chunkH] = h > 0 ? 1 : 0;
    // }
};

Rasterizer.prototype.riverPass = function(rivers)
{
    const width = this.dimension;
    const height = this.dimension;
    const nbRivers = rivers.length;
    for (let i = 0; i < nbRivers; ++i)
    {
        const r = rivers[i];
        const nbSegments = r.length - 1;
        for (let j = 0; j < nbSegments; ++j)
        {
            let p1 = r[j];
            let p2 = r[j + 1];

            let pixelA1 = { x: (0.5 + p1[0]) * width - 1.5, y: (0.5 + p1[1]) * height - 1.5, z: -1 };
            let pixelB1 = { x: (0.5 + p1[0]) * width + 1.5, y: (0.5 + p1[1]) * height + 1.5, z: -1 };
            let pixelC1 = { x: (0.5 + p2[0]) * width - 0.5, y: (0.5 + p2[1]) * height - 0.5, z: -1 };

            // let pixelA2 = { x: (0.5 + p1[0]) * width - 0.5, y: (0.5 + p1[1]) * height - 0.5, z: -1 };
            // let pixelB2 = { x: (0.5 + p1[0]) * width - 0.5, y: (0.5 + p1[1]) * height - 0.5, z: -1 };
            // let pixelC2 = { x: (0.5 + p2[0]) * width - 0.5, y: (0.5 + p2[1]) * height - 0.5, z: -1 };j
            // TODO other triangle + other triangle + cross product
            this.drawTriangle(
                [pixelA1.x, pixelA1.y, pixelA1.z],
                [pixelB1.x, pixelB1.y, pixelB1.z],
                [pixelC1.x, pixelC1.y, pixelC1.z],
            );
        }
    }
};

Rasterizer.prototype.drawCity = function(cityX, cityY, cityRadius)
{
    this.drawCircle(cityX, cityY, cityRadius);
    this.drawCircle(cityX, cityY, cityRadius - 1);
    this.drawCircle(cityX, cityY, cityRadius - 2);
    // TODO noisier
    // TODO inside of cities
};

Rasterizer.prototype.cityPass = function(mesh, cities)
{
    const nbCities = cities.length;
    const width = this.dimension;
    const height = this.dimension;
    let tris = mesh.tris;
    for (let i = 0; i < nbCities; ++i)
    {
        let c = cities[i];

        // City center
        let t = tris[c];
        let cX = 0; let cY = 0;
        const l = t.length;
        if (l !== 2 && l !== 3) console.error(`Uncommon tri length: ${l}.`);
        for (let j = 0; j < l; ++j) {
            cX += t[j][0];
            cY += t[j][1];
        }
        cX /= l; cY /= l;

        // City draw
        const cityRadius = i < 5 ? 10 : 5; // nb blocks
        const centerX = ((0.5 + cX) * width - 0.5) >> 0;
        const centerY = ((0.5 + cY) * height - 0.5) >> 0;
        this.drawCity(centerX, centerY, cityRadius);
    }
};

Rasterizer.prototype.treePass = function(mesh)
{
    // TODO never on a chunk border
};

export { Rasterizer };