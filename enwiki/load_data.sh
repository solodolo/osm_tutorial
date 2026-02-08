#! /usr/bin/env bash

SRC=""
DST=""

while [[ $# -gt 0 ]]; do
        case $1 in
                -s)
                SRC="$2"
                shift
        shift
                ;;
                -d)
        DST="$2"
                shift
        shift
                ;;
                -*)
                echo "Invalid option: $1"
                exit 1
                ;;
        esac
done

if [ "$SRC" == "" ] || [ "$DST" == "" ]; then
    echo "usage: $0 -s <source> -d <destination>"
    exit 1
fi

STAGING_DST="${DST}_staging"

echo "loading data from $SRC into $STAGING_DST"

cat $SRC | psql -h localhost -U postgres -W postgis -c "TRUNCATE TABLE $STAGING_DST; COPY $STAGING_DST FROM STDIN WITH (format text, delimiter E'\t', HEADER, NULL 'NULL');"

echo "copying data from $STAGING_DST into $DST"

if [ "$DST" == "enwiki_page" ]; then
    psql -h localhost -U postgres -W postgis -c "INSERT INTO enwiki_page (page_id, page_namespace, page_title) SELECT page_id, page_namespace, DECODE(page_title, 'hex') FROM enwiki_page_staging;"
elif [ "$DST" == "enwiki_geo_tags" ]; then
    psql -h localhost -U postgres -W postgis -c "INSERT INTO enwiki_geo_tags (gt_id, gt_page_id, gt_globe, gt_lat, gt_lon, gt_geo, gt_dim, gt_type, gt_name, gt_country, gt_region, gt_lat_int, gt_lon_int) \
        SELECT gt_id, gt_page_id, DECODE(gt_globe, 'hex') AS gt_globe, gt_lat, gt_lon, ST_SetSRID(ST_MakePoint(gt_lon, gt_lat), 4326) AS gt_geo, gt_dim, \
        DECODE(gt_type, 'hex') AS gt_type, DECODE(gt_name, 'hex') AS gt_name, DECODE(gt_country, 'hex') AS gt_country, DECODE(gt_region, 'hex') AS gt_region, \
        gt_lat_int, gt_lon_int FROM enwiki_geo_tags_staging WHERE convert_from(decode(gt_globe, 'hex'), 'utf-8') = 'earth';"
fi

