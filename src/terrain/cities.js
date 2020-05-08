import * as d3 from 'd3';

import PriorityQueue from 'js-priority-queue';

import { map } from './rough';
import { downhill, getFlux } from './erosion';
import {
    distance, isnearedge, neighbours, mergeSegments
} from './mesh';

let CityPlacer = function()
{
    this.buffer = [];
}

function cityScore(h, cities)
{
    let score = map(getFlux(h), Math.sqrt);
    for (let i = 0; i < h.length; i++) {
        if (h[i] <= 0 || isnearedge(h.mesh, i)) {
            score[i] = -999999;
            continue;
        }
        score[i] += 0.01 / (1e-9 + Math.abs(h.mesh.vxs[i][0]) - h.mesh.extent.width/2)
        score[i] += 0.01 / (1e-9 + Math.abs(h.mesh.vxs[i][1]) - h.mesh.extent.height/2)
        for (let j = 0; j < cities.length; j++) {
            score[i] -= 0.02 / (distance(h.mesh, cities[j], i) + 1e-9);
        }
    }
    return score;
}

function maxArg(array)
{
    let max = -Infinity;
    let maxIndex = 0;
    for (let i = 1, l = array.length, v; i < l; ++i)
    {
        if ((v = array[i]) > max)
        {
            max = v;
            maxIndex = i;
        }
    }
    return maxIndex;
}

function placeCity(render)
{
    render.cities = render.cities || [];
    let score = cityScore(render.h, render.cities);
    let newcity = maxArg(score);
    render.cities.push(newcity);
}

function placeCities(render) {
    let params = render.params;
    let h = render.h;
    let n = params.ncities;
    for (let i = 0; i < n; i++) {
        placeCity(render);
    }
}

function getRivers(h, limit)
{
    let dh = downhill(h);
    let flux = getFlux(h);
    let links = [];
    let above = 0;
    for (let i = 0; i < h.length; i++) {
        if (h[i] > 0) above++;
    }
    limit *= above / h.length;
    for (let i = 0; i < dh.length; i++) {
        if (isnearedge(h.mesh, i)) continue;
        if (flux[i] > limit && h[i] > 0 && dh[i] >= 0) {
            let up = h.mesh.vxs[i];
            let down = h.mesh.vxs[dh[i]];
            if (h[dh[i]] > 0) {
                links.push([up, down]);
            } else {
                links.push([up, [(up[0] + down[0])/2, (up[1] + down[1])/2]]);
            }
        }
    }
    return mergeSegments(links).map(relaxPath);
}

function getTerritories(render)
{
    let h = render.h;
    let cities = render.cities;
    let n = render.params.nterrs;
    if (n > render.cities.length) n = render.cities.length;
    let flux = getFlux(h);
    let terr = [];
    let queue = new PriorityQueue({comparator: function (a, b) {return a.score - b.score}});

    function weight(u, v)
    {
        let horiz = distance(h.mesh, u, v);
        let vert = h[v] - h[u];
        if (vert > 0) vert /= 10;
        let diff = 1 + 0.25 * Math.pow(vert/horiz, 2);
        diff += 100 * Math.sqrt(flux[u]);
        if (h[u] <= 0) diff = 100;
        if ((h[u] > 0) !== (h[v] > 0)) return 1000;
        return horiz * diff;
    }

    for (let i = 0; i < n; i++) {
        terr[cities[i]] = cities[i];
        let nbs = neighbours(h.mesh, cities[i]);
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
        let nbs = neighbours(h.mesh, u.vx);
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

    terr.mesh = h.mesh;
    return terr;
}

function getBorders(render)
{
    let terr = render.terr;
    let h = render.h;
    let edges = [];
    for (let i = 0; i < terr.mesh.edges.length; i++) {
        let e = terr.mesh.edges[i];
        if (e[3] === undefined) continue;
        if (isnearedge(terr.mesh, e[0]) || isnearedge(terr.mesh, e[1])) continue;
        if (h[e[0]] < 0 || h[e[1]] < 0) continue;
        if (terr[e[0]] !== terr[e[1]]) {
            edges.push([e[2], e[3]]);
        }
    }

    return mergeSegments(edges).map(relaxPath);
}

function relaxPath(path)
{
    let newpath = [path[0]];
    for (let i = 1; i < path.length - 1; i++) {
        let newpt = [0.25 * path[i-1][0] + 0.5 * path[i][0] + 0.25 * path[i+1][0],
            0.25 * path[i-1][1] + 0.5 * path[i][1] + 0.25 * path[i+1][1]];
        newpath.push(newpt);
    }
    newpath.push(path[path.length - 1]);
    return newpath;
}

export {
    cityScore,
    getBorders,
    getRivers,
    getTerritories,
    placeCities,
    placeCity,
};
