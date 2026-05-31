import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { CookieObject } from '../types';

/**
 * Launch a headless Chromium browser instance with stealth-friendly args.
 */
export async function launchBrowser(): Promise<Browser> {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });
  return browser;
}

/**
 * Create a browser context with Reddit cookies injected.
 * Transforms raw cookie objects into Playwright's expected format.
 */
export async function createContextWithCookies(
  browser: Browser,
  cookies: CookieObject[]
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });

  // Transform cookies to Playwright format
  const playwrightCookies = cookies.map((cookie) => ({
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain || '.reddit.com',
    path: cookie.path || '/',
    expires: cookie.expires ?? Math.floor(Date.now() / 1000) + 86400 * 365,
    httpOnly: cookie.httpOnly ?? false,
    secure: cookie.secure ?? true,
    sameSite: (cookie.sameSite ?? 'Lax') as 'Strict' | 'Lax' | 'None',
  }));

  await context.addCookies(playwrightCookies);

  const page = await context.newPage();

  return { context, page };
}

/**
 * Safely close a browser instance.
 */
export async function closeBrowser(browser: Browser): Promise<void> {
  try {
    await browser.close();
  } catch (err) {
    console.error('Error closing browser:', err);
  }
}
