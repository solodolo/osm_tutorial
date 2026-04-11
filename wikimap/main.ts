import './style.css'
import pmtilesUrl from './enwiki_page_geo.pmtiles?url'
import { WikiPreview, fetchWikiPreview } from './wikipediaApi.js'

import OSM from 'ol/source/OSM.js'
import OLMap from 'ol/Map.js';
import Overlay from 'ol/Overlay.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import VectorTile from 'ol/layer/VectorTile.js';
import { PMTilesVectorSource } from 'ol-pmtiles';
import { Fill, Stroke, Style } from 'ol/style.js';
import CircleStyle from 'ol/style/Circle.js';
import { FeatureLike } from 'ol/Feature.js';
import { MapBrowserEvent } from 'ol';
import { Coordinate } from 'ol/coordinate.js';

const map: OLMap = new OLMap({
  view: new View({
    center: [0, 0],
    zoom: 0,
  }),
  target: 'map',
});

const baseLayer: TileLayer = new TileLayer({
  source: new OSM(),
});

const defaultStyle = new Style({
  image: new CircleStyle({
    radius: 3,
    fill: new Fill({ color: '#3c6dce' }),
    stroke: new Stroke({ color: 'white', width: 0.5 }),
  }),
});

const selectedStyle = new Style({
  image: new CircleStyle({
    radius: 8,
    fill: new Fill({ color: '#3c6dce' }),
    stroke: new Stroke({ color: 'black', width: 1.5 }),
  }),
});

let selectedFeature: number | null = null;
const wikiDataLayer = new VectorTile({
  source: new PMTilesVectorSource({
    url: pmtilesUrl,
  }),
  style: (feature) => {
    let pageId = feature?.get('page_id');

    if (selectedFeature == pageId) {
      return selectedStyle;
    }

    return defaultStyle;
  },
});

map.addLayer(baseLayer);
map.addLayer(wikiDataLayer);

const tooltipEl: HTMLDivElement = document.createElement('div');
tooltipEl.className = 'wiki-tooltip';
tooltipEl.style.display = 'none';

const tooltipOverlay: Overlay = new Overlay({
  element: tooltipEl,
  offset: [0, -10],
  positioning: 'bottom-center',
  stopEvent: true,
});
map.addOverlay(tooltipOverlay);

function renderTooltip(preview: WikiPreview, pageId: number) {
  const link = `https://en.wikipedia.org/w/index.php?curid=${pageId}`;
  const img = preview.thumbnailUrl
    ? `<img class="wiki-tooltip__img" src="${preview.thumbnailUrl}" alt="" loading="lazy" />`
    : '';
  tooltipEl.innerHTML = `
    <div class="wiki-tooltip__title"><a href="${link}" target="_blank" rel="noreferrer">${preview.title}</a></div>
    <div class="wiki-tooltip__description">${preview.description}</div>
    ${img}
  `.trim();
}

function closeTooltip() {
  tooltipOverlay.setPosition(undefined);
  tooltipEl.style.display = 'none';
  tooltipEl.innerHTML = '';
}

function openTooltipAt(coordinate: number[], html: string) {
  tooltipOverlay.setPosition(coordinate);
  tooltipEl.style.display = 'block';
  tooltipEl.innerHTML = html;
}

function resetSelectedFeatures() {
  selectedFeature = null;
  wikiDataLayer.changed();
}

function setSelectedFeature(pageId: number) {
  selectedFeature = pageId;
  wikiDataLayer.changed();
}

function parseRawPageId(rawPageId: string): number | null {
  const parsed = Number(rawPageId);

  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  return parsed;
}

async function onFeatureClicked(feature: FeatureLike | null | undefined, coordinate: Coordinate): Promise<void> {
  if (!feature) {
    resetSelectedFeatures();
    closeTooltip();
    return;
  }

  const pageId = parseRawPageId(feature.get('page_id'));

  if (!pageId) {
    resetSelectedFeatures();
    closeTooltip();
    return;
  }

  setSelectedFeature(pageId);

  openTooltipAt(
    coordinate,
    `<div class="wiki-tooltip__title">Loading...</div>`,
  );

  try {
    const preview = await fetchWikiPreview(pageId);
    if (pageId !== selectedFeature) return;
    if (!preview) {
      openTooltipAt(
        coordinate,
        `<div class="wiki-tooltip__title">Wikipedia article not found</div>`,
      );
      return;
    }
    renderTooltip(preview, pageId);
    tooltipOverlay.setPosition(coordinate);
  } catch {
    if (pageId !== selectedFeature) return;
    openTooltipAt(
      coordinate,
      `<div class="wiki-tooltip__title">Failed to load preview</div>`,
    );
  }
}

function mapClickListener(event: MapBrowserEvent) {
  const hit = map.forEachFeatureAtPixel(
    event.pixel,
    (feature) => feature,
    {
      layerFilter: (layerCandidate) => {
        return layerCandidate === wikiDataLayer;
      },
      hitTolerance: 4
    },
  );

  return onFeatureClicked(hit, event.coordinate);
}

map.on('click', mapClickListener);

