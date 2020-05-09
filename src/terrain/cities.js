
import PriorityQueue from 'js-priority-queue';

import { FieldModifier, maxArg } from './rough';
import { Mesher }                from './mesh';
import { Eroder }                 from './erosion';

let fieldModifier = new FieldModifier();
let mesher = new Mesher();
let eroder = new Eroder();

let CityPlacer = function()
{
    this.buffer = [];
}

CityPlacer.prototype.resetBuffer = function(newBufferLength)
{
    if (this.buffer.length !== newBufferLength)
        this.buffer = new Float64Array(newBufferLength);
    else
        this.buffer.fill(0);
};

CityPlacer.prototype.swapBuffers = function(otherObject)
{
    let tempBuffer = this.buffer;
    this.buffer = otherObject.buffer;
    otherObject.buffer = tempBuffer;
}

CityPlacer.prototype.cityScore = function(mesh, cities)
{
    let h = mesh.buffer;

    this.resetBuffer(h.length);
    let oldBuffer = this.buffer;
    this.buffer = eroder.getFlux(mesh); // swap
    eroder.fluxBuffer = oldBuffer;
    fieldModifier.apply1D(this, Math.sqrt);

    // let score = applyTransform(getFlux(h), Math.sqrt);
    let score = this.buffer;
    for (let i = 0; i < h.length; i++)
    {
        if (h[i] <= 0 || mesher.isnearedge(mesh, i)) {
            score[i] = -999999;
            continue;
        }
        score[i] += 0.01 / (1e-9 + Math.abs(mesh.vxs[i][0]) - mesh.extent.width/2)
        score[i] += 0.01 / (1e-9 + Math.abs(mesh.vxs[i][1]) - mesh.extent.height/2)
        for (let j = 0; j < cities.length; j++) {
            score[i] -= 0.02 / (mesher.distance(mesh, cities[j], i) + 1e-9);
        }
    }

    return score; // this.buffer
}

CityPlacer.prototype.placeCity = function(country)
{
    country.cities = country.cities || [];
    let score = this.cityScore(country.mesh, country.cities);
    let newcity = maxArg(score);
    country.cities.push(newcity);
}

CityPlacer.prototype.placeCities = function(country)
{
    let params = country.params;
    let n = params.ncities;
    for (let i = 0; i < n; i++)
        this.placeCity(country);
}

CityPlacer.prototype.getRivers = function(mesh, limit)
{
    let dh = eroder.downhill(mesh);
    let flux = eroder.getFlux(mesh);
    let h = mesh.buffer;

    let links = [];
    let above = 0;
    for (let i = 0; i < h.length; i++) {
        if (h[i] > 0) above++;
    }
    limit *= above / h.length;
    for (let i = 0; i < dh.length; i++)
    {
        if (mesher.isnearedge(mesh, i)) continue;
        if (flux[i] > limit && h[i] > 0 && dh[i] >= 0) {
            let up = mesh.vxs[i];
            let down = mesh.vxs[dh[i]];
            if (h[dh[i]] > 0) {
                links.push([up, down]);
            } else {
                links.push([up, [(up[0] + down[0])/2, (up[1] + down[1])/2]]);
            }
        }
    }

    return mesher.mergeSegments(links).map(this.relaxPath);
}

CityPlacer.prototype.getTerritories = function(country)
{
    let mesh = country.mesh;
    let h = mesh.buffer;
    let cities = country.cities;
    let n = country.params.nterrs;
    if (n > country.cities.length) n = country.cities.length;
    let flux = eroder.getFlux(mesh);
    let terr = [];
    let queue = new PriorityQueue({comparator: function (a, b) {return a.score - b.score}});

    function weight(u, v)
    {
        let horiz = mesher.distance(mesh, u, v);
        let vert = h[v] - h[u];
        if (vert > 0) vert /= 10;
        let diff = 1 + 0.25 * Math.pow(vert / horiz, 2);
        diff += 100 * Math.sqrt(flux[u]);
        if (h[u] <= 0) diff = 100;
        if ((h[u] > 0) !== (h[v] > 0)) return 1000;
        return horiz * diff;
    }

    for (let i = 0; i < n; i++) {
        terr[cities[i]] = cities[i];
        let nbs = mesher.neighbours(mesh, cities[i]);
        for (let j = 0; j < nbs.length; j++) {
            queue.queue({
                score: weight(cities[i], nbs[j]),
                city: cities[i],
                vx: nbs[j]
            });
        }
    }

    while (queue.length) {
        let u = queue.dequeue();
        if (terr[u.vx] !== undefined) continue;
        terr[u.vx] = u.city;
        let nbs = mesher.neighbours(mesh, u.vx);
        for (let i = 0; i < nbs.length; i++) {
            let v = nbs[i];
            if (terr[v] !== undefined) continue;
            let newdist = weight(u.vx, v);
            queue.queue({
                score: u.score + newdist,
                city: u.city,
                vx: v
            });
        }
    }

    // terr.mesh = h.mesh;
    return terr;
}

CityPlacer.prototype.getBorders = function(country)
{
    let terr = country.terr;
    let mesh = country.mesh;
    let h = mesh.buffer;
    let edges = [];
    for (let i = 0; i < mesh.edges.length; i++)
    {
        let e = mesh.edges[i];
        if (e[3] === undefined) continue;
        if (mesher.isnearedge(mesh, e[0]) || mesher.isnearedge(mesh, e[1])) continue;
        if (h[e[0]] < 0 || h[e[1]] < 0) continue;
        if (terr[e[0]] !== terr[e[1]]) {
            edges.push([e[2], e[3]]);
        }
    }

    return mesher.mergeSegments(edges).map(this.relaxPath);
}

CityPlacer.prototype.relaxPath = function(path)
{
    let newpath = [path[0]];
    for (let i = 1; i < path.length - 1; i++)
    {
        let newpt = [
            0.25 * path[i-1][0] + 0.5 * path[i][0] + 0.25 * path[i+1][0],
            0.25 * path[i-1][1] + 0.5 * path[i][1] + 0.25 * path[i+1][1]
        ];
        newpath.push(newpt);
    }
    newpath.push(path[path.length - 1]);
    return newpath;
}

export {
    CityPlacer
};
