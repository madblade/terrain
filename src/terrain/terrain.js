
'use strict';

import * as d3 from 'd3';
import {
    makeName,
    makeRandomLanguage
} from '../language';

import {
    generateGoodMesh,
    isnearedge, contour, distance, neighbours
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
    fillSinks, trislope, cleanCoast,
} from './erosion';


import { Random } from "./random";
import {getBorders, getRivers, getTerritories, placeCities} from "./cities";

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

function visualizePoints(svg, pts) {
    let circle = svg.selectAll('circle').data(pts);
    circle.enter()
        .append('circle');
    circle.exit().remove();
    d3.selectAll('circle')
        .attr('cx', function (d) {return 1000*d[0]})
        .attr('cy', function (d) {return 1000*d[1]})
        .attr('r', 100 / Math.sqrt(pts.length));
}

function makeD3Path(path)
{
    let p = d3.path();
    p.moveTo(1000 * path[0][0], 1000 * path[0][1]);
    for (let i = 1; i < path.length; i++) {
        p.lineTo(1000 * path[i][0], 1000 * path[i][1]);
    }
    return p.toString();
}

function visualizeVoronoi(svg, field, lo, hi)
{
    if (hi === undefined) hi = d3.max(field) + 1e-9;
    if (lo === undefined) lo = d3.min(field) - 1e-9;
    let mappedvals = field.map(function (x) {return x > hi ? 1 : x < lo ? 0 : (x - lo) / (hi - lo)});
    let tris = svg.selectAll('path.field').data(field.mesh.tris)
    tris.enter()
        .append('path')
        .classed('field', true);

    tris.exit()
        .remove();

    svg.selectAll('path.field')
        .attr('d', makeD3Path)
        .style('fill', function (d, i) {
            return d3.interpolateViridis(mappedvals[i]);
        });
}

function visualizeDownhill(h) {
    let links = getRivers(h, 0.01);
    drawPaths('river', links);
}

function drawPaths(svg, cls, paths)
{
    paths = svg.selectAll('path.' + cls).data(paths)
    paths.enter()
        .append('path')
        .classed(cls, true)
    paths.exit()
        .remove();
    svg.selectAll('path.' + cls)
        .attr('d', makeD3Path);
}

function visualizeSlopes(svg, render)
{
    let randomGenerator = new Random('vslopes');
    let h = render.h;
    let strokes = [];
    let r = 0.25 / Math.sqrt(h.length);
    for (let i = 0; i < h.length; i++)
    {
        if (h[i] <= 0 || isnearedge(h.mesh, i)) continue;
        let nbs = neighbours(h.mesh, i);
        nbs.push(i);
        let s = 0;
        let s2 = 0;
        for (let j = 0; j < nbs.length; j++)
        {
            let slopes = trislope(h, nbs[j]);
            s += slopes[0] / 10;
            s2 += slopes[1];
        }
        s /= nbs.length;
        s2 /= nbs.length;
        if (Math.abs(s) < runif(0.1, 0.4)) continue;
        let l = r * runif(1, 2) * (1 - 0.2 * Math.pow(Math.atan(s), 2)) * Math.exp(s2/100);
        let x = h.mesh.vxs[i][0];
        let y = h.mesh.vxs[i][1];
        if (Math.abs(l*s) > 2 * r) {
            let n = Math.floor(Math.abs(l*s/r));
            l /= n;
            if (n > 4) n = 4;
            for (let j = 0; j < n; j++) {
                let u = randomGenerator.rnorm() * r;
                let v = randomGenerator.rnorm() * r;
                strokes.push([[x+u-l, y+v+l*s], [x+u+l, y+v-l*s]]);
            }
        } else {
            strokes.push([[x-l, y+l*s], [x+l, y-l*s]]);
        }
    }
    let lines = svg.selectAll('line.slope').data(strokes)
    lines.enter()
        .append('line')
        .classed('slope', true);
    lines.exit()
        .remove();
    svg.selectAll('line.slope')
        .attr('x1', function (d) {return 1000*d[0][0]})
        .attr('y1', function (d) {return 1000*d[0][1]})
        .attr('x2', function (d) {return 1000*d[1][0]})
        .attr('y2', function (d) {return 1000*d[1][1]})
}

function visualizeContour(h, level) {
    level = level || 0;
    let links = contour(h, level);
    drawPaths('coast', links);
}

function visualizeBorders(h, cities, n) {
    let links = getBorders(h, getTerritories(h, cities, n));
    drawPaths('border', links);
}

