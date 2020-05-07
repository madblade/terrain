
import * as d3 from 'd3';
import {
    cityScore,
    cleanCoast,
    contour,
    defaultExtent,
    defaultParams,
    doErosion, doMap, drawMap,
    drawPaths,
    erosionRate,
    fillSinks,
    generateCoast,
    getBorders,
    getRivers, getTerritories,
    placeCity,
    setSeaLevel,
    visualizeCities,
    visualizePoints,
    visualizeSlopes,
    visualizeVoronoi,
    runif,
    randomVector,
} from './terrain/terrain';

import {
    zero,
    slope,
    cone,
    add,
    mountains,
    peaky,
    normalize,
    relax
} from './terrain/rough';

import {
    generateGoodMesh,
    generatePoints,
    makeMesh,
    improvePoints,
} from './terrain/mesh';

function addSVG(div) {
    return div.insert("svg", ":first-child")
        .attr("height", 400)
        .attr("width", 400)
        .attr("viewBox", "-500 -500 1000 1000");
}
let meshDiv = d3.select("div#mesh");
let meshSVG = addSVG(meshDiv);

let meshPts = null;
let meshVxs = null;
let meshDual = false;

function meshDraw() {
    if (meshDual && !meshVxs) {
        meshVxs = makeMesh(meshPts).vxs;
    }
    visualizePoints(meshSVG, meshDual ? meshVxs : meshPts);
}

meshDiv.append("button")
    .text("Generate random points")
    .on("click", function () {
        meshDual = false;
        meshVxs = null;
        meshPts = generatePoints(256);
        meshDraw();
    });

meshDiv.append("button")
    .text("Improve points")
    .on("click", function () {
        meshPts = improvePoints(meshPts);
        meshVxs = null;
        meshDraw();
    });

let vorBut = meshDiv.append("button")
    .text("Show Voronoi corners")
    .on("click", function () {
        meshDual = !meshDual;
        if (meshDual) {
            vorBut.text("Show original points");
        } else {
            vorBut.text("Show Voronoi corners");
        }
        meshDraw();
    });

let primDiv = d3.select("div#prim");
let primSVG = addSVG(primDiv);

let mainSize = 2048;
let primH = zero(generateGoodMesh(mainSize));

function primDraw() {
    visualizeVoronoi(primSVG, primH, -1, 1);
    let con = contour(primH, 0);
    drawPaths(primSVG, 'coast', con);
}

primDraw();

primDiv.append("button")
    .text("Reset to flat")
    .on("click", function () {
        primH = zero(primH.mesh);
        primDraw();
    });

primDiv.append("button")
    .text("Add random slope")
    .on("click", function () {
        primH = add(primH, slope(primH.mesh, randomVector(4)));
        primDraw();
    });

primDiv.append("button")
    .text("Add cone")
    .on("click", function () {
        primH = add(primH, cone(primH.mesh, -0.5));
        primDraw();
    });

primDiv.append("button")
    .text("Add inverted cone")
    .on("click", function () {
        primH = add(primH, cone(primH.mesh, 0.5));
        primDraw();
    });

primDiv.append("button")
    .text("Add five blobs")
    .on("click", function () {
        primH = add(primH, mountains(primH.mesh, 5));
        primDraw();
    });

primDiv.append("button")
    .text("Normalize heightmap")
    .on("click", function () {
        primH = normalize(primH);
        primDraw();
    });

primDiv.append("button")
    .text("Round hills")
    .on("click", function () {
        primH = peaky(primH);
        primDraw();
    });

primDiv.append("button")
    .text("Relax")
    .on("click", function () {
        primH = relax(primH);
        primDraw();
    });

primDiv.append("button")
    .text("Set sea level to median")
    .on("click", function () {
        primH = setSeaLevel(primH, 0.5);
        primDraw();
    });

let erodeDiv = d3.select("div#erode");
let erodeSVG = addSVG(erodeDiv);

function generateUneroded() {
    let mesh = generateGoodMesh(mainSize);
    let h = add(slope(mesh, randomVector(4)),
        cone(mesh, runif(-1, 1)),
        mountains(mesh, 50));
    h = peaky(h);
    h = fillSinks(h);
    h = setSeaLevel(h, 0.5);
    return h;
}

let erodeH = primH;
let erodeViewErosion = false;

function erodeDraw() {
    if (erodeViewErosion) {
        visualizeVoronoi(erodeSVG, erosionRate(erodeH));
    } else {
        visualizeVoronoi(erodeSVG, erodeH, 0, 1);
    }
    drawPaths(erodeSVG, "coast", contour(erodeH, 0));
}

erodeDiv.append("button")
    .text("Generate random heightmap")
    .on("click", function () {
        erodeH = generateUneroded();
        erodeDraw();
    });

erodeDiv.append("button")
    .text("Copy heightmap from above")
    .on("click", function () {
        erodeH = primH;
        erodeDraw();
    });

erodeDiv.append("button")
    .text("Erode")
    .on("click", function () {
        erodeH = doErosion(erodeH, 0.1);
        erodeDraw();
    });

