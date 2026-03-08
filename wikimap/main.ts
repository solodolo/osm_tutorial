import './style.css'
import MVT from 'ol/format/MVT.js';
import OSM from 'ol/source/OSM.js'
import OLMap from 'ol/Map.js';
import Overlay from 'ol/Overlay.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import VectorTileLayer from 'ol/layer/VectorTile.js';
import VectorTileSource from 'ol/source/VectorTile.js';
import { Fill, Stroke, Style } from 'ol/style';
import CircleStyle from 'ol/style/Circle';
import { FeatureLike } from 'ol/Feature';
import { MapBrowserEvent } from 'ol';
import { Coordinate } from 'ol/coordinate';

const map: OLMap = new OLMap({
  view: new View({
    center: [0, 0],
    zoom: 0,
  }),
  target: 'map',
});

const layer: TileLayer = new TileLayer({
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
let tileSourceUrl = `${import.meta.env.VITE_TILE_SERVER_URL}/public.enwiki_page_geo_by_zoom_advanced/{z}/{x}/{y}.pbf`;
const layer2 = new VectorTileLayer({
  source: new VectorTileSource({
    format: new MVT(),
    url: tileSourceUrl,
    maxZoom: 22,
  }),
  style: (feature) => {
    let pageId = feature?.get('page_id');

    if (selectedFeature == pageId) {
      return selectedStyle;
    }

    return defaultStyle;
  },
});

map.addLayer(layer);
map.addLayer(layer2);

type WikiPreview = {
  title: string;
  description: string;
  thumbnailUrl?: string;
};

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

const wikiPreviewCache: Map<number, Promise<WikiPreview | null>> = new Map();

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

async function fetchWikiPreview(pageId: number): Promise<WikiPreview | null> {
  const cached = wikiPreviewCache.get(pageId);
  if (cached) return cached;

  const preview: Promise<WikiPreview | null> = (async () => {
    const url = new URL('https://en.wikipedia.org/w/api.php');
    url.search = new URLSearchParams({
      action: 'query',
      format: 'json',
      formatversion: '2',
      origin: '*',
      pageids: String(pageId),
      redirects: '1',
      prop: 'description|pageimages',
      piprop: 'thumbnail',
      pithumbsize: '240',
    }).toString();

    const resp = await fetch(url.toString());
    if (!resp.ok) throw new Error(`Wikipedia API error: ${resp.status}`);
    const data = await resp.json();
    const page = data?.query?.pages?.[0];
    if (!page || page.missing) return null;

    const title: string | undefined = page.title;
    if (!title) return null;

    const description: string = page.description || "";

    const thumbnailUrl: string | undefined = page.thumbnail?.source;
    return { title, description, thumbnailUrl };
  })().catch((err) => {
    wikiPreviewCache.delete(pageId);
    throw err;
  });

  wikiPreviewCache.set(pageId, preview);
  return preview;
}

function resetSelectedFeatures() {
  selectedFeature = null;
  layer2.changed();
}

function setSelectedFeature(pageId: number) {
  selectedFeature = pageId;
  layer2.changed();
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
        return layerCandidate === layer2;
      },
      hitTolerance: 4
    },
  );

  return onFeatureClicked(hit, event.coordinate);
}

map.on('click', mapClickListener);