function visualizeCities(svg, render) {
    let cities = render.cities;
    let h = render.h;
    let n = render.params.nterrs;

    let circs = svg.selectAll('circle.city').data(cities);
    circs.enter()
        .append('circle')
        .classed('city', true);
    circs.exit()
        .remove();
    svg.selectAll('circle.city')
        .attr('cx', function (d) {return 1000*h.mesh.vxs[d][0]})
        .attr('cy', function (d) {return 1000*h.mesh.vxs[d][1]})
        .attr('r', function (d, i) {return i >= n ? 4 : 10})
        .style('fill', 'white')
        .style('stroke-width', 5)
        .style('stroke-linecap', 'round')
        .style('stroke', 'black')
        .raise();
}

function dropEdge(h, p)
{
    p = p || 4
    let newh = zero(h.mesh);
    for (let i = 0; i < h.length; i++) {
        let v = h.mesh.vxs[i];
        let x = 2.4*v[0] / h.mesh.extent.width;
        let y = 2.4*v[1] / h.mesh.extent.height;
        newh[i] = h[i] - Math.exp(10*(Math.pow(Math.pow(x, p) + Math.pow(y, p), 1/p) - 1));
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

function terrCenter(h, terr, city, landOnly) {
    let x = 0;
    let y = 0;
    let n = 0;
    for (let i = 0; i < terr.length; i++) {
        if (terr[i] !== city) continue;
        if (landOnly && h[i] <= 0) continue;
        x += terr.mesh.vxs[i][0];
        y += terr.mesh.vxs[i][1];
        n++;
    }
    return [x/n, y/n];
}

function drawLabels(svg, render)
{
    let params = render.params;
    let h = render.h;
    let terr = render.terr;
    let cities = render.cities;
    let nterrs = render.params.nterrs;
    let avoids = [render.rivers, render.coasts, render.borders];
    let lang = makeRandomLanguage();
    let citylabels = [];
    function penalty(label) {
        let pen = 0;
        if (label.x0 < -0.45 * h.mesh.extent.width) pen += 100;
        if (label.x1 > 0.45 * h.mesh.extent.width) pen += 100;
        if (label.y0 < -0.45 * h.mesh.extent.height) pen += 100;
        if (label.y1 > 0.45 * h.mesh.extent.height) pen += 100;
        for (let i = 0; i < citylabels.length; i++) {
            let olabel = citylabels[i];
            if (label.x0 < olabel.x1 && label.x1 > olabel.x0 &&
                label.y0 < olabel.y1 && label.y1 > olabel.y0) {
                pen += 100;
            }
        }

        for (let i = 0; i < cities.length; i++) {
            let c = h.mesh.vxs[cities[i]];
            if (label.x0 < c[0] && label.x1 > c[0] && label.y0 < c[1] && label.y1 > c[1]) {
                pen += 100;
            }
        }
        for (let i = 0; i < avoids.length; i++) {
            let avoid = avoids[i];
            for (let j = 0; j < avoid.length; j++) {
                let avpath = avoid[j];
                for (let k = 0; k < avpath.length; k++) {
                    let pt = avpath[k];
                    if (pt[0] > label.x0 && pt[0] < label.x1 && pt[1] > label.y0 && pt[1] < label.y1) {
                        pen++;
                    }
                }
            }
        }
        return pen;
    }

    for (let i = 0; i < cities.length; i++) {
        let x = h.mesh.vxs[cities[i]][0];
        let y = h.mesh.vxs[cities[i]][1];
        let text = makeName(lang, 'city');
        let size = i < nterrs ? params.fontsizes.city : params.fontsizes.town;
        let sx = 0.65 * size/1000 * text.length;
        let sy = size/1000;
        let posslabels = [
            {
                x: x + 0.8 * sy,
                y: y + 0.3 * sy,
                align: 'start',
                x0: x + 0.7 * sy,
                y0: y - 0.6 * sy,
                x1: x + 0.7 * sy + sx,
                y1: y + 0.6 * sy
            },
            {
                x: x - 0.8 * sy,
                y: y + 0.3 * sy,
                align: 'end',
                x0: x - 0.9 * sy - sx,
                y0: y - 0.7 * sy,
                x1: x - 0.9 * sy,
                y1: y + 0.7 * sy
            },
            {
                x: x,
                y: y - 0.8 * sy,
                align: 'middle',
                x0: x - sx/2,
                y0: y - 1.9*sy,
                x1: x + sx/2,
                y1: y - 0.7 * sy
            },
            {
                x: x,
                y: y + 1.2 * sy,
                align: 'middle',
                x0: x - sx/2,
                y0: y + 0.1*sy,
                x1: x + sx/2,
                y1: y + 1.3*sy
            }
        ];
        let label = posslabels[d3.scan(posslabels, function (a, b) {return penalty(a) - penalty(b)})];
        label.text = text;
        label.size = size;
        citylabels.push(label);
    }

    let texts = svg.selectAll('text.city').data(citylabels);
    texts.enter()
        .append('text')
        .classed('city', true);
    texts.exit()
        .remove();
    svg.selectAll('text.city')
        .attr('x', function (d) {return 1000*d.x})
        .attr('y', function (d) {return 1000*d.y})
        .style('font-size', function (d) {return d.size})
        .style('text-anchor', function (d) {return d.align})
        .text(function (d) {return d.text})
        .raise();

    let reglabels = [];
    for (let i = 0; i < nterrs; i++) {
        let city = cities[i];
        let text = makeName(lang, 'region');
        let sy = params.fontsizes.region / 1000;
        let sx = 0.6 * text.length * sy;
        let lc = terrCenter(h, terr, city, true);
        let oc = terrCenter(h, terr, city, false);
        let best = 0;
        let bestscore = -999999;
        for (let j = 0; j < h.length; j++) {
            let score = 0;
            let v = h.mesh.vxs[j];
            score -= 3000 * Math.sqrt(
                Math.pow(v[0] - lc[0], 2) + Math.pow(v[1] - lc[1], 2)
            );
            score -= 1000 * Math.sqrt(
                Math.pow(v[0] - oc[0], 2) + Math.pow(v[1] - oc[1], 2)
            );
            if (terr[j] !== city) score -= 3000;
            for (let k = 0; k < cities.length; k++) {
                let u = h.mesh.vxs[cities[k]];
                if (Math.abs(v[0] - u[0]) < sx &&
                    Math.abs(v[1] - sy/2 - u[1]) < sy) {
                    score -= k < nterrs ? 4000 : 500;
                }
                if (v[0] - sx/2 < citylabels[k].x1 &&
                    v[0] + sx/2 > citylabels[k].x0 &&
                    v[1] - sy < citylabels[k].y1 &&
                    v[1] > citylabels[k].y0) {
                    score -= 5000;
                }
            }
            for (let k = 0; k < reglabels.length; k++) {
                let label = reglabels[k];
                if (v[0] - sx/2 < label.x + label.width/2 &&
                    v[0] + sx/2 > label.x - label.width/2 &&
                    v[1] - sy < label.y &&
                    v[1] > label.y - label.size) {
                    score -= 20000;
                }
            }
            if (h[j] <= 0) score -= 500;
            if (v[0] + sx/2 > 0.5 * h.mesh.extent.width) score -= 50000;
            if (v[0] - sx/2 < -0.5 * h.mesh.extent.width) score -= 50000;
            if (v[1] > 0.5 * h.mesh.extent.height) score -= 50000;
            if (v[1] - sy < -0.5 * h.mesh.extent.height) score -= 50000;
            if (score > bestscore) {
                bestscore = score;
                best = j;
            }
        }
        reglabels.push({
            text: text,
            x: h.mesh.vxs[best][0],
            y: h.mesh.vxs[best][1],
            size:sy,
            width:sx
        });
    }

    texts = svg.selectAll('text.region').data(reglabels);
    texts.enter()
        .append('text')
        .classed('region', true);
    texts.exit()
        .remove();
    svg.selectAll('text.region')
        .attr('x', function (d) {return 1000*d.x})
        .attr('y', function (d) {return 1000*d.y})
        .style('font-size', function (d) {return 1000*d.size})
        .style('text-anchor', 'middle')
        .text(function (d) {return d.text})
        .raise();
}

function drawMap(svg, render)
{
    render.rivers = getRivers(render.h, 0.01);
    render.coasts = contour(render.h, 0);
    render.terr = getTerritories(render);
    render.borders = getBorders(render);
    drawPaths(svg, 'river', render.rivers);
    drawPaths(svg, 'coast', render.coasts);
    drawPaths(svg, 'border', render.borders);
    visualizeSlopes(svg, render);
    visualizeCities(svg, render);
    drawLabels(svg, render);
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
    visualizeVoronoi,
    drawPaths,
    setSeaLevel,
    runif,
    randomVector,
    distance,
    doMap,
    visualizeBorders, visualizeCities, visualizeContour,
    visualizeDownhill, visualizePoints, visualizeSlopes,
    drawLabels, drawMap, dropEdge,
    generateCoast,
    makeD3Path,
    defaultExtent, defaultParams
};
