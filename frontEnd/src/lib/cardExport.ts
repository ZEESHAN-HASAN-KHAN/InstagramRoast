import { toBlob } from "html-to-image";

// Cards are rasterized in the browser from the same DOM the page already shows.
// Nothing is uploaded and nothing is generated server-side — the only external
// dependency is that the avatar host answers with CORS headers, without which
// the canvas is tainted and export throws.

export type ExportFormat = "card" | "story";

function isAppleWebKit() {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua);
  return /iP(hone|ad|od)/.test(ua) || isSafari;
}

async function rasterize(node: HTMLElement, pixelRatio: number): Promise<Blob> {
  const options = {
    pixelRatio,
    // The node is laid out at a fixed size; pinning it here stops a stray
    // transform on an ancestor from changing the captured bounds.
    width: node.offsetWidth,
    height: node.offsetHeight,
    cacheBust: true,
    style: { transform: "none", margin: "0" },
  };

  try {
    return await requireBlob(node, options);
  } catch {
    // Font inlining is the usual failure — it fetches the Google Fonts CSS and
    // any hiccup there kills the whole render. The card is still worth having
    // with fallback fonts, so retry without embedding.
    return requireBlob(node, { ...options, skipFonts: true });
  }
}

async function requireBlob(
  node: HTMLElement,
  options: Parameters<typeof toBlob>[1]
): Promise<Blob> {
  const blob = await toBlob(node, options);
  if (!blob) throw new Error("Card render produced no image");
  return blob;
}

/**
 * Renders a laid-out DOM node to a PNG blob at 2x, i.e. 1080px wide for the
 * 540px card and the 540x960 story frame.
 */
export async function renderCardBlob(node: HTMLElement): Promise<Blob> {
  // Without this the first capture can land before the webfonts swap in and
  // bake Georgia into the image.
  if (document.fonts?.ready) await document.fonts.ready;

  // WebKit reliably drops images and fonts on the first pass of a foreignObject
  // render; the second pass has everything warm. Cheap insurance, Safari only.
  if (isAppleWebKit()) {
    await rasterize(node, 1).catch(() => undefined);
  }

  return rasterize(node, 2);
}

export type ShareOutcome = "shared" | "downloaded" | "cancelled";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking immediately can cancel the download in Safari.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Hands the image to the OS share sheet where that exists — on a phone this
 * drops the user straight into Instagram's story composer — and falls back to a
 * plain download everywhere else.
 */
export async function shareOrDownload(
  blob: Blob,
  filename: string,
  shareText: string
): Promise<ShareOutcome> {
  const file = new File([blob], filename, { type: "image/png" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: shareText });
      return "shared";
    } catch (err) {
      // Dismissing the sheet is a deliberate "no", not a failure to route
      // around with a surprise download.
      if ((err as Error)?.name === "AbortError") return "cancelled";
    }
  }

  downloadBlob(blob, filename);
  return "downloaded";
}

export function cardFilename(handle: string, format: ExportFormat) {
  const safe = handle.replace(/[^a-z0-9_.-]/gi, "") || "roast";
  return `instaroasts-${safe}${format === "story" ? "-story" : ""}.png`;
}
