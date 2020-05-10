import { init }              from './terrain/home/home';
import {
    AmbientLight,
    BoxGeometry, BufferAttribute, BufferGeometry, DirectionalLight, DoubleSide,
    Mesh, MeshBasicMaterial, MeshPhongMaterial,
    PerspectiveCamera, Scene,
    WebGLRenderer
} from 'three';
import { Mesher }                          from './terrain/mesh';
import { FieldModifier }                   from './terrain/modifier';
import { Eroder }                          from './terrain/erosion';
import { CityPlacer }                      from './terrain/cities';
import { defaultParams, TerrainGenerator } from './terrain/terrain';
import { LanguageGenerator }               from './language';
import { NameGiver }                       from './terrain/names';
import { Rasterizer }                      from './terrain/pixel';


let mesher = new Mesher();
let fieldModifier = new FieldModifier(mesher);
let eroder = new Eroder(mesher);
let cityPlacer = new CityPlacer(mesher, fieldModifier, eroder);
let terrainGenerator = new TerrainGenerator(mesher, fieldModifier, eroder);
let languageGenerator = new LanguageGenerator();
let nameGiver = new NameGiver(languageGenerator);

init(
    mesher,
    fieldModifier,
    eroder,
    cityPlacer,
    terrainGenerator,
    languageGenerator,
    nameGiver
);

let country = { params: defaultParams };
country.mesh = terrainGenerator.generateCoast(defaultParams);
cityPlacer.placeCities(country);

let rasterizer = new Rasterizer();
let triMesh = rasterizer.computeTriMesh(country.mesh);
console.log(triMesh);

let container = document.getElementById('gl');
const dpr = window.devicePixelRatio
let w = container.clientWidth * dpr;
let h = container.clientHeight * dpr;
let scene = new Scene();
let camera = new PerspectiveCamera(75, w / h, 0.1, 1000);
let renderer = new WebGLRenderer({antialias: true});
renderer.setSize(w, h);
container.appendChild(renderer.domElement);

let geometry = new BufferGeometry();
let positions = new Float32Array(triMesh.length * 3 * 3);
for (let i = 0; i < triMesh.length; ++i)
{
    let ti = triMesh[i];
    positions[9 * i]     = ti[0][0];
    positions[9 * i + 1] = ti[0][1];
    positions[9 * i + 2] = ti[0][2];

    positions[9 * i + 3] = ti[1][0];
    positions[9 * i + 4] = ti[1][1];
    positions[9 * i + 5] = ti[1][2];

    positions[9 * i + 6] = ti[2][0];
    positions[9 * i + 7] = ti[2][1];
    positions[9 * i + 8] = ti[2][2];
}
let positionAttribute = new BufferAttribute(positions, 3);
geometry.setAttribute('position', positionAttribute);
geometry.computeVertexNormals();

let material = new MeshPhongMaterial(
    { color: 0x00ff00, side: DoubleSide }
    );
let cube = new Mesh(geometry, material);
cube.scale.multiplyScalar(2.0);
scene.add(cube);
scene.add(new DirectionalLight(0xffffff, 10));
camera.position.z = 5;
let animate = function () {
    requestAnimationFrame(animate);
    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;
    renderer.render(scene, camera);
};
animate();
