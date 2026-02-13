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

echo "loading data from $SRC into $STAGING_DST and then copying into $DST"

STAGING_COPY="TRUNCATE TABLE $STAGING_DST; COPY $STAGING_DST FROM STDIN WITH (format text, delimiter E'\t', HEADER, NULL 'NULL');"
INSERT="
TRUNCATE TABLE enwiki_page_geo;
INSERT INTO enwiki_page_geo (
    page_id,
    page_namespace,
    page_title,
    page_len,
    gt_id,
    gt_lat,
    gt_lon,
    gt_geo,
    gt_dim,
    gt_type,
    gt_name,
    gt_country,
    gt_region,
    gt_lat_int,
    gt_lon_int,
    page_len_ntile
) SELECT
    page_id,
    page_namespace,
    DECODE(page_title, 'hex') AS page_title,
    page_len,
    gt_id,
    gt_lat,
    gt_lon,
    ST_SetSRID(ST_MakePoint(gt_lon, gt_lat), 4326) AS gt_geo,
    gt_dim,
    DECODE(gt_type, 'hex') AS gt_type,
    DECODE(gt_name, 'hex') AS gt_name,
    DECODE(gt_country, 'hex') AS gt_country,
    DECODE(gt_region, 'hex') AS gt_region,
    gt_lat_int,
    gt_lon_int,
    page_len_ntile
FROM enwiki_page_geo_staging;"

cat $SRC | psql -h localhost -U postgres -W postgis -c "${STAGING_COPY}${INSERT}"

