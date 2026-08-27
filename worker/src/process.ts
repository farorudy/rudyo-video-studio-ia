import { spawn } from "node:child_process";
import path from "node:path";

export type RunOptions = {
  timeoutMs?: number;
  onStderr?: (line: string) => void;
};

export async function run(command: string, args: string[], options: RunOptions = {}) {
  const commandName = path.basename(command).toUpperCase().replace(/[^A-Z0-9_]/g, "_");
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let stderr = "";
    let stderrRemainder = "";
    const maxLogChars = 128_000;
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${commandName}_TIMEOUT`));
    }, options.timeoutMs || 30 * 60_000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => { stdout = (stdout + chunk).slice(-maxLogChars); });
    child.stderr.on("data", (chunk: string) => {
      stderr = (stderr + chunk).slice(-maxLogChars);
      if (options.onStderr) {
        const lines = (stderrRemainder + chunk).split(/\r?\n/);
        stderrRemainder = lines.pop() || "";
        lines.forEach(options.onStderr);
      }
    });
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${commandName}_EXIT_${code}: ${stderr.slice(-2000)}`));
    });
  });
}
