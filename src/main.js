import './style.css';

import { init }              from './terrain/home/home';
import {
    BoxBufferGeometry,
    BufferAttribute, BufferGeometry, DataTexture,
    DirectionalLight, DoubleSide,
    Line, LineBasicMaterial,
    Mesh,
    MeshBasicMaterial, MeshPhongMaterial, MOUSE, OrthographicCamera,
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
import { NameGiver }                  from './terrain/names';
import { MapControls, OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import * as d3                        from 'd3';
import { SVGDrawer }                       from './terrain/render';
import { WorldMap }                        from './terrain/world';


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
    let container = document.getElementById('gl');
    const dpr = window.devicePixelRatio
    let w = container.clientWidth * dpr;
    let h = container.clientHeight * dpr;
    let scene = new Scene();
    let camera = new PerspectiveCamera(75, w / h, 0.1, 1000);
    let renderer = new WebGLRenderer({antialias: true});
    renderer.setSize(w, h);
    container.appendChild(renderer.domElement);

    //
    let li = new DirectionalLight(0xffffff, 2);
    li.position.set(1, -1, 2);
    scene.add(li);
    camera.position.z = 1;

    let oc = new MapControls(camera, container);
    oc.enableRotate = false;
    oc.screenSpacePanning = true;

    let world = new WorldMap();
    world.seedWorld();
    world.genWorld();
    // .then(() =>
    //     world.tiles.forEach(tile =>
    //     {
    //         let country = tile.getCountry();
    //         let raster = tile.getRaster();
    //         let triMesh = tile.triMesh;
    //
    //         const width = tile.dimension;
    //         const height = tile.dimension;
    //         let buffer = makeImageBufferFromRaster(tile, raster);
    //
    //         // svg image
    //         // makeSVG(country);
    //
    //         // raster image
    //         // makeImage(width, height, buffer);
    //
    //         // three mesh + texture
    //         let cx = tile.coordX;
    //         let cy = tile.coordY;
    //         addThreeMesh(scene, country, triMesh, width, height, buffer, cx, cy);
    //     })
    // );

    let animate = function() {
        requestAnimationFrame(animate);
        world.generateIfNeeded(scene, camera);
        // let coords = getFocusedCoords();
        // let tile = createOrContinueGeneratingTile();
        // if (tile.ready) addTile();
        renderer.render(scene, camera);
    };
    animate();
}

function makeSVG(country)
{
    let finalDiv = d3select("div#fin");
    let finalSVG = svgDrawer.addSVG(finalDiv);
    svgDrawer.drawMap(finalSVG, country);
}

function makeImage(width, height, buffer)
{
    let canvas = document.createElement('canvas');
    let ctx = canvas.getContext('2d');
    canvas.width = width;
    canvas.height = height;
    let iData = ctx.createImageData(width, height);
    iData.data.set(buffer);
    ctx.putImageData(iData, 0, 0);
    let image = document.getElementById('gen-image');
    image.src = canvas.toDataURL();
}

// init(
//     mesher, fieldModifier, eroder, cityPlacer,
//     terrainGenerator, languageGenerator, nameGiver
// );
init3D();
