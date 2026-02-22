import type { InputEventHandler, InputEvent } from "./input-event.js";
import type { ILogger } from "../events/event-dispatcher.js";

/**
 * Creates the handleInputEvent function bound to a specific InputEventHandler.
 * The returned function is registered as callable from C# during initialization.
 *
 * Initialization sequence (JS-side):
 * ```ts
 * const handler = new InputEventHandler(dom, dispatcher, logger);
 * const handleInputEvent = createHandleInputEvent(handler, logger);
 * runtime.registerFunction("handleInputEvent", handleInputEvent);
 * ```
 *
 * Once registered, C# bridges call `IJSRuntime.CallFunction("handleInputEvent", json)`
 * to push serialized InputEvents across the boundary. The returned closure deserializes
 * the JSON and delegates to `InputEventHandler.handleEvent`, which dispatches through
 * `EventDispatcher` (capture → target → bubble) to reach user-registered listeners.
 */
export function createHandleInputEvent(
  handler: InputEventHandler,
  logger?: ILogger,
): (json: string) => void {
  return (json: string): void => {
    let evt: InputEvent;
    try {
      evt = JSON.parse(json);
    } catch (e) {
      logger?.logWarning(`Failed to parse InputEvent JSON: ${e}`);
      return;
    }
    handler.handleEvent(evt);
  };
}
