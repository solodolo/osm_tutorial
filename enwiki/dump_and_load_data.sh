#! /usr/bin/env bash

TABLE=""
ACTION=""

while [[ $# -gt 0 ]]; do
	case $1 in
		--page)
		TABLE="page"
		shift
		;;
		--geo-tags)
		TABLE="geo_tags"
		shift
		;;
		--dump)
		ACTION="dump"
		shift
		;;
		--load)
		ACTION="load"
		shift
		;;
		-*)
		echo "Invalid option: $1"
		exit 1
		;;
	esac
done

if [ "$TABLE" == "page" ] && [ "$ACTION" == "dump" ]; then
	# Dump the data we need from `page` and `geo_tag` tables
	# -B flag prints the results using tab as the column separator
	PAGE_SELECT="SELECT page_id, page_namespace, HEX(page_title) AS page_title FROM page WHERE page_is_redirect = 0;"
	PAGE_DUMP_PATH="page_dump.csv"

	echo "dumping 'page' table to $PATH_DUMP_PATH"

	if [ -e $PAGE_DUMP_PATH ]; then
		read -r -p "$PAGE_DUMP_PATH exists. Overwrite? [y|N] " response

		if [[ ! $response =~ ^[yY]$ ]]; then
			echo "canceled by user"
			exit 1
		fi
	fi

	echo $PAGE_SELECT | mariadb -B -h localhost --port 3306 -u user --password enwiki > $PAGE_DUMP_PATH
fi

if [ "$TABLE" == "geo_tags" ] && [ "$ACTION" == "dump" ]; then
	GEO_TAG_SELECT="SELECT gt_id, gt_page_id, HEX(gt_globe) AS gt_globe, \
	gt_lat, gt_lon, gt_dim, HEX(gt_type) AS gt_type, HEX(gt_name) AS gt_name, \
	gt_country, HEX(gt_region) AS gt_region, gt_lat_int, gt_lon_int FROM \
	geo_tags WHERE gt_primary = 1;"

	GEO_TAG_DUMP_PATH="geo_tag_dump.csv"

	echo "dumping 'geo_tags' table to $GEO_TAG_DUMP_PATH"

	if [ -e $GEO_TAG_DUMP_PATH ]; then
		read -r -p "$GEO_TAG_DUMP_PATH exists. Overwrite? [y|N] " response

		if [[ ! $response =~ ^[yY]$ ]]; then
			echo "canceled by user"
			exit 1
		fi
	fi

	echo "$GEO_TAG_SELECT" | mariadb -B -h localhost --port 3306 -u user --password enwiki > $GEO_TAG_DUMP_PATH
fi
