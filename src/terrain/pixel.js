
let Rasterizer = function()
{

};

Rasterizer.prototype.computeTriMesh = function(
    pts, tris, values
)
{
    let triMesh = new Float64Array(3 * tris.length);
    let z = new Float64Array(pts.length);

    for (let i = 0; i < tris.length; ++i)
    {
        let t = tris[i];
    }
}
