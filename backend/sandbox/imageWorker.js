import { createWorker } from "tesseract.js";
import { fileURLToPath } from "node:url";

console.log = (...args) => console.error(...args);

const ROOT = fileURLToPath(
  new URL("../", import.meta.url)
);

const MAX_SIZE = 5 * 1024 * 1024;

async function main() {

  const chunks = [];
  let size = 0;

  for await (const chunk of process.stdin) {

    size += chunk.length;

    if (size > MAX_SIZE) {
      throw new Error("Image exceeds 5 MB");
    }

    chunks.push(chunk);
  }

  const buffer = Buffer.concat(chunks);

  if (!buffer.length) {
    throw new Error("Empty image");
  }

  const worker = await createWorker("eng", 1, {
    langPath: ROOT,
    cachePath: ROOT,
    cacheMethod: "readOnly",
    gzip: false
  });

  try {

    const result = await worker.recognize(buffer);

    const text = result.data.text.trim();

    if (!text || text.length > 30000) {
      throw new Error("Invalid extracted text");
    }

    return {
      success: true,
      pages: 1,
      text,
      confidence: result.data.confidence
    };

  } finally {

    await worker.terminate();
  }
}

main()
  .then(result => {
    process.stdout.write(JSON.stringify(result));
  })
  .catch(() => {
    process.stdout.write(JSON.stringify({
      success: false,
      error: "Image extraction failed"
    }));

    process.exitCode = 1;
  });