import { spawn } from "node:child_process";

const command = process.platform === "win32" ? "npx.cmd" : "npx";

const child = spawn(command, ["next", "dev"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    USE_LOCAL_SESSION: "true",
    USE_MOCK_STORYBOARD: process.env.USE_MOCK_STORYBOARD || "true",
    NEXT_PUBLIC_APP_URL:
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
