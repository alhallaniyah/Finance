// Lightweight print helper to print a specific element with the same styles
// as the current app preview, without external dependencies.
//
// It opens a new window, clones styles from the current document,
// injects the target element's HTML, waits for fonts and images,
// then triggers the print dialog and closes.

type PrintOptions = {
  title?: string;
  // When true, strip Tailwind `print:` classes to keep screen layout when printing
  keepScreenLayout?: boolean;
  // Optional callback when printing completes
  onAfterPrint?: () => void;
};

function cloneHeadStyles(targetDoc: Document) {
  const parentHead = document.head;
  const nodes = parentHead.querySelectorAll('style, link[rel="stylesheet"]');
  nodes.forEach((node) => {
    if (node.tagName.toLowerCase() === 'style') {
      const styleEl = targetDoc.createElement('style');
      styleEl.textContent = (node as HTMLStyleElement).textContent || '';
      targetDoc.head.appendChild(styleEl);
    } else if (node.tagName.toLowerCase() === 'link') {
      const linkEl = targetDoc.createElement('link');
      linkEl.rel = 'stylesheet';
      linkEl.href = (node as HTMLLinkElement).href;
      targetDoc.head.appendChild(linkEl);
    }
  });
}

function stripPrintVariantClasses(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node: Node | null = walker.currentNode;
  while (node) {
    const el = node as HTMLElement;
    if (el.className) {
      const classes = el.className.toString().split(/\s+/).filter(Boolean);
      const filtered = classes.filter((c) => !c.startsWith('print:'));
      el.className = filtered.join(' ');
    }
    node = walker.nextNode();
  }
}

async function waitForImages(doc: Document) {
  const imgs = Array.from(doc.images);
  await Promise.all(
    imgs.map((img) =>
      img.complete && img.naturalWidth > 0
        ? Promise.resolve()
        : new Promise((resolve) => {
            img.onload = () => resolve(undefined);
            img.onerror = () => resolve(undefined);
          })
    )
  );
}

export async function printElementWithStyles(element: HTMLElement, options: PrintOptions = {}) {
  const { title = 'Document', keepScreenLayout = true, onAfterPrint } = options;

  const printWin = window.open('', '_blank');
  if (!printWin) {
    // Fallback to window.print() if popup blocked
    window.print();
    return;
  }

  const doc = printWin.document;
  doc.open();
  doc.write('<!doctype html><html><head><meta charset="utf-8" /></head><body></body></html>');
  doc.close();

  // Title for the print tab
  printWin.document.title = title;

  // Clone styles (Tailwind + app styles injected by Vite)
  cloneHeadStyles(doc);

  // Clone and optionally sanitize element
  const container = doc.createElement('div');
  const clone = element.cloneNode(true) as HTMLElement;
  if (keepScreenLayout) {
    stripPrintVariantClasses(clone);
  }
  container.appendChild(clone);
  doc.body.style.margin = '0';
  doc.body.appendChild(container);

  try {
    // Wait for fonts and images to be ready in the new window
    if ((doc as any).fonts && typeof (doc as any).fonts.ready === 'object') {
      await (doc as any).fonts.ready;
    }
    await waitForImages(doc);
  } catch {}

  // Trigger print
  printWin.focus();
  const after = () => {
    try { printWin.close(); } catch {}
    onAfterPrint?.();
  };

  // Some browsers support onafterprint in the child window
  (printWin as any).onafterprint = after;
  // In case onafterprint is not fired, schedule a close
  setTimeout(after, 2500);
  printWin.print();
}