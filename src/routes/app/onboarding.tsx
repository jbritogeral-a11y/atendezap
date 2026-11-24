import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { brand } from "@/config/brand";
import { Loader2, Check, Building2, MapPin, Palette, Bot, PartyPopper } from "lucide-react";
import { maskNif, maskPhone, maskPostalCode } from "@/lib/masks";
import { DISTRITOS_PT } from "@/config/locale";

type Search = { checkout?: string };

export const Route = createFileRoute("/app/onboarding")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    checkout: typeof s.checkout === "string" ? s.checkout : undefined,
  }),
  head: () => ({ meta: [{ title: `${brand.name} — Bem-vindo` }] }),
  component: Onboarding,
});

const STEPS = [
  { key: "empresa", label: "Empresa", icon: Building2 },
  { key: "endereco", label: "Endereço", icon: MapPin },
  { key: "identidade", label: "Identidade", icon: Palette },
  { key: "agente", label: "Agente IA", icon: Bot },
  { key: "concluir", label: "Concluir", icon: PartyPopper },
] as const;

const SEGMENTOS = [
  "Varejo / E-commerce", "Alimentação", "Beleza e Estética", "Saúde", "Educação",
  "Serviços Profissionais", "Imobiliária", "Agência / Marketing", "Software / SaaS",
  "Indústria", "Construção", "Logística", "Outro",
];

const PORTES = ["Empresário em nome individual", "Micro (até 9)", "Pequena (10-49)", "Média/Grande (50+)"];

