
import { logger } from '../lib/logger';

export type SemanticNode = {
  role?: string;
  name?: string;
  description?: string;
  xpath?: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
  children?: SemanticNode[];
};

function reduceName(name?: string) {
  if (!name) return '';
  return name.trim().replace(/\s+/g, ' ').slice(0, 200);
}

/**
 * Distills the accessibility tree into a format optimized for LLM consumption.
 * Note: In this browser preview, we simulate the Playwright accessibility snapshot.
 */
export async function distillAccessibility(page: any): Promise<SemanticNode> {
  logger.info('Commencing semantic DOM distillation...');
  
  // Simulation for the browser-based UI
  if (!page || typeof page.accessibility === 'undefined') {
    return {
      role: 'WebArea',
      name: 'OmniScout AI Dashboard',
      children: [
        { role: 'button', name: 'Spawn Agent', description: 'Initiate scout sequence' },
        { role: 'link', name: 'Dashboard Navigation', description: 'Navigate to overview' }
      ]
    };
  }

  try {
    const snapshot = await page.accessibility.snapshot({ interestingOnly: true });
    
    const mapNode = (node: any): SemanticNode => {
      const kids = (node.children || []).map(mapNode);
      return {
        role: node.role,
        name: reduceName(node.name),
        description: reduceName(node.value || node.description),
        children: kids.length ? kids : undefined
      };
    };

    return mapNode(snapshot);
  } catch (err) {
    logger.error({ err }, 'Accessibility snapshot failed during distillation');
    throw err;
  }
}

/**
 * Extracts candidate interactable elements with approximate XPaths.
 */
export async function extractCandidates(page: any, limit = 50) {
  // If page is provided (Playwright context)
  if (page && typeof page.evaluate === 'function') {
    return await page.evaluate((limitNum: number) => {
      const nodes: any[] = [];
      function xpathOf(el: Element) {
        if (!el) return '';
        const parts: string[] = [];
        let curr: Node | null = el;
        while (curr && curr.nodeType === Node.ELEMENT_NODE) {
          let tag = (curr as Element).tagName.toLowerCase();
          let sibIndex = 1;
          let sib = (curr as Element).previousElementSibling;
          while (sib) {
            if (sib.tagName === (curr as Element).tagName) sibIndex++;
            sib = sib.previousElementSibling;
          }
          parts.unshift(`${tag}[${sibIndex}]`);
          curr = curr.parentElement;
        }
        return '/' + parts.join('/');
      }
      
      const actionable = Array.from(document.querySelectorAll('a,button,input[type=submit],input[type=button],[role="button"],[onclick]'))
        .slice(0, limitNum)
        .map(el => ({
          tag: el.tagName,
          text: (el.textContent || (el as HTMLInputElement).value || '').trim().slice(0, 200),
          xpath: xpathOf(el),
        }));
      return actionable;
    }, limit);
  }
  
  // Fallback / Mock
  return [
    { tag: 'BUTTON', text: 'Login', xpath: '/html[1]/body[1]/div[1]/button[1]' },
    { tag: 'A', text: 'Sign Up', xpath: '/html[1]/body[1]/nav[1]/a[2]' }
  ];
}
