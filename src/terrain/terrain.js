
'use strict';

import * as d3 from 'd3';

import {
    generateGoodMesh,
} from './mesh';

import {
    zero,
    slope,
    cone,
    add,
    mountains,
    peaky,
    relax,
} from './rough';

import {
    doErosion,
    fillSinks,
    cleanCoast,
} from './erosion';

import { Random } from './random';
import {
    placeCities
} from './cities';
import {
    drawMap
} from './render';

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

let defaultExtent = {
    width: 1,
    height: 1
};

function quantile(h, q)
{
    let sortedh = [];
    for (let i = 0; i < h.length; i++) {
        sortedh[i] = h[i];
    }
    sortedh.sort(d3.ascending);
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

function generateCoast(params)
{
    let mesh = generateGoodMesh(params.npts, params.extent);
    let h = add(
        slope(mesh, randomVector(4)),
        cone(mesh, runif(-1, -1)),
        mountains(mesh, 50)
    );
    for (let i = 0; i < 10; i++) {
        h = relax(h);
    }
    h = peaky(h);
    h = doErosion(h, runif(0, 0.1), 5);
    h = setSeaLevel(h, runif(0.2, 0.6));
    h = fillSinks(h);
    h = cleanCoast(h, 3);
    return h;
}

function doMap(svg, params) {
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