erodeDiv.append("button")
    .text("Set sea level to median")
    .on("click", function () {
        erodeH = setSeaLevel(erodeH, 0.5);
        erodeDraw();
    });


erodeDiv.append("button")
    .text("Clean coastlines")
    .on("click", function () {
        erodeH = cleanCoast(erodeH, 1);
        erodeH = fillSinks(erodeH);
        erodeDraw();
    });

let erodeBut = erodeDiv.append("button")
    .text("Show erosion rate")
    .on("click", function () {
        erodeViewErosion = !erodeViewErosion;
        if (erodeViewErosion) {
            erodeBut.text("Show heightmap");
        } else {
            erodeBut.text("Show erosion rate");
        }
        erodeDraw();
    });

let physDiv = d3.select("div#phys");
let physSVG = addSVG(physDiv);
let physH = erodeH;

let physViewCoast = false;
let physViewRivers = false;
let physViewSlope = false;
let physViewHeight = true;

function physDraw() {
    if (physViewHeight) {
        visualizeVoronoi(physSVG, physH, 0);
    } else {
        physSVG.selectAll("path.field").remove();
    }
    if (physViewCoast) {
        drawPaths(physSVG, "coast", contour(physH, 0));
    } else {
        drawPaths(physSVG, "coast", []);
    }
    if (physViewRivers) {
        drawPaths(physSVG, "river", getRivers(physH, 0.01));
    } else {
        drawPaths(physSVG, "river", []);
    }
    if (physViewSlope) {
        visualizeSlopes(physSVG, {h:physH});
    } else {
        visualizeSlopes(physSVG, {h:zero(physH.mesh)});
    }
}
physDiv.append("button")
    .text("Generate random heightmap")
    .on("click", function () {
        physH = generateCoast({npts:mainSize, extent:defaultExtent});
        physDraw();
    });

physDiv.append("button")
    .text("Copy heightmap from above")
    .on("click", function () {
        physH = erodeH;
        physDraw();
    });

let physCoastBut = physDiv.append("button")
    .text("Show coastline")
    .on("click", function () {
        physViewCoast = !physViewCoast;
        physCoastBut.text(physViewCoast ? "Hide coastline" : "Show coastline");
        physDraw();
    });

let physRiverBut = physDiv.append("button")
    .text("Show rivers")
    .on("click", function () {
        physViewRivers = !physViewRivers;
        physRiverBut.text(physViewRivers ? "Hide rivers" : "Show rivers");
        physDraw();
    });


let physSlopeBut = physDiv.append("button")
    .text("Show slope shading")
    .on("click", function () {
        physViewSlope = !physViewSlope;
        physSlopeBut.text(physViewSlope ? "Hide slope shading" : "Show slope shading");
        physDraw();
    });


let physHeightBut = physDiv.append("button")
    .text("Hide heightmap")
    .on("click", function () {
        physViewHeight = !physViewHeight;
        physHeightBut.text(physViewHeight ? "Hide heightmap" : "Show heightmap");
        physDraw();
    });

let cityDiv = d3.select("div#city");
let citySVG = addSVG(cityDiv);

let cityViewScore = true;

function newCityRender(h) {
    h = h || generateCoast({npts:mainSize, extent: defaultExtent});
    return {
        params: defaultParams,
        h: h,
        cities: []
    };
}
let cityRender = newCityRender(physH);
function cityDraw() {
    cityRender.terr = getTerritories(cityRender);
    if (cityViewScore) {
        let score = cityScore(cityRender.h, cityRender.cities);
        visualizeVoronoi(citySVG, score, d3.max(score) - 0.5);
    } else {
        visualizeVoronoi(citySVG, cityRender.terr);
    }
    drawPaths(citySVG, 'coast', contour(cityRender.h, 0));
    drawPaths(citySVG, 'river', getRivers(cityRender.h, 0.01));
    drawPaths(citySVG, 'border', getBorders(cityRender));
    visualizeSlopes(citySVG, cityRender);
    visualizeCities(citySVG, cityRender);
}

cityDiv.append("button")
    .text("Generate random heightmap")
    .on("click", function () {
        cityRender = newCityRender();
        cityDraw();
    });

cityDiv.append("button")
    .text("Copy heightmap from above")
    .on("click", function () {
        cityRender = newCityRender(physH);
        cityDraw();
    });

cityDiv.append("button")
    .text("Add new city")
    .on("click", function () {
        placeCity(cityRender);
        cityDraw();
    });

let cityViewBut = cityDiv.append("button")
    .text("Show territories")
    .on("click", function () {
        cityViewScore = !cityViewScore;
        cityViewBut.text(cityViewScore ? "Show territories" : "Show city location scores");
        cityDraw();
    });

let finalDiv = d3.select("div#final");
let finalSVG = addSVG(finalDiv);
finalDiv.append("button")
    .text("Copy map from above")
    .on("click", function () {
        drawMap(finalSVG, cityRender);
    });

finalDiv.append("button")
    .text("Generate high resolution map")
    .on("click", function () {
        doMap(finalSVG, defaultParams);
    });

