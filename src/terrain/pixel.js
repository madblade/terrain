
let Rasterizer = function()
{
    this.dimension = 256;

    this.heightBuffer = [];
    this.chunkBiomes = [];
    this.surfaceBuffer = [];
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
            let index = `${p[0].toFixed(5)},${p[1].toFixed(5)}`;
            let height = z.get(index) / zPass.get(index);
            newTri.push([p[0], p[1], height]);
        }
        triMesh.push(newTri);
    }

    return triMesh;
}

// Clamping values to keep them between 0 and 1
Rasterizer.prototype.clamp = function (value) //, min, max) {
{
    // if (typeof min === "undefined") { min = 0; }
    // if (typeof max === "undefined") { max = 1; }
    // return Math.max(min, Math.min(value, max));
    return Math.max(0, Math.min(value, 1));
};

// Interpolating the value between 2 vertices
// min is the starting point, max the ending point
// and gradient the % between the 2 points
Rasterizer.prototype.interpolate = function (min, max, gradient)
{
    return min + (max - min) * this.clamp(gradient);
};

// drawing line between 2 points from left to right
// papb -> pcpd
// pa, pb, pc, pd must then be sorted before
Rasterizer.prototype.processScanLine = function (y, pa, pb, pc, pd, c)
{
    // Thanks to current Y, we can compute the gradient to compute others values like
    // the starting X (sx) and ending X (ex) to draw between
    // if pa.Y == pb.Y or pc.Y == pd.Y, gradient is forced to 1
    let gradient1 = pa.y !== pb.y ? (y - pa.y) / (pb.y - pa.y) : 1;
    let gradient2 = pc.y !== pd.y ? (y - pc.y) / (pd.y - pc.y) : 1;

    let sx = this.interpolate(pa.x, pb.x, gradient1) >> 0;
    let sh = Math.min(pa.z, pb.z) + Math.abs(pa.z - pb.z) * this.clamp(gradient1);
    let ex = this.interpolate(pc.x, pd.x, gradient2) >> 0;
    let eh =  Math.min(pc.z, pd.z) + Math.abs(pc.z - pd.z) * this.clamp(gradient2);

    const offset = this.dimension * y;
    const delta = ex - sx;
    // drawing a line from left (sx) to right (ex)
    for (let x = sx; x < ex; ++x)
    {
        let h = ((sh + (eh - sh) * x / delta) * 16) >> 0;
        // console.log(` ... ${h}`);
        // if (h < 0) h = 255;
        this.heightBuffer[offset + x] = c;
            // h * 16;
        // this.drawPoint(new BABYLON.Vector2(x, y), color);
        // TODO draw
    }
};

Rasterizer.prototype.dt = function(vertex1, vertex2, vertex3)
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
                // Interpolate attributes
                // let varyings = new Array(varyingCount);
                // for (let varyingIndex = 0; varyingIndex < varyingCount; ++varyingIndex)
                // {
                //     varyings[varyingIndex] = vec4.scale(1 / oneOverW, vec4.add(
                //         vec4.scale(alpha / w1, vertex1[varyingIndex]),
                //         vec4.add(vec4.scale(beta / w2, vertex2[varyingIndex]),
                //             vec4.scale(gamma / w3, vertex3[varyingIndex]))
                //     ));
                // }

                // let color = renderState.pixelShader(varyings);
                // drawPixel(x, y, varyings[0][2] / varyings[0][3], color[0], color[1], color[2]);
                let h =  255 * (alpha * v1h[2] + beta * v2h[2] + gamma * v3h[2]);
                if (h < 0) h = 255;
                this.heightBuffer[offset + x] = h;
            }
        }
    }
};

