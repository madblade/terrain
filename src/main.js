
import * as d3 from 'd3';

import {
    defaultExtent,
    defaultParams,
    generateCoast,
    randomVector, generateUneroded,
} from './terrain/terrain';

import {
    drawMap,
    drawPaths,
    visualizeCities,
    visualizePoints,
    visualizeSlopes,
    visualizeVoronoi,
} from './terrain/render';

import {
    CityPlacer
} from './terrain/cities';

import {
    Eroder
} from './terrain/erosion';

import { FieldModifier } from './terrain/modifier';

import { Mesher} from "./terrain/mesh";
import { max }   from './terrain/math';

let d3select = d3.select;

let mesher = new Mesher();
let fieldModifier = new FieldModifier();
let eroder = new Eroder();
let cityPlacer = new CityPlacer();

function addSVG(div) {
    return div.insert("svg", ":first-child")
        .attr("height", 400)
        .attr("width", 400)
        .attr("viewBox", "-500 -500 1000 1000");
}
let meshDiv = d3select("div#mesh");
let meshSVG = addSVG(meshDiv);

let meshPts = null;
let meshVxs = null;
let meshDual = false;

function meshDraw() {
    if (meshDual && !meshVxs) {
        meshVxs = mesher.makeMesh(meshPts).vxs;
    }
    visualizePoints(meshSVG, meshDual ? meshVxs : meshPts);
}

meshDiv.append("button")
    .text("Generate random points")
    .on("click", () => {
        meshDual = false;
        meshVxs = null;
        meshPts = mesher.generatePoints(256);
        meshDraw();
    });

meshDiv.append("button")
    .text("Improve points")
    .on("click", () => {
        meshPts = mesher.improvePoints(meshPts);
        meshVxs = null;
        meshDraw();
    });

let vorBut = meshDiv.append("button")
    .text("Show Voronoi corners")
    .on("click", () => {
        meshDual = !meshDual;
        if (meshDual) {
            vorBut.text("Show original points");
        } else {
            vorBut.text("Show Voronoi corners");
        }
        meshDraw();
    });

let primDiv = d3select("div#prim");
let primSVG = addSVG(primDiv);

let mainSize = 2048;
let primH = mesher.generateGoodMesh(mainSize);
fieldModifier.resetField(primH);

function primDraw()
{
    visualizeVoronoi(primSVG, primH, primH.buffer, -1, 1);
    let con = mesher.contour(primH, 0);
    drawPaths(primSVG, 'coast', con);
}

primDraw();

primDiv.append("button")
    .text("Reset to flat")
    .on("click", () => {
        fieldModifier.resetField(primH);
        primDraw();
    });

primDiv.append("button")
    .text("Add random slope")
    .on("click", () => {
        fieldModifier.resetField(primH);
        fieldModifier.addSlope(primH, randomVector(4));
        primDraw();
    });

primDiv.append("button")
    .text("Add cone")
    .on("click", () => {
        fieldModifier.resetField(primH);
        fieldModifier.addCone(primH, -0.5);
        primDraw();
    });

primDiv.append("button")
    .text("Add inverted cone")
    .on("click", () => {
        fieldModifier.resetField(primH);
        fieldModifier.addCone(primH, 0.5);
        primDraw();
    });

primDiv.append("button")
    .text("Add five blobs")
    .on("click", () => {
        fieldModifier.resetField(primH);
        fieldModifier.addMountains(primH, 5);
        primDraw();
    });

primDiv.append("button")
    .text("Normalize heightmap")
    .on("click", () => {
        fieldModifier.normalize(primH);
        primDraw();
    });

primDiv.append("button")
    .text("Round hills")
    .on("click", () => {
        fieldModifier.peaky(primH);
        primDraw();
    });

primDiv.append("button")
    .text("Relax")
    .on("click", () => {
        fieldModifier.relax(primH);
        primDraw();
    });

primDiv.append("button")
    .text("Set sea level to median")
    .on("click", () => {
        fieldModifier.setSeaLevel(primH, 0.5);
        primDraw();
    });

let erodeDiv = d3select("div#erode");
let erodeSVG = addSVG(erodeDiv);

let erodeH = primH;
let erodeViewErosion = false;

function erodeDraw()
{
    if (erodeViewErosion) {
        let erosionRate = eroder.erosionRate(erodeH);
        visualizeVoronoi(erodeSVG, erodeH, erosionRate);
    } else {
        visualizeVoronoi(erodeSVG, erodeH, erodeH.buffer, 0, 1);
    }
    drawPaths(erodeSVG, "coast", mesher.contour(erodeH, 0));
}

erodeDiv.append("button")
    .text("Generate random heightmap")
    .on("click", () => {
        erodeH = generateUneroded(mainSize);
        erodeDraw();
    });

erodeDiv.append("button")
    .text("Copy heightmap from above")
    .on("click", () => {
        erodeH = primH;
        erodeDraw();
    });

erodeDiv.append("button")
    .text("Erode")
    .on("click", () => {
        eroder.doErosion(erodeH, 0.1);
        erodeDraw();
    });

erodeDiv.append("button")
    .text("Set sea level to median")
    .on("click", () => {
        fieldModifier.setSeaLevel(erodeH, 0.5);
        erodeDraw();
    });


erodeDiv.append("button")
    .text("Clean coastlines")
    .on("click", () => {
        eroder.cleanCoast(erodeH, 1);
        eroder.fillSinks(erodeH);
        erodeDraw();
    });

