import { createFileRoute } from "@tanstack/react-router";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import {
  Building2, Users, ShieldCheck, Package, KeyRound, CreditCard, Receipt,
  Brain, Palette, BookOpen, Boxes, Bell, Database, Settings2, FileText,
  Network, ClipboardCheck, Store, Download, ExternalLink,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/help")({
  component: AdminHelpPage,
});

type Section = {
  icon: typeof Building2;
  title: string;
  path: string;
  what: string;
  how: string[];
};

const sections: { group: string; items: Section[] }[] = [
  {
    group: "Tenants — quem usa a plataforma",
    items: [
      {
        icon: Store, title: "Franquias", path: "/admin/franchises",
        what: "Cadastro das franquias/regionais que revendem a plataforma.",
        how: [
          "Clique em Nova franquia, preencha nome + slug.",
          "Depois vincule empresas a essa franquia em Empresas.",
          "O dono da franquia enxerga apenas as empresas dela.",
        ],
      },
      {
        icon: Building2, title: "Empresas", path: "/admin/organizations",
        what: "Cada empresa cliente (com seus líderes e equipes).",
        how: [
          "Nova empresa → nome, slug, CNPJ opcional, franquia (se houver).",
          "Ao criar, um Admin da empresa é convidado por e-mail.",
          "Toda alteração fica em Logs de auditoria.",
        ],
      },
      {
        icon: Network, title: "Filiais / Áreas / Equipes", path: "/admin/hierarchy",
        what: "Estrutura organizacional dentro de cada empresa.",
        how: [
          "Selecione a empresa → adicione filiais, áreas e equipes.",
          "Serve para segmentar indicadores, rituais e relatórios.",
        ],
      },
      {
        icon: Users, title: "Usuários", path: "/admin/users",
        what: "Todos os usuários da plataforma.",
        how: [
          "Busque por nome/e-mail; edite papéis ou desative acesso.",
          "Convites são enviados por e-mail com link mágico.",
        ],
      },
      {
        icon: ShieldCheck, title: "Permissões (RBAC)", path: "/admin/permissions",
        what: "Papéis e o que cada um pode fazer.",
        how: [
          "Papéis: super_admin, franchise_owner, org_admin, leader, viewer.",
          "Um mesmo usuário pode ter papéis em empresas diferentes.",
        ],
      },
    ],
  },
  {
    group: "Comercial — planos, licenças e cobrança",
    items: [
      {
        icon: Package, title: "Planos", path: "/admin/plans",
        what: "Pacotes comerciais (Starter, Pro, Enterprise…).",
        how: [
          "Defina preço mensal/anual, limite de líderes e módulos incluídos.",
          "Um plano publicado fica disponível para novas assinaturas.",
        ],
      },
      {
        icon: Boxes, title: "Módulos", path: "/admin/modules",
        what: "Blocos do produto (Consciência, Organização, IA Coach…).",
        how: [
          "Ative/desative por plano — controla o que aparece para o líder.",
        ],
      },
      {
        icon: KeyRound, title: "Licenças", path: "/admin/licenses",
        what: "Quantidade de assentos ativos por empresa.",
        how: [
          "Aumente/reduza manualmente ou deixe seguir a assinatura.",
        ],
      },
      {
        icon: CreditCard, title: "Assinaturas", path: "/admin/subscriptions",
        what: "Vínculo empresa ↔ plano ↔ ciclo.",
        how: [
          "Alterar plano gera pró-rata; cancelar mantém acesso até o fim do ciclo.",
        ],
      },
      {
        icon: Receipt, title: "Faturas", path: "/admin/invoices",
        what: "Histórico financeiro e status de pagamento.",
        how: [
          "Pendente / Paga / Atrasada / Cancelada — sincroniza com Asaas.",
        ],
      },
      {
        icon: CreditCard, title: "Cobrança (Asaas)", path: "/admin/billing",
        what: "Integração com o gateway de cobrança.",
        how: [
          "Configure a chave de API e o webhook uma única vez.",
          "Todos os boletos/Pix passam a ser emitidos automaticamente.",
        ],
      },
    ],
  },
  {
    group: "Implantação",
    items: [
      {
        icon: ClipboardCheck, title: "Onboarding", path: "/admin/onboarding",
        what: "Checklist de setup de cada empresa nova.",
        how: [
          "Acompanhe o progresso da implantação: métodos, líderes, primeiros rituais.",
        ],
      },
    ],
  },
  {
    group: "Plataforma — configurações globais",
    items: [
      {
        icon: Brain, title: "Provedor de IA", path: "/admin/ai",
        what: "Qual IA (OpenAI ou Gemini) responde ao IA Coach dos líderes.",
        how: [
          "Escolha provedor + modelo (ex.: gpt-4o-mini, gemini-2.5-flash).",
          "Informe o NOME da variável de ambiente que guarda a API Key (ex.: OPENAI_API_KEY).",
          "A chave em si vive no servidor — o líder nunca vê nem escolhe.",
          "Defina limite mensal de tokens e temperatura.",
        ],
      },
      {
        icon: Palette, title: "Branding", path: "/admin/branding",
        what: "Logo, cores e nome exibidos para os líderes.",
        how: [
          "Aplica-se globalmente ou por franquia/empresa (white-label).",
        ],
      },
      {
        icon: BookOpen, title: "Metodologia", path: "/admin/methodology",
        what: "Conteúdos oficiais (definições, textos de apoio, prompts).",
        how: [
          "Editar aqui atualiza o que aparece nos módulos do líder.",
        ],
      },
      {
        icon: Package, title: "Apps & Versões", path: "/admin/apps",
        what: "Versão publicada, changelog e link do app.",
        how: [
          "O app é web (PWA): abre em qualquer navegador.",
          "Em celulares, ensine o líder a Adicionar à tela inicial (iOS Safari / Android Chrome).",
        ],
      },
      {
        icon: Bell, title: "Notificações", path: "/admin/notifications",
        what: "Templates de e-mail/push disparados pela plataforma.",
        how: [
          "Ex.: convite, ritual amanhã, delegação atrasada, feedback pendente.",
        ],
      },
      {
        icon: Database, title: "Dados (Import/Export)", path: "/admin/data",
        what: "Importar CSV de líderes/equipes e exportar backups.",
        how: [
          "Baixe o template CSV antes de importar.",
          "Exportação gera zip por empresa.",
        ],
      },
      {
        icon: Settings2, title: "Configurações", path: "/admin/settings",
        what: "Parâmetros gerais (fuso, idioma padrão, política de senha).",
        how: ["Alterações valem para toda a plataforma."],
      },
      {
        icon: FileText, title: "Logs de auditoria", path: "/admin/logs",
        what: "Quem fez o quê e quando.",
        how: [
          "Filtre por usuário, empresa, ação ou período.",
          "Retenção: 90 dias por padrão.",
        ],
      },
    ],
  },
];

