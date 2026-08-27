# Overview

This is a fun experiment to build a map of wikipedia pages that have a geography component and display them efficiently. I documented a few different approaches that were abandoned for one reason or another. The final version works well though and runs on a $6 VPS.

## Helpful tutorials

* https://blog.rustprooflabs.com/2019/01/postgis-osm-load was used as a starting point and tweaked for current versions of all the tools.
* https://github.com/bmgru/osmhike-tileserver/blob/master/tutorial.pdf as a general reference.
* https://github.com/openstreetmap-carto/openstreetmap-carto was used as the default style for importing and rendering data

## MVT Tutorial

This approach loads the geo data into PostGIS and then stands up an MVT tile server that issues `/{z}/{x}/{y}.pbf` queries to the PostGIS server and converts the responses into MVT tiles.
The frontend uses OpenLayers to render the MVT tiles and generate requests to the tile server.

### Setting up Postgres and PostGIS

1. OSM and shape data can be downloaded from https://download.geofabrik.de
1. Navigate to https://download.geofabrik.de/africa/tanzania.html and download the OSM PBF file for Tanzania.
1. Set up Postgres with PostGIS extension using Podman.
    ```
    podman network create postgis-network
    podman run --name postgis-server --network host --network postgis-network -e POSTGRES_PASSWORD=password -d postgis/postgis
    podman run -it --rm --network postgis-network postgis/postgis psql -h postgis-server -U postgres
    CREATE EXTENSION hstore;
    ```

