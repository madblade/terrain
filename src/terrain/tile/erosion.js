
import { max }    from '../math';

let Eroder = function(
    mesher
)
{
    if (!mesher) throw Error('Invalid argument');

    this.buffer = [];
    this.fluxBuffer = [];
    this.slopeBuffer = [];
    this.indexBuffer = [];
    this.downhillBuffer = [];

    this.mesher = mesher;
}

Eroder.prototype.resetDownhillBuffer = function(newBufferLength)
{
    if (this.downhillBuffer.length !== newBufferLength)
        this.downhillBuffer = new Int32Array(newBufferLength);
    else this.downhillBuffer.fill(0);
}

Eroder.prototype.resetSlopeBuffer = function(newBufferLength)
{
    if (this.slopeBuffer.length !== newBufferLength)
        this.slopeBuffer = new Float64Array(newBufferLength);
    else this.slopeBuffer.fill(0);
}

Eroder.prototype.resetFluxBuffer = function(newBufferLength)
{
    if (this.fluxBuffer.length !== newBufferLength)
        this.fluxBuffer = new Float64Array(newBufferLength);
    else this.fluxBuffer.fill(0);
}

Eroder.prototype.resetIndexBuffer = function(newBufferLength)
{
    if (this.indexBuffer.length !== newBufferLength)
        this.indexBuffer = new Uint32Array(newBufferLength);
    else this.indexBuffer.fill(0);
}

Eroder.prototype.resetBuffer = function(newBufferLength)
{
    if (this.buffer.length !== newBufferLength)
        this.buffer = new Float64Array(newBufferLength);
    else this.buffer.fill(0);
};

Eroder.prototype.swapBuffers = function(otherObject)
{
    let tempBuffer = this.buffer;
    this.buffer = otherObject.buffer;
    otherObject.buffer = tempBuffer;
};

Eroder.prototype.downhill = function(mesh)
{
    let nbTris = mesh.buffer.length;
    this.resetDownhillBuffer(nbTris);
    let downs = this.downhillBuffer;
    for (let i = 0; i < nbTris; i++) {
        downs[i] = this.downfrom(mesh, i);
    }
    return downs;
};

Eroder.prototype.downfrom = function(mesh, i)
{
    const mesher = this.mesher;

    if (mesher.isedge(mesh, i)) return -2;
    let h = mesh.buffer;
    let best = -1;
    let besth = h[i];
    let nbs = mesher.neighbours(mesh, i);
    for (let j = 0, l = nbs.length; j < l; j++)
    {
        const b = nbs[j];
        const hb = h[b];
        if (hb < besth) {
            besth = hb;
            best = b;
        }
    }
    return best;
};

// TODO progressive mode
Eroder.prototype.fillSinks = function(mesh, epsilon)
{
    const mesher = this.mesher;

    let h = mesh.buffer;
    epsilon = epsilon || 1e-5;
    let infinity = 999999;

    const hl = h.length;
    this.resetBuffer(hl);
    let newh = this.buffer;
    for (let i = 0; i < hl; i++)
    {
        if (mesher.isnearedge(mesh, i)) {
            newh[i] = h[i];
        } else {
            newh[i] = infinity;
        }
    }

    let changed = false;
    let oh;
    while (true)
    {
        changed = false;
        for (let i = 0; i < hl; i++)
        {
            if (newh[i] === h[i]) continue;
            let nbs = mesher.neighbours(mesh, i);
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
        if (!changed)
        {
            this.swapBuffers(mesh);
            return;
        }
    }
}

// TODO progressive mode
Eroder.prototype.getFlux = function(mesh)
{
    let dh = this.downhill(mesh);
    let nbTris = mesh.buffer.length;
    this.resetIndexBuffer(nbTris);
    this.resetFluxBuffer(nbTris);
    let idxs = this.indexBuffer;
    let flux = this.fluxBuffer;
    let h = mesh.buffer;

    const hl = h.length;
    const hlInv = 1 / hl;
    for (let i = 0; i < hl; i++) {
        idxs[i] = i;
        flux[i] = hlInv;
    }
    idxs.sort(function (a, b) {
        return h[b] - h[a];
    });
    for (let i = 0; i < hl; i++) {
        const j = idxs[i];
        const dhj = dh[j];
        if (dhj >= 0) {
            flux[dhj] += flux[j];
        }
    }

    return flux;
}

Eroder.prototype.trislope = function(mesh, i)
{
    let nbs = this.mesher.neighbours(mesh, i);
    if (nbs.length !== 3) return [0, 0];
    let p0 = mesh.vxs[nbs[0]];
    let p1 = mesh.vxs[nbs[1]];
    let p2 = mesh.vxs[nbs[2]];

    let x1 = p1[0] - p0[0];
    let x2 = p2[0] - p0[0];
    let y1 = p1[1] - p0[1];
    let y2 = p2[1] - p0[1];

    let det = x1 * y2 - x2 * y1;
    let h = mesh.buffer;
    let h1 = h[nbs[1]] - h[nbs[0]];
    let h2 = h[nbs[2]] - h[nbs[0]];

    return [
        (y2 * h1 - y1 * h2) / det,
        (-x2 * h1 + x1 * h2) / det
    ];
}

Eroder.prototype.getSlope = function(mesh)
{
    // let dh = downhill(h);
    // let slope = zero(h.mesh);
    this.resetSlopeBuffer(mesh.buffer.length);
    let slope = this.slopeBuffer;
    let h = mesh.buffer;
    for (let i = 0; i < h.length; i++)
    {
        let s = this.trislope(mesh, i);
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

Eroder.prototype.erosionRate = function(mesh)
{
    let flux = this.getFlux(mesh); // flux buffer
    let slope = this.getSlope(mesh); // slope buffer
    let nbTris = mesh.buffer.length;
    this.resetBuffer(nbTris); // this.buffer
    let newh = this.buffer;
    for (let i = 0; i < nbTris; i++)
    {
        let river = Math.sqrt(flux[i]) * slope[i];
        let creep = slope[i] * slope[i];
        let total = 1000 * river + creep;
        total = total > 200 ? 200 : total;
        newh[i] = total;
    }
    return newh;
}

Eroder.prototype.erode = function(mesh, amount)
{
    let h = mesh.buffer;
    let er = this.erosionRate(mesh); // this.buffer
    let maxr = max(er);
    let c = amount / maxr;

    // TODO amount proportional to distance to the edge
    for (let i = 0; i < h.length; i++)
    {
        h[i] = h[i] - c * er[i];
    }
}

Eroder.prototype.doErosion = function(mesh, amount, n)
{
    n = n || 1;
    this.fillSinks(mesh);
    for (let i = 0; i < n; i++) {
        this.erode(mesh, amount);
        this.fillSinks(mesh);
    }
}

Eroder.prototype.cleanCoast = function(mesh, iters)
{
    const mesher = this.mesher;
    let h = mesh.buffer;
    let nbTris = h.length;
    let newh;

    for (let iter = 0; iter < iters; iter++)
    {
        let changed = 0;

        this.resetBuffer(nbTris);
        newh = this.buffer;
        h = mesh.buffer;
        for (let i = 0; i < h.length; i++) {
            newh[i] = h[i];
            let nbs = mesher.neighbours(mesh, i);
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
        this.swapBuffers(mesh);

        this.resetBuffer(nbTris);
        newh = this.buffer;
        h = mesh.buffer;
        for (let i = 0; i < h.length; i++) {
            newh[i] = h[i];
            let nbs = mesher.neighbours(mesh, i);
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
        this.swapBuffers(mesh);
    }
}

export {
    Eroder
}
