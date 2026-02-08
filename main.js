import './style.css'
import MVT from 'ol/format/MVT';
import OSM from 'ol/source/OSM.js'
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import VectorTileLayer from 'ol/layer/VectorTile';
import VectorTileSource from 'ol/source/VectorTile';

const map = new Map({
        view: new View({
                center: [0, 0],
                zoom: 2,
        }),
        target: 'map',
});

const layer = new TileLayer({
        source: new OSM(),
});

const layer2 = new VectorTileLayer({
        source: new VectorTileSource({
                format: new MVT(),
                url: 'http://127.0.0.1:7800/public.enwiki_geo_tags/{z}/{x}/{y}.pbf',
                maxZoom: 22,
        }),

});

map.addLayer(layer);
map.addLayer(layer2);

map.on('click', function(event) {
        map.forEachFeatureAtPixel(event.pixel, function(feature) {
                if (feature) {
                        const pageId = feature.getProperties().gt_page_id;
                        console.log(pageId);
                }
        });
});

