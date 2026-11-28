import { fileURLToPath } from "node:url";

// Redirect PDF.js diagnostics away from JSON output.
console.log = (...args) => console.error(...args);
console.warn = (...args) => console.error(...args);

const MAX_SIZE = 5 * 1024 * 1024;
const MAX_PAGES = 15;
const MAX_TEXT = 30000;

async function main() {
  const { getDocument } = await import(
    "pdfjs-dist/legacy/build/pdf.mjs"
  );

  const chunks = [];
  let size = 0;

  for await (const chunk of process.stdin) {
    size += chunk.length;

    if (size > MAX_SIZE) {
      throw new Error("File exceeds 5 MB");
    }

    chunks.push(chunk);
  }

  const buffer = Buffer.concat(chunks);

  if (buffer.subarray(0, 5).toString() !== "%PDF-") {
    throw new Error("Invalid PDF");
  }

  const fonts = fileURLToPath(
    new URL(
      "../node_modules/pdfjs-dist/standard_fonts/",
      import.meta.url
    )
  ).replace(/\\/g, "/");

  const task = getDocument({
    data: new Uint8Array(buffer),
    standardFontDataUrl: fonts,
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0
  });

  let result;

  try {
    const pdf = await task.promise;

    if (pdf.numPages > MAX_PAGES) {
      throw new Error("Maximum 15 pages allowed");
    }

    let text = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();

      for (const item of content.items) {
        text += (item.str || "") +
          (item.hasEOL ? "\n" : " ");
      }

      text += "\n";

      if (text.length > MAX_TEXT) {
        throw new Error("Report text exceeds limit");
      }
    }

    if (!text.trim()) {
      throw new Error("No readable text found");
    }

    result = {
      success: true,
      pages: pdf.numPages,
      text: text.trim()
    };

  } finally {
    try {
      await task.destroy();
    } catch {
      // Extraction has finished; cleanup warning
      // must not create a second JSON response.
    }
  }

  return result;
}

main()
  .then(result => {
    process.stdout.write(JSON.stringify(result));
  })
  .catch(() => {
    process.stdout.write(JSON.stringify({
      success: false,
      error: "PDF extraction failed"
    }));

    process.exitCode = 1;
  });