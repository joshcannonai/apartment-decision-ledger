import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WebMCPRegistrar } from "./WebMCPRegistrar";

describe("WebMCP registration", () => {
  it("registers all seven tools for the component lifetime and unregisters on cleanup", async () => {
    const registerTool = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: { registerTool },
    });

    const view = render(<WebMCPRegistrar />);
    await waitFor(() => expect(registerTool).toHaveBeenCalledTimes(7));

    const names = registerTool.mock.calls.map(([tool]) => tool.name);
    expect(names).toEqual([
      "prepare_search",
      "propose_preferences",
      "search_candidates",
      "organize_results",
      "add_candidate",
      "compare_candidates",
      "stage_decision",
    ]);
    const signals = registerTool.mock.calls.map(([, options]) => options.signal as AbortSignal);
    expect(signals.every((signal) => !signal.aborted)).toBe(true);

    view.unmount();
    expect(signals.every((signal) => signal.aborted)).toBe(true);
    Reflect.deleteProperty(document, "modelContext");
  });
});
