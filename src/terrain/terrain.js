
import * as d3 from 'd3';

import { Random } from './random';

import {
    FieldModifier,
} from './rough';
import {
    Eroder,
} from './erosion';

import { Mesher } from './mesh';

let mesher = new Mesher();
let fieldModifier = new FieldModifier();
let eroder = new Eroder();

let mainRandomGenerator = new Random('terrain');
function randomVector(scale)
{
    let r1 = mainRandomGenerator.rnorm(); // rnorm();
    // let r2 = mainRandomGenerator.rnorm(); // rnorm();
    return [scale * r1, scale * r1];
}
function runif(lo, hi)
{
    let r = mainRandomGenerator.uniform();
    return lo + r * (hi - lo);
    // return lo + Math.random() * (hi - lo);
}

let TerrainGenerator = function()
{
    this.buffer = [];
}

// TODO fix leaks
// TODO macroscopic noise
function generateCoast(params)
{
    let mesh = mesher.generateGoodMesh(params.npts, params.extent);
    fieldModifier.addSlope(mesh, randomVector(4));
    fieldModifier.addCone(mesh, runif(-1, -1));
    fieldModifier.addMountains(mesh, 50);
    // let h = sumFields([
    //     slope(mesh, randomVector(4)),
    //     cone(mesh, runif(-1, -1)),
    //     mountains(mesh, 50)
    // ]);
    for (let i = 0; i < 10; i++) {
        fieldModifier.relax(mesh);
        // h = relax(h);
    }
    fieldModifier.peaky(mesh);
    // h = peaky(h);

    let el = runif(0, 0.1);
    eroder.doErosion(mesh, el, 5);

    let sl = runif(0.2, 0.6);
    fieldModifier.setSeaLevel(mesh, sl);

    eroder.fillSinks(mesh);
    eroder.cleanCoast(mesh, 3);

    console.log(mesh);
    return mesh;
}

function generateUneroded(mainSize)
{
    let mesh = mesher.generateGoodMesh(mainSize);
    // let h = sumFields([
    fieldModifier.addSlope(mesh, randomVector(4));
    fieldModifier.addCone(mesh, runif(-1, 1));
    fieldModifier.addMountains(mesh, 50);
        // slope(mesh, randomVector(4)),
        // cone(mesh, runif(-1, 1)),
        // mountains(mesh, 50)]
    // );
    fieldModifier.peaky(mesh);
    // h = peaky(h);
    eroder.fillSinks(mesh);
    fieldModifier.setSeaLevel(mesh, 0.5);
    return mesh;
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
    runif, randomVector,
    generateCoast, generateUneroded,
    defaultExtent, defaultParams
};