let erodeBut = erodeDiv.append("button")
    .text("Show erosion rate")
    .on("click", () => {
        erodeViewErosion = !erodeViewErosion;
        if (erodeViewErosion)
            erodeBut.text("Show heightmap");
        else
            erodeBut.text("Show erosion rate");
        erodeDraw();
    });

let physDiv = d3select("div#phys");
let physSVG = addSVG(physDiv);
let physH = erodeH;

let physViewCoast = false;
let physViewRivers = false;
let physViewSlope = false;
let physViewHeight = true;

function physDraw()
{
    if (physViewHeight)
        visualizeVoronoi(physSVG, physH, physH.buffer, 0);
    else
        physSVG.selectAll("path.field").remove();

    if (physViewCoast)
        drawPaths(physSVG, "coast", mesher.contour(physH, 0));
    else
        drawPaths(physSVG, "coast", []);

    if (physViewRivers) {
        console.log('display rivers');
        drawPaths(physSVG, "river", cityPlacer.getRivers(physH, 0.01));
    } else
        drawPaths(physSVG, "river", []);

    if (physViewSlope)
        visualizeSlopes(physSVG, physH, physH.buffer);
    else {
        let zero = [];
        for (let i = 0; i < physH.buffer.length; ++i) zero[i] = 0;
        visualizeSlopes(physSVG, physH, zero);
    }
}
physDiv.append("button")
    .text("Generate random heightmap")
    .on("click", () => {
        physH = generateCoast({ npts: mainSize, extent: defaultExtent });
        physDraw();
    });

physDiv.append("button")
    .text("Copy heightmap from above")
    .on("click", () => {
        physH = erodeH;
        physDraw();
    });

let physCoastBut = physDiv.append("button")
    .text("Show coastline")
    .on("click", () => {
        physViewCoast = !physViewCoast;
        physCoastBut.text(physViewCoast ? "Hide coastline" : "Show coastline");
        physDraw();
    });

let physRiverBut = physDiv.append("button")
    .text("Show rivers")
    .on("click", () => {
        physViewRivers = !physViewRivers;
        physRiverBut.text(physViewRivers ? "Hide rivers" : "Show rivers");
        physDraw();
    });


let physSlopeBut = physDiv.append("button")
    .text("Show slope shading")
    .on("click", () => {
        physViewSlope = !physViewSlope;
        physSlopeBut.text(physViewSlope ? "Hide slope shading" : "Show slope shading");
        physDraw();
    });


let physHeightBut = physDiv.append("button")
    .text("Hide heightmap")
    .on("click", () => {
        physViewHeight = !physViewHeight;
        physHeightBut.text(physViewHeight ? "Hide heightmap" : "Show heightmap");
        physDraw();
    });

let cityDiv = d3select("div#city");
let citySVG = addSVG(cityDiv);

let cityViewScore = true;

function newCountry(h)
{
    h = h || generateCoast({ npts: mainSize, extent: defaultExtent });
    return {
        params: defaultParams,
        mesh: h,
        cities: []
    };
}

let country = newCountry(physH);
function cityDraw()
{
    country.terr = cityPlacer.getTerritories(country);
    if (cityViewScore) {
        let score = cityPlacer.cityScore(country.mesh, country.cities);
        visualizeVoronoi(citySVG, country.mesh, score, max(score) - 0.5);
    } else {
        visualizeVoronoi(citySVG, country.mesh, country.terr);
    }
    drawPaths(citySVG, 'coast', mesher.contour(country.mesh, 0));
    drawPaths(citySVG, 'river', cityPlacer.getRivers(country.mesh, 0.01));
    drawPaths(citySVG, 'border', cityPlacer.getBorders(country));
    visualizeSlopes(citySVG, country.mesh, country.mesh.buffer);
    visualizeCities(citySVG, country);
}

cityDiv.append("button")
    .text("Generate random heightmap")
    .on("click", () => {
        country = newCountry();
        cityDraw();
    });

cityDiv.append("button")
    .text("Copy heightmap from above")
    .on("click", () => {
        country = newCountry(physH);
        cityDraw();
    });

cityDiv.append("button")
    .text("Add new city")
    .on("click", () => {
        cityPlacer.placeCity(country);
        cityDraw();
    });

let cityViewBut = cityDiv.append("button")
    .text("Show territories")
    .on("click", () => {
        cityViewScore = !cityViewScore;
        cityViewBut.text(cityViewScore ? "Show territories" : "Show city location scores");
        cityDraw();
    });

let finalDiv = d3select("div#final");
let finalSVG = addSVG(finalDiv);
finalDiv.append("button")
    .text("Copy map from above")
    .on("click", () => {
        drawMap(finalSVG, country);
    });

finalDiv.append("button")
    .text("Generate high resolution map")
    .on("click", () => {
        doMap(finalSVG, defaultParams);
    });

function doMap(svg, params)
{
    let country = {
        params: params
    };
    let width = svg.attr('width');
    svg.attr('height', width * params.extent.height / params.extent.width);
    svg.attr('viewBox', -1000 * params.extent.width / 2 + ' ' +
        -1000 * params.extent.height / 2 + ' ' +
        1000 * params.extent.width + ' ' +
        1000 * params.extent.height);

    svg.selectAll().remove();
    country.mesh = params.generator(params);
    cityPlacer.placeCities(country);
    drawMap(svg, country);
}
