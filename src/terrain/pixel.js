
let Rasterizer = function()
{

};

Rasterizer.prototype.computeTriMesh = function(
    pts, tris, values
)
{
    let triMesh = [];
    let z = new Float64Array(pts.length);
    let zPass = new Uint8Array(pts.length);

    // Compute point heights
    for (let i = 0; i < tris.length; ++i)
    {
        let t = tris[i];
        if (t.length !== 3) continue;
        for (let j = 0; j < 3; ++j) {
            let p = t[j];
            let index = p.index;
            let value = values[index];
            z[index] += value;
            zPass[index]++;
        }
    }
    for (let i = 0; i < z.length; ++i)
    {
        let count = zPass[i];
        if (count < 1) continue;
        z[i] /= count;
    }

    // Compute 3D tris
    for (let i = 0; i < tris.length; ++i)
    {
        let t = tris[i];
        if (t.length !== 3) continue;
        let newTri = [];
        for (let j = 0; j < 3; ++j) {
            let p = t[j];
            newTri.push([p[0], p[1], z[p.index]]);
        }
        triMesh.push(newTri);
    }

    return triMesh;
}
