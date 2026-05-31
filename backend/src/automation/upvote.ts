import { Page } from 'playwright';
import {
  getCommentSelectors,
  getUpvoteButtonSelectors,
  getUpvotedIndicatorSelectors,
} from './selectors';
import { randomDelay, humanScroll, coverUpvotes, simulateReading } from './humanBehavior';

export interface UpvoteResult {
  success: boolean;
  alreadyUpvoted: boolean;
  error?: string;
}

/**
 * Main upvote function.
 * Navigates to the target comment, simulates human behavior, and clicks upvote.
 */
export async function upvoteComment(
  page: Page,
  postUrl: string,
  commentId: string
): Promise<UpvoteResult> {
  try {
    // Navigate to the post
    await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await randomDelay(2000, 5000);

    // Simulate reading the page before taking action
    await humanScroll(page);
    await randomDelay(1000, 3000);

    // Find the target comment element
    const commentSelectors = getCommentSelectors(commentId);
    let commentElement = null;

    for (const selector of commentSelectors) {
      try {
        commentElement = await page.$(selector);
        if (commentElement) break;
      } catch {
        continue;
      }
    }

    if (!commentElement) {
      // Try scrolling down to find the comment (lazy-loaded comments)
      for (let attempt = 0; attempt < 5; attempt++) {
        await page.mouse.wheel(0, 800);
        await randomDelay(1500, 3000);

        for (const selector of commentSelectors) {
          try {
            commentElement = await page.$(selector);
            if (commentElement) break;
          } catch {
            continue;
          }
        }
        if (commentElement) break;
      }
    }

    if (!commentElement) {
      return {
        success: false,
        alreadyUpvoted: false,
        error: `Comment ${commentId} not found on page`,
      };
    }

    // Scroll the comment into view
    await commentElement.scrollIntoViewIfNeeded();
    await randomDelay(500, 1500);

    // Check if already upvoted
    const upvotedSelectors = getUpvotedIndicatorSelectors();
    for (const selector of upvotedSelectors) {
      try {
        const indicator = await commentElement.$(selector);
        if (indicator) {
          return { success: true, alreadyUpvoted: true };
        }
      } catch {
        continue;
      }
    }

    // Find the upvote button
    const upvoteSelectors = getUpvoteButtonSelectors();
    let upvoteButton = null;

    for (const selector of upvoteSelectors) {
      try {
        upvoteButton = await commentElement.$(selector);
        if (upvoteButton) break;
      } catch {
        continue;
      }
    }

    if (!upvoteButton) {
      return {
        success: false,
        alreadyUpvoted: false,
        error: `Upvote button not found for comment ${commentId}`,
      };
    }

    // Simulate reading the comment before upvoting
    await simulateReading(page);

    // Do cover upvotes first (upvote 2-3 other random comments)
    await coverUpvotes(page);
    await randomDelay(2000, 5000);

    // Scroll back to the target comment
    await commentElement.scrollIntoViewIfNeeded();
    await randomDelay(500, 1500);

    // Re-locate the upvote button after scrolling
    upvoteButton = null;
    for (const selector of upvoteSelectors) {
      try {
        upvoteButton = await commentElement.$(selector);
        if (upvoteButton) break;
      } catch {
        continue;
      }
    }

    if (!upvoteButton) {
      return {
        success: false,
        alreadyUpvoted: false,
        error: `Upvote button lost after cover upvotes for comment ${commentId}`,
      };
    }

    // Click the upvote button
    await upvoteButton.click();
    await randomDelay(1000, 3000);

    // Verify the upvote took effect
    let verified = false;
    for (const selector of upvotedSelectors) {
      try {
        const indicator = await commentElement.$(selector);
        if (indicator) {
          verified = true;
          break;
        }
      } catch {
        continue;
      }
    }

    // Even if verification fails, the click may have worked (DOM differs across versions)
    return {
      success: true,
      alreadyUpvoted: false,
      error: verified ? undefined : 'Upvote clicked but verification uncertain',
    };
  } catch (err: any) {
    return {
      success: false,
      alreadyUpvoted: false,
      error: err.message || 'Unknown error during upvote',
    };
  }
}