### Installing pg_tileserv
Next we need a way to serve Mapbox Vector Tiles ([MVT](https://gdal.org/en/stable/drivers/vector/mvt.html)) from our PostGIS database to our map renderer. We can do this with [pg_tileserv](https://access.crunchydata.com/documentation/pg_tileserv/1.0.11/) which is a single standalone binary that acts as the intermediary between our raw OSM data and the rendering layer.
1. Stand up the podman container and have it connect to the PostGIS server.
```
podman run -e DATABASE_URL=postgres://postgres:<password>@127.0.0.1/postgis -p 7800:7800 --network host pramsey/pg_tileserv
```
2. Visit [localhost:7800] to verify that things work.

### Example queries
#### Distance to
[ST_Distance](http://postgis.net/docs/ST_Distance.html) - Returns the 2-dimensional cartesian minimum distance (based on spatial ref) between two geometries in projected units.
```
SELECT
    ST_DISTANCE(
        ST_TRANSFORM(
            'SRID=4326;POINT(34.63026599999999 -9.907023199906947)'::geometry, 3857
        ),
        way::geometry
    ) AS geom_dist,
    ST_DISTANCE(
        'SRID=4326;POINT(34.63026599999999 -9.907023199906947)'::geography,
        ST_TRANSFORM(way, 4326)::geography
    ) AS geog_dist -- More accurate but slower
FROM planet_osm_point
WHERE
    ST_DISTANCE(
        ST_TRANSFORM(
            'SRID=4326;POINT(34.63026599999999 -9.907023199906947)'::geometry, 3857
        ),
        way::geometry
    ) <= 5000;
```
### Rendering the map
We need a way to render the MVT tiles from `pg_fileserv`. We can use [OpenLayers](https://openlayers.org/doc/quickstart.html), which is a client-side library for rendering map tiles.
1. Install OpenLayers `npm create ol-app wiki-map`
2. Install vite
```
cd wiki-map && npm install vite --save
```
3. Start the server with `npx vite`

#### Issues during setup
1. It wasn't clear to me how to change the style of a feature when it is clicked. I tried using [Select Interactions](https://openlayers.org/en/latest/apidoc/module-ol_interaction_Select-Select.html) but these do not seem to be supported for vector tile layers. Eventually, I came across [this article](https://openlayers.org/en/latest/examples/vector-tile-selection.html) which shows how to do what I wanted using `map.on` click events.

#### Wikipedia API
1. A testing sandbox for the Wikipedia API is available at https://en.wikipedia.org/wiki/Special:ApiSandbox

### Production deployment
1. Create project directory on server
    ```
    ssh -p 3020 dmmettlach@wikimap_vps 'mkdir -p ~/wikimap/wikimap'
    ssh -p 3020 dmmettlach@wikimap_vps 'mkdir -p ~/www_data/wikimap'
    ```
1. Copy the project files to the server
    ```
    # Docker compose
    scp -P 3020 docker-compose.yml dmmettlach@wikimap_vps:~/wikimap/
    # pg_tileserv config
    scp -P 3020 wikimap/pg_tileserv.toml dmmettlach@wikimap_vps:~/wikimap/wikimap/
    # Database scripts
    rsync -e "ssh -p 3020" --exclude data -av enwiki dmmettlach@wikimap_vps:~/wikimap/
    ```
1. Build the web app and copy to server
    ```
    npm run build
    rsync -e "ssh -p 3020" -av dist --delete dmmettlach@wikimap_vps:~/www_data/wikimap
    ```
1. Dump the data and copy to server
    ```
    cd enwiki
    ./dump_data.sh data/page_geo.csv
    ssh -p 3020 dmmettlach@wikimap_vps 'mkdir -p ~/wikimap/enwiki/data'
    scp -P 3020 data/page_geo.csv dmmettlach@wikimap_vps:~/wikimap/enwiki/data/
    ```
1. Set up `.env` file. See `.env.example` for required variables.
    ```
    echo "POSTGRES_PASSWORD=foobar" > ~/wikimap/.env
    chmod 600 ~/wikimap/.env
    ```
1. Start the containers
    ```
    ssh -p 3020 dmmettlach@wikimap_vps
    cd wikidata
    docker-compose up -d
    ```
1. Set up the database
    ```
    docker exec -i wikimap-postgis-1 psql -U postgres postgis < sql/create_table_enwiki_page_geo.sql
    docker exec -i wikimap-postgis-1 psql -U postgres postgis < sql/create_table_enwiki_page_geo_staging.sql
    docker exec -i wikimap-postgis-1 psql -U postgres postgis < sql/create_enwiki_page_geo_by_zoom_advanced_function.sql
    ```
1. Load the data
    ```
    # Load into staging table
    cat page_geo.csv | docker exec -i wikimap-postgis-1 psql -h localhost -U postgres -W postgis -c "COPY enwiki_page_geo_staging FROM STDIN WITH (format text, delimiter E'\t', HEADER, NULL 'NULL');"
    # Copy from staging to prod
    INSERT="TRUNCATE TABLE enwiki_page_geo; INSERT INTO enwiki_page_geo ( page_id, page_namespace, page_title, page_len, gt_id, gt_lat, gt_lon, gt_geo, gt_dim, gt_type, gt_name, gt_country, gt_region, gt_lat_int, gt_lon_int, page_len_ntile ) SELECT page_id, page_namespace, DECODE(page_title, 'hex') AS page_title, page_len, gt_id, gt_lat, gt_lon, ST_SetSRID(ST_MakePoint(gt_lon, gt_lat), 4326) AS gt_geo, gt_dim, DECODE(gt_type, 'hex') AS gt_type, DECODE(gt_name, 'hex') AS gt_name, DECODE(gt_country, 'hex') AS gt_country, DECODE(gt_region, 'hex') AS gt_region, gt_lat_int, gt_lon_int, page_len_ntile FROM enwiki_page_geo_staging;"
    docker exec -it wikimap-postgis-1 psql -h localhost -U postgres postgis -c "$INSERT"
    ```

## PMTile Tutorial

In contrast to MVT tiles, PMTile is an archive file format. Instead of using a tile server to serve `{z}/{x}/{y}` requests, clients can use http range queries to request data out of the static PMTile file. That means a PostGIS and tile server is not required once the PMTile archive is generated. It uses deduplication to reduce the number of tiles it stores internally to dramatically reduce the size vs generating tiles for every z/x/y combination separately.

### Generating the PMTile archive

The general strategy is to convert `PostGIS -> GeoJSON -> PMTile`.

1. Use ogr2ogr to convert the geo data in PostGIS into GeoJSON. Then convert the GeoJSON to PMTile.
    ```
    cd enwiki
    ./enwiki_postgis_to_geojson.sh # Creates enwiki_page_geo.jsonl
    ./enwiki_geojson_to_pmtile.sh # Creates enwiki_page_geo.pmtiles
    ```

