
import { browserManager } from '../services/browser-manager';
import { distillAccessibility, extractCandidates } from '../services/dom-distiller';
import { selectorCache } from '../services/selector-cache';
import { verifyAndSuggestSelector } from '../services/llmService';
import { logger } from '../lib/logger';

export type OpenAnalyzeResult = {
  selector?: string;
  success: boolean;
  source: 'cache' | 'llm' | 'screenshot' | 'none';
  candidate?: any;
  semanticSnapshotId?: string | null;
  message?: string;
};

export class RetryableError extends Error { constructor(msg: string) { super(msg); this.name = 'RetryableError'; } }
export class InterventionError extends Error { constructor(msg: string) { super(msg); this.name = 'InterventionError'; } }
export class FatalError extends Error { constructor(msg: string) { super(msg); this.name = 'FatalError'; } }

// Placeholder helpers - implement to persist snapshots/logs in your DB
async function saveDomSnapshot(executionId: string, url: string, parsedJson: any, htmlHash?: string) {
  logger.info({ executionId, url }, 'saveDomSnapshot: saving cognitive snapshot to storage');
  return 'snapshot-' + Math.random().toString(36).substring(7);
}

async function takeScreenshotAndAnalyze(page: any) {
  // Placeholder for services/vision-engine/ScreenshotAnalyzer
  const buf = await page.screenshot({ fullPage: false, type: 'png' });
  logger.info('Vision Engine: Analyzing viewport frame for structural cues');
  // return { selector?: string, reason?: string }
  return { analysis: 'screenshot-analyzed', buffer: buf };
}

/**
 * Probes the page for CAPTCHAs, human-verification loops, or anti-bot challenges.
 */
async function detectHumanInterventionRequired(page: any): Promise<boolean> {
  try {
    return await page.evaluate(() => {
      const bodyText = document.body?.innerText || '';
      const suspiciousSelectors = [
        'iframe[src*="captcha"]',
        'iframe[src*="recaptcha"]',
        'iframe[src*="hcaptcha"]',
        'div.g-recaptcha',
        '#cf-challenge',
        '#challenge-form',
        '.captcha-container'
      ];
      
      const hasSuspiciousElement = suspiciousSelectors.some(s => !!document.querySelector(s));
      const hasAntiBotText = /captcha|verify you are human|prove you are not a robot|cloudflare/i.test(bodyText);
      
      return hasSuspiciousElement || hasAntiBotText;
    });
  } catch (err) {
    logger.warn('Intervention probe failed: browser context might be detached');
    return false;
  }
}

/**
 * Open a page, analyze accessibility/candidates, consult cache, call LLM to find selector.
 * @param executionId - workflow execution id for logging / tracing
 * @param url - target url
 * @param description - human description of element (e.g., "Login Button")
 */
