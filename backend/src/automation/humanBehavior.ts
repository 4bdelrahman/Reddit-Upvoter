import { Page } from 'playwright';
import { getAllCommentSelectors, getUpvoteButtonSelectors } from './selectors';

/**
 * Wait a random number of milliseconds between min and max.
 */
export async function randomDelay(min: number, max: number): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Scroll the page slowly in a human-like fashion with random pauses.
 */
export async function humanScroll(page: Page): Promise<void> {
  const scrollSteps = Math.floor(Math.random() * 4) + 2; // 2–5 scrolls

  for (let i = 0; i < scrollSteps; i++) {
    const scrollAmount = Math.floor(Math.random() * 400) + 100; // 100–500px
    await page.mouse.wheel(0, scrollAmount);
    await randomDelay(500, 2000);
  }
}

/**
 * Upvote 2-3 random OTHER comments on the page to mask targeted voting behavior.
 */
export async function coverUpvotes(page: Page, count: number = 0): Promise<void> {
  const numCover = count > 0 ? count : Math.floor(Math.random() * 2) + 2; // 2–3

  // Find all comment elements on the page
  let commentElements: any[] = [];
  for (const selector of getAllCommentSelectors()) {
    commentElements = await page.$$(selector);
    if (commentElements.length > 0) break;
  }

  if (commentElements.length < 2) return;

  // Shuffle and pick random comments
  const shuffled = commentElements.sort(() => Math.random() - 0.5);
  const targets = shuffled.slice(0, Math.min(numCover, shuffled.length));

  for (const commentEl of targets) {
    try {
      // Try to find the upvote button within this comment
      let upvoteBtn = null;
      for (const btnSelector of getUpvoteButtonSelectors()) {
        upvoteBtn = await commentEl.$(btnSelector);
        if (upvoteBtn) break;
      }

      if (upvoteBtn) {
        // Scroll the button into view
        await upvoteBtn.scrollIntoViewIfNeeded();
        await randomDelay(300, 1200);

        // Check if not already upvoted (aria-pressed != "true")
        const isPressed = await upvoteBtn.getAttribute('aria-pressed');
        if (isPressed !== 'true') {
          await upvoteBtn.click();
          await randomDelay(800, 2500);
        }
      }
    } catch {
      // Silently skip any failures on cover upvotes
      continue;
    }
  }
}

/**
 * Simulate a human reading the page: wait 30-90 seconds with small random mouse movements.
 */
export async function simulateReading(page: Page): Promise<void> {
  const readingTime = Math.floor(Math.random() * 60000) + 30000; // 30–90 seconds
  const endTime = Date.now() + readingTime;

  while (Date.now() < endTime) {
    try {
      // Small random mouse movement
      const x = Math.floor(Math.random() * 800) + 200;
      const y = Math.floor(Math.random() * 600) + 100;
      await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 5) + 3 });
    } catch {
      // Page may have closed
      break;
    }

    // Wait 3–10 seconds between movements
    const pause = Math.floor(Math.random() * 7000) + 3000;
    await new Promise((resolve) => setTimeout(resolve, Math.min(pause, endTime - Date.now())));
  }
}
