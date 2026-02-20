/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

function makeFeature(pageId: number) {
  return {
    get: (key: string) => (key === 'page_id' ? pageId : undefined),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => resolve = res);
  return { promise, resolve };
}


let MapMock: any;
let OverlayMock: any;

vi.mock('ol/Overlay.js', () => {
  class MockOverlay {
    static instances: MockOverlay[] = [];
    element: any;
    position: any;
    setPositionCalls: any[] = [];

    constructor(options: any) {
      this.element = options?.element;
      MockOverlay.instances.push(this);
    }

    setPosition(pos: any) {
      this.position = pos;
      this.setPositionCalls.push(pos);
    }
  }

  OverlayMock = MockOverlay;
  return { default: MockOverlay };
});

vi.mock('ol/Map.js', () => {
  class MockMap {
    static instances: MockMap[] = [];

    handlers: Record<string, Function[]> = {};
    private hit: any;

    constructor(_: any) {
      MockMap.instances.push(this);
    }

    addLayer(_: any) { }
    addOverlay(_: any) { }

    on(evt: string, handler: Function) {
      (this.handlers[evt] ||= []).push(handler);
    }

    forEachFeatureAtPixel(_: any, cb: (f: any) => any, __?: any) {
      return this.hit ? cb(this.hit) : undefined;
    }

    setHit(feature: any) {
      this.hit = feature;
    }

    triggerClick(event: any) {
      const results: any[] = [];
      for (const h of this.handlers['click'] || []) results.push(h(event));
      return Promise.all(results);
    }
  }

  MapMock = MockMap;
  return { default: MockMap };
});

describe('main.ts tooltip behavior', () => {
  beforeEach(() => {
    // Fresh DOM container for each module import.
    document.body.innerHTML = '<div id="map"></div>';

    // Reset mock singletons.
    if (MapMock?.instances) MapMock.instances.length = 0;
    if (OverlayMock?.instances) OverlayMock.instances.length = 0;

    vi.unstubAllGlobals();
  });

  it('only one tooltip can be open at a time (single overlay reused)', async () => {
    const jsonByPageId = new Map<number, Promise<any>>();
    jsonByPageId.set(1, Promise.resolve(null));
    jsonByPageId.set(2, Promise.resolve(null));

    vi.stubGlobal(
      'fetch',
      vi.fn(async (urlStr: string) => {
        const pageId = Number(new URL(urlStr).searchParams.get('pageids'));
        const d = jsonByPageId.get(pageId);
        if (!d) throw new Error(`Unexpected pageId ${pageId}`);
        return {
          ok: true,
          status: 200,
          json: async () => d,
        } as any;
      }),
    );

    await vi.resetModules();
    await import('./main.ts');

    expect(OverlayMock.instances).toHaveLength(1);
    const overlay = OverlayMock.instances[0];
    const tooltipEl = overlay.element as HTMLDivElement;

    const map = MapMock.instances[0];
    map.setHit(makeFeature(1));
    map.triggerClick({ pixel: [0, 0], coordinate: [10, 20] });

    expect(OverlayMock.instances).toHaveLength(1);
    expect(overlay.position).toEqual([10, 20]);
    expect(tooltipEl.style.display).toBe('block');
    expect(tooltipEl.innerHTML).toContain('Loading...');

    map.setHit(makeFeature(2));
    map.triggerClick({ pixel: [0, 0], coordinate: [30, 40] });

    expect(OverlayMock.instances).toHaveLength(1);
    expect(overlay.position).toEqual([30, 40]);
    expect(tooltipEl.style.display).toBe('block');
    expect(tooltipEl.innerHTML).toContain('Loading...');
  });

  it('clicking a feature while another tooltip is loading shows the most recently clicked feature', async () => {
    const jsonByPageId = new Map<number, Promise<any>>();
    const d1 = deferred();
    const d2 = deferred();
    const preview1 = { query: { pages: [{ title: 'A', description: 'First', thumbnail: { source: 'https://example.com/a.jpg' } }] } };
    const preview2 = { query: { pages: [{ title: 'B', description: 'Second', thumbnail: { source: 'https://example.com/b.jpg' } }] } };

    jsonByPageId.set(1, d1.promise);
    jsonByPageId.set(2, d2.promise);

    vi.stubGlobal(
      'fetch',
      vi.fn(async (urlStr: string) => {
        const pageId = Number(new URL(urlStr).searchParams.get('pageids'));
        const d = jsonByPageId.get(pageId);
        if (!d) throw new Error(`Unexpected pageId ${pageId}`);
        return {
          ok: true,
          status: 200,
          json: async () => d,
        } as any;
      }),
    );

    await vi.resetModules();
    await import('./main.ts');

    const overlay = OverlayMock.instances[0];
    const tooltipEl = overlay.element as HTMLDivElement;
    const map = MapMock.instances[0];

    map.setHit(makeFeature(1));
    const click1 = map.triggerClick({ pixel: [0, 0], coordinate: [1, 1] });
    expect(tooltipEl.innerHTML).toContain('Loading...');

    map.setHit(makeFeature(2));
    const click2 = map.triggerClick({ pixel: [0, 0], coordinate: [2, 2] });
    expect(overlay.position).toEqual([2, 2]);

    d1.resolve(preview1);
    d2.resolve(preview2);

    await click1;
    await click2;

    expect(tooltipEl.innerHTML).toContain('B');
    expect(tooltipEl.innerHTML).toContain('curid=2');
    expect(tooltipEl.innerHTML).not.toContain('A');
  });

  it('clicking a non-feature closes the tooltip and cancels pending loads', async () => {
    const jsonByPageId = new Map<number, Promise<any>>();
    const d1 = Promise.resolve({
      query: {
        pages: [
          {
            title: 'A',
            description: 'First',
            thumbnail: { source: 'https://example.com/a.jpg' },
          },
        ],
      },
    });

    jsonByPageId.set(1, d1);

    vi.stubGlobal(
      'fetch',
      vi.fn(async (urlStr: string) => {
        const pageId = Number(new URL(urlStr).searchParams.get('pageids'));
        const d = jsonByPageId.get(pageId);
        if (!d) throw new Error(`Unexpected pageId ${pageId}`);
        return {
          ok: true,
          status: 200,
          json: async () => d,
        } as any;
      }),
    );

    await vi.resetModules();
    await import('./main.ts');

    const overlay = OverlayMock.instances[0];
    const tooltipEl = overlay.element as HTMLDivElement;
    const map = MapMock.instances[0];

    map.setHit(makeFeature(1));
    const click1 = map.triggerClick({ pixel: [0, 0], coordinate: [5, 5] });
    expect(tooltipEl.style.display).toBe('block');
    expect(tooltipEl.innerHTML).toContain('Loading...');

    map.setHit(undefined);
    await map.triggerClick({ pixel: [0, 0], coordinate: [9, 9] });

    expect(overlay.position).toBeUndefined();
    expect(tooltipEl.style.display).toBe('none');
    expect(tooltipEl.innerHTML).toBe('');

    await click1;

    expect(overlay.position).toBeUndefined();
    expect(tooltipEl.style.display).toBe('none');
    expect(tooltipEl.innerHTML).toBe('');
  });
});
