import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Home from "@/pages/Home";
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
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-12">
      <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-10 sm:py-10">
        <a href="/" className="text-sm font-semibold text-cyan-800 transition hover:text-cyan-600">← Voltar ao OrbeEdital</a>
        <p className="mt-8 text-xs font-bold uppercase tracking-[.18em] text-cyan-700">OrbeEdital · Documento institucional</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#102B4E]">{privacy ? "Política de Privacidade" : "Termos e Condições de Uso"}</h1>
        <p className="mt-3 text-sm text-slate-500">Última atualização: 12 de novembro de 2026</p>
        <div className="prose prose-slate mt-8 max-w-none prose-headings:font-semibold prose-headings:text-[#153454] prose-a:text-cyan-800 prose-p:leading-7">
          {privacy ? <>
            <p>Esta Política explica como o OrbeEdital trata os dados pessoais relacionados ao uso da plataforma, para quais finalidades eles são utilizados e quais direitos podem ser exercidos pelos titulares, nos termos da legislação aplicável, especialmente a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD).</p>
            <h2>1. Dados tratados e finalidades</h2>
            <p>Para criar e manter uma conta, autenticar o acesso e disponibilizar os recursos contratados ou solicitados, o OrbeEdital pode tratar os dados cadastrais e profissionais informados pelo usuário, como nome, endereço de e-mail e informações da empresa. Também podem ser tratados registros técnicos e de segurança necessários ao funcionamento, à prevenção de uso indevido e à proteção da plataforma.</p>
            <p>As informações sobre oportunidades de compras públicas são obtidas de fontes públicas e oficiais identificadas na própria interface. O OrbeEdital não solicita que o usuário forneça dados pessoais de terceiros sem autorização ou outra base legal adequada.</p>
            <h2>2. Bases legais e uso dos dados</h2>
            <p>O tratamento ocorre conforme a finalidade e a hipótese legal aplicável, incluindo a execução de procedimentos relacionados à disponibilização da conta e dos serviços, o cumprimento de obrigações legais ou regulatórias, o exercício regular de direitos e, quando necessário, o legítimo interesse, respeitados os direitos e as liberdades dos titulares.</p>
            <h2>3. Mensagens e prestadores de serviço</h2>
            <p>O serviço de e-mail transacional poderá utilizar o provedor Resend para enviar mensagens de confirmação de endereço eletrônico e redefinição de senha. Quando essa integração estiver ativa, os dados estritamente necessários à entrega, como endereço de e-mail e nome associado à conta, poderão ser compartilhados com o provedor para essa finalidade.</p>
            <p>Os links de confirmação e redefinição podem conter tokens temporários e de uso único. A aplicação foi estruturada para armazenar somente o hash desses tokens. Outros serviços externos, como pagamentos e notificações, somente tratarão dados quando forem efetivamente habilitados e utilizados.</p>
            <h2>4. Compartilhamento e armazenamento</h2>
            <p>Os dados não são comercializados. O compartilhamento poderá ocorrer com prestadores que apoiem a operação da plataforma, quando necessário à prestação do serviço, ou para cumprimento de obrigação legal, exercício regular de direitos e atendimento a determinações de autoridades competentes. São adotadas medidas técnicas e organizacionais destinadas a proteger os dados, sem que isso represente garantia de segurança absoluta.</p>
            <p>Os dados serão mantidos pelo período necessário às finalidades informadas e para cumprimento de obrigações legais, regulatórias ou para o exercício regular de direitos. Quando não forem mais necessários, serão eliminados ou anonimizados, observadas as hipóteses legais de conservação.</p>
            <h2>5. Direitos do titular</h2>
            <p>Nos termos da LGPD, o titular pode solicitar, conforme aplicável, confirmação da existência de tratamento, acesso, correção, anonimização, bloqueio ou eliminação de dados, portabilidade, informação sobre compartilhamentos, revisão de decisões automatizadas e revogação do consentimento quando essa for a base legal utilizada.</p>
            <h2>6. Cookies e tecnologias semelhantes</h2>
            <p>A plataforma poderá utilizar recursos técnicos necessários à autenticação, à manutenção da sessão e à segurança. Caso sejam implementados cookies ou tecnologias não essenciais, suas finalidades e opções de gerenciamento deverão ser informadas de forma específica.</p>
            <h2>7. Atualizações e contato</h2>
            <p>Esta Política poderá ser atualizada para refletir mudanças nos serviços ou na legislação. A versão vigente ficará disponível nesta página. Para exercer direitos ou esclarecer dúvidas sobre privacidade, utilize o canal oficial de contato do OrbeEdital, quando disponibilizado na plataforma.</p>
            <p><strong>Responsável pelo tratamento:</strong> a identificação completa da pessoa física ou jurídica responsável e seu canal específico de privacidade deverão ser informados nesta página antes da operação comercial do serviço.</p>
          </> : <>
            <p>Estes Termos e Condições regulam o acesso e a utilização do OrbeEdital. Ao criar uma conta ou utilizar a plataforma, o usuário declara que leu e concorda com estas condições. Caso não concorde, deverá deixar de utilizar o serviço.</p>
            <h2>1. Finalidade da plataforma</h2>
            <p>O OrbeEdital é uma ferramenta de pesquisa e organização de informações sobre oportunidades de compras públicas, reunindo dados disponibilizados por fontes públicas e oficiais. A plataforma tem caráter de apoio à pesquisa e não substitui os portais governamentais, os documentos oficiais, a assessoria especializada ou a análise do próprio usuário.</p>
            <h2>2. Cadastro e responsabilidades do usuário</h2>
            <p>O usuário deve fornecer informações corretas e atualizadas, manter a confidencialidade de suas credenciais e comunicar qualquer suspeita de acesso não autorizado. É responsável pelas atividades realizadas em sua conta e por utilizar a plataforma em conformidade com a legislação e com estes Termos.</p>
            <p>É vedado utilizar o serviço para finalidade ilícita, tentar comprometer sua segurança ou disponibilidade, acessar contas ou dados de terceiros sem autorização, interferir no funcionamento da plataforma ou realizar coleta automatizada em desacordo com os limites técnicos e as regras aplicáveis.</p>
            <h2>3. Fontes, conferência e atualização das informações</h2>
            <p>As informações sobre editais e oportunidades têm origem em fontes externas, cuja disponibilidade, conteúdo, formato e frequência de atualização não são controlados integralmente pelo OrbeEdital. A exibição de um registro na plataforma não significa que o procedimento esteja aberto, vigente, adequado ao perfil do usuário ou livre de alterações.</p>
            <p>Antes de tomar qualquer decisão ou participar de procedimento, o usuário deve consultar a publicação e os documentos integrais na fonte oficial responsável, verificando, por sua conta, requisitos, retificações, anexos, prazos, condições e eventuais comunicados. Em caso de divergência, prevalecem as informações e os documentos publicados pelo órgão ou entidade competente.</p>
            <h2>4. Disponibilidade e alterações do serviço</h2>
            <p>O OrbeEdital busca manter a plataforma disponível e funcional, mas poderá realizar manutenções, atualizações ou suspensões temporárias por motivos técnicos, operacionais, de segurança ou por dependência de serviços externos. Não há garantia de disponibilidade ininterrupta, atualização em tempo real, cobertura integral de fontes ou ausência de falhas.</p>
            <h2>5. Propriedade intelectual e serviços de terceiros</h2>
            <p>Os elementos próprios da plataforma, incluindo sua identidade visual, organização, textos e componentes de software, são protegidos pela legislação aplicável. Marcas, conteúdos e documentos de órgãos públicos ou de terceiros permanecem sujeitos aos direitos e às condições de seus respectivos titulares. Links para fontes externas são disponibilizados para consulta; seus conteúdos e serviços são de responsabilidade de terceiros.</p>
            <h2>6. Limites de responsabilidade</h2>
            <p>O OrbeEdital não decide, conduz ou representa órgãos responsáveis por licitações e contratações públicas, não presta garantia de habilitação, contratação ou resultado e não substitui a avaliação técnica, jurídica, comercial ou documental do usuário. Na extensão permitida pela legislação, não responde por indisponibilidade ou alteração de fontes externas, decisões tomadas exclusivamente com base em dados não conferidos na origem ou danos decorrentes de uso em desacordo com estes Termos.</p>
            <h2>7. Suspensão e encerramento</h2>
            <p>O acesso poderá ser limitado ou suspenso diante de indícios de fraude, risco à segurança, uso ilícito, violação destes Termos ou obrigação legal. Sempre que razoável e permitido, o usuário será informado sobre a medida adotada. O usuário poderá deixar de utilizar a plataforma e solicitar providências relativas à sua conta pelos canais oficiais disponibilizados.</p>
            <h2>8. Alterações destes Termos e legislação</h2>
            <p>Estes Termos poderão ser atualizados para refletir a evolução do serviço ou mudanças legais. A versão vigente será publicada nesta página, com a data da última atualização. Aplicam-se as leis da República Federativa do Brasil, respeitadas as normas de proteção do consumidor e demais regras obrigatórias.</p>
            <h2>9. Contato</h2>
            <p>Dúvidas sobre estes Termos poderão ser encaminhadas pelo canal oficial de atendimento do OrbeEdital, quando disponibilizado na plataforma. A identificação do responsável pela operação e seus dados de contato deverão ser publicados antes da operação comercial do serviço.</p>
          </>}
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
    <Route path="/login"><AuthRoute initialMode="login"/></Route>
    <Route path="/register"><AuthRoute initialMode="register"/></Route>
    <Route path="/verify-email" component={VerifyEmailPage}/>
    <Route path="/forgot-password" component={ForgotPasswordPage}/>
    <Route path="/reset-password" component={ResetPasswordPage}/>
    <Route path="/app/admin/login" component={AdminLogin}/>
    <Route path="/app/admin" component={AdminConsole}/>
    <Route path="/app/*" component={Portal}/>
    <Route path="/app" component={Portal}/>
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
