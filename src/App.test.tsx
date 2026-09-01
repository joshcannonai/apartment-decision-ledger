import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";
import { workspaceActions } from "./domain/store";

describe("Apartment Decision Ledger UI", () => {
  beforeEach(() => {
    window.localStorage.clear();
    workspaceActions.resetWorkspace();
  });

  afterEach(cleanup);

  it("starts anonymously and makes optional identity boundaries explicit", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /fits your actual life/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /optional sign in/i }));

    expect(screen.getByRole("heading", { name: /use this without an account/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /continue with chatgpt/i })).toBeDisabled();
  });

  it("shows results before refinement and keeps agent context pending approval", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /salt lake city demo/i }));

    expect(await screen.findByRole("heading", { name: /best options/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /answer these to enhance/i })).toBeInTheDocument();
    expect(screen.getAllByText(/needs a workable place for a 72-inch desk/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/brought by your agent/i).length).toBeGreaterThan(0);

    const proposal = screen.getByText("Needs a workable place for a 72-inch desk", { selector: "strong" }).closest("article");
    expect(proposal).not.toBeNull();
    fireEvent.click(within(proposal!).getByRole("button", { name: /approve/i }));

    await waitFor(() => {
      expect(screen.getByText(/needs a workable place for a 72-inch desk/i, { selector: ".context-chip" })).toBeInTheDocument();
    });
  });

  it("allows a one-item compare selection before a valid comparison exists", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /salt lake city demo/i }));
    await screen.findByRole("heading", { name: /best options/i });

    const addButtons = screen.getAllByRole("button", { name: /add .* to comparison/i });
    fireEvent.click(addButtons[0]);

    expect(screen.getByRole("button", { name: /compare 1 option/i })).toHaveTextContent("Add one more");
  });

  it("moves between the mobile workspace sections without losing the selected candidate", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /salt lake city demo/i }));
    await screen.findByRole("heading", { name: /best options/i });

    const decisionTab = screen.getByRole("button", { name: "Decision" });
    const refineTab = screen.getByRole("button", { name: "Refine" });
    fireEvent.click(decisionTab);
    expect(decisionTab).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { name: /Capitol Reef/i })).toBeInTheDocument();

    fireEvent.click(refineTab);
    expect(refineTab).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { name: /enhance and narrow/i })).toBeInTheDocument();
  });

  it("stages a reversible internal decision without implying landlord action", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /salt lake city demo/i }));
    await screen.findByRole("heading", { name: /best options/i });

    fireEvent.click(screen.getByRole("button", { name: /stage leader/i }));
    expect(screen.getByText(/marks one leading option in this workspace only/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /undo staged decision/i }));
    await waitFor(() => {
      expect(screen.queryByText(/marks one leading option in this workspace only/i)).not.toBeInTheDocument();
    });
  });

  it("queues an answer, marks it updated, and exposes Run 2 without replacing Run 1", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /salt lake city demo/i }));
    await screen.findByRole("heading", { name: /best options/i });

    const customQuestion = screen.getByText(/carrying the 72-inch desk/i).closest("form");
    expect(customQuestion).not.toBeNull();
    fireEvent.change(within(customQuestion!).getByPlaceholderText(/type an answer/i), {
      target: { value: "Yes, elevator access matters" },
    });
    fireEvent.click(within(customQuestion!).getByRole("button", { name: /apply answer/i }));

    expect(within(customQuestion!).getByText("Updated")).toBeInTheDocument();
    fireEvent.click(within(customQuestion!).getByRole("button", { name: /rerun ranking/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Run 2" })).toBeEnabled();
    });
    expect(screen.getByRole("button", { name: "Run 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run 2" })).toHaveAttribute("aria-pressed", "true");
  });
});
