import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { slugify } from "@/lib/tenant";
import type { MetodoPagamento } from "@/config/pagamento";

export const createCheckoutCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { nome: string; plano_slug?: string }) => {
    const nome = String(d.nome || "").trim();
    if (nome.length < 2) throw new Error("Informe o nome da sua empresa.");
    const plano_slug = d.plano_slug ? String(d.plano_slug).toLowerCase().trim() : null;
    return { nome, plano_slug };
  })
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: existingErr } = await supabaseAdmin
      .from("company_user")
      .select("company_id")
      .eq("user_id", context.userId)
      .eq("ativo", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (existingErr) throw existingErr;
    if (existing?.company_id) return { companyId: existing.company_id as string };

    // Trial days: do plano escolhido (ou starter como fallback).
    let trialDays = 3;
    let planSlug = data.plano_slug;
    if (planSlug) {
      const { data: plan } = await supabaseAdmin
        .from("plan")
        .select("trial_days, slug")
        .eq("slug", planSlug)
        .maybeSingle();
      if (plan?.trial_days != null) trialDays = Number(plan.trial_days) || trialDays;
    } else {
      const { data: starter } = await supabaseAdmin
        .from("plan")
        .select("trial_days, slug")
        .eq("slug", "starter")
        .maybeSingle();
      if (starter?.trial_days != null) trialDays = Number(starter.trial_days) || trialDays;
      planSlug = starter?.slug ?? null;
    }

    const slug = `${slugify(data.nome)}-${Math.random().toString(36).slice(2, 6)}`;
    const trialAte = new Date(Date.now() + trialDays * 86400000).toISOString();

    const { data: company, error: companyErr } = await supabaseAdmin
      .from("company")
      .insert({
        nome: data.nome,
        slug,
        primary_color: "#25D366",
        created_by: context.userId,
        status_cobranca: "trial",
        onboarding_completed: false,
        onboarding_step: 0,
        trial_ate: trialAte,
        selected_plan_slug: planSlug,
      } as any)
      .select("id")
      .single();
    if (companyErr || !company) throw new Error(companyErr?.message || "Falha ao criar empresa");

    const { error: memberErr } = await supabaseAdmin.from("company_user").insert({
      user_id: context.userId,
      company_id: company.id,
      role: "owner",
      ativo: true,
    });
    if (memberErr) throw memberErr;

    return { companyId: company.id as string };
  });

export const markCheckoutPending = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { companyId: string; metodo?: MetodoPagamento }) => {
    const companyId = String(d.companyId || "").trim();
    if (!companyId) throw new Error("Empresa inválida.");
    const metodo = d.metodo ?? "transferencia";
    if (metodo !== "transferencia" && metodo !== "paypal") {
      throw new Error("Método de pagamento inválido.");
    }
    return { companyId, metodo };
  })
  .handler(async ({ context, data }) => {
    const { data: membership, error: membershipError } = await context.supabase
      .from("company_user")
      .select("company_id")
      .eq("company_id", data.companyId)
      .eq("user_id", context.userId)
      .eq("ativo", true)
      .maybeSingle();
    if (membershipError) throw new Error("Não foi possível validar o acesso à empresa.");
    if (!membership) throw new Error("Não tem acesso a esta empresa.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: company, error: companyError } = await supabaseAdmin
      .from("company")
      .update({ status_cobranca: "checkout_pending" })
      .eq("id", data.companyId)
      .select("id")
      .maybeSingle();
    if (companyError) throw new Error("Não foi possível registar o aviso de pagamento.");
    if (!company) throw new Error("Empresa não encontrada.");

    return { ok: true, companyId: data.companyId, metodo: data.metodo };
  });
