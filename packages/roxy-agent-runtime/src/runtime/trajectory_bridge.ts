import type { TrajectoryEvent } from "../core/interfaces.ts";
import { NotImplementedError } from "../core/errors.ts";

/**
 * Translate runtime stream events + node instrumentation into the framework's
 * canonical {@link TrajectoryEvent} schema, feeding the recorder. SKELETON STUB.
 */
export class TrajectoryBridge {
  emit(_event: TrajectoryEvent): void {
    throw new NotImplementedError("TrajectoryBridge.emit");
  }
}
