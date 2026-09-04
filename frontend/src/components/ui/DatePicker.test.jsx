import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import DatePicker from "./DatePicker";

describe("DatePicker Component", () => {
  it("renderiza o placeholder e valor formatado corretamente", () => {
    const { rerender } = render(<DatePicker placeholder="dd/mm/aaaa" />);
    expect(screen.getByText("dd/mm/aaaa")).toBeInTheDocument();

    rerender(<DatePicker value="2026-09-15" />);
    expect(screen.getByText("15/09/2026")).toBeInTheDocument();
  });

  it("abre o calendário ao clicar no gatilho", () => {
    render(<DatePicker value="2026-09-15" />);
    const trigger = screen.getByText("15/09/2026");
    fireEvent.click(trigger);

    expect(screen.getByText("Setembro")).toBeInTheDocument();
    expect(screen.getByText("2026")).toBeInTheDocument();
    expect(screen.getByText("Hoje")).toBeInTheDocument();
    expect(screen.getByText("Limpar")).toBeInTheDocument();
  });

  it("bloqueia e desabilita dias anteriores ao limite 'min'", () => {
    const onChange = vi.fn();
    render(
      <DatePicker
        value="2026-09-15"
        min="2026-09-10"
        onChange={onChange}
      />
    );

    const trigger = screen.getByText("15/09/2026");
    fireEvent.click(trigger);

    // O dia 5 de setembro é anterior a min (2026-09-10) -> deve estar desabilitado
    const day5Buttons = screen.getAllByRole("button", { name: "5" });
    const currentMonthDay5 = day5Buttons.find((btn) => btn.className.includes("line-through"));
    expect(currentMonthDay5).toBeDefined();
    expect(currentMonthDay5).toBeDisabled();

    // Tentar clicar no dia 5 não deve chamar onChange
    fireEvent.click(currentMonthDay5);
    expect(onChange).not.toHaveBeenCalled();

    // O dia 20 de setembro é posterior a min -> deve estar habilitado
    const day20Buttons = screen.getAllByRole("button", { name: "20" });
    const enabledDay20 = day20Buttons.find((btn) => !btn.disabled);
    expect(enabledDay20).toBeDefined();

    fireEvent.click(enabledDay20);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({ value: "2026-09-20" }),
      })
    );
  });

  it("bloqueia e desabilita dias posteriores ao limite 'max'", () => {
    const onChange = vi.fn();
    render(
      <DatePicker
        value="2026-09-15"
        max="2026-09-20"
        onChange={onChange}
      />
    );

    const trigger = screen.getByText("15/09/2026");
    fireEvent.click(trigger);

    // O dia 25 de setembro é posterior a max (2026-09-20) -> deve estar desabilitado
    const day25Buttons = screen.getAllByRole("button", { name: "25" });
    const currentMonthDay25 = day25Buttons.find((btn) => btn.className.includes("line-through"));
    expect(currentMonthDay25).toBeDefined();
    expect(currentMonthDay25).toBeDisabled();

    // Clicar não deve acionar onChange
    fireEvent.click(currentMonthDay25);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("desabilita o botão 'Hoje' caso hoje esteja fora do intervalo min/max", () => {
    render(
      <DatePicker
        min="2099-01-01"
      />
    );

    const trigger = screen.getByText("dd/mm/aaaa");
    fireEvent.click(trigger);

    const todayBtn = screen.getByRole("button", { name: "Hoje" });
    expect(todayBtn).toBeDisabled();
  });
});

