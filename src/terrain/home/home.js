
import * as d3 from 'd3';

import {
    defaultExtent,
    defaultParams, TerrainGenerator,
} from '../terrain';
import { SVGDrawer }         from '../render';
import { max }               from '../math';

function init(
    mesher,
    fieldModifier,
    eroder,
    cityPlacer,
    terrainGenerator,
    languageGenerator,
    nameGiver
)
{

let d3select = d3.select;

// Drawing
let svgDrawer = new SVGDrawer(mesher, eroder, terrainGenerator, cityPlacer, nameGiver);

// Mesh
let meshDiv = d3select("div#mesh");
let meshSVG = svgDrawer.addSVG(meshDiv);
let meshPts = null;
let meshVxs = null;
let meshDual = false;

// Prim
let primDiv = d3select("div#prim");
let primSVG = svgDrawer.addSVG(primDiv);
let mainSize = 2048;
let primH = mesher.generateGoodMesh(mainSize);
fieldModifier.resetField(primH);

function primDraw()
{
    svgDrawer.visualizeVoronoi(primSVG, primH, primH.buffer, -1, 1);
    svgDrawer.drawPaths(primSVG, 'coast', mesher.contour(primH, 0));
}

// Erode
let erodeDiv = d3select("div#erode");
let erodeSVG = svgDrawer.addSVG(erodeDiv);
let erodeH = primH;
let erodeViewErosion = false;
function erodeDraw()
{
    if (erodeViewErosion) {
        let erosionRate = eroder.erosionRate(erodeH);
        svgDrawer.visualizeVoronoi(erodeSVG, erodeH, erosionRate);
    } else svgDrawer.visualizeVoronoi(erodeSVG, erodeH, erodeH.buffer, 0, 1);
    svgDrawer.drawPaths(erodeSVG, "coast", mesher.contour(erodeH, 0));
}

// Phys
let physDiv = d3select("div#phys");
let physSVG = svgDrawer.addSVG(physDiv);
let physH = erodeH;
let physViewCoast = false;
let physViewRivers = false;
let physViewSlope = false;
let physViewHeight = true;
function physDraw()
{
    if (physViewHeight) svgDrawer.visualizeVoronoi(physSVG, physH, physH.buffer, 0);
    else physSVG.selectAll("path.field").remove();

    if (physViewCoast) svgDrawer.drawPaths(physSVG, "coast", mesher.contour(physH, 0));
    else svgDrawer.drawPaths(physSVG, "coast", []);

    if (physViewRivers) svgDrawer.drawPaths(physSVG, "river", cityPlacer.getRivers(physH, 0.01));
    else svgDrawer.drawPaths(physSVG, "river", []);

    if (physViewSlope) svgDrawer.visualizeSlopes(physSVG, physH, physH.buffer);
    else {
        let zero = [];
        for (let i = 0; i < physH.buffer.length; ++i) zero[i] = 0;
        svgDrawer.visualizeSlopes(physSVG, physH, zero);
    }
}

// Country
let cityDiv = d3select("div#city");
let citySVG = svgDrawer.addSVG(cityDiv);
let cityViewScore = true;
function newCountry(h)
{
    h = h || terrainGenerator.generateCoast({ npts: mainSize, extent: defaultExtent });
    return { params: defaultParams, mesh: h, cities: [] };
}
let country = newCountry(physH);
function cityDraw()
{
    country.terr = cityPlacer.getTerritories(country);
    if (cityViewScore) {
        let score = cityPlacer.cityScore(country.mesh, country.cities);
        svgDrawer.visualizeVoronoi(citySVG, country.mesh, score, max(score) - 0.5);
    } else svgDrawer.visualizeVoronoi(citySVG, country.mesh, country.terr);
    svgDrawer.drawPaths(citySVG, 'coast', mesher.contour(country.mesh, 0));
    svgDrawer.drawPaths(citySVG, 'river', cityPlacer.getRivers(country.mesh, 0.01));
    svgDrawer.drawPaths(citySVG, 'border', cityPlacer.getBorders(country));
    svgDrawer.visualizeSlopes(citySVG, country.mesh, country.mesh.buffer);
    svgDrawer.visualizeCities(citySVG, country);
}

// Final
let finalDiv = d3select("div#final");
let finalSVG = svgDrawer.addSVG(finalDiv);
function doMap(svg, params)
{
    let country = { params: params };
    let width = svg.attr('width');
    svg.attr('height', width * params.extent.height / params.extent.width);
    svg.attr('viewBox',
        -1000 * params.extent.width / 2 + ' ' +
        -1000 * params.extent.height / 2 + ' ' +
        1000 * params.extent.width + ' ' +
        1000 * params.extent.height
    );
    svg.selectAll().remove();
    country.mesh = terrainGenerator.generateCoast(params);
    cityPlacer.placeCities(country);
    svgDrawer.drawMap(svg, country);
}

// Mesh
meshDiv.append("button")
    .text("Generate random points")
    .on("click", () => {
        meshDual = false;
        meshPts = mesher.generatePoints(256);
        if (meshDual) meshVxs = mesher.makeMesh(meshPts).vxs;
        svgDrawer.visualizePoints(meshSVG, meshDual ? meshVxs : meshPts);
    });

meshDiv.append("button")
    .text("Improve points")
    .on("click", () => {
        meshPts = mesher.improvePoints(meshPts);
        if (meshDual) meshVxs = mesher.makeMesh(meshPts).vxs;
        svgDrawer.visualizePoints(meshSVG, meshDual ? meshVxs : meshPts);
    });

let vorBut = meshDiv.append("button")
    .text("Show Voronoi corners")
    .on("click", () => {
        meshDual = !meshDual;
        if (meshDual) vorBut.text("Show original points");
        else vorBut.text("Show Voronoi corners");
        if (meshDual && !meshVxs) meshVxs = mesher.makeMesh(meshPts).vxs;
        svgDrawer.visualizePoints(meshSVG, meshDual ? meshVxs : meshPts);
    });

// Prim
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
        fieldModifier.addSlope(primH, terrainGenerator.randomVector(4));
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

primDraw();

// Erode
erodeDiv.append("button")
    .text("Generate random heightmap")
    .on("click", () => {
        erodeH = terrainGenerator.generateUneroded(mainSize);
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

// Phys
physDiv.append("button")
    .text("Generate random heightmap")
    .on("click", () => {
        physH = terrainGenerator.generateCoast(
            { npts: mainSize, extent: defaultExtent }
        );
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

// Country
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

// Final
finalDiv.append("button")
    .text("Copy map from above")
    .on("click", () => {
        svgDrawer.drawMap(finalSVG, country);
    });

finalDiv.append("button")
    .text("Generate high resolution map")
    .on("click", () => {
        doMap(finalSVG, defaultParams);
    });

// doMap(finalSVG, defaultParams);

}

export { init };
