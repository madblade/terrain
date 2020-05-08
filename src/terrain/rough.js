import * as d3 from 'd3';

import { Random } from './random';

import { neighbours } from './mesh';

let randomGenerator = new Random('rough');

let Mapper = function()
{
    this.buffer = [];
};

function zero(mesh)
{
    let z = [];
    for (let i = 0; i < mesh.vxs.length; i++) {
        z[i] = 0;
    }
    z.mesh = mesh;
    return z;
}

function slope(mesh, direction)
{
    return mesh.map(function (x) {
        return x[0] * direction[0] + x[1] * direction[1];
    });
}

function cone(mesh, slope) {
    return mesh.map(function (x) {
        return Math.sqrt(
            Math.pow(x[0], 2) + Math.pow(x[1], 2)
        ) * slope;
    });
}

function add()
{
    let n = arguments[0].length;
    let newvals = zero(arguments[0].mesh);
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < arguments.length; j++) {
            newvals[i] += arguments[j][i];
        }
    }
    return newvals;
}

function mountains(mesh, n, r)
{
    r = r || 0.05;
    let mounts = [];
    for (let i = 0; i < n; i++)
    {
        let r1 = randomGenerator.uniform();
        let r2 = randomGenerator.uniform();
        mounts.push([mesh.extent.width * (r1 - 0.5), mesh.extent.height * (r2 - 0.5)]);
    }

    let newvals = zero(mesh);
    for (let i = 0; i < mesh.vxs.length; i++)
    {
        let p = mesh.vxs[i];
        for (let j = 0; j < n; j++) {
            let m = mounts[j];
            newvals[i] +=
                Math.pow(Math.exp(-
                    (Math.pow(p[0] - m[0], 2) + Math.pow(p[1] - m[1], 2)) / (2 * r * r)),
                    2
                );
        }
    }

    return newvals;
}

function map(h, f) {
    let newh = h.map(f);
    newh.mesh = h.mesh;
    return newh;
}

function min(array)
{
    let min = Infinity;
    for (let i = 0, l = array.length, v; i < l; ++i)
    {
        if ((v = array[i]) < min) min = v;
    }
    return min;
}

function max(array)
{
    let max = -Infinity;
    for (let i = 0, l = array.length, v; i < l; ++i)
    {
        if ((v = array[i]) > max) max = v;
    }
    return max;
}

function normalize(h)
{
    let lo = min(h);
    let hi = max(h);
    return map(h, function (x) {return (x - lo) / (hi - lo)});
}

function peaky(h) {
    return map(normalize(h), Math.sqrt);
}

function mean(indexArray, array)
{
    let l = indexArray.length;
    let m = 0; let n = 0;
    for (let i = 0; i < l; ++i) {
        m += array[indexArray[i]];
        ++n;
    }
    return m / n;
}

function relax(h)
{
    let newh = zero(h.mesh);
    for (let i = 0; i < h.length; i++) {
        let nbs = neighbours(h.mesh, i);
        if (nbs.length < 3) {
            newh[i] = 0;
            continue;
        }
        newh[i] = mean(nbs, h);
    }
    return newh;
}

export {
    zero,
    slope,
    cone,
    add,
    min, max,
    mountains,
    peaky,
    normalize,
    relax,
    map
}
