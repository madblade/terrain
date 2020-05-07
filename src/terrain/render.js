import * as d3 from "d3";
import { getBorders, getRivers, getTerritories } from './cities';
import { Random } from './random';
import { contour, isnearedge, neighbours } from './mesh';
import { trislope } from './erosion';
import { zero } from './rough';
import { runif } from './terrain';
import { drawLabels } from './names';

function visualizePoints(svg, pts)
{
    let circle = svg.selectAll('circle').data(pts);
    circle.enter()
        .append('circle');
    circle.exit().remove();
    d3.selectAll('circle')
        .attr('cx', function (d) {
            return 1000 * d[0]
        })
        .attr('cy', function (d) {
            return 1000 * d[1]
        })
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
    let mappedvals = field.map(function (x) {
        return x > hi ? 1 : x < lo ? 0 : (x - lo) / (hi - lo)
    });
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

function visualizeDownhill(h)
{
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
    for (let i = 0; i < h.length; i++) {
        if (h[i] <= 0 || isnearedge(h.mesh, i)) continue;
        let nbs = neighbours(h.mesh, i);
        nbs.push(i);
        let s = 0;
        let s2 = 0;
        for (let j = 0; j < nbs.length; j++) {
            let slopes = trislope(h, nbs[j]);
            s += slopes[0] / 10;
            s2 += slopes[1];
        }
        s /= nbs.length;
        s2 /= nbs.length;
        if (Math.abs(s) < runif(0.1, 0.4)) continue;
        let l = r * runif(1, 2) *
            (1 - 0.2 * Math.pow(Math.atan(s), 2)) *
            Math.exp(s2 / 100);
        let x = h.mesh.vxs[i][0];
        let y = h.mesh.vxs[i][1];
        if (Math.abs(l * s) > 2 * r) {
            let n = Math.floor(Math.abs(l * s / r));
            l /= n;
            if (n > 4) n = 4;
            for (let j = 0; j < n; j++) {
                let u = randomGenerator.rnorm() * r;
                let v = randomGenerator.rnorm() * r;
                strokes.push([[x + u - l, y + v + l * s], [x + u + l, y + v - l * s]]);
            }
        } else {
            strokes.push([[x - l, y + l * s], [x + l, y - l * s]]);
        }
    }
    let lines = svg.selectAll('line.slope').data(strokes)
    lines.enter()
        .append('line')
        .classed('slope', true);
    lines.exit()
        .remove();
    svg.selectAll('line.slope')
        .attr('x1', function (d) {
            return 1000 * d[0][0]
        })
        .attr('y1', function (d) {
            return 1000 * d[0][1]
        })
        .attr('x2', function (d) {
            return 1000 * d[1][0]
        })
        .attr('y2', function (d) {
            return 1000 * d[1][1]
        })
}

function visualizeContour(h, level)
{
    level = level || 0;
    let links = contour(h, level);
    drawPaths('coast', links);
}

function visualizeBorders(h, cities, n)
{
    let links = getBorders(h, getTerritories(h, cities, n));
    drawPaths('border', links);
}

function visualizeCities(svg, render)
{
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
        .attr('cx', function (d) {
            return 1000 * h.mesh.vxs[d][0]
        })
        .attr('cy', function (d) {
            return 1000 * h.mesh.vxs[d][1]
        })
        .attr('r', function (d, i) {
            return i >= n ? 4 : 10
        })
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
        let x = 2.4 * v[0] / h.mesh.extent.width;
        let y = 2.4 * v[1] / h.mesh.extent.height;
        newh[i] = h[i] - Math.exp(
            10 * (Math.pow(
            Math.pow(x, p) + Math.pow(y, p),
            1 / p) - 1)
        );
    }
    return newh;
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

export {
    visualizeVoronoi,
    drawPaths,
    visualizeBorders, visualizeCities, visualizeContour,
    visualizeDownhill, visualizePoints, visualizeSlopes,
    drawMap, dropEdge,
    makeD3Path
}
