/**
 * Reddit DOM selectors with fallbacks for both old and new Reddit.
 * Each selector group is an array — try them in order until one matches.
 */

/**
 * Get selectors that target a specific comment by its Reddit comment ID.
 * Reddit IDs come in short form (e.g. "abc123") — on the page they may
 * appear as "t1_abc123".
 */
export function getCommentSelectors(commentId: string): string[] {
  const fullId = commentId.startsWith('t1_') ? commentId : `t1_${commentId}`;
  const shortId = commentId.replace(/^t1_/, '');

  return [
    // New Reddit (shreddit)
    `shreddit-comment[thingid="${fullId}"]`,
    `[id="${fullId}"]`,
    // Old Reddit
    `.thing[data-fullname="${fullId}"]`,
    `#thing_${fullId}`,
    // Generic fallback
    `[data-comment-id="${shortId}"]`,
    `[id="comment-${shortId}"]`,
  ];
}

/**
 * Get upvote button selectors within a comment container.
 * These are used relative to a matched comment element.
 */
export function getUpvoteButtonSelectors(): string[] {
  return [
    // New Reddit (shreddit)
    'button[upvote]',
    'shreddit-comment-action-row button:first-of-type',
    '[data-click-id="upvote"]',
    'button[aria-label="upvote"]',
    'button[aria-label="Upvote"]',
    // Old Reddit
    '.arrow.up',
    '.arrow.upmod',
    '.midcol .arrow:first-child',
    // Generic
    '[class*="upvote"]',
    '[class*="IconUpvote"]',
  ];
}

/**
 * Selectors to check if a comment is already upvoted.
 */
export function getUpvotedIndicatorSelectors(): string[] {
  return [
    // New Reddit
    'button[upvote][aria-pressed="true"]',
    '[data-click-id="upvote"][aria-pressed="true"]',
    'button[aria-label="upvote"][aria-pressed="true"]',
    // Old Reddit
    '.arrow.upmod',
    '.midcol .arrow.upmod',
  ];
}

/**
 * Comment body / text content selectors.
 */
export function getCommentBodySelectors(): string[] {
  return [
    // New Reddit
    '[slot="comment"]',
    'div[data-testid="comment"]',
    '.Comment__body',
    // Old Reddit
    '.usertext-body',
    '.md',
    // Generic
    '[class*="RichTextJSON"]',
    '[class*="comment-content"]',
  ];
}

/**
 * Generic selectors for any comment on the page (used for cover upvotes).
 */
export function getAllCommentSelectors(): string[] {
  return [
    'shreddit-comment',
    '.thing.comment',
    '[data-testid="comment"]',
    '.Comment',
  ];
}
