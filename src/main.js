import { init }              from './terrain/home/home';
import {
    BufferAttribute, BufferGeometry,
    DirectionalLight, DoubleSide,
    Line, LineBasicMaterial,
    Mesh,
    MeshBasicMaterial, MeshPhongMaterial, OrthographicCamera,
    PerspectiveCamera, PlaneBufferGeometry,
    Scene, Vector3,
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
import { OrbitControls }                   from 'three/examples/jsm/controls/OrbitControls';


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
country.rivers = cityPlacer.getRivers(country.mesh, 0.01);
country.coasts = mesher.contour(country.mesh, 0);
country.terr = cityPlacer.getTerritories(country);
country.borders = cityPlacer.getBorders(country);
console.log(country.rivers);


let rasterizer = new Rasterizer();
let triMesh = rasterizer.computeTriMesh(country.mesh);

let container = document.getElementById('gl');
const dpr = window.devicePixelRatio
let w = container.clientWidth * dpr;
let h = container.clientHeight * dpr;
let scene = new Scene();
let camera = new PerspectiveCamera(75, w / h, 0.1, 1000);
let renderer = new WebGLRenderer({antialias: true});
renderer.setSize(w, h);
container.appendChild(renderer.domElement);

// Rivers
let rivers = [...country.coasts, ...country.rivers];
for (let i = 0; i < rivers.length; ++i)
{
    const r = rivers[i];
    let m = new LineBasicMaterial({color: 0xff0000});
    let pts = [];
    for (let j = 0; j < r.length; ++j)
    {
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
// cube.scale.multiplyScalar(4.0);
// cube.scale.z /= 4;
scene.add(cube);

let p = new Mesh(
    new PlaneBufferGeometry(10, 10),
    new MeshBasicMaterial({ color: 0x0000ff})
);
p.position.set(0, 0, 0);
scene.add(p);

let li = new DirectionalLight(0xffffff, 2);
li.position.set(1, -1, 2);
scene.add(li);
camera.position.z = 5;
new OrbitControls(camera, container);
let animate = function () {
    requestAnimationFrame(animate);
    // cube.rotation.x += 0.01;
    // cube.rotation.y += 0.01;
    renderer.render(scene, camera);
};
animate();
