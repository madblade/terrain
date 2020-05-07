import * as d3 from "d3";
import {Delaunay} from "d3-delaunay";
import { defaultExtent } from "./terrain";
import {Random} from "./random";

let randomGenerator = new Random('mesher');

function generatePoints(n, extent)
{
    extent = extent || defaultExtent;
    let pts = [];
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

    console.log('New Voronoi');
    console.log(layout);
    // const delaunay = Delaunay.from(pts);
    // const dln = delaunay.voronoi([-w, -h, w, h]);
    // console.log(dln);

    return layout;
}

function makeMesh(pts, extent) {
    extent = extent || defaultExtent;
    let vor = voronoi(pts, extent);
    let vxs = [];
    let vxids = {};
    let adj = [];
    let edges = [];
    let tris = [];
    for (let i = 0; i < vor.edges.length; i++) {
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

export {
    generateGoodMesh,
    centroid,
    voronoi,
    generateGoodPoints, generatePoints,
    makeMesh,
    improvePoints,
}
