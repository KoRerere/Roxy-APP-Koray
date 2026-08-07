import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Create a unique temp directory; returns a cleanup function. */
export async function makeTempDir(prefix = "roxy-test-"): Promise<{
  path: string;
  cleanup: () => Promise<void>;
}> {
  const path = await mkdtemp(join(tmpdir(), prefix));
  const cleanup = async (): Promise<void> => {
    await rm(path, { recursive: true, force: true });
  };
  return { path, cleanup };
}
