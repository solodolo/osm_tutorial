#! /usr/bin/env bash

ogr2ogr -f GeoJSONSeq enwiki_page_geo.jsonl PG:"host='localhost' dbname='postgis' user='postgres' password='password'" -sql "SELECT page_id, page_namespace, convert_from(page_title, 'UTF-8') as page_title, page_len, gt_id, gt_lat, gt_lon, gt_geo, gt_dim, convert_from(gt_type, 'UTF-8') as gt_type, convert_from(gt_name, 'UTF-8') as gt_name, convert_from(gt_country, 'UTF-8') as gt_country, convert_from(gt_region, 'UTF-8') as gt_region, gt_lat_int, gt_lon_int FROM enwiki_page_geo"

