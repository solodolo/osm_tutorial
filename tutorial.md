**Tutorial followed https://blog.rustprooflabs.com/2019/01/postgis-osm-load**

1. OSM and shape data can be downloaded from https://download.geofabrik.de
1. Navigate to https://download.geofabrik.de/africa.html and download the OSM and shape files for Tanzania.
1. Set up Postgres with PostGIS extension.
    ```
    podman network create postgis-network
    podman run --name postgis-server --network postgis-network -e POSTGRES_PASSWORD=password -d postgis/postgis
    podman run -it --rm --network postgis-network postgis/postgis psql -h postgis-server -U postgres
    ```
1. Install osm2pgsql. This will allow us to import the osm.pbf files into our postgis database. First we need to grab a stylesheet for the map style though.
    1. Grab the positron style sheet
    ```
    mkdir -p ~/workspace/osm_tutorial && cd ~/workspace/osm_tutorial
    git clone https://github.com/openmaptiles/positron-gl-style.git ./positron-gl-style
    ```
    1. Run osm2pgsql using podman. The `:Z` suffix is needed to fix SELinux security issues with the bind mount. See [this article](https://stackoverflow.com/questions/24288616/permission-denied-on-accessing-host-directory-in-docker).
    ```
    cd ~/workspace/osm_tutorial
    podman run -it --rm -v $(pwd):/data_dir:Z --network postgis-network iboates/osm2pgsql \
        --create --slim --cache 200 --number-processes 1 --hstore --style /data_dir/positron-gl-style/style.json \
        --multi-geometry -d postgres -U postgres -W -H postgis-server /data_dir/tanzania-260123.osm.pbf
    ```
