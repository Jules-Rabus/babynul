import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScoreStepper } from "./score-stepper";

describe("ScoreStepper", () => {
  it("incrémente et décrémente via les boutons ± ", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ScoreStepper value={2} onChange={onChange} min={0} max={10} />);
    await user.click(screen.getByRole("button", { name: /augmenter/i }));
    expect(onChange).toHaveBeenLastCalledWith(3);
    await user.click(screen.getByRole("button", { name: /diminuer/i }));
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it("désactive − à la valeur min et + à la valeur max", () => {
    const { rerender } = render(
      <ScoreStepper value={0} onChange={() => {}} min={0} max={3} />,
    );
    expect(screen.getByRole("button", { name: /diminuer/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /augmenter/i })).not.toBeDisabled();

    rerender(<ScoreStepper value={3} onChange={() => {}} min={0} max={3} />);
    expect(screen.getByRole("button", { name: /augmenter/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /diminuer/i })).not.toBeDisabled();
  });

  it("affiche le label et le max", () => {
    render(<ScoreStepper value={1} onChange={() => {}} label="Score A" max={5} />);
    expect(screen.getByText("Score A")).toBeInTheDocument();
    expect(screen.getByText(/max 5/i)).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("clampe les valeurs hors bornes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ScoreStepper value={10} onChange={onChange} min={0} max={10} step={1} />);
    const plus = screen.getByRole("button", { name: /augmenter/i });
    expect(plus).toBeDisabled();
    // clic forcé (disabled empêche, donc on se contente de vérifier le bouton)
    expect(onChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /diminuer/i }));
    expect(onChange).toHaveBeenLastCalledWith(9);
  });
});
