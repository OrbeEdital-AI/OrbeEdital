import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Home from "@/pages/Home";
import PricingPage from "@/pages/PricingPage";
import PixPaymentPage from "@/pages/PixPaymentPage";
import AuthRoute from "@/pages/AuthRoute";
import Portal from "@/pages/Portal";
import AdminConsole from "@/pages/AdminConsole";
import AdminLogin from "@/pages/AdminLogin";
import { ForgotPasswordPage, ResetPasswordPage, VerifyEmailPage } from "@/pages/EmailAuthPages";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

function LegalPage({ kind }: { kind: "terms" | "privacy" }) {
  const privacy = kind === "privacy";

  const termsSections = [
    { title: "1. Finalidade da plataforma", items: [
      ["1.1.", "O OrbeEdital é uma ferramenta de pesquisa e organização de informações sobre oportunidades de compras públicas, que reúne dados de fontes públicas e oficiais."],
      ["1.2.", "A plataforma é um apoio à pesquisa. Ela não substitui os portais governamentais, os documentos oficiais, a assessoria especializada nem a sua própria análise."],
    ]},
    { title: "2. Cadastro e responsabilidades do usuário", items: [
      ["2.1.", "Você deve fornecer informações corretas e atualizadas e manter suas credenciais em sigilo."],
      ["2.2.", "Comunique qualquer suspeita de acesso não autorizado à sua conta."],
      ["2.3.", "Você é responsável pelas atividades realizadas em sua conta e pelo uso da plataforma em conformidade com a lei e com estes Termos."],
      ["2.4.", "É proibido:", ["usar o serviço para fins ilícitos;", "tentar comprometer a segurança ou a disponibilidade da plataforma;", "acessar contas ou dados de terceiros sem autorização;", "interferir no funcionamento do serviço;", "realizar coleta automatizada em desacordo com os limites técnicos e as regras aplicáveis."]],
    ]},
    { title: "3. Fontes e conferência das informações", items: [
      ["3.1.", "As informações têm origem em fontes externas. O OrbeEdital não controla integralmente a disponibilidade, o conteúdo, o formato nem a frequência de atualização dessas fontes."],
      ["3.2.", "A exibição de um registro não significa que o procedimento esteja aberto, vigente, adequado ao seu perfil ou livre de alterações."],
      ["3.3.", "Antes de qualquer decisão ou participação em procedimento, consulte a publicação e os documentos integrais na fonte oficial. Verifique por conta própria requisitos, retificações, anexos, prazos, condições e comunicados."],
      ["3.4.", "Em caso de divergência, prevalecem as informações e os documentos publicados pelo órgão ou entidade competente."],
    ]},
    { title: "4. Disponibilidade e alterações do serviço", items: [
      ["4.1.", "O OrbeEdital busca manter a plataforma disponível, mas pode realizar manutenções, atualizações ou suspensões temporárias por motivos técnicos, operacionais, de segurança ou por dependência de serviços externos."],
      ["4.2.", "Não há garantia de disponibilidade ininterrupta, atualização em tempo real, cobertura integral das fontes ou ausência de falhas."],
    ]},
    { title: "5. Propriedade intelectual e serviços de terceiros", items: [
      ["5.1.", "Os elementos próprios da plataforma (identidade visual, organização, textos e componentes de software) são protegidos pela legislação aplicável."],
      ["5.2.", "Marcas, conteúdos e documentos de órgãos públicos ou de terceiros permanecem sujeitos aos direitos de seus titulares."],
      ["5.3.", "Os links para fontes externas servem para consulta. O conteúdo e os serviços desses sites são de responsabilidade de terceiros."],
    ]},
    { title: "6. Limites de responsabilidade", items: [
      ["6.1.", "O OrbeEdital não decide, conduz nem representa órgãos responsáveis por licitações e contratações públicas."],
      ["6.2.", "A plataforma não garante habilitação, contratação ou resultado, e não substitui a avaliação técnica, jurídica, comercial ou documental do usuário."],
      ["6.3.", "Na extensão permitida pela lei, o OrbeEdital não responde por:", ["indisponibilidade ou alteração de fontes externas;", "decisões tomadas exclusivamente com base em dados não conferidos na origem;", "danos decorrentes de uso em desacordo com estes Termos."]],
    ]},
    { title: "7. Suspensão e encerramento", items: [
      ["7.1.", "O acesso poderá ser limitado ou suspenso em caso de indício de fraude, risco à segurança, uso ilícito, violação destes Termos ou obrigação legal."],
      ["7.2.", "Sempre que razoável e permitido, o usuário será informado sobre a medida adotada."],
      ["7.3.", "Você pode deixar de usar a plataforma e solicitar providências sobre sua conta pelos canais oficiais."],
    ]},
    { title: "8. Alterações destes Termos e legislação aplicável", items: [
      ["8.1.", "Os Termos podem ser atualizados para refletir mudanças no serviço ou na legislação. A versão vigente fica publicada nesta página, com a data da última atualização."],
      ["8.2.", "Aplicam-se as leis da República Federativa do Brasil, respeitadas as normas de proteção do consumidor e demais regras obrigatórias."],
    ]},
    { title: "9. Contato", items: [
      ["9.1.", <>Dúvidas sobre estes Termos podem ser enviadas para <a className="font-semibold text-cyan-800 underline" href="mailto:orbeedital@gmail.com">orbeedital@gmail.com</a>.</>],
    ]},
  ];

  const privacySections = [
    { title: "1. Dados tratados e finalidades", items: [
      ["1.1.", "Para criar e manter sua conta, autenticar seu acesso e disponibilizar os recursos solicitados, o OrbeEdital pode tratar dados cadastrais e profissionais informados por você, como nome, e-mail e informações da empresa."],
      ["1.2.", "Também podem ser tratados registros técnicos e de segurança, necessários ao funcionamento da plataforma, à prevenção de uso indevido e à sua proteção."],
      ["1.3.", "As informações sobre oportunidades de compras públicas vêm de fontes públicas e oficiais, identificadas na própria interface."],
      ["1.4.", "O OrbeEdital não solicita dados pessoais de terceiros sem autorização ou outra base legal adequada."],
    ]},
    { title: "2. Bases legais", items: [
      ["2.1.", "O tratamento ocorre conforme a finalidade e a hipótese legal aplicável, incluindo:", ["execução de procedimentos relacionados à disponibilização da conta e dos serviços;", "cumprimento de obrigação legal ou regulatória;", "exercício regular de direitos;", "legítimo interesse, quando necessário, respeitados seus direitos e liberdades."]],
    ]},
    { title: "3. Mensagens e prestadores de serviço", items: [
      ["3.1.", "O envio de e-mails transacionais (confirmação de endereço e redefinição de senha) poderá ser feito pelo provedor Resend."],
      ["3.2.", "Quando essa integração estiver ativa, os dados estritamente necessários à entrega, como e-mail e nome associado à conta, poderão ser compartilhados com o provedor para essa finalidade."],
      ["3.3.", "Os links de confirmação e redefinição podem conter tokens temporários e de uso único. A aplicação armazena somente o hash desses tokens."],
      ["3.4.", "Outros serviços externos, como pagamentos e notificações, só tratarão dados se forem efetivamente habilitados e utilizados."],
    ]},
    { title: "4. Compartilhamento, armazenamento e segurança", items: [
      ["4.1.", "Os dados não são comercializados."],
      ["4.2.", "O compartilhamento poderá ocorrer:", ["com prestadores que apoiem a operação da plataforma, quando necessário à prestação do serviço;", "para cumprimento de obrigação legal ou exercício regular de direitos;", "para atendimento a determinações de autoridades competentes."]],
      ["4.3.", "São adotadas medidas técnicas e organizacionais para proteger os dados, sem que isso represente garantia de segurança absoluta."],
      ["4.4.", "Os dados são mantidos pelo período necessário às finalidades informadas e ao cumprimento de obrigações legais, regulatórias ou de exercício regular de direitos."],
      ["4.5.", "Quando deixarem de ser necessários, os dados serão eliminados ou anonimizados, observadas as hipóteses legais de conservação."],
    ]},
    { title: "5. Seus direitos como titular", items: [
      ["5.1.", "Nos termos da LGPD, você pode solicitar, conforme aplicável:", ["confirmação da existência de tratamento;", "acesso aos dados;", "correção de dados incompletos, inexatos ou desatualizados;", "anonimização, bloqueio ou eliminação de dados;", "portabilidade;", "informação sobre compartilhamentos;", "revisão de decisões automatizadas;", "revogação do consentimento, quando essa for a base legal utilizada."]],
    ]},
    { title: "6. Cookies e tecnologias semelhantes", items: [
      ["6.1.", "A plataforma pode utilizar recursos técnicos necessários à autenticação, à manutenção da sessão e à segurança."],
      ["6.2.", "Se forem implementados cookies ou tecnologias não essenciais, suas finalidades e opções de gerenciamento serão informadas de forma específica."],
    ]},
    { title: "7. Atualizações e contato", items: [
      ["7.1.", "Esta Política pode ser atualizada para refletir mudanças nos serviços ou na legislação. A versão vigente fica publicada nesta página."],
      ["7.2.", <>Para exercer seus direitos ou esclarecer dúvidas sobre privacidade, entre em contato pelo e-mail <a className="font-semibold text-cyan-800 underline" href="mailto:orbeedital@gmail.com">orbeedital@gmail.com</a>.</>],
    ]},
  ];

  const sections = privacy ? privacySections : termsSections;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-12">
      <article className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white px-5 py-7 shadow-sm sm:px-10 sm:py-10 lg:px-14">
        <a href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-800 transition hover:text-cyan-600">← Voltar ao OrbeEdital</a>
        <p className="mt-8 text-xs font-bold uppercase tracking-[.18em] text-cyan-700">OrbeEdital · Documento institucional</p>
        <h1 className="mt-3 text-2xl font-bold leading-tight tracking-tight text-[#102B4E] sm:text-3xl">{privacy ? "Política de Privacidade" : "Termos e Condições de Uso"}</h1>
        <p className="mt-3 border-b border-slate-200 pb-6 text-sm text-slate-500">Última atualização: 12 de novembro de 2026</p>
        <div className="mt-7 space-y-8 text-[15px] leading-7 text-slate-700 sm:mt-9">
          {privacy && <p className="text-base leading-8">Esta Política explica como o OrbeEdital trata dados pessoais, para quais finalidades e quais direitos você pode exercer, nos termos da legislação aplicável, em especial a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018, a LGPD).</p>}
          {!privacy && <p className="text-base leading-8">Ao criar uma conta ou utilizar o OrbeEdital, você declara que leu e concorda com estes Termos. Se não concordar, deixe de utilizar o serviço.</p>}
          {sections.map((section) => (
            <section key={section.title} className="space-y-3">
              <h2 className="border-l-4 border-cyan-600 pl-3 text-lg font-bold leading-7 text-[#153454]">{section.title}</h2>
              <div className="space-y-3 pl-1">
                {section.items.map(([number, content, bullets]: any) => (
                  <div key={number} className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-2 sm:grid-cols-[3.75rem_minmax(0,1fr)] sm:gap-3">
                    <span className="font-semibold text-slate-500">{number}</span>
                    <div className="min-w-0">
                      <p>{content}</p>
                      {bullets && <ul className="mt-2 list-disc space-y-1 pl-5 marker:text-cyan-700">{bullets.map((bullet: string) => <li key={bullet}>{bullet}</li>)}</ul>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
function AdminAlias() {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate("/app/admin");
  }, [navigate]);
  return <div className="grid min-h-screen place-items-center text-slate-500">Abrindo administração…</div>;
}

function Router() {
  return <Switch>
    <Route path="/" component={Home}/>
    <Route path="/plans" component={PricingPage}/>
    <Route path="/pix-payment" component={PixPaymentPage}/>
    <Route path="/login"><AuthRoute initialMode="login"/></Route>
    <Route path="/register"><AuthRoute initialMode="register"/></Route>
    <Route path="/verify-email" component={VerifyEmailPage}/>
    <Route path="/forgot-password" component={ForgotPasswordPage}/>
    <Route path="/reset-password" component={ResetPasswordPage}/>
    <Route path="/app/admin/login" component={AdminLogin}/>
    <Route path="/app/admin/:section" component={AdminConsole}/>
    <Route path="/app/admin" component={AdminConsole}/>
    <Route path="/app/billing" component={Portal}/>
    <Route path="/app/profile" component={Portal}/>
    <Route path="/app/opportunities/:id" component={Portal}/>
    <Route path="/app/opportunities" component={Portal}/>
    <Route path="/app/favorites" component={Portal}/>
    <Route path="/app/saved-searches" component={Portal}/>
    <Route path="/app" component={Portal}/>
    <Route path="/app/*" component={Portal}/>
    <Route path="/terms"><LegalPage kind="terms"/></Route>
    <Route path="/privacy"><LegalPage kind="privacy"/></Route>
    <Route path="/admin" component={AdminAlias}/>
    <Route path="/admin/*" component={AdminAlias}/>
    <Route path="/404" component={NotFound}/>
    <Route component={NotFound}/>
  </Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster/><Router/></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
