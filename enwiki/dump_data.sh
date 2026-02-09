#! /usr/bin/env bash

SELECT="
WITH page_geo AS (
    SELECT page_id,
	    page_namespace,
	    HEX(page_title),
	    page_len,
	    gt_id,
	    gt_lat,
	    gt_lon,
	    gt_dim,
	    HEX(gt_type) AS gt_type,
	    HEX(gt_name) AS gt_name,
	    HEX(gt_country) AS gt_country,
	    HEX(gt_region) AS gt_region,
	    gt_lat_int,
	    gt_lon_int
    FROM geo_tags gt
    JOIN page p ON p.page_id = gt.gt_page_id
    WHERE p.page_is_redirect = 0 AND gt.gt_primary = 1 AND gt_globe = 'earth'
)
SELECT *, NTILE(5) over (order by page_geo.page_len) AS page_len_pentile FROM page_geo
"

DUMP_PATH="page_geo.csv"

echo "dumping data to $DUMP_PATH"

if [ -e $DUMP_PATH ]; then
	read -r -p "$DUMP_PATH exists. Overwrite? [y|N] " response

	if [[ ! $response =~ ^[yY]$ ]]; then
		echo "canceled by user"
		exit 1
	fi
fi

echo $SELECT | mariadb -B -h localhost --port 3306 -u user --password enwiki > $DUMP_PATH

