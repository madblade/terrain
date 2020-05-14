
'use strict';

import { Rasterizer }        from './pixel';
import { FieldModifier }     from './modifier';
import { Eroder }            from './erosion';
import { CityPlacer }                      from './cities';
import { TerrainGenerator } from './terrain';
import { LanguageGenerator }               from '../../language';
import { NameGiver }         from '../names';
import { Mesher }            from '../mesh';

let Tile = function(
    coordX, coordY, dimension,
    country
)
{
    this.coordX = coordX;
    this.coordY = coordY;
    this.dimension = dimension;
    this.country = country; // contains pre-computed Voronoi in country.mesh

    this.ready = false;
    this.progress = 0;

    // TODO seed
    this.rasterizer = new Rasterizer(this.dimension);
    this.mesher = new Mesher();
    this.fieldModifier = new FieldModifier(this.mesher);
    this.eroder = new Eroder(this.mesher);
    this.cityPlacer = new CityPlacer(this.mesher, this.fieldModifier, this.eroder);
    this.terrainGenerator = new TerrainGenerator(this.mesher, this.fieldModifier, this.eroder);
    this.languageGenerator = new LanguageGenerator();
    this.nameGiver = new NameGiver(this.languageGenerator);
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
