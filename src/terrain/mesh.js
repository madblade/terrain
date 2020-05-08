
import * as d3 from 'd3';
import { Delaunay } from 'd3-delaunay';

import { Random } from './random';

import { defaultExtent } from './terrain';

let randomGenerator = new Random('mesher');

let Mesher = function()
{
    this.buffer = [];
};

function generatePoints(n, extent)
{
    extent = extent || defaultExtent;
    let pts = [];
    // let side = Math.sqrt(n);
    // for (let x = 0; x < side; ++x) {
    //     for (let y = 0; y < side; ++y) {
    //         let r1 = randomGenerator.uniform();
    //         let r2 = randomGenerator.uniform();
    //         pts.push(
    //             [
    //                 ((x + 0.5 * (r1)) / side - 0.5) * extent.width,
    //                 ((y + 0.5 * (r2)) / side - 0.5) * extent.height
    //             ]
    //         );
    //     }
    // }
    for (let i = 0; i < n; i++)
    {
        let r1 = randomGenerator.uniform();
        let r2 = randomGenerator.uniform();
        pts.push([(r1 - 0.5) * extent.width, (r2 - 0.5) * extent.height]);
    }
    return pts;
}

function centroid(pts) {
    let x = 0;
    let y = 0;
    for (let i = 0; i < pts.length; i++) {
        x += pts[i][0];
        y += pts[i][1];
    }
    return [x/pts.length, y/pts.length];
}

function improvePoints(pts, n, extent) {
    n = n || 1;
    extent = extent || defaultExtent;
    for (let i = 0; i < n; i++) {
        pts = voronoi(pts, extent)
            .polygons(pts)
            .map(centroid);
    }
    return pts;
}

function generateGoodPoints(n, extent) {
    extent = extent || defaultExtent;
    let pts = generatePoints(n, extent);
    pts = pts.sort(function (a, b) {
        return a[0] - b[0];
    });
    return improvePoints(pts, 1, extent);
}

function voronoi(pts, extent) {
    extent = extent || defaultExtent;
    let w = extent.width/2;
    let h = extent.height/2;
    let layout = d3.voronoi().extent([[-w, -h], [w, h]])(pts);

    console.log(layout);
    const delaunay = Delaunay.from(pts);
    const dln = delaunay.voronoi([-w, -h, w, h]);
    console.log(dln);

    return layout;
}

function makeMesh(pts, extent)
{
    extent = extent || defaultExtent;
    let vor = voronoi(pts, extent);
    let vxs = [];
    let vxids = {};
    let adj = [];
    let edges = [];
    let tris = [];
    for (let i = 0; i < vor.edges.length; i++)
    {
        let e = vor.edges[i];
        if (e === undefined) continue;
        let e0 = vxids[e[0]];
        let e1 = vxids[e[1]];
        if (e0 === undefined) {
            e0 = vxs.length;
            vxids[e[0]] = e0;
            vxs.push(e[0]);
        }
        if (e1 === undefined) {
            e1 = vxs.length;
            vxids[e[1]] = e1;
            vxs.push(e[1]);
        }
        adj[e0] = adj[e0] || [];
        adj[e0].push(e1);
        adj[e1] = adj[e1] || [];
        adj[e1].push(e0);
        edges.push([e0, e1, e.left, e.right]);
        tris[e0] = tris[e0] || [];
        if (!tris[e0].includes(e.left)) tris[e0].push(e.left);
        if (e.right && !tris[e0].includes(e.right)) tris[e0].push(e.right);
        tris[e1] = tris[e1] || [];
        if (!tris[e1].includes(e.left)) tris[e1].push(e.left);
        if (e.right && !tris[e1].includes(e.right)) tris[e1].push(e.right);
    }

    let mesh = {
        pts: pts,
        vor: vor,
        vxs: vxs,
        adj: adj,
        tris: tris,
        edges: edges,
        extent: extent
    }

    mesh.map = function (f) {
        let mapped = vxs.map(f);
        mapped.mesh = mesh;
        return mapped;
    }

    return mesh;
}

function generateGoodMesh(n, extent) {
    extent = extent || defaultExtent;
    let pts = generateGoodPoints(n, extent);
    return makeMesh(pts, extent);
}

function mergeSegments(segs)
{
    let adj = {};
    for (let i = 0; i < segs.length; i++) {
        let seg = segs[i];
        let a0 = adj[seg[0]] || [];
        let a1 = adj[seg[1]] || [];
        a0.push(seg[1]);
        a1.push(seg[0]);
        adj[seg[0]] = a0;
        adj[seg[1]] = a1;
    }
    let done = [];
    let paths = [];
    let path = null;
    while (true)
    {
        if (path === null) {
            for (let i = 0; i < segs.length; i++) {
                if (done[i]) continue;
                done[i] = true;
                path = [segs[i][0], segs[i][1]];
                break;
            }
            if (path === null) break;
        }

        let changed = false;
        for (let i = 0; i < segs.length; i++) {
            if (done[i]) continue;
            if (adj[path[0]].length === 2 && segs[i][0] === path[0]) {
                path.unshift(segs[i][1]);
            } else if (adj[path[0]].length === 2 && segs[i][1] === path[0]) {
                path.unshift(segs[i][0]);
            } else if (adj[path[path.length - 1]].length === 2 && segs[i][0] === path[path.length - 1]) {
                path.push(segs[i][1]);
            } else if (adj[path[path.length - 1]].length === 2 && segs[i][1] === path[path.length - 1]) {
                path.push(segs[i][0]);
            } else {
                continue;
            }
            done[i] = true;
            changed = true;
            break;
        }
        if (!changed) {
            paths.push(path);
            path = null;
        }
    }

    return paths;
}

function contour(h, level)
{
    level = level || 0;
    let edges = [];
    for (let i = 0; i < h.mesh.edges.length; i++) {
        let e = h.mesh.edges[i];
        if (e[3] === undefined) continue;
        if (isnearedge(h.mesh, e[0]) || isnearedge(h.mesh, e[1])) continue;
        if ((h[e[0]] > level && h[e[1]] <= level) ||
            (h[e[1]] > level && h[e[0]] <= level)) {
            edges.push([e[2], e[3]]);
        }
    }

    return mergeSegments(edges);
}

function isedge(mesh, i) {
    return (mesh.adj[i].length < 3);
}

function isnearedge(mesh, i) {
    let x = mesh.vxs[i][0];
    let y = mesh.vxs[i][1];
    let w = mesh.extent.width;
    let h = mesh.extent.height;
    return x < -0.45 * w || x > 0.45 * w || y < -0.45 * h || y > 0.45 * h;
}

function neighboursCopy(mesh, i) {
    let onbs = mesh.adj[i];
    let nbs = [];
    for (let i = 0; i < onbs.length; i++) {
        nbs.push(onbs[i]);
    }
    return nbs;
}

function neighbours(mesh, i) {
    // return neighboursCopy(mesh, i);
    return mesh.adj[i];
}

function distance(mesh, i, j)
{
    let p = mesh.vxs[i];
    let q = mesh.vxs[j];
    return Math.sqrt(
        Math.pow(p[0] - q[0], 2) + Math.pow(p[1] - q[1], 2)
    );
}

export {
    generateGoodMesh,
    centroid,
    voronoi,
    generateGoodPoints, generatePoints,
    makeMesh,
    improvePoints,
    isedge, isnearedge, contour, mergeSegments, distance, neighbours,
    neighboursCopy
}
