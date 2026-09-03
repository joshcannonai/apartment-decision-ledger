import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";
import { workspaceActions, workspaceStore } from "./domain/store";

describe("Apartment Ledger UI", () => {
  beforeEach(() => {
    window.localStorage.clear();
    workspaceActions.resetWorkspace();
  });

  afterEach(cleanup);

  it("starts anonymously and makes optional identity boundaries explicit", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /build your first apartment shortlist/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /optional sign in/i }));

    expect(screen.getByRole("heading", { name: /use this without an account/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /continue with chatgpt/i })).toBeDisabled();
  });

  it("offers light, dark, and system themes and persists the selection", () => {
    render(<App />);

    const themeButton = screen.getByRole("button", { name: /theme: system/i });
    fireEvent.click(themeButton);

    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(window.localStorage.getItem("apartment-ledger.theme")).toBe("dark");
    expect(screen.getByRole("button", { name: /theme: dark/i })).toBeInTheDocument();
  });

  it("keeps a submitted city visible when live inventory is unavailable instead of rendering a blank page", async () => {
    render(<App />);

    const cityInput = screen.getByPlaceholderText(/city and state/i);
    fireEvent.change(cityInput, { target: { value: "Denver, CO" } });
    fireEvent.click(within(cityInput.closest("form")!).getByRole("button", { name: /find apartments/i }));

    expect(await screen.findByRole("heading", { name: /Denver, CO is ready/i })).toBeInTheDocument();
    expect(screen.getByText(/live apartment inventory is not connected yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open the Salt Lake City demo/i })).toBeInTheDocument();
  });

  it("keeps the empty search action disabled until a city is entered", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: /find apartments/i })).toBeDisabled();
  });

  it("shows the exact browser fields an agent prepared through WebMCP before search", () => {
    workspaceActions.prepareSearch({
      city: "Denver",
      state: "CO",
      maxAllIn: 2100,
      minBedrooms: 2,
      rentalType: "whole_place",
      moveWindow: "October",
      sharedContextSummary: "Lives alone and owns a 72-inch desk",
      budgetRationale: "Agent suggestion based on context the user shared",
      text: "Needs parking and room for a long desk",
    }, {
      preferences: [{ kind: "furniture", label: "72-inch desk", value: true, source: "agent_context", confidence: 0.95 }],
      anchors: [{ label: "Trader Joe's", importance: 4, source: "agent_context", confidence: 0.9 }],
    });

    render(<App />);

    expect(screen.getByLabelText(/city or metro area/i)).toHaveValue("Denver, CO");
    expect(screen.getByLabelText(/maximum all-in monthly cost/i)).toHaveValue(2100);
    expect(screen.getByLabelText(/minimum bedrooms/i)).toHaveValue("2");
    expect(screen.getByLabelText(/move window/i)).toHaveValue("October");
    expect(screen.getByLabelText(/rental type/i)).toHaveValue("whole_place");
    expect(screen.getByLabelText(/what your agent knows/i)).toHaveValue("Lives alone and owns a 72-inch desk");
    expect(screen.getByLabelText(/budget suggestion rationale/i)).toHaveValue("Agent suggestion based on context the user shared");
    expect(screen.getByLabelText(/anything else that matters/i)).toHaveValue("Needs parking and room for a long desk");
    expect(screen.getByText("72-inch desk", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("Trader Joe's", { exact: true })).toBeInTheDocument();
    expect(document.querySelectorAll("[data-agent-field]")).toHaveLength(8);
  });

  it("shows results before refinement and keeps agent context pending approval", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /salt lake city demo/i }));

    expect(await screen.findByRole("heading", { name: /best options/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /answer these to enhance/i })).toBeInTheDocument();
    expect(screen.getAllByText(/needs a workable place for a 72-inch desk/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/brought by your agent/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("img", { name: /kitchen opening into a living room/i })).toHaveAttribute("src", "/demo-media/kitchen-living.webp");
    expect(screen.queryByText(/no verified photo/i)).not.toBeInTheDocument();

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

  it("previews Google Maps and adds a verified location beside existing anchors", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /salt lake city demo/i }));
    await screen.findByRole("heading", { name: /best options/i });

    expect(screen.getByTitle(/Google map showing Capitol Reef/i)).toHaveAttribute(
      "src",
      expect.stringContaining("maps.google.com/maps?output=embed"),
    );
    const mapLink = screen.getByRole("link", { name: /expand map for Capitol Reef/i });
    expect(mapLink).toHaveAttribute("href", expect.stringContaining("google.com/maps/search"));
    expect(mapLink).not.toHaveAttribute("target");
    expect(screen.getByRole("link", { name: /original listing/i })).not.toHaveAttribute("target");
    fireEvent.click(screen.getByRole("button", { name: /add location/i }));
    fireEvent.change(screen.getByPlaceholderText(/place name or address/i), {
      target: { value: "University of Utah" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add to search/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /University of Utah/i })).toBeInTheDocument();
    });
    const added = workspaceStore.getSnapshot().anchors.find((anchor) => anchor.label === "University of Utah");
    expect(added).toMatchObject({ status: "approved", verification: "verified_coordinates" });

    fireEvent.click(screen.getByRole("button", { name: /sort results by this place/i }));
    expect(workspaceStore.getSnapshot().sort).toMatchObject({ by: "distance", anchorId: added?.id });
  });
});
