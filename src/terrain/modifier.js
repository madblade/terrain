
import { Random }                   from './random';
import { Mesher }                   from './mesh';
import { max, mean, min, quantile } from './math';
import { license }                  from 'd3/dist/package';

let mesher = new Mesher();
let randomGenerator = new Random('rough');

let FieldModifier = function()
{
    this.buffer = [];
};

FieldModifier.prototype.resetBuffer = function(newBufferLength)
{
    if (this.buffer.length !== newBufferLength)
        this.buffer = new Float64Array(newBufferLength);
    else
        this.buffer.fill(0);
};

FieldModifier.prototype.swapBuffers = function(otherObject)
{
    let tempBuffer = this.buffer;
    this.buffer = otherObject.buffer;
    otherObject.buffer = tempBuffer;
}

FieldModifier.prototype.addScalar = function(mesh, scalar)
{
    let buffer = mesh.buffer;
    for (let i = 0, l = buffer.length; i < l; i++)
    {
        buffer[i] += scalar;
    }
}

FieldModifier.prototype.apply1D = function(mesh, mapper1D)
{
    let buffer = mesh.buffer;
    for (let i = 0, l = buffer.length; i < l; i++)
    {
        const b = buffer[i];
        buffer[i] = mapper1D(b);
    }
}

FieldModifier.prototype.apply2D = function(mesh, mapper2D)
{
    let vxs = mesh.vxs;
    let buffer = mesh.buffer;
    for (let i = 0, l = vxs.length, v; i < l; i++) {
        v = vxs[i];
        buffer[i] = mapper2D(v);
    }
}

FieldModifier.prototype.addSlope = function(mesh, direction)
{
    let dx = direction[0];
    let dy = direction[1];
    this.apply2D(mesh, v => v[0] * dx + v[1] * dy);
}

FieldModifier.prototype.addCone = function(mesh, slope)
{
    this.apply2D(mesh,
    v => Math.sqrt(
        Math.pow(v[0], 2) + Math.pow(v[1], 2)
    ) * slope);
}

FieldModifier.prototype.resetField = function(mesh)
{
    let buffer = mesh.buffer;
    for (let i = 0, l = buffer.length; i < l; ++i)
        buffer[i] = 0;
}


FieldModifier.prototype.addMountains = function(mesh, n, r)
{
    r = r || 0.05;
    let mounts = [];
    for (let i = 0; i < n; i++)
    {
        let r1 = randomGenerator.uniform();
        let r2 = randomGenerator.uniform();
        mounts.push([mesh.extent.width * (r1 - 0.5), mesh.extent.height * (r2 - 0.5)]);
    }

    let newvals = mesh.buffer
    let vxs = mesh.vxs;
    let r22 = 2 * r * r;
    for (let i = 0; i < vxs.length; i++)
    {
        let p = vxs[i];
        for (let j = 0; j < n; j++) {
            let m = mounts[j];
            newvals[i] +=
                Math.pow(Math.exp(-
                        (
                            Math.pow(p[0] - m[0], 2) +
                            Math.pow(p[1] - m[1], 2)
                        ) / r22),
                    2
                );
        }
    }
}

FieldModifier.prototype.normalize = function(mesh)
{
    let lo = min(mesh.buffer);
    let hi = max(mesh.buffer);
    this.apply1D(mesh, x => (x - lo) / (hi - lo));
}

FieldModifier.prototype.peaky = function(mesh)
{
    this.normalize(mesh);
    this.apply1D(mesh, Math.sqrt);
}

FieldModifier.prototype.relax = function(mesh)
{
    let length = mesh.buffer.length
    this.resetBuffer(length);
    let newh = this.buffer;
    let field = mesh.buffer;

    for (let i = 0; i < length; i++)
    {
        let nbs = mesher.neighbours(mesh, i);
        if (nbs.length < 3) {
            newh[i] = 0;
            continue;
        }
        newh[i] = mean(nbs, field);
    }

    this.swapBuffers(mesh);
}

FieldModifier.prototype.setSeaLevel = function(mesh, q)
{
    let delta = quantile(mesh, q);
    this.addScalar(mesh, -delta);
}

export {
    FieldModifier,
}