Rasterizer.prototype.drawTriangle = function (pp1, pp2, pp3)
{
    // Sorting the points in order to always have this order on screen p1, p2 & p3
    // with p1 always up (thus having the Y the lowest possible to be near the top screen)
    // then p2 between p1 & p3
    let p1 = pp1; let p2 = pp2; let p3 = pp3;
    // temp;
    if (p1.y > p2.y) {
        // temp = p2;
        p2 = pp1;
        p1 = pp2;
    }
    if (p2.y > p3.y) {
        // temp = p2;
        p2 = pp3;
        p3 = pp2;
    }
    if (p1.y > p2.y) {
        // temp = p2;
        p2 = pp1;
        p1 = pp2;
    }

    // inverse slopes
    let dP1P2; let dP1P3;

    // Computing slopes
    if (p2.y - p1.y > 0) dP1P2 = (p2.x - p1.x) / (p2.y - p1.y);
    else dP1P2 = 0;

    if (p3.y - p1.y > 0) dP1P3 = (p3.x - p1.x) / (p3.y - p1.y);
    else dP1P3 = 0;

    // P1
    // -
    // -   - P2
    // -
    // P3
    if (dP1P2 > dP1P3 || p1.y === p2.y && p1.x < p2.x)
    {
        for (let y = p1.y >> 0; y <= p3.y >> 0; ++y) {
            if (y < p2.y) {
                this.processScanLine(y, p1, p3, p1, p2, 64);
            } else {
                this.processScanLine(y, p1, p3, p2, p3, 96);
            }
        }
    }

    //       P1
    //        -
    // P2 -   -
    //        -
    //       P3
    else
    {
        for (let y = p1.y >> 0; y <= p3.y >> 0; ++y) {
            if (y < p2.y) {
                this.processScanLine(y, p1, p2, p1, p3, 128);
            } else {
                this.processScanLine(y, p2, p3, p1, p3, 255);
            }
        }
    }
};

Rasterizer.prototype.heightPass = function (triMesh)
{
    const width = this.dimension;
    const height =  this.dimension;
    this.heightBuffer = new Int32Array(width * height);

    // let x1, x2, x3, y1, y2, y3, z1, z2, z3;
    const nbTris = triMesh.length;
    for (let i = 0; i < nbTris; ++i)
    {
        let t = triMesh[i];

        if (t.length !== 3) continue;

        // if (t[0][2] < 0 && t[1][2] < 0 && t[2][2] < 0) continue;
        // x1 = (0.5 + t[0][0]) * width; y1 = (0.5 + t[0][1]) * height; z1 = t[0][2];
        // x2 = (0.5 + t[1][0]) * width; y2 = (0.5 + t[1][1]) * height; z2 = t[1][2];
        // x3 = (0.5 + t[2][0]) * width; y3 = (0.5 + t[2][1]) * height; z3 = t[2][2];
        let pixelA = { x: (0.5 + t[0][0]) * width - 0.5, y: (0.5 + t[0][1]) * height - 0.5, z: t[0][2] };
        let pixelB = { x: (0.5 + t[1][0]) * width - 0.5, y: (0.5 + t[1][1]) * height - 0.5, z: t[1][2] };
        let pixelC = { x: (0.5 + t[2][0]) * width - 0.5, y: (0.5 + t[2][1]) * height - 0.5, z: t[2][2] };
        // if ((y2 - y1) * (x3 - x2) - (y3 - y2) * (x2 - x1) < 0) {
        // pixelA = {x: x1, y: y1, z: z1};
        // pixelB = {x: x2, y: y2, z: z2};
        // pixelC = {x: x3, y: y3, z: z3};
        // } else {
        //     pixelA = {x: x1, y: y1, z: z1};
        //     pixelB = {x: x2, y: y2, z: z2};
        //     pixelC = {x: x3, y: y3, z: z3};
        // }

        // let heights = [t[0][2], t[1][2], t[2][2]];
            // 0.25 + ((indexFaces % cMesh.Faces.length) / cMesh.Faces.length) * 0.75;
        // this.drawTriangle(pixelA, pixelB, pixelC//,
        // heights
        // and compute normal
        // );
        this.dt(
            [pixelA.x, pixelA.y, pixelA.z],
            [pixelB.x, pixelB.y, pixelB.z],
            [pixelC.x, pixelC.y, pixelC.z],
            );
    }

    // console.log(this.heightBuffer);
}

Rasterizer.prototype.riverPass = function(mesh)
{

}

Rasterizer.prototype.cityPass = function(mesh)
{

}

Rasterizer.prototype.treePass = function(mesh)
{

}

export { Rasterizer };
