import { executeStep } from "../../steps/index.js";

describe("Steps Execution", () => {
  it("handles filter step with legacy config shape", () => {
    const pass = executeStep(
      "filter",
      { price: 55 },
      { field: "price", operator: ">", value: 20 }
    );

    expect(pass.filtered).toBeUndefined();
    expect(pass.payload).toEqual({ price: 55 });

    const blocked = executeStep(
      "filter",
      { price: 10 },
      { field: "price", operator: ">", value: 20 }
    );

    expect(blocked.filtered).toBe(true);
    expect(blocked.reason).toContain("price");
  });

  it("handles filter step with normalized conditions config", () => {
    const result = executeStep("filter", { price: 25 }, {
      conditions: [{ field: "price", op: "gt", value: 20 }],
    });

    expect(result.filtered).toBeUndefined();
    expect(result.payload).toEqual({ price: 25 });
  });

  it("renames fields in transform step", () => {
    const result = executeStep(
      "transform",
      { firstName: "Ali", phone: "0799", price: 55 },
      { mappings: [{ from: "firstName", to: "name" }] }
    );

    expect(result.payload).toEqual({ name: "Ali", phone: "0799", price: 55 });
  });

  it("sets fields in set_fields step", () => {
    const result = executeStep("set_fields", { price: 55 }, {
      values: { currency: "USD", status: "paid" },
    });

    expect(result.payload).toEqual({
      price: 55,
      currency: "USD",
      status: "paid",
    });
  });

  it("supports enrich and calculate_field steps", () => {
    const enriched = executeStep("enrich", { price: 50 }, {
      key: "country",
      value: "Jordan",
    });

    expect(enriched.payload).toEqual({ price: 50, country: "Jordan" });

    const calculated = executeStep("calculate_field", { price: 50 }, {
      field: "price",
      op: "subtract",
      value: 10,
    });

    expect(calculated.payload).toEqual({ price: 40 });
  });

  it("throws for unsupported step type", () => {
    expect(() =>
      executeStep("delay", { price: 50 }, { ms: 1000 })
    ).toThrow("Unsupported step type");
  });
});
