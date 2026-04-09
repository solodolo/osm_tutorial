#! /usr/bin/env bash

tippecanoe -zg -o enwiki_page_geo.pmtiles --force --drop-densest-as-needed --extend-zooms-if-still-dropping enwiki_page_geo.jsonl
