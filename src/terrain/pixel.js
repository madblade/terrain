
let Rasterizer = function()
{

};

Rasterizer.prototype.computeTriMesh = function(
    mesh
)
{
    let pts = mesh.pts;
    let tris = mesh.tris;
    let values = mesh.buffer;

    let triMesh = [];
    let z = new Map();
    let zPass = new Map();

    // Compute point heights
    for (let i = 0; i < tris.length; ++i)
    {
        let t = tris[i];
        let v = values[i];
        if (t.length !== 3) continue;
        for (let j = 0; j < 3; ++j) {
            let p = t[j];
            let index = `${p[0].toFixed(4)},${p[1].toFixed(4)}`;
            if (!z.has(index))
            {
                z.set(index, v);
                zPass.set(index, 1);
            } else {
                z.set(index, z.get(index) + v);
                zPass.set(index, zPass.get(index) + 1);
            }
            // z[index] += v;
            // zPass[index]++;
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
        for (let j = 0; j < 3; ++j)
        {
            let p = t[j];
            let index = `${p[0].toFixed(4)},${p[1].toFixed(4)}`;
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
Rasterizer.prototype.processScanLine = function (y, pa, pb, pc, pd, color)
{
    // Thanks to current Y, we can compute the gradient to compute others values like
    // the starting X (sx) and ending X (ex) to draw between
    // if pa.Y == pb.Y or pc.Y == pd.Y, gradient is forced to 1
    let gradient1 = pa.y !== pb.y ? (y - pa.y) / (pb.y - pa.y) : 1;
    let gradient2 = pc.y !== pd.y ? (y - pc.y) / (pd.y - pc.y) : 1;

    let sx = this.interpolate(pa.x, pb.x, gradient1) >> 0;
    let ex = this.interpolate(pc.x, pd.x, gradient2) >> 0;

    // drawing a line from left (sx) to right (ex)
    for(let x = sx; x < ex; x++) {
        // this.drawPoint(new BABYLON.Vector2(x, y), color);
        // TODO draw
    }
};

Rasterizer.prototype.drawTriangle = function (p1, p2, p3, color)
{
    // Sorting the points in order to always have this order on screen p1, p2 & p3
    // with p1 always up (thus having the Y the lowest possible to be near the top screen)
    // then p2 between p1 & p3
    let temp;
    if (p1.y > p2.y) {
        temp = p2;
        p2 = p1;
        p1 = temp;
    }
    if (p2.y > p3.y) {
        temp = p2;
        p2 = p3;
        p3 = temp;
    }
    if (p1.y > p2.y) {
        temp = p2;
        p2 = p1;
        p1 = temp;
    }

    // inverse slopes
    let dP1P2; let dP1P3;

    // http://en.wikipedia.org/wiki/Slope
    // Computing slopes
    if (p2.y - p1.y > 0) {
        dP1P2 = (p2.x - p1.x) / (p2.y - p1.y);
    } else {
        dP1P2 = 0;
    }

    if (p3.y - p1.y > 0) {
        dP1P3 = (p3.x - p1.x) / (p3.y - p1.y);
    } else {
        dP1P3 = 0;
    }

    // P1
    // -
    // -   - P2
    // -
    // P3
    if (dP1P2 > dP1P3)
    {
        for (let y = p1.y >> 0; y <= p3.y >> 0; y++) {
            if (y < p2.y) {
                this.processScanLine(y, p1, p3, p1, p2, color);
            } else {
                this.processScanLine(y, p1, p3, p2, p3, color);
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
        for (let y = p1.y >> 0; y <= p3.y >> 0; y++) {
            if (y < p2.y) {
                this.processScanLine(y, p1, p2, p1, p3, color);
            } else {
                this.processScanLine(y, p2, p3, p1, p3, color);
            }
        }
    }
};

Rasterizer.prototype.drawTriMesh = function (cMesh)
{
    for (let indexFaces = 0; indexFaces < cMesh.Faces.length; indexFaces++)
    {
        let currentFace = cMesh.Faces[indexFaces];
        let vertexA = cMesh.Vertices[currentFace.A];
        let vertexB = cMesh.Vertices[currentFace.B];
        let vertexC = cMesh.Vertices[currentFace.C];

        let pixelA = this.project(vertexA, transformMatrix);
        let pixelB = this.project(vertexB, transformMatrix);
        let pixelC = this.project(vertexC, transformMatrix);

        let color = 0.25 + ((indexFaces % cMesh.Faces.length) / cMesh.Faces.length) * 0.75;
        this.drawTriangle(pixelA, pixelB, pixelC,
            // new BABYLON.Color4(color, color, color, 1)
            // TODO wire in height into color
            // and compute normal
        );
    }
}

export { Rasterizer };
