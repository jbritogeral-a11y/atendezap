import { beforeEach, describe, expect, mock, test } from "bun:test";
let responses = [];
let operations = [];
let superAdmin = true;
mock.module("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate = (input) => input;
    const chain = {
      middleware: () => chain,
      inputValidator: (fn) => {
        validate = fn;
        return chain;
      },
      handler: (fn) => (input) => fn({ ...input, data: validate(input.data) })
    };
    return chain;
  }
}));
mock.module("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
mock.module("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table) => {
      const operation = { table, action: "select", filters: {} };
      operations.push(operation);
      const resolve = () => Promise.resolve(responses.shift() ?? { data: null, error: null });
      const query = {
        select: () => query,
        eq: (key, value) => {
          operation.filters[key] = value;
          return query;
        },
        update: (payload) => {
          operation.action = "update";
          operation.payload = payload;
          return query;
        },
        insert: (payload) => {
          operation.action = "insert";
          operation.payload = payload;
          return query;
        },
        maybeSingle: resolve,
        then: (fulfilled, rejected) => resolve().then(fulfilled, rejected)
      };
      return query;
    }
  }
}));
const { assignCompanyPlan } = await import("./master.functions");
const context = {
  userId: "admin",
  supabase: {
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: superAdmin ? { role: "super_admin" } : null, error: null })
      };
      return query;
    }
  }
};
const assign = assignCompanyPlan;
const plan = { id: "paid-plan", nome: "Pro", slug: "pro", preco_cents: 9700 };
beforeEach(() => {
  superAdmin = true;
  operations = [];
  responses = [
    { data: plan, error: null },
    { data: null, error: null },
    { data: { id: "company" }, error: null },
    { data: null, error: null }
  ];
});
async function run(periodDays) {
  return assign({ context, data: { companyId: "company", planId: "paid-plan", ...periodDays === undefined ? {} : { periodDays } } });
}
function savedPeriodDays() {
  const payload = operations.find((o) => o.table === "subscription" && o.action !== "select")?.payload;
  if (!payload?.["current_period_end"] || !payload["current_period_start"])
    throw new Error("Período não guardado");
  return (Date.parse(payload["current_period_end"]) - Date.parse(payload["current_period_start"])) / 86400000;
}
describe("manual company plans", () => {
  test("defaults to exactly 30 days", async () => {
    await run();
    expect(savedPeriodDays()).toBe(30);
  });
  test("clamps the period to at least 1 day", async () => {
    await run(-10);
    expect(savedPeriodDays()).toBe(1);
  });
  test("clamps the period to at most 365 days", async () => {
    await run(500);
    expect(savedPeriodDays()).toBe(365);
  });
  test("only super admins can assign a plan", async () => {
    superAdmin = false;
    await expect(run()).rejects.toThrow("Acesso negado");
    expect(operations).toHaveLength(0);
  });
  test("only an active plan is loaded and missing plans do not change the company", async () => {
    responses[0] = { data: null, error: null };
    await expect(run()).rejects.toThrow("Plano ativo não encontrado");
    expect(operations[0]?.filters).toEqual({ id: "paid-plan", ativo: true });
    expect(operations).toHaveLength(1);
  });
  test("rejects a free plan", async () => {
    responses[0] = { data: { ...plan, preco_cents: 0 }, error: null };
    await expect(run()).rejects.toThrow("Selecione um plano pago");
    expect(operations).toHaveLength(1);
  });
  test("activates the company and inserts a manual active subscription", async () => {
    expect(await run(45)).toEqual({ ok: true, planNome: "Pro", slug: "pro" });
    expect(operations.find((o) => o.table === "company")?.payload).toEqual({ status_cobranca: "ativo", selected_plan_slug: "pro" });
    expect(operations.find((o) => o.action === "insert")?.payload).toMatchObject({ company_id: "company", plan_id: "paid-plan", status: "active", provider: "manual" });
    expect(savedPeriodDays()).toBe(45);
  });
  test("updates the existing subscription and clears trial and cancellation", async () => {
    responses[1] = { data: { id: "existing-subscription" }, error: null };
    await run();
    const update = operations.find((o) => o.table === "subscription" && o.action === "update");
    expect(update?.filters).toEqual({ id: "existing-subscription" });
    expect(update?.payload).toMatchObject({ plan_id: "paid-plan", status: "active", provider: "manual", trial_ends_at: null, cancel_at_period_end: false });
    expect((update?.payload)["updated_at"]).toBe((update?.payload)["current_period_start"]);
    expect(operations.some((o) => o.action === "insert")).toBe(false);
  });
});
