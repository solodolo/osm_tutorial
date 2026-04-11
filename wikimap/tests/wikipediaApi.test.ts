import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchWikiPreview } from '../src/wikipediaApi';

const validWikiPageResponse = {
  query: {
    pages: [
      {
        missing: false,
        title: 'Some cool page',
        description: 'This is an article about a really cool thing',
        thumbnail: {
          source: 'foo.jpg'
        }
      }
    ]
  }
};

describe('fetchWikiPreview', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    // TODO: Figure out a way to clear the wiki cache between tests
  });

  it('returns a WikiPreview when request is successful', async () => {
    vi.stubGlobal('fetch', (_url: string) => {
      return Promise.resolve({ ok: true, json: async () => Promise.resolve(validWikiPageResponse) });
    });

    const result = await fetchWikiPreview(1);

    expect(result.title).toEqual('Some cool page');
    expect(result.description).toEqual('This is an article about a really cool thing');
    expect(result.thumbnailUrl).toEqual('foo.jpg');
  });

  it('returns null when page is undefined', async () => {
    vi.stubGlobal('fetch', (_url: string) => {
      return Promise.resolve({ ok: true, json: async () => Promise.resolve({ query: { pages: null } }) });
    });

    const result = await fetchWikiPreview(2);

    expect(result).toBeNull();
  });

  it('caches results for the same pageId', async () => {
    const stubbedFetch = vi.fn();
    stubbedFetch.mockImplementation((_url) => {
      return Promise.resolve({ ok: true, json: async () => Promise.resolve({ query: { pages: null } }) });
    });

    vi.stubGlobal('fetch', stubbedFetch);

    await fetchWikiPreview(3);
    await fetchWikiPreview(3);

    expect(stubbedFetch).toHaveBeenCalledOnce();
  });
})
