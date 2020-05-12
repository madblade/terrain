import { SimplexNoise } from './simplex';
import { Random }       from './random';

let Rasterizer = function()
{
    this.dimension = 512;

    this.heightBuffer = [];
    this.chunkBiomes = [];
    this.surfaceBuffer = [];

    this.rng = new Random('simplex')
    this.nng = new SimplexNoise(this.rng);
};

Rasterizer.prototype.computeTriMesh = function(
    mesh
)
{
    let pts = mesh.pts;
    let tris = mesh.tris;
    let values = mesh.buffer;
    let nbInteriorTris = mesh.nbInteriorTris;

    let triMesh = [];
    let z = new Map();
    let zPass = new Map();

    // Compute point heights
    for (let i = 0; i < tris.length; ++i)
    {
        let t = tris[i];
        let v = i >= nbInteriorTris ? -0.01 : values[i];
        // let v = values[i];
        if (t.length !== 3) continue;
        for (let j = 0; j < 3; ++j) {
            let p = t[j];
            let index = `${p[0].toFixed(5)},${p[1].toFixed(5)}`;
            if (!z.has(index))
            {
                z.set(index, v);
                zPass.set(index, 1);
            } else {
                let ov = z.get(index);
                if (Math.sign(v) !== Math.sign(ov)) {
                    z.set(index, Math.min(ov, v));
                    zPass.set(index, 1);
                } else {
                    z.set(index, ov + v);
                    zPass.set(index, zPass.get(index) + 1);
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
        let newTri = [];
        let v = values[i];
        for (let j = 0; j < 3; ++j)
        {
            let p = t[j];
            let x = p[0]; let y = p[1];
            let index = `${x.toFixed(5)},${y.toFixed(5)}`;
            let height = z.get(index) / zPass.get(index);
            newTri.push([x, y, height]);
        }
        triMesh.push(newTri);
    }

    return triMesh;
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

    let minX = Math.min(v1h[0], v2h[0], v3h[0]);
    let maxX = Math.max(v1h[0], v2h[0], v3h[0]);
    let minY = Math.min(v1h[1], v2h[1], v3h[1]);
    let maxY = Math.max(v1h[1], v2h[1], v3h[1]);

    let f12 = (x, y) => (v1h[1] - v2h[1]) * x
            + (v2h[0] - v1h[0]) * y
            + v1h[0] * v2h[1] - v2h[0] * v1h[1];

    let f23 = (x, y) => (v2h[1] - v3h[1]) * x
            + (v3h[0] - v2h[0]) * y
            + v2h[0] * v3h[1] - v3h[0] * v2h[1];

    let f31 = (x, y) => (v3h[1] - v1h[1]) * x
            + (v1h[0] - v3h[0]) * y
            + v3h[0] * v1h[1] - v1h[0] * v3h[1];

    let startY = Math.floor(minY), startX = Math.floor(minX);
    let endY = Math.ceil(maxY), endX = Math.ceil(maxX);
    let nng = this.nng;
    for (let y = startY; y <= endY; ++y)
    {
        const offset = this.dimension * y;
        for (let x = startX; x <= endX; ++x)
        {
            let alpha = f23(x, y) / f23(v1h[0], v1h[1]);
            let beta = f31(x, y) / f31(v2h[0], v2h[1]);
            let gamma = f12(x, y) / f12(v3h[0], v3h[1]);

            if (alpha > 0 && beta > 0 && gamma > 0)
            {
                let h =  255 * (alpha * v1h[2] + beta * v2h[2] + gamma * v3h[2]);
                // if (h < 0) h = 255;
                this.heightBuffer[offset + x] =
                    (
                        nng.noise(0.5 * x / 128, 0.5 * y / 128) * 64 +
                        nng.noise(0.5 * x / 32, 0.5 * y / 32) * 64 +
                        nng.noise(0.5 * x / 8, 0.5 * y / 8) * 64 +
                        nng.noise(0.5 * x / 2, 0.5 * y / 2) * 64
                    );
                    // h;
            }
        }
    }
};

Rasterizer.prototype.heightPass = function (triMesh)
{
    const width = this.dimension;
    const height =  this.dimension;
    this.heightBuffer = new Int32Array(width * height);

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

Rasterizer.prototype.noisePass = function(mesh)
{

};

Rasterizer.prototype.riverPass = function(mesh)
{

};

Rasterizer.prototype.cityPass = function(mesh)
{

};

Rasterizer.prototype.treePass = function(mesh)
{

};

export { Rasterizer };
