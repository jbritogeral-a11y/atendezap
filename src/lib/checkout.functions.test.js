import { beforeEach, describe, expect, mock, test } from "bun:test";

let operations = [];
let member = true;

mock.module("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate = (input) => input;
    const chain = {
      middleware: () => chain,
      inputValidator: (fn) => {
        validate = fn;
        return chain;
      },
      handler: (fn) => (input) => fn({ ...input, data: validate(input.data) }),
    };
    return chain;
  },
}));
mock.module("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
mock.module("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table) => {
      const operation = { table, action: "update", filters: {} };
      operations.push(operation);
      const query = {
        update: (payload) => {
          operation.payload = payload;
          return query;
        },
        eq: (key, value) => {
          operation.filters[key] = value;
          return query;
        },
        select: () => query,
        maybeSingle: async () => ({ data: { id: "company" }, error: null }),
      };
      return query;
    },
  },
}));

const { markCheckoutPending } = await import("./checkout.functions");
const context = {
  userId: "user",
  supabase: {
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: member ? { company_id: "company" } : null, error: null }),
      };
      return query;
    },
  },
};

beforeEach(() => {
  operations = [];
  member = true;
});

describe("manual checkout pending", () => {
  test("marks only the member company as checkout_pending with bank transfer by default", async () => {
    const result = await markCheckoutPending({ context, data: { companyId: "company" } });
    expect(result).toEqual({ ok: true, companyId: "company", metodo: "transferencia" });
    expect(operations).toHaveLength(1);
    expect(operations[0]).toMatchObject({
      table: "company",
      payload: { status_cobranca: "checkout_pending" },
      filters: { id: "company" },
    });
  });

  test("accepts PayPal as the manual payment method", async () => {
    const result = await markCheckoutPending({ context, data: { companyId: "company", metodo: "paypal" } });
    expect(result.metodo).toBe("paypal");
  });

  test("rejects users without active membership before using privileged access", async () => {
    member = false;
    await expect(markCheckoutPending({ context, data: { companyId: "company" } })).rejects.toThrow("Não tem acesso");
    expect(operations).toHaveLength(0);
  });

  test("rejects an unknown payment method without changing the company", () => {
    expect(() => markCheckoutPending({ context, data: { companyId: "company", metodo: "cartao" } })).toThrow("Método de pagamento inválido");
    expect(operations).toHaveLength(0);
  });
});
