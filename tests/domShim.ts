/**
 * Lightweight Node test DOM & Storage shim for unit-testing pure utilities
 * (gpxParser, storage, gyro3d, crashDetection) without external npm deps.
 */

interface ListenerEntry {
  fn: (event: any) => void;
}

class XmlNode {
  tagName: string;
  localName: string;
  attributes = new Map<string, string>();
  children: XmlNode[] = [];
  parent: XmlNode | null = null;
  text = '';

  constructor(tagName: string) {
    this.tagName = tagName;
    const colon = tagName.indexOf(':');
    this.localName = colon >= 0 ? tagName.slice(colon + 1) : tagName;
  }

  get textContent(): string {
    if (this.children.length === 0) return this.text;
    let out = this.text;
    for (const c of this.children) {
      out += c.textContent;
    }
    return out;
  }

  getAttribute(name: string): string | null {
    return this.attributes.has(name) ? (this.attributes.get(name) ?? null) : null;
  }

  private matchesSimple(part: string): boolean {
    const clean = part.trim().toLowerCase();
    return this.tagName.toLowerCase() === clean || this.localName.toLowerCase() === clean;
  }

  private matchesSelector(selector: string): boolean {
    const parts = selector.split('>').map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) return false;
    if (!this.matchesSimple(parts[parts.length - 1])) return false;
    if (parts.length === 1) return true;
    // Check immediate parent chain right-to-left
    let cur: XmlNode | null = this.parent;
    for (let i = parts.length - 2; i >= 0; i--) {
      if (!cur || !cur.matchesSimple(parts[i])) return false;
      cur = cur.parent;
    }
    return true;
  }

  querySelectorAll(selectorGroup: string): XmlNode[] {
    const selectors = selectorGroup.split(',').map(s => s.trim()).filter(Boolean);
    const results: XmlNode[] = [];
    const walk = (node: XmlNode) => {
      for (const child of node.children) {
        if (selectors.some(sel => child.matchesSelector(sel))) {
          results.push(child);
        }
        walk(child);
      }
    };
    walk(this);
    return results;
  }

  querySelector(selectorGroup: string): XmlNode | null {
    return this.querySelectorAll(selectorGroup)[0] ?? null;
  }
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function parseXmlDocument(xml: string): XmlNode {
  const root = new XmlNode('#document');
  const trimmed = (xml || '').trim();
  if (!trimmed.startsWith('<')) {
    const errNode = new XmlNode('parsererror');
    errNode.parent = root;
    errNode.text = 'Invalid XML';
    root.children.push(errNode);
    return root;
  }

  const stack: XmlNode[] = [root];
  const tokenRegex = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([^\s>/]+)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let match: RegExpExecArray | null;
  let hasParseError = false;
  let sawElement = false;

  while ((match = tokenRegex.exec(trimmed)) !== null) {
    const [full, cdata, isClose, rawTag, rawAttrs, selfClose, text] = match;
    if (full.startsWith('<!--') || full.startsWith('<?')) continue;

    const current = stack[stack.length - 1];
    if (cdata !== undefined) {
      current.text += cdata;
      continue;
    }
    if (text !== undefined) {
      const decoded = decodeXmlEntities(text);
      if (current.children.length === 0) {
        current.text += decoded;
      } else if (decoded.trim()) {
        current.text += decoded;
      }
      continue;
    }

    if (isClose) {
      if (stack.length <= 1 || stack[stack.length - 1].tagName !== rawTag) {
        hasParseError = true;
        break;
      }
      stack.pop();
    } else if (rawTag) {
      sawElement = true;
      const el = new XmlNode(rawTag);
      el.parent = current;
      if (rawAttrs) {
        const attrRegex = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
        let am: RegExpExecArray | null;
        while ((am = attrRegex.exec(rawAttrs)) !== null) {
          el.attributes.set(am[1], decodeXmlEntities(am[2] ?? am[3] ?? ''));
        }
      }
      current.children.push(el);
      if (!selfClose) {
        stack.push(el);
      }
    }
  }

  if (hasParseError || !sawElement || stack.length !== 1) {
    const errNode = new XmlNode('parsererror');
    errNode.parent = root;
    errNode.text = 'Malformed XML';
    root.children.push(errNode);
  }
  return root;
}

const storageMap = new Map<string, string>();
const windowListeners = new Map<string, Set<(event: any) => void>>();

export function resetTestEnvironment(): void {
  storageMap.clear();
  windowListeners.clear();
}

export function dispatchWindowEvent(type: string, event: any): void {
  const listeners = windowListeners.get(type);
  if (!listeners) return;
  for (const fn of listeners) {
    fn(event);
  }
}

export function installDomShim(): void {
  if (!(globalThis as any).DOMParser) {
    (globalThis as any).DOMParser = class MockDOMParser {
      parseFromString(str: string, _mimeType?: string) {
        return parseXmlDocument(str);
      }
    };
  }

  if (!(globalThis as any).localStorage) {
    (globalThis as any).localStorage = {
      get length() {
        return storageMap.size;
      },
      clear() {
        storageMap.clear();
      },
      getItem(key: string) {
        return storageMap.has(key) ? (storageMap.get(key) ?? null) : null;
      },
      key(index: number) {
        return Array.from(storageMap.keys())[index] ?? null;
      },
      removeItem(key: string) {
        storageMap.delete(key);
      },
      setItem(key: string, value: string) {
        storageMap.set(key, String(value));
      },
    };
  }

  if (!(globalThis as any).window) {
    (globalThis as any).window = {
      innerWidth: 412,
      innerHeight: 915,
      addEventListener(type: string, fn: (e: any) => void) {
        if (!windowListeners.has(type)) windowListeners.set(type, new Set());
        windowListeners.get(type)!.add(fn);
      },
      removeEventListener(type: string, fn: (e: any) => void) {
        windowListeners.get(type)?.delete(fn);
      },
      dispatchEvent(event: { type: string }) {
        dispatchWindowEvent(event.type, event);
        return true;
      },
    };
  }
}
