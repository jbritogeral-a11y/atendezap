import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { brand, supportWhatsappUrl } from "@/config/brand";
import { pagamentoPaypal, pagamentoTransferencia, type MetodoPagamento } from "@/config/pagamento";
import {
  Loader2, ShieldCheck, ArrowLeft, Check, TrendingUp, Crown, Smartphone,
  Users, MessageSquare, Headphones, Calendar, BarChart3, Webhook, Zap, ExternalLink, Sparkles, Lock,
  Copy, Landmark,
} from "lucide-react";
import { createCheckoutCompany, markCheckoutPending } from "@/lib/checkout.functions";
import { useServerFn } from "@tanstack/react-start";
import { trialDaysLeft } from "@/lib/tenant";

type Search = { plano?: string };

type Plano = {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  preco_cents: number;
  trial_days: number;
  checkout_url: string | null;
  destaque: boolean;
  limite_mensagens: number;
  limite_instancias: number;
  limite_usuarios: number;
  limite_contatos: number;
  features: string[];
};

export const Route = createFileRoute("/app/checkout")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    plano: typeof s.plano === "string" ? s.plano : undefined,
  }),
  head: () => ({
    meta: [
      { title: `${brand.name} — Escolha o seu plano` },
      { name: "description", content: "Escolha o seu plano AtendeZap, comece o trial gratuito ou ative o acesso por transferência Wise ou PayPal." },
      { property: "og:title", content: `${brand.name} — Escolha o seu plano` },
      { property: "og:description", content: "Escolha o seu plano AtendeZap, comece o trial gratuito ou ative o acesso por transferência Wise ou PayPal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CheckoutPage,
});

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}
function defaultCompanyName(email?: string | null) {
  const local = email?.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  return local ? `Empresa de ${local}` : "Minha empresa";
}

const FEATURE_ICONS: Record<string, React.ReactNode> = {
  "número de WhatsApp": <Smartphone className="size-4" />,
  "usuários": <Users className="size-4" />,
  "conversas": <MessageSquare className="size-4" />,
  "contatos": <Users className="size-4" />,
  "CRM": <BarChart3 className="size-4" />,
  "IA": <Zap className="size-4" />,
  "Google Agenda": <Calendar className="size-4" />,
  "Relatórios": <BarChart3 className="size-4" />,
  "Suporte": <Headphones className="size-4" />,
  "API": <Webhook className="size-4" />,
  "Webhooks": <Webhook className="size-4" />,
  "Onboarding": <Crown className="size-4" />,
  "Gerente": <Crown className="size-4" />,
  "SLA": <ShieldCheck className="size-4" />,
};
function featureIcon(text: string) {
  for (const key of Object.keys(FEATURE_ICONS)) {
    if (text.toLowerCase().includes(key.toLowerCase())) return FEATURE_ICONS[key];
  }
  return <Check className="size-4" />;
}
function normalizeFeatureText(text: string) {
  return /n[úu]meros? de whatsapp/i.test(text) ? "1 número de WhatsApp" : text;
}
function normalizeFeatures(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((f) => String(f));
  if (raw && typeof raw === "object") {
    return Object.keys(raw).filter((k) => Boolean((raw as Record<string, unknown>)[k]));
  }
  return [];
}
function CheckoutPage() {
  const ctx = Route.useRouteContext();
  const navigate = useNavigate();
  const search = useSearch({ from: "/app/checkout" }) as Search;
  const createCompany = useServerFn(createCheckoutCompany);
  const markPending = useServerFn(markCheckoutPending);

  const [plans, setPlans] = useState<Plano[]>([]);
  const [selected, setSelected] = useState<string | null>(search.plano ?? null);
  const [creating, setCreating] = useState(false);
  const [waiting, setWaiting] = useState(ctx.company?.status_cobranca === "checkout_pending");
  const [metodo, setMetodo] = useState<MetodoPagamento>("transferencia");
  const [marking, setMarking] = useState(false);

  // Modo: "trial" (sem empresa, oferecer teste grátis) vs "paywall" (empresa existe mas precisa pagar)
  const hasCompany = !!ctx.company;
  const trialActive =
    hasCompany && ctx.company!.status_cobranca === "trial" && trialDaysLeft(ctx.company!.trial_ate) > 0;
  const paywallMode = hasCompany && !trialActive && ctx.company!.status_cobranca !== "ativo";

  // Empresa ativa ou em trial ainda válido → não deveria estar aqui
  useEffect(() => {
    if (!ctx.company) return;
    if (ctx.company.status_cobranca === "ativo" || trialActive) {
      navigate({ to: ctx.company.onboarding_completed ? "/app/dashboard" : "/app/onboarding", replace: true });
    }
  }, [ctx.company, navigate, trialActive]);

  useEffect(() => {
    supabase.from("plan").select("*").eq("ativo", true).order("ordem").then(({ data }) => {
      if (data?.length) {
        const list = (data as Plano[]).map((p) => ({ ...p, features: normalizeFeatures(p.features) }));
        setPlans(list);
        const initial =
          search.plano ||
          ctx.company?.selected_plan_slug ||
          list.find((p) => p.destaque)?.slug ||
          list[0].slug;
        if (!selected || !list.find((p) => p.slug === selected)) setSelected(initial);
      }
    });
  }, []);

  // Polling em modo paywall: assim que a equipa confirmar o pagamento, libera o acesso.
  useEffect(() => {
    if (!waiting || !ctx.company) return;
    const id = ctx.company.id;
    const interval = setInterval(async () => {
      const { data: comp } = await supabase
        .from("company")
        .select("id, status_cobranca, onboarding_completed")
        .eq("id", id)
        .maybeSingle();
      if (comp?.status_cobranca === "ativo") {
        clearInterval(interval);
        toast.success("Pagamento confirmado! A libertar o seu acesso…");
        setTimeout(() => {
          window.location.href = comp.onboarding_completed ? "/app/dashboard" : "/app/onboarding";
        }, 800);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [waiting, ctx.company]);

  const plano = useMemo(() => plans.find((p) => p.slug === selected), [plans, selected]);

  async function iniciarTrial() {
    if (!plano) return toast.error("Selecione um plano.");
    setCreating(true);
    try {
      await createCompany({ data: { nome: defaultCompanyName(ctx.user.email), plano_slug: plano.slug } });
      toast.success(`Teste grátis de ${plano.trial_days} dias iniciado!`);
      window.location.href = "/app/onboarding";
    } catch (e: any) {
      toast.error(e.message || "Falha ao iniciar teste");
    } finally {
      setCreating(false);
    }
  }

  async function avisarPagamento(metodoPagamento: MetodoPagamento) {
    if (!ctx.company) return;
    setMarking(true);
    try {
      await markPending({ data: { companyId: ctx.company.id, metodo: metodoPagamento } });
      setWaiting(true);
      toast.success("Aviso enviado. Vamos confirmar o seu pagamento.");
    } catch (e: any) {
      toast.error(e.message || "Não foi possível enviar o aviso de pagamento.");
    } finally {
      setMarking(false);
    }
  }

  function abrirPaypal() {
    const mensagem = encodeURIComponent(
      `Olá! Preciso do link PayPal para ativar o meu plano AtendeZap. O meu e-mail de registo é ${ctx.user.email ?? ""}.`,
    );
    const url = pagamentoPaypal.url ||
      (pagamentoPaypal.email ? "https://www.paypal.com/signin" : `${supportWhatsappUrl}?text=${mensagem}`);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const headerBadge = paywallMode
    ? { icon: <Lock className="size-3.5 mr-1.5" />, text: "Seu período de teste terminou" }
    : { icon: <Sparkles className="size-3.5 mr-1.5" />, text: `${plans[0]?.trial_days ?? 3} dias grátis sem cartão` };
  const headerTitle = paywallMode
    ? "Ative seu plano para continuar"
    : "Comece grátis em segundos";
  const headerSubtitle = paywallMode
    ? "Os seus dados continuam guardados. Assim que confirmarmos o pagamento, o seu acesso será libertado."
    : "Escolha um plano para começar. Você não precisa pagar agora — só vai cobrar no final do período de teste, se quiser continuar.";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
        <button
          onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 mb-6"
        >
          <ArrowLeft className="size-3.5" /> Sair
        </button>

        <div className="text-center max-w-2xl mx-auto mb-10 md:mb-14">
          <Badge variant="secondary" className="mb-4 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
            {headerBadge.icon}
            {headerBadge.text}
          </Badge>
          <h1 className="font-display text-3xl md:text-5xl font-bold tracking-tight">
            {headerTitle}
          </h1>
          <p className="text-muted-foreground mt-3 text-base md:text-lg">
            {headerSubtitle}
          </p>
          {paywallMode && (
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-3 font-medium">
              Importante: use o mesmo e-mail do registo (<span className="font-mono">{ctx.user.email}</span>) ao pagar — é assim que libertamos o seu acesso.
            </p>
          )}
        </div>

        {plans.length === 0 ? (
          <div className="grid place-items-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <div className="grid md:grid-cols-3 gap-4 lg:gap-6 items-stretch mb-10 md:mb-14">
              {plans.map((p) => {
                const isSelected = selected === p.slug;
                return (
                  <Card
                    key={p.id}
                    className={`relative flex flex-col p-6 md:p-7 transition-all duration-200 ${
                      isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-xl" : "hover:shadow-md"
                    } ${p.destaque ? "md:-my-4 md:py-10 border-primary/30 bg-gradient-to-b from-primary/5 to-background" : ""}`}
                  >
                    {p.destaque && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-primary text-primary-foreground hover:bg-primary px-3 py-1 text-[10px] uppercase tracking-wider font-bold shadow-sm">
                          <TrendingUp className="size-3 mr-1" /> Mais popular
                        </Badge>
                      </div>
                    )}
                    <div className="mb-5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{p.nome}</span>
                        {isSelected && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                            <Check className="size-3" /> Selecionado
                          </span>
                        )}
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="font-display text-4xl font-bold">{formatBRL(p.preco_cents)}</span>
                        <span className="text-muted-foreground text-sm">/mês</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2 min-h-[2.5rem]">{p.descricao}</p>
                      {!paywallMode && (
                        <p className="text-[11px] text-primary font-semibold mt-1">
                          {p.trial_days} dias grátis — sem cartão
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-5">
                      <Limit label="WhatsApp" v={1} />
                      <Limit label="Usuários" v={p.limite_usuarios} />
                      <Limit label="Conversas/mês" v={p.limite_mensagens} />
                      <Limit label="Contatos" v={p.limite_contatos} />
                    </div>
                    <ul className="space-y-2.5 text-sm flex-1 mb-6">
                      {(p.features || []).map((f) => normalizeFeatureText(f)).map((f) => (
                        <li key={f} className="flex items-start gap-2.5">
                          <span className="mt-0.5 size-5 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0">
                            {featureIcon(f)}
                          </span>
                          <span className="text-foreground/90">{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      onClick={() => setSelected(p.slug)}
                      variant={isSelected ? "default" : "outline"}
                      size="lg"
                      className="w-full font-semibold"
                    >
                      {isSelected ? (<><Check className="size-4 mr-1.5" /> Plano escolhido</>) : "Escolher este plano"}
                    </Button>
                  </Card>
                );
              })}
            </div>

            <div className="max-w-2xl mx-auto">
              <Card className="p-6 md:p-8 text-center">
                {waiting ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20 text-sm">
                      <Loader2 className="size-4 animate-spin text-primary" />
                      <span>A aguardar confirmação do pagamento…</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      O aviso foi registado. O seu acesso será libertado aqui automaticamente após a confirmação manual do pagamento.
                    </p>
                  </div>
                ) : paywallMode ? (
                  <>
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <Lock className="size-5 text-primary" />
                      <h2 className="font-display text-xl font-bold">Ative o plano para libertar o seu acesso</h2>
                    </div>
                    <p className="text-sm text-muted-foreground mb-5">
                      Plano selecionado: <span className="font-semibold text-foreground">{plano?.nome}</span> —{" "}
                      {formatBRL(plano?.preco_cents ?? 0)}/mês.
                    </p>

                    <div className="grid grid-cols-2 gap-2 mb-6" role="group" aria-label="Método de pagamento">
                      <Button
                        variant={metodo === "transferencia" ? "default" : "outline"}
                        onClick={() => setMetodo("transferencia")}
                      >
                        <Landmark className="size-4 mr-2" /> Transferência
                      </Button>
                      <Button
                        variant={metodo === "paypal" ? "default" : "outline"}
                        onClick={() => setMetodo("paypal")}
                      >
                        PayPal
                      </Button>
                    </div>

                    {metodo === "transferencia" ? (
                      <div className="space-y-4 text-left">
                        <div className="space-y-2">
                          <CopyField label="Nome" value={pagamentoTransferencia.titular} />
                          <CopyField label="IBAN" value={pagamentoTransferencia.iban} />
                          <CopyField label="Swift/BIC" value={pagamentoTransferencia.swift} />
                          <CopyField label="Morada do banco" value={pagamentoTransferencia.moradaBanco} />
                          <CopyField label="Referência" value={ctx.user.email ?? ""} />
                        </div>
                        <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1.5">
                          <p className="font-medium text-foreground">{pagamentoTransferencia.bancoNota}</p>
                          <p>{pagamentoTransferencia.instrucoes}</p>
                        </div>
                        <Button
                          onClick={() => avisarPagamento("transferencia")}
                          disabled={marking}
                          size="lg"
                          className="w-full bg-gradient-brand text-primary-foreground hover:opacity-90 font-semibold"
                        >
                          {marking ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Check className="size-4 mr-2" />}
                          Já transferi — avisar confirmação
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4 text-left">
                        <p className="text-sm text-muted-foreground">{pagamentoPaypal.instrucoes}</p>
                        {pagamentoPaypal.email && <CopyField label="E-mail PayPal" value={pagamentoPaypal.email} />}
                        <Button
                          onClick={abrirPaypal}
                          size="lg"
                          className="w-full bg-gradient-brand text-primary-foreground hover:opacity-90 font-semibold"
                        >
                          <ExternalLink className="size-4 mr-2" />
                          {pagamentoPaypal.url
                            ? "Abrir pagamento PayPal"
                            : pagamentoPaypal.email
                              ? "Abrir PayPal"
                              : "Pedir link PayPal no WhatsApp"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => avisarPagamento("paypal")}
                          disabled={marking}
                          className="w-full"
                        >
                          {marking ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Check className="size-4 mr-2" />}
                          Já paguei no PayPal
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <Sparkles className="size-5 text-primary" />
                      <h2 className="font-display text-xl font-bold">Pronto pra começar?</h2>
                    </div>
                    <p className="text-sm text-muted-foreground mb-5">
                      Plano escolhido: <span className="font-semibold text-foreground">{plano?.nome}</span>.
                      Você ganha <b>{plano?.trial_days ?? 3} dias grátis</b> pra explorar tudo, sem precisar de cartão.
                      Cobramos só se você decidir continuar.
                    </p>
                    <Button
                      onClick={iniciarTrial}
                      disabled={!plano || creating}
                      size="lg"
                      className="w-full md:w-auto min-w-[280px] bg-gradient-brand text-primary-foreground hover:opacity-90 font-semibold"
                    >
                      {creating ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Sparkles className="size-4 mr-2" />}
                      Começar {plano?.trial_days ?? 3} dias grátis
                    </Button>
                  </>
                )}
                <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="size-3.5" /> Pagamento por transferência (Wise) ou PayPal.
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado.`);
    } catch {
      toast.error(`Não foi possível copiar ${label.toLowerCase()}.`);
    }
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-all">{value}</p>
      </div>
      <Button type="button" size="sm" variant="ghost" onClick={copy} className="shrink-0" aria-label={`Copiar ${label}`}>
        <Copy className="size-3.5 mr-1.5" /> Copiar
      </Button>
    </div>
  );
}

function Limit({ label, v }: { label: string; v: number }) {
  return (
    <div className="bg-muted/50 rounded-lg px-2.5 py-1.5 flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{v.toLocaleString("pt-PT")}</span>
    </div>
  );
}