function Onboarding() {
  const ctx = Route.useRouteContext();
  const navigate = useNavigate();
  const search = useSearch({ from: "/app/onboarding" }) as Search;
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Empresa
  const [tipoPessoa, setTipoPessoa] = useState<"pf" | "pj">("pj");
  const [cnpjCpf, setCnpjCpf] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState(ctx.company?.nome ?? "");
  const [emailCorp, setEmailCorp] = useState(ctx.user.email ?? "");
  const [telefone, setTelefone] = useState("");
  const [segmento, setSegmento] = useState("");
  const [porte, setPorte] = useState("");
  const [site, setSite] = useState("");

  // Endereço
  const [cep, setCep] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");

  // Identidade
  const [primaryColor, setPrimaryColor] = useState(ctx.company?.primary_color ?? brand.primary);
  const [logoUrl, setLogoUrl] = useState(ctx.company?.logo_url ?? "");

  // Agente
  const [agente, setAgente] = useState({
    nome_agente: "Atendente Virtual",
    papel_objetivo: "Atender clientes, tirar dúvidas e ajudar a fechar vendas.",
    estilo_comunicacao: "Cordial, profissional e objetivo.",
    sobre_empresa: "",
    produtos_servicos: "",
  });

  // Sem empresa? Vai para checkout primeiro
  useEffect(() => {
    if (!ctx.company) navigate({ to: "/app/checkout", replace: true });
  }, [ctx.company, navigate]);

  // Pré-preenche com dados existentes da empresa
  useEffect(() => {
    if (!ctx.company) return;
    const c = ctx.company;
    if (c.tipo_pessoa) setTipoPessoa(c.tipo_pessoa as any);
    if (c.cnpj_cpf) setCnpjCpf(c.cnpj_cpf);
    if (c.razao_social) setRazaoSocial(c.razao_social);
    if (c.nome_fantasia) setNomeFantasia(c.nome_fantasia);
    if (c.email_corporativo) setEmailCorp(c.email_corporativo);
    if (c.telefone) setTelefone(c.telefone);
    if (c.segmento) setSegmento(c.segmento);
    if (c.porte) setPorte(c.porte);
    if (c.site) setSite(c.site);
    if (c.cep) setCep(c.cep);
    if (c.rua) setRua(c.rua);
    if (c.numero) setNumero(c.numero);
    if (c.complemento) setComplemento(c.complemento);
    if (c.bairro) setBairro(c.bairro);
    if (c.cidade) setCidade(c.cidade);
    if (c.estado) setEstado(c.estado);
    if (typeof c.onboarding_step === "number" && c.onboarding_step > 0) {
      setStep(Math.min(c.onboarding_step, STEPS.length - 1));
    }
  }, [ctx.company]);

  // Toast pagamento aprovado
  useEffect(() => {
    if (search.checkout === "success") {
      toast.success("Pagamento validado! 3 dias grátis liberados.");
    }
  }, [search.checkout]);

  if (!ctx.company) return null;
  const companyId = ctx.company.id;

  async function persistPartial(nextStep: number) {
    const patch: any = {
      tipo_pessoa: tipoPessoa,
      cnpj_cpf: cnpjCpf || null,
      razao_social: razaoSocial || null,
      nome_fantasia: nomeFantasia || null,
      email_corporativo: emailCorp || null,
      telefone: telefone || null,
      segmento: segmento || null,
      porte: porte || null,
      site: site || null,
      cep: cep || null,
      rua: rua || null,
      numero: numero || null,
      complemento: complemento || null,
      bairro: bairro || null,
      cidade: cidade || null,
      estado: estado || null,
      pais: "PT",
      primary_color: primaryColor,
      logo_url: logoUrl || null,
      onboarding_step: nextStep,
    };
    await supabase.from("company").update(patch).eq("id", companyId);
  }

  function validateStep(): string | null {
    if (step === 0) {
      if (!nomeFantasia.trim()) return "Indique o nome comercial.";
      if (!cnpjCpf.trim()) return "Indique o NIF.";
      const nifErr = cnpjCpf.replace(/\D/g, "").length !== 9 ? "Indique um NIF válido (9 dígitos)." : null;
      if (nifErr) return nifErr;
      if (telefone.replace(/\D/g, "").length !== 9) return "Indique um telemóvel válido (9XX XXX XXX).";
      if (!segmento) return "Selecione o segmento.";
      if (!porte) return "Selecione a dimensão.";
    }
    if (step === 1) {
      if (!/^\d{4}-\d{3}$/.test(cep.trim())) return "Indique um código postal válido (XXXX-XXX).";
      if (!cidade.trim() || !estado.trim()) return "Preencha a localidade e o distrito.";
    }
    return null;
  }

  async function next() {
    const err = validateStep();
    if (err) return toast.error(err);
    setSaving(true);
    try {
      await persistPartial(step + 1);
      setStep(Math.min(step + 1, STEPS.length - 1));
    } catch (e: any) {
      toast.error(e.message || "Falha ao guardar");
    } finally {
      setSaving(false);
    }
  }
  function back() { if (step > 0) setStep(step - 1); }

  async function finalizar() {
    setSaving(true);
    try {
      await persistPartial(STEPS.length - 1);

      // Upsert agente (PK = company_id)
      await supabase.from("agent_config").upsert({
        company_id: companyId,
        user_id: ctx.user.id,
        nome_empresa: nomeFantasia.trim(),
        ...agente,
      }, { onConflict: "company_id" });

      await supabase.from("company").update({
        onboarding_completed: true,
        nome: nomeFantasia.trim(),
      }).eq("id", companyId);

      toast.success("Tudo pronto! Bem-vindo ao " + brand.name);
      window.location.href = "/app/dashboard";
    } catch (e: any) {
      toast.error(e.message || "Falha ao concluir");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold font-display">Vamos configurar o seu {brand.name}</h1>
        <p className="text-sm text-muted-foreground">Demora cerca de 3 minutos. Pode voltar e ajustar depois.</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1 md:gap-2 mb-6 overflow-x-auto pb-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = i < step;
          const active = i === step;
          return (
            <div key={s.key} className="flex items-center gap-1.5 md:gap-2 shrink-0">
              <div className={`size-8 rounded-full grid place-items-center text-xs font-bold transition ${
                done ? "bg-primary text-primary-foreground" :
                active ? "bg-primary text-primary-foreground ring-4 ring-primary/20" :
                "bg-muted text-muted-foreground"
              }`}>
                {done ? <Check className="size-4" /> : <Icon className="size-4" />}
              </div>
              <div className={`text-xs md:text-sm hidden sm:block ${active ? "font-semibold" : "text-muted-foreground"}`}>{s.label}</div>
              {i < STEPS.length - 1 && <div className="w-4 md:w-8 h-px bg-border" />}
            </div>
          );
        })}
      </div>

      <Card className="p-6 space-y-4">
        {step === 0 && (
          <>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTipoPessoa("pj")}
                className={`flex-1 rounded-lg border-2 p-3 text-sm font-semibold transition ${tipoPessoa === "pj" ? "border-primary bg-primary/5" : "border-border"}`}
              >Empresa (NIF)</button>
              <button
                type="button"
                onClick={() => setTipoPessoa("pf")}
                className={`flex-1 rounded-lg border-2 p-3 text-sm font-semibold transition ${tipoPessoa === "pf" ? "border-primary bg-primary/5" : "border-border"}`}
              >Particular (NIF)</button>
            </div>

            <Row label="NIF">
              <Input
                value={cnpjCpf}
                onChange={(e) => setCnpjCpf(maskNif(e.target.value))}
                placeholder="123 456 789"
                inputMode="numeric"
              />
            </Row>

            {tipoPessoa === "pj" && (
              <Row label="Denominação social">
                <Input value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} placeholder="Ex: Padaria do João, Lda." />
              </Row>
            )}

            <Row label={"Nome comercial"}>
              <Input value={nomeFantasia} onChange={(e) => setNomeFantasia(e.target.value)} placeholder="Ex: Padaria do João" />
            </Row>

            <div className="grid sm:grid-cols-2 gap-3">
              <Row label="E-mail corporativo">
                <Input type="email" value={emailCorp} onChange={(e) => setEmailCorp(e.target.value)} />
              </Row>
              <Row label="Telemóvel">
                <Input value={telefone} onChange={(e) => setTelefone(maskPhone(e.target.value))} placeholder="912 345 678" inputMode="tel" />
              </Row>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <Row label="Segmento">
                <Select value={segmento} onValueChange={setSegmento}>
                  <SelectTrigger><SelectValue placeholder="Escolha…" /></SelectTrigger>
                  <SelectContent>
                    {SEGMENTOS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Row>
              <Row label="Dimensão">
                <Select value={porte} onValueChange={setPorte}>
                  <SelectTrigger><SelectValue placeholder="Escolha…" /></SelectTrigger>
                  <SelectContent>
                    {PORTES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Row>
            </div>

            <Row label="Site (opcional)">
              <Input value={site} onChange={(e) => setSite(e.target.value)} placeholder="https://" />
            </Row>
          </>
        )}

        {step === 1 && (
          <>
            <div className="grid sm:grid-cols-3 gap-3">
              <Row label="Código postal"><Input value={cep} onChange={(e) => setCep(maskPostalCode(e.target.value))} placeholder="1000-001" inputMode="numeric" /></Row>
              <div className="sm:col-span-2"><Row label="Morada"><Input value={rua} onChange={(e) => setRua(e.target.value)} /></Row></div>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <Row label="Número"><Input value={numero} onChange={(e) => setNumero(e.target.value)} /></Row>
              <Row label="Andar/Fração"><Input value={complemento} onChange={(e) => setComplemento(e.target.value)} placeholder="Ex: 2.º Esq." /></Row>
              <Row label="Freguesia"><Input value={bairro} onChange={(e) => setBairro(e.target.value)} /></Row>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2"><Row label="Localidade"><Input value={cidade} onChange={(e) => setCidade(e.target.value)} /></Row></div>
              <Row label="Distrito">
                <Select value={estado} onValueChange={setEstado}>
                  <SelectTrigger><SelectValue placeholder="Escolha…" /></SelectTrigger>
                  <SelectContent>
                    {DISTRITOS_PT.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Row>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <Row label="Cor primária da marca">
              <div className="flex items-center gap-3">
                <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-10 w-14 rounded border" />
                <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
              </div>
            </Row>
            <p className="text-xs text-muted-foreground">Pode alterar isto depois em Configurações.</p>
          </>
        )}

        {step === 3 && (
          <>
            <Row label="Nome do agente">
              <Input value={agente.nome_agente} onChange={(e) => setAgente({ ...agente, nome_agente: e.target.value })} />
            </Row>
            <Row label="Papel e objetivo">
              <Textarea value={agente.papel_objetivo} onChange={(e) => setAgente({ ...agente, papel_objetivo: e.target.value })} rows={2} />
            </Row>
            <Row label="Estilo de comunicação">
              <Textarea value={agente.estilo_comunicacao} onChange={(e) => setAgente({ ...agente, estilo_comunicacao: e.target.value })} rows={2} />
            </Row>
            <Row label="Sobre a empresa">
              <Textarea value={agente.sobre_empresa} onChange={(e) => setAgente({ ...agente, sobre_empresa: e.target.value })} rows={3} placeholder="O que faz, há quanto tempo, diferenciais…" />
            </Row>
            <Row label="Produtos / serviços">
              <Textarea value={agente.produtos_servicos} onChange={(e) => setAgente({ ...agente, produtos_servicos: e.target.value })} rows={3} placeholder="Liste os principais produtos e serviços." />
            </Row>
          </>
        )}

        {step === 4 && (
          <div className="text-center py-6 space-y-4">
            <div className="size-16 mx-auto rounded-full bg-primary/10 grid place-items-center">
              <PartyPopper className="size-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold font-display">Tudo certo, {nomeFantasia}!</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              A sua conta está pronta. Tem <b>3 dias grátis</b> para explorar tudo.
              Ligue o seu WhatsApp no passo seguinte e a IA começa logo a atender.
            </p>
          </div>
        )}

        <div className="flex justify-between pt-4 border-t border-border mt-2">
          <Button variant="ghost" onClick={back} disabled={step === 0 || saving}>Voltar</Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={next} disabled={saving}>
              {saving ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : null} Avançar
            </Button>
          ) : (
            <Button onClick={finalizar} disabled={saving} className="bg-gradient-brand text-primary-foreground hover:opacity-90 font-semibold">
              {saving ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : null} Ir para o painel
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
