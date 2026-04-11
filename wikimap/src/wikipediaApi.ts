const wikiPreviewCache: Map<number, Promise<WikiPreview | null>> = new Map();

export type WikiPreview = {
  title: string;
  description: string;
  thumbnailUrl?: string;
};

export async function fetchWikiPreview(pageId: number): Promise<WikiPreview | null> {
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

