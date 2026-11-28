import { spawn } from "node:child_process";

let active = false;

export async function processReport(buffer, type = "pdf") {

  if (
    !Buffer.isBuffer(buffer) ||
    buffer.length === 0 ||
    buffer.length > 5 * 1024 * 1024
  ) {
    throw new Error("Invalid file size");
  }

  if (!["pdf", "image"].includes(type)) {
    throw new Error("Unsupported report type");
  }

  if (active) {
    throw new Error("Sandbox is busy");
  }

  active = true;

  const command = type === "pdf"
    ? [
        "/usr/bin/pdftotext",
        "-f", "1",
        "-l", "15",
        "-layout", "-", "-"
      ]
    : [
        "/usr/bin/tesseract",
        "stdin", "stdout", "-l", "eng"
      ];

  try {
    return await new Promise((resolve, reject) => {

      const child = spawn("wsl.exe", [
        "-d", "Ubuntu",
        "--",
        "/usr/bin/timeout", "-k", "5s", "60s",
        "/usr/bin/bwrap",

        "--unshare-all",
        "--die-with-parent",
        "--new-session",
        "--cap-drop", "ALL",

        "--ro-bind", "/usr", "/usr",

        "--symlink", "usr/lib", "/lib",
        "--symlink", "usr/lib64", "/lib64",
        "--symlink", "usr/bin", "/bin",

        "--proc", "/proc",
        "--dev", "/dev",
        "--tmpfs", "/tmp",

        "--clearenv",
        "--setenv", "PATH", "/usr/bin:/bin",
        "--setenv", "HOME", "/tmp",
        "--setenv", "LANG", "C.UTF-8",
        "--setenv", "OMP_THREAD_LIMIT", "2",

        "--chdir", "/tmp",

        "--",

        "/usr/bin/prlimit",
        "--as=1073741824",
        "--cpu=45",
        "--nofile=64",
        "--core=0",
        "--",

        ...command

      ], {
        windowsHide: true,
        shell: false,
        stdio: ["pipe", "pipe", "pipe"]
      });

      const chunks = [];

      let size = 0;
      let finished = false;

      function fail(message) {

        if (finished) return;

        finished = true;
        clearTimeout(timer);
        child.kill();

        reject(new Error(message));
      }

      const timer = setTimeout(() => {
        fail("Sandbox processing timed out");
      }, 90000);

      child.stdout.on("data", chunk => {

        if (finished) return;

        size += chunk.length;

        if (size > 120000) {
          return fail("Sandbox output limit exceeded");
        }

        chunks.push(chunk);
      });

      child.stderr.on("data", () => {});

      child.stdin.on("error", () => {});

      child.on("error", () => {
        fail("Unable to launch Linux sandbox");
      });

      child.on("close", code => {

        if (finished) return;

        finished = true;
        clearTimeout(timer);

        if (code !== 0) {
          return reject(
            new Error("Sandbox processing failed")
          );
        }

        const text = Buffer.concat(chunks)
          .toString("utf8")
          .trim();

        if (!text || text.length > 30000) {
          return reject(
            new Error("Invalid extracted text")
          );
        }

        console.log(
          "[SECURITY] Linux sandbox processing completed:",
          type
        );

        resolve({
          success: true,
          pages: type === "pdf"
            ? text.split("\f").filter(p => p.trim()).length
            : 1,
          text,
          confidence: null
        });
      });

      child.stdin.end(buffer);
    });

  } finally {
    active = false;
  }
}