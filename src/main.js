import './style.css';

import { init }              from './terrain/home/home';
import {
    BufferAttribute, BufferGeometry, DataTexture,
    DirectionalLight, DoubleSide,
    Line, LineBasicMaterial,
    Mesh,
    MeshBasicMaterial, MeshPhongMaterial, OrthographicCamera,
    PerspectiveCamera, PlaneBufferGeometry, RGBAFormat, RGBFormat,
    Scene, Vector3,
    WebGLRenderer
} from 'three';
import { Mesher }                          from './terrain/mesh';
import { FieldModifier }                   from './terrain/tile/modifier';
import { Eroder }                          from './terrain/tile/erosion';
import { CityPlacer }                      from './terrain/tile/cities';
import { defaultParams, TerrainGenerator } from './terrain/tile/terrain';
import { Rasterizer }                      from './terrain/tile/pixel';
import { LanguageGenerator }               from './language';
import { NameGiver }                       from './terrain/names';
import { OrbitControls }                   from 'three/examples/jsm/controls/OrbitControls';
import * as d3                             from 'd3';
import { SVGDrawer }                       from './terrain/render';
import { y }                               from './terrain/voronoi/point';


let mesher = new Mesher();
let fieldModifier = new FieldModifier(mesher);
let eroder = new Eroder(mesher);
let cityPlacer = new CityPlacer(mesher, fieldModifier, eroder);
let terrainGenerator = new TerrainGenerator(mesher, fieldModifier, eroder);
let languageGenerator = new LanguageGenerator();
let nameGiver = new NameGiver(languageGenerator);


let d3select = d3.select;
let svgDrawer = new SVGDrawer(mesher, eroder, terrainGenerator, cityPlacer, nameGiver);

function init3D()
{
    let country = { params: defaultParams };
    country.mesh = terrainGenerator.generateCoast(defaultParams);
    cityPlacer.placeCities(country);
    country.rivers = cityPlacer.getRivers(country.mesh, 0.01);
    country.coasts = mesher.contour(country.mesh, 0);
    country.terr = cityPlacer.getTerritories(country);
    country.borders = cityPlacer.getBorders(country);

    console.log(country.cities);
    let rasterizer = new Rasterizer();
    let triMesh = //[];
        rasterizer.computeTriMesh(country.mesh);
    rasterizer.initBuffers(triMesh);
    rasterizer.heightPass(triMesh);
    rasterizer.noisePass(5.0);
    console.log(rasterizer.heightBuffer);
    rasterizer.riverPass(country.rivers);
    rasterizer.cityPass(country.mesh, country.cities);

    // let finalDiv = d3select("div#fin");
    // let finalSVG = svgDrawer.addSVG(finalDiv);
    // svgDrawer.drawMap(finalSVG, country);
    const width = rasterizer.dimension;
    const height = rasterizer.dimension;
    let buffer = makeImageBufferFromRaster(rasterizer);

    let canvas = document.createElement('canvas');
    let ctx = canvas.getContext('2d');
    canvas.width = width;
    canvas.height = height;
    let iData = ctx.createImageData(width, height);
    iData.data.set(buffer);
    ctx.putImageData(iData, 0, 0);
    let image = document.getElementById('gen-image');
    image.src = canvas.toDataURL();

    let container = document.getElementById('gl');
    const dpr = window.devicePixelRatio
    let w = container.clientWidth * dpr;
    let h = container.clientHeight * dpr;
    let scene = new Scene();
    let camera = new PerspectiveCamera(75, w / h, 0.1, 1000);
    let renderer = new WebGLRenderer({antialias: true});
    renderer.setSize(w, h);
    container.appendChild(renderer.domElement);

    addThreeMesh(scene, country, triMesh, width, height, buffer);

    //
    let li = new DirectionalLight(0xffffff, 2);
    li.position.set(1, -1, 2);
    scene.add(li);
    camera.position.z = 1;

    let oc = new OrbitControls(camera, container);
    // oc.enableRotate = false;
    // oc.screenSpacePanning = true;
    let animate = function ()
    {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    };
    animate();
}

function makeImageBufferFromRaster(
    rasterizer
)
{
    const width = rasterizer.dimension;
    const height = rasterizer.dimension;
    let rb = rasterizer.heightBuffer;
    let buffer = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < height; ++i) for (let j = 0; j < width; ++j)
    {
        let s = i * width + j;
        let stride = s * 4;
        let si = (width - i - 1) * width + j;
        let v = rb[si] >> 0;
        buffer[stride    ] = v > 0 ? v : 0;
        buffer[stride + 1] = v > 0 ? v : 0;
        buffer[stride + 2] = v > 0 ? v : 255;
        buffer[stride + 3] = 255;
    }

    return buffer;
}

function addThreeMesh(
    scene,
    country, triMesh,
    rasterWidth, rasterHeight,
    buffer)
{
    // Rivers
    let rivers = [...country.coasts, ...country.rivers];
    for (let i = 0; i < rivers.length; ++i) {
        const r = rivers[i];
        let m = new LineBasicMaterial({color: 0xff0000});
        let pts = [];
        for (let j = 0; j < r.length; ++j) {
            let p = r[j];
            pts.push(new Vector3(p[0], p[1], 0.1));
        }
        let g = new BufferGeometry().setFromPoints(pts);
        let l = new Line(g, m);
        scene.add(l);
    }

    // HeightMap
    let geometry = new BufferGeometry();
    let positions = new Float32Array(triMesh.length * 3 * 3);
    for (let i = 0; i < triMesh.length; ++i) {
        let ti = triMesh[i];
        positions[9 * i]     = ti[0][0];
        positions[9 * i + 1] = ti[0][1];
        positions[9 * i + 2] = ti[0][2] / 4;

        positions[9 * i + 3] = ti[1][0];
        positions[9 * i + 4] = ti[1][1];
        positions[9 * i + 5] = ti[1][2] / 4;

        positions[9 * i + 6] = ti[2][0];
        positions[9 * i + 7] = ti[2][1];
        positions[9 * i + 8] = ti[2][2] / 4;
    }

    let positionAttribute = new BufferAttribute(positions, 3);
    geometry.setAttribute('position', positionAttribute);
    geometry.computeVertexNormals();
    let material = new MeshPhongMaterial(
        {
            color: 0x00ff00, side: DoubleSide,
            shininess: 0
            // wireframe: true
        }
    );
    let cube = new Mesh(geometry, material);
    scene.add(cube);

    let dataTexture = new DataTexture(buffer, rasterWidth, rasterHeight, RGBAFormat);
    let p = new Mesh(
        new PlaneBufferGeometry(1, 1),
        new MeshBasicMaterial({
            // color: 0x0000ff,
            transparent: true, opacity: 0.5,
            map: dataTexture
        })
    );
    p.scale.y = -1;
    p.position.set(0, 0, 0);
    scene.add(p);
}

// init(
//     mesher, fieldModifier, eroder, cityPlacer,
//     terrainGenerator, languageGenerator, nameGiver
// );
init3D();
