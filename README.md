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
    podman run --name postgis-server --network postgis-network -e POSTGRES_PASSWORD=password -d postgis/postgis
    podman run -it --rm --network postgis-network postgis/postgis psql -h postgis-server -U postgres
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

### Rendering the map


