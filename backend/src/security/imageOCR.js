import { processReport } from "./sandbox.js";

export async function processImage(buffer) {
  return processReport(buffer, "image");
}