function AdminHelpPage() {
  const appUrl = typeof window !== "undefined" ? `${window.location.origin}/app` : "/app";
  return (
    <>
      <AdminPageHeader
        title="Documentação do Admin"
        description="Guia rápido de cada área do painel — o que é, como usar, quando usar."
      />

      {/* Bloco de acesso ao app */}
      <section className="mb-8 rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-accent">
              App do líder
            </div>
            <h2 className="mt-1 font-display text-xl">Onde os líderes acessam</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              O app é uma aplicação web (PWA). Não precisa baixar da loja — abre em
              qualquer navegador e pode ser instalado como ícone no celular.
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              <li><strong className="text-foreground">iPhone (Safari):</strong> Compartilhar → Adicionar à Tela de Início.</li>
              <li><strong className="text-foreground">Android (Chrome):</strong> menu ⋮ → Instalar app / Adicionar à tela inicial.</li>
              <li><strong className="text-foreground">Desktop (Chrome/Edge):</strong> ícone de instalar ao lado da URL.</li>
            </ul>
          </div>
          <div className="flex flex-col gap-2">
            <a
              href={appUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
            >
              <ExternalLink className="h-4 w-4" /> Abrir app do líder
            </a>
            <a
              href={appUrl}
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <Download className="h-3.5 w-3.5" /> Link para instalar
            </a>
          </div>
        </div>
      </section>

      {/* Seções */}
      <div className="space-y-10">
        {sections.map((sec) => (
          <section key={sec.group}>
            <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {sec.group}
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {sec.items.map((item) => (
                <a
                  key={item.path}
                  href={item.path}
                  className="group rounded-2xl border border-border bg-card p-5 transition-all hover:border-accent/40 hover:shadow-[var(--shadow-accent)]"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent/10 text-accent">
                      <item.icon className="h-4 w-4" strokeWidth={1.75} />
                    </div>
                    <div>
                      <h3 className="font-medium">{item.title}</h3>
                      <div className="text-[11px] text-muted-foreground">{item.path}</div>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-foreground/90">{item.what}</p>
                  <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                    {item.how.map((h, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="mt-10 rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-lg">Boas práticas</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>• Sempre configure Provedor de IA antes de convidar líderes — o IA Coach depende disso.</li>
          <li>• Convide 1 Admin por empresa; ele completa o restante do onboarding.</li>
          <li>• Revise Logs de auditoria semanalmente em ambientes multiempresa.</li>
          <li>• Para white-label: cadastre Branding por franquia antes de vincular empresas.</li>
          <li>• Não compartilhe a chave de API de IA por chat — use apenas a variável de ambiente do servidor.</li>
        </ul>
      </section>
    </>
  );
}