
import * as d3 from 'd3';

import { Random } from './random';

import {
    zero,
    slope,
    cone,
    mountains,
    peaky,
    relax, sumFields,
} from './rough';
import {
    doErosion, fillSinks, cleanCoast,
} from './erosion';
import { generateGoodMesh } from './mesh';
import { placeCities } from './cities';
import { drawMap } from './render';

let mainRandomGenerator = new Random('terrain');
function randomVector(scale)
{
    let r = mainRandomGenerator.rnorm(); // rnorm();
    return [scale * r, scale * r];
}
function runif(lo, hi)
{
    let r = mainRandomGenerator.uniform();
    return lo + r * (hi - lo);
    // return lo + Math.random() * (hi - lo);
}

function quantile(h, q)
{
    let sortedh = [];
    for (let i = 0; i < h.length; i++) {
        sortedh[i] = h[i];
    }
    sortedh.sort(
        // d3.ascending
    );
    return d3.quantile(sortedh, q);
}

function setSeaLevel(h, q)
{
    let newh = zero(h.mesh);
    let delta = quantile(h, q);
    for (let i = 0; i < h.length; i++) {
        newh[i] = h[i] - delta;
    }
    return newh;
}

let TerrainGenerator = function()
{
    this.buffer = [];
}

// TODO fix leaks
// TODO macroscopic noise
function generateCoast(params)
{
    let mesh = generateGoodMesh(params.npts, params.extent);
    let h = sumFields([
        slope(mesh, randomVector(4)),
        cone(mesh, runif(-1, -1)),
        mountains(mesh, 50)
    ]);
    for (let i = 0; i < 10; i++) {
        h = relax(h);
    }
    h = peaky(h);

    let el = runif(0, 0.1);
    h = doErosion(h, el, 5);

    let sl = runif(0.2, 0.6);
    h = setSeaLevel(h, sl);

    h = fillSinks(h);
    h = cleanCoast(h, 3);

    console.log(h);
    return h;
}

function doMap(svg, params)
{
    let render = {
        params: params
    };
    let width = svg.attr('width');
    svg.attr('height', width * params.extent.height / params.extent.width);
    svg.attr('viewBox', -1000 * params.extent.width/2 + ' ' +
        -1000 * params.extent.height/2 + ' ' +
        1000 * params.extent.width + ' ' +
        1000 * params.extent.height);
    svg.selectAll().remove();
    render.h = params.generator(params);
    placeCities(render);
    drawMap(svg, render);
}

let defaultExtent = {
    width: 1,
    height: 1
};

let defaultParams = {
    extent: defaultExtent,
    generator: generateCoast,
    npts: 16384,
    ncities: 15,
    nterrs: 5,
    fontsizes: {
        region: 40,
        city: 25,
        town: 20
    }
}

export {
    setSeaLevel,
    runif,
    randomVector,
    doMap,
    generateCoast,
    defaultExtent, defaultParams
};
