
import { logger } from '../lib/logger';

interface CachedSelector {
  selector: string;
  success_rate: number;
  last_seen: string;
}

/**
 * Manages element selector persistence. 
 * Replaces direct SQL queries with a browser-safe storage for the preview.
 */
class SelectorCache {
  private storageKey = 'omniscout_selector_cache';

  private getCache(): Record<string, Record<string, CachedSelector>> {
    const raw = localStorage.getItem(this.storageKey);
    return raw ? JSON.parse(raw) : {};
  }

  private saveCache(cache: Record<string, Record<string, CachedSelector>>) {
    localStorage.setItem(this.storageKey, JSON.stringify(cache));
  }

  async findCachedSelector(domain: string, description: string) {
    logger.debug({ domain, description }, 'Querying selector cache');
    const cache = this.getCache();
    const domainCache = cache[domain];
    
    if (domainCache && domainCache[description]) {
      return domainCache[description];
    }
    return null;
  }

  async upsertSelector(domain: string, description: string, selector: string, success: boolean) {
    const cache = this.getCache();
    if (!cache[domain]) cache[domain] = {};
    
    const existing = cache[domain][description] || {
      selector,
      success_rate: 0,
      last_seen: new Date().toISOString()
    };

    // Calculate moving average for success rate
    const currentRate = existing.success_rate;
    const newRate = success ? Math.min(1, currentRate + 0.2) : Math.max(0, currentRate - 0.2);

    cache[domain][description] = {
      selector,
      success_rate: parseFloat(newRate.toFixed(2)),
      last_seen: new Date().toISOString()
    };

    this.saveCache(cache);
    logger.info({ domain, description, newRate }, 'Selector cache updated');
  }
}

export const selectorCache = new SelectorCache();
