
import {
    makeName, makeRandomLanguage
}                 from '../language';
import { minArg } from './math';

let NameGiver = function()
{
    this.buffer = [];
};

function terrCenter(mesh, terr, city, landOnly)
{
    let h = mesh.buffer;
    let x = 0;
    let y = 0;
    let n = 0;
    for (let i = 0; i < terr.length; i++)
    {
        if (terr[i] !== city) continue;
        if (landOnly && h[i] <= 0) continue;
        x += mesh.vxs[i][0];
        y += mesh.vxs[i][1];
        n++;
    }
    return [x / n, y / n];
}

function drawLabels(svg, country)
{
    let params = country.params;
    let mesh = country.mesh;
    let h = mesh.buffer;
    let terr = country.terr;
    let cities = country.cities;
    let nterrs = country.params.nterrs;
    let avoids = [country.rivers, country.coasts, country.borders];
    let lang = makeRandomLanguage();
    let citylabels = [];

    function penalty(label)
    {
        let pen = 0;
        if (label.x0 < -0.45 * mesh.extent.width) pen += 100;
        if (label.x1 > 0.45 * mesh.extent.width) pen += 100;
        if (label.y0 < -0.45 * mesh.extent.height) pen += 100;
        if (label.y1 > 0.45 * mesh.extent.height) pen += 100;
        for (let i = 0; i < citylabels.length; i++) {
            let olabel = citylabels[i];
            if (label.x0 < olabel.x1 && label.x1 > olabel.x0 &&
                label.y0 < olabel.y1 && label.y1 > olabel.y0) {
                pen += 100;
            }
        }

        for (let i = 0; i < cities.length; i++) {
            let c = mesh.vxs[cities[i]];
            if (label.x0 < c[0] && label.x1 > c[0] && label.y0 < c[1] && label.y1 > c[1]) {
                pen += 100;
            }
        }
        for (let i = 0; i < avoids.length; i++) {
            let avoid = avoids[i];
            for (let j = 0; j < avoid.length; j++) {
                let avpath = avoid[j];
                for (let k = 0; k < avpath.length; k++) {
                    let pt = avpath[k];
                    if (pt[0] > label.x0 && pt[0] < label.x1 && pt[1] > label.y0 && pt[1] < label.y1) {
                        pen++;
                    }
                }
            }
        }
        return pen;
    }

    for (let i = 0; i < cities.length; i++)
    {
        let x = mesh.vxs[cities[i]][0];
        let y = mesh.vxs[cities[i]][1];
        let text = makeName(lang, 'city');
        let size = i < nterrs ? params.fontsizes.city : params.fontsizes.town;
        let sx = 0.65 * size / 1000 * text.length;
        let sy = size / 1000;
        let posslabels = [
            {
                x: x + 0.8 * sy,
                y: y + 0.3 * sy,
                align: 'start',
                x0: x + 0.7 * sy,
                y0: y - 0.6 * sy,
                x1: x + 0.7 * sy + sx,
                y1: y + 0.6 * sy
            },
            {
                x: x - 0.8 * sy,
                y: y + 0.3 * sy,
                align: 'end',
                x0: x - 0.9 * sy - sx,
                y0: y - 0.7 * sy,
                x1: x - 0.9 * sy,
                y1: y + 0.7 * sy
            },
            {
                x: x,
                y: y - 0.8 * sy,
                align: 'middle',
                x0: x - sx/2,
                y0: y - 1.9*sy,
                x1: x + sx/2,
                y1: y - 0.7 * sy
            },
            {
                x: x,
                y: y + 1.2 * sy,
                align: 'middle',
                x0: x - sx/2,
                y0: y + 0.1*sy,
                x1: x + sx/2,
                y1: y + 1.3*sy
            }
        ];

        let comparator = function (a, b) {return penalty(a) - penalty(b)};
        let label = posslabels[
            minArg(posslabels, comparator)
            ];
        label.text = text;
        label.size = size;
        citylabels.push(label);
    }

    let texts = svg.selectAll('text.city').data(citylabels);
    texts.enter()
        .append('text')
        .classed('city', true);
    texts.exit()
        .remove();
    svg.selectAll('text.city')
        .attr('x', function (d) {return 1000 * d.x})
        .attr('y', function (d) {return 1000 * d.y})
        .style('font-size', function (d) {return d.size})
        .style('text-anchor', function (d) {return d.align})
        .text(function (d) {return d.text})
        .raise();

    let reglabels = [];
    for (let i = 0; i < nterrs; i++)
    {
        let city = cities[i];
        let text = makeName(lang, 'region');
        let sy = params.fontsizes.region / 1000;
        let sx = 0.6 * text.length * sy;
        let lc = terrCenter(mesh, terr, city, true);
        let oc = terrCenter(mesh, terr, city, false);
        let best = 0;
        let bestscore = -999999;
        for (let j = 0; j < h.length; j++) {
            let score = 0;
            let v = mesh.vxs[j];
            score -= 3000 * Math.sqrt(
                Math.pow(v[0] - lc[0], 2) + Math.pow(v[1] - lc[1], 2)
            );
            score -= 1000 * Math.sqrt(
                Math.pow(v[0] - oc[0], 2) + Math.pow(v[1] - oc[1], 2)
            );
            if (terr[j] !== city) score -= 3000;
            for (let k = 0; k < cities.length; k++) {
                let u = mesh.vxs[cities[k]];
                if (Math.abs(v[0] - u[0]) < sx &&
                    Math.abs(v[1] - sy/2 - u[1]) < sy) {
                    score -= k < nterrs ? 4000 : 500;
                }
                if (v[0] - sx/2 < citylabels[k].x1 &&
                    v[0] + sx/2 > citylabels[k].x0 &&
                    v[1] - sy < citylabels[k].y1 &&
                    v[1] > citylabels[k].y0) {
                    score -= 5000;
                }
            }
            for (let k = 0; k < reglabels.length; k++) {
                let label = reglabels[k];
                if (v[0] - sx/2 < label.x + label.width/2 &&
                    v[0] + sx/2 > label.x - label.width/2 &&
                    v[1] - sy < label.y &&
                    v[1] > label.y - label.size) {
                    score -= 20000;
                }
            }
            if (h[j] <= 0) score -= 500;
            if (v[0] + sx/2 > 0.5 * mesh.extent.width) score -= 50000;
            if (v[0] - sx/2 < -0.5 * mesh.extent.width) score -= 50000;
            if (v[1] > 0.5 * mesh.extent.height) score -= 50000;
            if (v[1] - sy < -0.5 * mesh.extent.height) score -= 50000;
            if (score > bestscore) {
                bestscore = score;
                best = j;
            }
        }
        reglabels.push({
            text: text,
            x: mesh.vxs[best][0],
            y: mesh.vxs[best][1],
            size: sy,
            width: sx
        });
    }

    texts = svg.selectAll('text.region').data(reglabels);
    texts.enter()
        .append('text')
        .classed('region', true);
    texts.exit()
        .remove();
    svg.selectAll('text.region')
        .attr('x', d => 1000 * d.x)
        .attr('y', d => 1000 * d.y)
        .style('font-size', d => 1000 * d.size)
        .style('text-anchor', 'middle')
        .text(d => d.text)
        .raise();
}

export {
    drawLabels
};
