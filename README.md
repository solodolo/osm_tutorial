# Overview

This is a tutorial for building a map of Tanzania using OSM data. Several other tutorials were followed to pieces this together:
* https://blog.rustprooflabs.com/2019/01/postgis-osm-load was used as a starting point and tweaked for current versions of all the tools.
* https://github.com/bmgru/osmhike-tileserver/blob/master/tutorial.pdf as a general reference.
* https://github.com/openstreetmap-carto/openstreetmap-carto was used as the default style for importing and rendering data

## Tutorial

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

### Importing data with osm2pgsql
1. Create our working directory.
    ```
    mkdir -p ~/workspace/osm_tutorial && cd ~/workspace/osm_tutorial
    ```
1. Create a "style" lua file to describe how osm2pgsql should transform the source OSM data into data for Postgres. Read more about styles [here](https://osm2pgsql.org/doc/manual.html#the-flex-output). More advanced themes can be built using the [Themepark](https://osm2pgsql.org/themepark/users-manual.html) framework. For this project, we can use the style provided by [openstreetmap-carto](https://github.com/openstreetmap-carto/openstreetmap-carto).
    ```
    git clone git clone git@github.com:openstreetmap-carto/openstreetmap-carto.git
    ```
1. ~Install osm2pgsql. This will allow us to import the osm.pbf files into our postgis database.~
    * ~Grab the default lua style from the osm2pgsql repository.~
    ```
    mkdir -p ~/workspace/osm_tutorial/flex_style && cd ~/workspace/osm_tutorial
    wget -O flex_style/style.lua https://raw.githubusercontent.com/osm2pgsql-dev/osm2pgsql/refs/heads/master/style.lua
    ```
1. Then we can import the data by running osm2pgsql using podman. The `:Z` suffix is needed to fix SELinux security issues with the bind mount. See [this article](https://stackoverflow.com/questions/24288616/permission-denied-on-accessing-host-directory-in-docker).
    ```
    podman run -it --rm -v $(pwd):/data_dir:Z --network postgis-network iboates/osm2pgsql \
        --create --slim --cache 200 --number-processes 1 --hstore -O flex -S /data_dir/openstreetmap-carto/openstreetmap-carto-flex.lua \
        --multi-geometry -d postgres -U postgres -W -H postgis-server /data_dir/tanzania-260123.osm.pbf
    ```
1. osm2pgsql should start the import and complete in a few minutes.
    ```
    2026-01-24 18:18:53  osm2pgsql version 2.2.0 (2.2.0-2-g7629962d)
    2026-01-24 18:18:53  WARNING: Ignoring option -k,--hstore for 'flex' output
    2026-01-24 18:18:53  WARNING: Ignoring option -G,--multi-geometry for 'flex' output
    2026-01-24 18:18:53  Database version: 17.5 (Debian 17.5-1.pgdg110+1)
    2026-01-24 18:18:53  PostGIS version: 3.5
    2026-01-24 18:18:53  WARNING: No output tables defined!
    2026-01-24 18:18:53  Initializing properties table '"public"."osm2pgsql_properties"'.
    2026-01-24 18:18:53  Storing properties to table '"public"."osm2pgsql_properties"'.
    2026-01-24 18:21:38  Reading input files done in 165s (2m 45s).
    2026-01-24 18:21:38    Processed 124849873 nodes in 133s (2m 13s) - 939k/s
    2026-01-24 18:21:38    Processed 17494539 ways in 32s - 547k/s
    2026-01-24 18:21:38    Processed 36842 relations in 0s - 37k/s
    2026-01-24 18:21:38  No marked nodes or ways (Skipping stage 2).
    2026-01-24 18:21:38  Building index on middle ways table
    2026-01-24 18:21:38  Building indexes on middle rels table
    2026-01-24 18:21:38  Done postprocessing on table 'planet_osm_nodes' in 0s
    2026-01-24 18:22:46  Done postprocessing on table 'planet_osm_ways' in 67s (1m 7s)
    2026-01-24 18:22:46  Done postprocessing on table 'planet_osm_rels' in 0s
    2026-01-24 18:22:46  Storing properties to table '"public"."osm2pgsql_properties"'.
    2026-01-24 18:22:46  osm2pgsql took 233s (3m 53s) overall.
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

## Production deployment
1. Create project directory on server
    ```
    ssh -p 3020 dmmettlach@137.184.39.108 'mkdir -p ~/wikimap/wikimap'
    ssh -p 3020 dmmettlach@137.184.39.108 'mkdir -p ~/www_data/wikimap'
    ```
1. Copy the project files to the server
    ```
    # Docker compose
    scp -P 3020 docker-compose.yml dmmettlach@137.184.39.108:~/wikimap/
    # pg_tileserv config
    scp -P 3020 wikimap/pg_tileserv.toml dmmettlach@137.184.39.108:~/wikimap/wikimap/
    # Database scripts
    rsync -e "ssh -p 3020" --exclude data -av enwiki dmmettlach@137.184.39.108:~/wikimap/
    ```
1. Build the web app and copy to server
    ```
    npm run build
    rsync -e "ssh -p 3020" -av dist dmmettlach@137.184.39.108:~/www_data/wikimap
    ```
1. Dump the data and copy to server
    ```
    cd enwiki
    ./dump_data.sh data/page_geo.csv
    ssh -p 3020 dmmettlach@137.184.39.108 'mkdir -p ~/wikimap/enwiki/data'
    scp -P 3020 data/page_geo.csv dmmettlach@137.184.39.108:~/wikimap/enwiki/data/
    ```
1. Set up `.env` file. See `.env.example` for required variables.
    ```
    echo "POSTGRES_PASSWORD=foobar" > ~/wikimap/.env
    chmod 600 ~/wikimap/.env
    ```
1. Start the containers
    ```
    ssh -p 3020 dmmettlach@137.184.39.108
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
