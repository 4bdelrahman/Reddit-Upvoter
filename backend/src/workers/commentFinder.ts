import { RedditComment } from '../types';

interface RedditApiComment {
  kind: string;
  data: {
    id: string;
    author: string;
    body?: string;
    permalink?: string;
    replies?: RedditApiListing | string;
    [key: string]: any;
  };
}

interface RedditApiListing {
  kind: string;
  data: {
    children: RedditApiComment[];
    [key: string]: any;
  };
}

/**
 * Recursively flatten a Reddit comment tree from the JSON API response.
 */
function flattenComments(listing: RedditApiListing | undefined): RedditApiComment[] {
  if (!listing || listing.kind !== 'Listing' || !listing.data?.children) {
    return [];
  }

  const results: RedditApiComment[] = [];

  for (const child of listing.data.children) {
    if (child.kind === 't1' && child.data) {
      results.push(child);

      // Recurse into replies
      if (child.data.replies && typeof child.data.replies === 'object') {
        const nested = flattenComments(child.data.replies as RedditApiListing);
        results.push(...nested);
      }
    }
  }

  return results;
}

/**
 * Fetch the Reddit post's comments via JSON API and find comments authored
 * by any of the known account usernames.
 */
export async function findTargetComments(
  postUrl: string,
  knownUsernames: string[]
): Promise<RedditComment[]> {
  // Normalize the URL — strip trailing slash and query params, then append .json
  let cleanUrl = postUrl.split('?')[0].replace(/\/+$/, '');

  // If it already ends in .json, don't double-add
  if (!cleanUrl.endsWith('.json')) {
    cleanUrl += '.json';
  }

  const apiUrl = `${cleanUrl}?limit=500&raw_json=1`;

  const response = await fetch(apiUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch Reddit post comments: HTTP ${response.status} ${response.statusText}`
    );
  }

  const json = (await response.json()) as RedditApiListing[];

  // Reddit JSON API returns an array of two listings:
  // [0] = the post itself, [1] = the comments
  if (!Array.isArray(json) || json.length < 2) {
    throw new Error('Unexpected Reddit JSON API response structure');
  }

  const commentListing = json[1];
  const allComments = flattenComments(commentListing);

  // Lowercase the known usernames for case-insensitive matching
  const knownLower = new Set(knownUsernames.map((u) => u.toLowerCase()));

  const targetComments: RedditComment[] = allComments
    .filter(
      (c) =>
        c.data.author &&
        knownLower.has(c.data.author.toLowerCase()) &&
        c.data.author !== '[deleted]'
    )
    .map((c) => ({
      id: c.data.id,
      author: c.data.author,
      body: c.data.body || '',
      permalink: c.data.permalink || '',
    }));

  return targetComments;
}
