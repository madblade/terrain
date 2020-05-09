
// Math util functions

import * as d3 from 'd3';

let d3quantile = d3.quantile;

function quantile(mesh, q)
{
    let h = mesh.buffer;
    let sortedh = [];
    for (let i = 0; i < h.length; i++) {
        sortedh[i] = h[i];
    }
    sortedh.sort(
        // d3.ascending
    );
    return d3quantile(sortedh, q);
}

function mean(indexArray, array)
{
    let l = indexArray.length;
    let m = 0; let n = 0;
    for (let i = 0; i < l; ++i) {
        m += array[indexArray[i]];
        ++n;
    }
    return m / n;
}

function min(array)
{
    let min = Infinity;
    for (let i = 0, l = array.length, v; i < l; ++i)
    {
        if ((v = array[i]) < min) min = v;
    }
    return min;
}

function max(array)
{
    let max = -Infinity;
    for (let i = 0, l = array.length, v; i < l; ++i)
    {
        if ((v = array[i]) > max) max = v;
    }
    return max;
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

function minArg(array, compare)
{
    let minValue = Infinity;
    let minIndex = 0;
    for (let i = 1, l = array.length, value; i < l; ++i)
    {
        value = array[i];
        if (
            minIndex === 0
                ? compare(value, value) === 0
                :
                compare(value, minValue) < 0
        )
        {
            minValue = value;
            minIndex = i;
        }
    }

    return minIndex;
}

export {
    min, max, maxArg, minArg,
    mean,
    quantile
}