export async function openAndAnalyze(executionId: string, url: string, description: string): Promise<OpenAnalyzeResult> {
  const ctx = await browserManager.getContext();
  const page = await ctx.newPage();
  logger.info({ executionId, url, step: 'openAndAnalyze:start' }, 'Starting structural analysis');

  try {
    // Navigate
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      logger.info({ executionId, url, step: 'page.goto' }, 'Page content stream stabilized');
      
      // Early anti-bot check
      const interventionRequired = await detectHumanInterventionRequired(page);
      if (interventionRequired) {
        logger.warn({ executionId, url }, 'Anti-bot detected during navigation. Escalating to human controller.');
        throw new InterventionError('Human intervention required: Anti-bot challenge detected');
      }
    } catch (err: any) {
      if (err instanceof InterventionError) throw err;
      logger.error({ executionId, url, step: 'page.goto', err }, 'Navigation sequence failed');
      // network/timeouts are retryable
      throw new RetryableError(`Navigation failed: ${err?.message || err}`);
    }

    const domain = new URL(url).hostname;

    // 1) check selector cache first (fast path)
    try {
      const cached = await selectorCache.findCachedSelector(domain, description);
      if (cached?.selector) {
        logger.info({ executionId, url, domain, selector: cached.selector, source: 'cache' }, 'Attempting cached selector hit');
        try {
          // try quick check; small wait to let dynamic UI render
          const el = await page.$(cached.selector);
          if (el) {
            logger.info({ executionId, url, selector: cached.selector }, 'Cache hit verified');
            return { selector: cached.selector, success: true, source: 'cache' };
          }
        } catch (err) {
          logger.warn({ executionId, err, selector: cached.selector }, 'Cached selector invalid; falling back to full analysis');
        }
      }
    } catch (err) {
      logger.warn({ executionId, err }, 'Memory cache read error; continuing');
    }

    // 2) Extract Accessibility Tree (DomDistiller)
    let semantic: any = null;
    let semanticSnapshotId: string | null = null;
    try {
      semantic = await distillAccessibility(page);
      // persist semantic snapshot for debugging & model training
      semanticSnapshotId = await saveDomSnapshot(executionId, url, semantic);
      logger.info({ executionId, url, semanticSnapshotId }, 'Accessibility map committed to repository');
    } catch (err) {
      logger.error({ executionId, url, err }, 'Accessibility map generation failed; triggering vision fallback');
      const screenshotRes = await takeScreenshotAndAnalyze(page);
      if ((screenshotRes as any).selector) {
        const sel = (screenshotRes as any).selector;
        try {
          const el = await page.$(sel);
          if (el) {
            await selectorCache.upsertSelector(domain, description, sel, true);
            return { selector: sel, success: true, source: 'screenshot', semanticSnapshotId: null };
          } else {
            await selectorCache.upsertSelector(domain, description, sel, false);
          }
        } catch (e) {
          logger.warn({ executionId, err: e, sel }, 'Vision-derived selector failed verification');
        }
      }
    }

    // 3) Extract candidate interactable elements
    let candidates: any[] = [];
    try {
      candidates = await extractCandidates(page, 80);
      logger.info({ executionId, url, candidateCount: candidates.length }, 'Candidacy extraction complete');
    } catch (err) {
      logger.error({ executionId, url, err }, 'Candidacy extraction exception');
      throw new RetryableError('Candidate extraction failed: ' + (err as Error).message);
    }

    // 4) Call LLM to suggest selector
    let llmRes: any;
    try {
      llmRes = await verifyAndSuggestSelector({
        semanticTree: semantic,
        candidates,
        prompt: `Find the element corresponding to: ${description}`,
      });
      logger.info({ executionId, url, llmResponse: llmRes?.selector ? 'selector-suggested' : 'no-selector' }, 'Cognitive consensus received');
    } catch (err) {
      logger.error({ executionId, url, err }, 'Cognitive uplink failure');
      throw new RetryableError('LLM call failed: ' + (err as Error).message);
    }

    const sel = llmRes?.selector;
    if (!sel) {
      logger.warn({ executionId, url, description }, 'LLM unable to resolve target selector');
      return { success: false, source: 'none', message: 'No selector returned by LLM' };
    }

    // 5) Verify selector on page
    try {
      try {
        await page.waitForSelector(sel, { timeout: 3000 });
      } catch {
        // ignore; we'll try querying directly
      }
      const el = await page.$(sel);
      if (el) {
        logger.info({ executionId, url, selector: sel }, 'LLM selector successfully verified');
        await selectorCache.upsertSelector(domain, description, sel, true);
        return { selector: sel, success: true, source: 'llm', semanticSnapshotId };
      } else {
        logger.info({ executionId, url, selector: sel }, 'LLM selector failed verification in current state');
        await selectorCache.upsertSelector(domain, description, sel, false);
        return { selector: sel, success: false, source: 'llm', message: 'Selector suggested but not found', semanticSnapshotId };
      }
    } catch (err) {
      logger.error({ executionId, url, err, selector: sel }, 'Critical error during selector verification');
      await selectorCache.upsertSelector(domain, description, sel, false);
      
      // Late intervention check: Check if verification failed because of a popup challenge
      const interventionRequired = await detectHumanInterventionRequired(page);
      if (interventionRequired) {
        logger.warn({ executionId, url }, 'Anti-bot mechanism detected during verification phase');
        throw new InterventionError('Captcha detected on page during verification');
      }

      throw new RetryableError('Selector verification failure: ' + (err as Error).message);
    }
  } finally {
    try {
      await page.close();
    } catch (err) {
      logger.warn({ executionId, err }, 'Page termination failure');
    }
    try {
      await browserManager.releaseContext(ctx);
    } catch (err) {
      logger.warn({ executionId, err }, 'Context recycling failure');
    }
    logger.info({ executionId, url, step: 'openAndAnalyze:done' }, 'Activity cycle terminated');
  }
}
