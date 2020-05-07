import * as d3 from "d3";

import { zero } from './rough';
import {
    distance, neighbours, isnearedge, isedge
} from './mesh';

function downhill(h)
{
    if (h.downhill) return h.downhill;
    function downfrom(i) {
        if (isedge(h.mesh, i)) return -2;
        let best = -1;
        let besth = h[i];
        let nbs = neighbours(h.mesh, i);
        for (let j = 0; j < nbs.length; j++) {
            if (h[nbs[j]] < besth) {
                besth = h[nbs[j]];
                best = nbs[j];
            }
        }
        return best;
    }
    let downs = [];
    for (let i = 0; i < h.length; i++) {
        downs[i] = downfrom(i);
    }
    h.downhill = downs;
    return downs;
}

function findSinks(h)
{
    let dh = downhill(h);
    let sinks = [];
    for (let i = 0; i < dh.length; i++) {
        let node = i;
        while (true) {
            if (isedge(h.mesh, node)) {
                sinks[i] = -2;
                break;
            }
            if (dh[node] === -1) {
                sinks[i] = node;
                break;
            }
            node = dh[node];
        }
    }
}

function fillSinks(h, epsilon)
{
    epsilon = epsilon || 1e-5;
    let infinity = 999999;
    let newh = zero(h.mesh);
    for (let i = 0; i < h.length; i++)
    {
        if (isnearedge(h.mesh, i)) {
            newh[i] = h[i];
        } else {
            newh[i] = infinity;
        }
    }

    while (true)
    {
        let changed = false;
        let oh;
        for (let i = 0; i < h.length; i++)
        {
            if (newh[i] === h[i]) continue;
            let nbs = neighbours(h.mesh, i);
            for (let j = 0; j < nbs.length; j++) {
                if (h[i] >= newh[nbs[j]] + epsilon) {
                    newh[i] = h[i];
                    changed = true;
                    break;
                }
                oh = newh[nbs[j]] + epsilon;
                if ((newh[i] > oh) && (oh > h[i])) {
                    newh[i] = oh;
                    changed = true;
                }
            }
        }
        if (!changed) return newh;
    }
}

let idxs;
function getFlux(h)
{
    let dh = downhill(h);
    if (!idxs || idxs.length !== h.length) {
        idxs = new Array(h.length);
    }
    // let idxs = [];
    let flux = zero(h.mesh);
    for (let i = 0; i < h.length; i++) {
        idxs[i] = i;
        flux[i] = 1/h.length;
    }
    idxs.sort(function (a, b) {
        return h[b] - h[a];
    });
    for (let i = 0; i < h.length; i++) {
        let j = idxs[i];
        if (dh[j] >= 0) {
            flux[dh[j]] += flux[j];
        }
    }
    return flux;
}

function trislope(h, i)
{
    let nbs = neighbours(h.mesh, i);
    if (nbs.length !== 3) return [0,0];
    let p0 = h.mesh.vxs[nbs[0]];
    let p1 = h.mesh.vxs[nbs[1]];
    let p2 = h.mesh.vxs[nbs[2]];

    let x1 = p1[0] - p0[0];
    let x2 = p2[0] - p0[0];
    let y1 = p1[1] - p0[1];
    let y2 = p2[1] - p0[1];

    let det = x1 * y2 - x2 * y1;
    let h1 = h[nbs[1]] - h[nbs[0]];
    let h2 = h[nbs[2]] - h[nbs[0]];

    return [
        (y2 * h1 - y1 * h2) / det,
        (-x2 * h1 + x1 * h2) / det
    ];
}

function getSlope(h)
{
    // let dh = downhill(h);
    let slope = zero(h.mesh);
    for (let i = 0; i < h.length; i++) {
        let s = trislope(h, i);
        slope[i] = Math.sqrt(s[0] * s[0] + s[1] * s[1]);
        // continue;
        // if (dh[i] < 0) {
        //     slope[i] = 0;
        // } else {
        //     slope[i] = (h[i] - h[dh[i]]) / distance(h.mesh, i, dh[i]);
        // }
    }
    return slope;
}

function erosionRate(h)
{
    let flux = getFlux(h);
    let slope = getSlope(h);
    let newh = zero(h.mesh);
    for (let i = 0; i < h.length; i++) {
        let river = Math.sqrt(flux[i]) * slope[i];
        let creep = slope[i] * slope[i];
        let total = 1000 * river + creep;
        total = total > 200 ? 200 : total;
        newh[i] = total;
    }
    return newh;
}

function erode(h, amount) {
    let er = erosionRate(h);
    let newh = zero(h.mesh);
    let maxr = d3.max(er);
    for (let i = 0; i < h.length; i++) {
        newh[i] = h[i] - amount * (er[i] / maxr);
    }
    return newh;
}

function doErosion(h, amount, n)
{
    n = n || 1;
    h = fillSinks(h);
    for (let i = 0; i < n; i++) {
        h = erode(h, amount);
        h = fillSinks(h);
    }
    return h;
}

function cleanCoast(h, iters)
{
    for (let iter = 0; iter < iters; iter++)
    {
        let changed = 0;
        let newh = zero(h.mesh);
        for (let i = 0; i < h.length; i++) {
            newh[i] = h[i];
            let nbs = neighbours(h.mesh, i);
            if (h[i] <= 0 || nbs.length !== 3) continue;
            let count = 0;
            let best = -999999;
            for (let j = 0; j < nbs.length; j++) {
                if (h[nbs[j]] > 0) {
                    count++;
                } else if (h[nbs[j]] > best) {
                    best = h[nbs[j]];
                }
            }
            if (count > 1) continue;
            newh[i] = best / 2;
            changed++;
        }
        h = newh;

        newh = zero(h.mesh);
        for (let i = 0; i < h.length; i++) {
            newh[i] = h[i];
            let nbs = neighbours(h.mesh, i);
            if (h[i] > 0 || nbs.length !== 3) continue;
            let count = 0;
            let best = 999999;
            for (let j = 0; j < nbs.length; j++) {
                if (h[nbs[j]] <= 0) {
                    count++;
                } else if (h[nbs[j]] < best) {
                    best = h[nbs[j]];
                }
            }
            if (count > 1) continue;
            newh[i] = best / 2;
            changed++;
        }
        h = newh;
    }
    return h;
}

export {
    doErosion,
    downhill,
    getFlux,
    getSlope, trislope,
    erosionRate, fillSinks,
    cleanCoast
}
