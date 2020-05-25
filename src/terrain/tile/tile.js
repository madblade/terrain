
'use strict';

import { Rasterizer }        from './pixel';
import { FieldModifier }     from './modifier';
import { Eroder }            from './erosion';
import { CityPlacer }                      from './cities';
import { TerrainGenerator } from './terrain';
import { LanguageGenerator }               from '../../language';
import { NameGiver }         from '../names';
import { Mesher }            from '../mesh';

const STEPS = Object.freeze({
    WAITING: -1,
    START: 0,

    HEIGHTMAP_INIT: 1, // macro Gaussian
    HEIGHTMAP_MOUNTAINS: 2, // 50 Gaussian
    HEIGHTMAP_RELAX: 3, // relax + peaky
    HEIGHTMAP_EROSION: 4, // MULTIPLE PASSES
    HEIGHTMAP_LEVEL: 5, // set sea level + fill sinks
    HEIGHTMAP_CLEAN: 6, // clean coast

    OBJECTS_CITIES: 7, //
    OBJECTS_RIVERS: 8, //
    OBJECTS_BORDERS: 9, //

    RASTER_TRIMESH: 10, // compute trimesh + init buffer
    RASTER_RASTERIZE: 11, // MULTIPLE PASSES
    RASTER_NOISE_PASS: 12,
    RASTER_RIVER_PASS: 13,
    RASTER_TREE_PASS: 14,
    RASTER_CITY_PASS: 15,

    READY: 16
});

let Tile = function(
    coordX, coordY, dimension,
    country
)
{
    this.coordX = coordX;
    this.coordY = coordY;
    this.dimension = dimension;
    this.country = country; // contains pre-computed Voronoi in country.mesh

    // TODO seed
    this.rasterizer = new Rasterizer(this.dimension);
    this.mesher = new Mesher();
    this.fieldModifier = new FieldModifier(this.mesher);
    this.eroder = new Eroder(this.mesher);
    this.cityPlacer = new CityPlacer(this.mesher, this.fieldModifier, this.eroder);
    this.terrainGenerator = new TerrainGenerator(this.mesher, this.fieldModifier, this.eroder);
    this.languageGenerator = new LanguageGenerator();
    this.nameGiver = new NameGiver(this.languageGenerator);

    // Progressive
    this.step = STEPS.WAITING;
    this.ready = false;
    this.presentInScene = false; // when added
};

Tile.prototype.setNoiseTile = function(noiseTile)
{
    this.rasterizer.setNoiseTile(noiseTile);
};

Tile.prototype.stepGeneration = function()
{
    if (this.ready) return;

    switch (this.step)
    {
        case STEPS.WAITING:
            this.step++;
            break;
        case STEPS.START:
            const mesh = this.country.mesh;
            this.fieldModifier.resetBuffer(mesh.tris.length)
            this.step++;
            break;
        case STEPS.HEIGHTMAP_INIT:
            this.step++;
            break;
        case STEPS.HEIGHTMAP_MOUNTAINS: // 50 passes to optimize
            this.step++;
            break;
        case STEPS.HEIGHTMAP_RELAX:
            this.step++;
            break;
        case STEPS.HEIGHTMAP_EROSION: // fill sinks multiple passes
            this.step++;
            break;
        case STEPS.HEIGHTMAP_LEVEL:
            this.step++;
            break;
        case STEPS.HEIGHTMAP_CLEAN:
            this.step++;
            break;

        case STEPS.OBJECTS_CITIES:
            this.step++;
            break;
        case STEPS.OBJECTS_RIVERS:
            this.step++;
            break;
        case STEPS.OBJECTS_BORDERS:
            this.step++;
            break;

        case STEPS.RASTER_TRIMESH:
            this.step++;
            break;
        case STEPS.RASTER_RASTERIZE:
            this.step++;
            break;
        case STEPS.RASTER_NOISE_PASS:
            this.step++;
            break;
        case STEPS.RASTER_RIVER_PASS:
            this.step++;
            break;
        case STEPS.RASTER_TREE_PASS:
            this.step++;
            break;
        case STEPS.RASTER_CITY_PASS:
            this.step++;
            break;

        case STEPS.READY:
            this.ready = true;
            break;
    }
};

Tile.prototype.processHeightMap = function()
{
    let fieldModifier = this.fieldModifier;
    let mesh = this.country.mesh;
    let eroder = this.eroder;
    let terrainGenerator = this.terrainGenerator;

    fieldModifier.resetBuffer(mesh.tris.length);
    fieldModifier.addSlope(mesh, terrainGenerator.randomVector(4));
    fieldModifier.addCone(mesh, terrainGenerator.runif(-1, -1));
    fieldModifier.addMountains(mesh, 50);
    for (let i = 0; i < 10; i++)
    {
        fieldModifier.relax(mesh);
    }

    fieldModifier.peaky(mesh);

    let el = terrainGenerator.runif(0, 0.1);
    eroder.doErosion(mesh, el, 5);

    let sl = terrainGenerator.runif(0.2, 0.6);
    fieldModifier.setSeaLevel(mesh, sl);

    eroder.fillSinks(mesh);
    eroder.cleanCoast(mesh, 3);
};

Tile.prototype.placeObjects = function()
{
    let country = this.country;
    let cityPlacer = this.cityPlacer;
    let mesher = this.mesher;

    cityPlacer.placeCities(country);
    country.rivers = cityPlacer.getRivers(country.mesh, 0.01);
    country.coasts = mesher.contour(country.mesh, 0);
    country.terr = cityPlacer.getTerritories(country);
    country.borders = cityPlacer.getBorders(country);
};

Tile.prototype.renderToRaster = function()
{
    let rasterizer = this.rasterizer;
    let country = this.country;

    let triMesh = rasterizer.computeTriMesh(country.mesh);
    this.triMesh = triMesh;
    rasterizer.initBuffers(triMesh);
    rasterizer.heightPass(triMesh);
    rasterizer.noisePass(5.0);
    console.log(rasterizer.heightBuffer);
    rasterizer.riverPass(country.rivers);
    rasterizer.cityPass(country.mesh, country.cities);
};

Tile.prototype.getRaster = function()
{
    return this.rasterizer.heightBuffer;
};

Tile.prototype.getCountry = function()
{
    return this.country;
};

Tile.prototype.pack = function()
{
    return {
        country: this.getCountry(),
        raster: this.getRaster(),
        triMesh: this.triMesh,
        x: this.coordX,
        y: this.coordY
    }
}

export { Tile }
