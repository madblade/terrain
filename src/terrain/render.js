
import * as d3 from 'd3';

import { Random }           from './tile/random';
import { max, min }         from './math';

let d3selectAll = d3.selectAll;
let d3interpolateViridis = d3.interpolateViridis;
let d3path = d3.path;

let SVGDrawer = function(
    mesher, eroder,
    terrainGenerator, cityPlacer, nameGiver
)
{
    this.mesher = mesher;
    this.eroder = eroder;
    this.terrainGenerator = terrainGenerator;
    this.cityPlacer = cityPlacer;
    this.nameGiver = nameGiver;
};

SVGDrawer.prototype.visualizePoints = function(svg, pts)
{
    let circle = svg.selectAll('circle.vtest').data(pts);
    circle.enter()
        .append('circle')
        .classed('vtest', true);
    circle.exit().remove();
    d3selectAll('circle.vtest')
        .attr('cx', d => 1000 * d[0])
        .attr('cy', d => 1000 * d[1])
        .attr('r', 100 / Math.sqrt(pts.length));
}

SVGDrawer.prototype.makeD3Path = function(path)
{
    let p = d3path();
    p.moveTo(1000 * path[0][0], 1000 * path[0][1]);
    for (let i = 1; i < path.length; i++) {
        p.lineTo(1000 * path[i][0], 1000 * path[i][1]);
    }
    return p.toString();
}

SVGDrawer.prototype.visualizeVoronoi = function(svg, mesh, field, lo, hi)
{
    let tris = mesh.tris;
    if (hi === undefined) hi = max(field) + 1e-9;
    if (lo === undefined) lo = min(field) - 1e-9;
    let mappedvals = field.map(x =>
        x > hi ? 1 : x < lo ? 0 : (x - lo) / (hi - lo)
    );
    let svgTris = svg.selectAll('path.field').data(tris)
    svgTris.enter()
        .append('path')
        .classed('field', true);

    svgTris.exit()
        .remove();

    svg.selectAll('path.field')
        .attr('d', this.makeD3Path)
        .style('fill', (d, i) =>
            d3interpolateViridis(mappedvals[i])
        );
}

SVGDrawer.prototype.drawPaths = function(svg, cls, paths)
{
    paths = svg.selectAll('path.' + cls).data(paths)
    paths.enter()
        .append('path')
        .classed(cls, true)
    paths.exit()
        .remove();
    svg.selectAll('path.' + cls)
        .attr('d', this.makeD3Path);
}

SVGDrawer.prototype.visualizeSlopes = function(svg, mesh, field)
{
    const mesher = this.mesher;
    const terrainGenerator = this.terrainGenerator;
    const eroder = this.eroder;

    let randomGenerator = new Random('vslopes');
    let h = field;
    let strokes = [];
    let r = 0.25 / Math.sqrt(h.length);
    for (let i = 0; i < h.length; i++)
    {
        if (h[i] <= 0 || mesher.isnearedge(mesh, i)) continue;
        let nbs = mesher.neighboursCopy(mesh, i);
        nbs.push(i);
        let s = 0;
        let s2 = 0;
        for (let j = 0; j < nbs.length; j++) {
            let slopes = eroder.trislope(mesh, nbs[j]);
            s += slopes[0] / 10;
            s2 += slopes[1];
        }
        s /= nbs.length;
        s2 /= nbs.length;
        if (Math.abs(s) < terrainGenerator.runif(0.1, 0.4)) continue;
        let l = r * terrainGenerator.runif(1, 2) *
            (1 - 0.2 * Math.pow(Math.atan(s), 2)) *
            Math.exp(s2 / 100);
        let x = mesh.vxs[i][0];
        let y = mesh.vxs[i][1];
        if (Math.abs(l * s) > 2 * r) {
            let n = Math.floor(Math.abs(l * s / r));
            l /= n;
            if (n > 4) n = 4;
            for (let j = 0; j < n; j++) {
                let u = randomGenerator.rnorm() * r;
                let v = randomGenerator.rnorm() * r;
                strokes.push([
                    [x + u - l, y + v + l * s],
                    [x + u + l, y + v - l * s]
                ]);
            }
        } else {
            strokes.push([
                [x - l, y + l * s],
                [x + l, y - l * s]
            ]);
        }
    }

    let lines = svg.selectAll('line.slope').data(strokes)
    lines.enter()
        .append('line')
        .classed('slope', true);
    lines.exit()
        .remove();
    svg.selectAll('line.slope')
        .attr('x1', d => 1000 * d[0][0])
        .attr('y1', d => 1000 * d[0][1])
        .attr('x2', d => 1000 * d[1][0])
        .attr('y2', d => 1000 * d[1][1])
}

SVGDrawer.prototype.visualizeCities = function(svg, country)
{
    let cities = country.cities;
    let mesh = country.mesh;
    let n = country.params.nterrs;

    let circs = svg.selectAll('circle.city').data(cities);
    circs.enter()
        .append('circle')
        .classed('city', true);
    circs.exit()
        .remove();
    svg.selectAll('circle.city')
        .attr('cx', d => 1000 * mesh.vxs[d][0])
        .attr('cy', d => 1000 * mesh.vxs[d][1])
        .attr('r', (d, i) => i >= n ? 4 : 10)
        .style('fill', 'white')
        .style('stroke-width', 5)
        .style('stroke-linecap', 'round')
        .style('stroke', 'black')
        .raise();
}

SVGDrawer.prototype.drawMap = function(svg, country)
{
    const mesher = this.mesher;
    const cityPlacer = this.cityPlacer;
    const nameGiver = this.nameGiver;

    country.rivers = cityPlacer.getRivers(country.mesh, 0.01);
    country.coasts = mesher.contour(country.mesh, 0);
    country.terr = cityPlacer.getTerritories(country);
    country.borders = cityPlacer.getBorders(country);
    this.drawPaths(svg, 'river', country.rivers);
    this.drawPaths(svg, 'coast', country.coasts);
    this.drawPaths(svg, 'border', country.borders);
    this.visualizeSlopes(svg, country.mesh, country.mesh.buffer);
    this.visualizeCities(svg, country);
    nameGiver.drawLabels(svg, country);
}

SVGDrawer.prototype.addSVG = function(div)
{
    return div.insert("svg", ":first-child")
        .attr("height", 400)
        .attr("width", 400)
        .attr("viewBox", "-500 -500 1000 1000");
}

export {
    SVGDrawer
}
