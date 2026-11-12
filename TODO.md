# TODO — OrbeEdital

Cada resultado é marcado como concluído somente após evidência de sua entrega; os itens ainda sem todos os critérios atendidos permanecem abertos. As APIs oficiais iniciais são PNCP e Compras.gov.br. Nenhum registro de demonstração será apresentado como oportunidade real; campos ausentes permanecerão como “não informado”. A persistência do produto é exclusivamente no PostgreSQL externo Supabase, depois de validar conexão autenticada; a tabela `users` criada automaticamente pelo starter no MySQL gerenciado ficará sem uso. O cadastro público não concede superadmin; a promoção da conta administrativa configurada exige comando local explícito depois que o titular tiver sido verificado por um operador.

## 1. Site público, identidade e navegação responsiva

- [x] Criar identidade visual profissional que transmita confiança, tecnologia, segurança e credibilidade, com nome ORBEEDITAL e posicionamento “Inteligência em licitações públicas”. Priorizar azul-marinho, azul, branco e cinza.
- [ ] Criar site institucional público com página inicial, apresentação da plataforma, funcionalidades, planos e preços, perguntas frequentes, contato, login, cadastro, termos de uso e política de privacidade.
- [ ] Implementar experiência SaaS B2B organizada e intuitiva, adequada a empresas sem conhecimento técnico em licitações: navegação por módulos, menu lateral em telas apropriadas, indicadores, tabelas filtráveis/ordenáveis, busca global e responsividade em computadores, tablets e celulares.
- [ ] Usar português brasileiro, moeda Real (R$), datas DD/MM/AAAA e fuso de Brasília em interfaces, mensagens, registros e relatórios destinados ao usuário.
- [ ] Manter a interface responsiva, acessível, legível, performática e consistente entre módulos.

## 2. Cadastro, login, sessão e perfil empresarial

- [x] Cadastro solicita nome, e-mail, telefone, senha, nome da empresa, CNPJ opcional no cadastro inicial, estado, município e segmento de atuação.
- [x] Implementar autenticação real, recuperação de senha, verificação de e-mail, controle de sessão, proteção de rotas e feedback adequado. Não simular conta autenticada nem envio de e-mail.
- [ ] Criar perfil empresarial com dados da empresa, produtos comercializados, serviços prestados, áreas de atuação, estados e municípios atendidos, palavras-chave, códigos CATMAT/CATSER e preferências de notificação.
- [x] Permitir cadastrar mais de um segmento de atuação.
- [x] Oferecer recuperação de senha e verificação de e-mail por mecanismo real; quando um serviço externo de envio não estiver configurado, indicar claramente a dependência e não afirmar que a mensagem foi enviada. SMTP Gmail foi autenticado; o Gmail aceitou e a auditoria registrou os dois fluxos.
- [ ] Criar perfil comum de teste para o endereço autorizado pelo usuário, sem papel administrativo; não liberar o portal até o link real de verificação ser confirmado e possibilitar que o titular defina sua própria senha pelo fluxo seguro. A conta `user` foi criada; confirmação e redefinição aguardam os links enviados ao titular.

## 3. Arquitetura PostgreSQL e isolamento dos dados

- [x] Usar exclusivamente PostgreSQL externo Supabase para os dados de negócio, mediante `LICITAHUB_POSTGRES_URL`; usar `LICITAHUB_POSTGRES_CA_CERT` com validação TLS, CA e hostname habilitada. Não usar MySQL gerenciado como fallback.
- [x] A migração inicial do starter que criou `users` no MySQL gerenciado permanece sem uso pelo produto; não aplicar migrações de negócio nesse MySQL.
- [x] Antes de qualquer migração PostgreSQL, verificar que uma sessão autenticada ao Supabase pode ser aberta com TLS plenamente validado. Somente depois dessa confirmação aplicar migrações aditivas e determinísticas no PostgreSQL externo.
- [ ] Estruturar tabelas para usuários, empresas, perfis empresariais, planos, assinaturas, pagamentos, fontes, execuções de coleta, licitações, itens, órgãos públicos, municípios, estados, documentos, histórico de atualizações, favoritos, pesquisas salvas, alertas, notificações, análises de IA, oportunidades acompanhadas, atividades dos usuários e permissões administrativas.
- [ ] Implementar índices para pesquisa por palavra-chave, estado, município, órgão, modalidade, situação, datas, valores e códigos CATMAT/CATSER, com busca textual adequada ao PostgreSQL.
- [ ] Garantir isolamento dos dados particulares de cada assinante/empresa no servidor; dados privados nunca podem ser protegidos apenas escondendo conteúdo no navegador.
- [ ] Compartilhar entre assinantes apenas os registros públicos de licitações; restringir notas, favoritos, pesquisas, perfis, arquivos privados, alertas, atividades e pipeline à empresa/usuários autorizados.
- [ ] Persistir documentos em armazenamento apropriado e metadados/índice/propriedade no PostgreSQL.

## 4. Framework de fontes e integrações oficiais

- [x] Criar conectores independentes, extensíveis e substituíveis, capazes de adicionar novas fontes sem reescrever a aplicação.
- [x] Priorizar APIs oficiais, dados abertos/arquivos oficiais, integrações autorizadas e, somente quando permitido, consulta a páginas públicas segundo termos de uso e legislação. Não contornar CAPTCHA, autenticação, bloqueios nem mecanismos de proteção.
- [x] Implementar inicialmente API oficial de consulta PNCP e API oficial de dados abertos Compras.gov.br; registrar cobertura, última sincronização e limitações observadas.
- [ ] Registrar como integradas ou pendentes, conforme a situação real: Portal de Compras Públicas, BLL Compras, Licitanet, BBMNET, Licitações-e, portais estaduais, portais municipais e outras fontes futuras. Fonte sem integração automatizada possível/autorizada deve ter limitação explicitada no painel administrativo.
- [ ] Criar gestão de fontes para visualizar nome, endereço, tipo de integração, status, última execução, próxima execução, quantidade de registros importados, quantidade de erros e tempo médio de processamento.
- [ ] Disponibilizar ações administrativas funcionais: ativar, desativar, executar sincronização manual, consultar logs, configurar frequência, consultar erros e reprocessar registros.
- [ ] Monitorar mudanças estruturais nos portais ou indisponibilidade de dados e expor a situação/erro no painel administrativo.

## 5. Coleta, normalização e histórico de licitações

- [ ] Extrair e armazenar, sempre que a fonte fornecer: número da licitação, número do processo administrativo, ano, modalidade, tipo de contratação, descrição do objeto, resumo do objeto, órgão responsável, unidade compradora, CNPJ do órgão, estado, município, endereço, data de publicação, data de abertura, data/horário da sessão, prazo de envio de propostas, valor estimado, valor homologado, situação atual, critério de julgamento, modo de disputa, fonte, link original, link do edital, documentos anexos, itens, quantitativos e histórico de atualizações.
- [x] Não inventar informações ausentes. Manter os campos sem dados como identificados “não informado”.
- [ ] Armazenar fonte de origem e links originais em todos os registros importados.
- [ ] Persistir itens e respectivos quantitativos quando a fonte os disponibilizar.
- [ ] Registrar histórico de alterações por oportunidade, incluindo mudanças em datas, edital/documentos, situação e campos de origem, conforme disponibilidade da API.
- [ ] Usar identificadores oficiais para unicidade; quando não houver identificador oficial único, usar combinação de fonte, órgão, número do processo e ano.
- [ ] Evitar duplicidades na importação e permitir que a administração identifique/corrija registros duplicados.
- [x] Consultar primeiro endpoints oficiais publicados e respeitar paginação, limites e parâmetros das APIs. Não afirmar sincronização integral do país se a fonte e janela consultada não sustentarem essa cobertura.

## 6. Atualização automática, fila e logs de coleta

- [ ] Criar serviço de monitoramento periódico que consulte fontes, identifique novas publicações e atualize licitações existentes.
- [ ] Detectar mudança de datas, alterações em editais, processos suspensos, revogados, anulados ou encerrados, e registrar histórico de modificações.
- [x] Evitar duplicidade, armazenar data/hora da última sincronização e registrar erros de integração.
- [x] Contar e registrar no histórico cada mudança em campo visível da oportunidade, incluindo órgão/unidade, localização, modalidade, sessão, documentos e última atualização oficial; atualizações apenas de `rawData` ou `lastSyncedAt` não devem inflar o contador público `updated`. Evidência: `comparableChanges` compara os campos exibidos com igualdade profunda e tem testes para localização, datas e refresh técnico.
- [ ] Criar fila de processamento para evitar sobrecarga das fontes e permitir configuração da frequência de atualização para cada conector.
- [ ] Fazer tarefas idempotentes e reprocessáveis, com controle de tentativas/erros, para que retries não criem registros duplicados.
- [x] Disponibilizar sincronização manual autorizada no painel.
- [x] Implementar callback agendado autenticado para execução periódica em produção; só exibir o monitoramento automático como ativo após publicação e registro/ativação efetivos do agendamento. O callback foi publicado e os dois Heartbeats estão habilitados/associados; as primeiras execuções PNCP e Compras.gov.br retornaram HTTP 200, cada uma com 50 registros inseridos e zero erros. A estabilidade de recorrências futuras e a observabilidade de falhas permanecem abertas nos itens próprios.
- [x] Coletar do PNCP todas as contratações com recebimento de propostas aberto usando `GET /v1/contratacoes/proposta`, sem filtro de modalidade e percorrendo todas as páginas anunciadas por `totalPaginas` (até 50 registros por página). Registrar total de páginas/itens, não marcar execução completa se houver truncamento ou falha e manter a sincronização automática horária. Implementação com teto explícito de 1.000 páginas, retry limitado com `Retry-After`, persistência de metadados por página e validação fail-closed de respostas/paginação incompletas. Evidência após publicação: Heartbeat PNCP HTTP 200, 69 registros em 2 páginas, 38 atualizações (10/11/2026 22:04 UTC); os totais variam com as novas publicações.
- [ ] Complementar a fonte Compras.gov.br percorrendo todas as páginas para cada modalidade consultada e respeitando o tamanho máximo de 500. A API oficial de contratações PNCP 14133 exige datas de publicação e modalidade; portanto esse conector é complementar ao feed PNCP de abertos e não deve ser descrito como uma busca histórica exaustiva de todos os abertos. Evidência: Heartbeat da versão anterior percorreu 14 páginas/2.809 registros e expirou aos 31 s; dois ensaios manuais completos do código local percorreram 14 páginas/2.809 registros, sem erros, em 93,4 s e 80,3 s. Após upsert atômico por lote, concorrência limitada a três modalidades e comparação ampliada de histórico, os ensaios mais recentes percorreram novamente as 14 páginas/2.809 registros, sem erros, em 25,8 s e 28,0 s; confirmação do Heartbeat na versão publicada ainda pendente.
- [ ] Fazer os callbacks automáticos concluírem dentro do timeout do agendador sem truncar páginas; preservar idempotência, deduplicação cross-source e histórico de mudanças, responder 2xx somente após a persistência confirmada e manter erros/timeout visíveis como falha. Evidência: os dois ensaios locais completos com persistência confirmada levaram 25,8 s e 28,0 s, abaixo do timeout de 31 s observado; o callback inclui autenticação/resolução de identidade adicional e ainda deve ser confirmado depois da publicação.

## 7. Portal do assinante e dashboard

- [ ] Criar área exclusiva para usuários cadastrados, apresentando o estado de acesso/assinatura real.
- [x] No rodapé do menu lateral, exibir o link `Perfil da empresa` e a conta autenticada com inicial/avatar, nome, e-mail e ação `Sair`. Evidência: JSX do portal reorganizado; typecheck e build aprovados.
- [x] Manter os itens do menu lateral em formato de lista vertical, um abaixo do outro, também em telas estreitas; não usar navegação horizontal.
- [x] Organizar a página `Perfil da empresa` em blocos, mantendo a mensagem “Estes dados são privados e ajudam a organizar futuras recomendações de compatibilidade. Listas podem ser separadas por vírgula.” e todos os campos existentes: Nome da empresa; CNPJ; Estado; Município; Segmento principal; Outros segmentos; Produtos comercializados; Serviços prestados; Palavras-chave; Estados atendidos; Municípios atendidos; Códigos CATMAT; Códigos CATSER; Valor mínimo (R$); Valor máximo (R$); botão `Salvar perfil`. Evidência: campos agrupados em cinco seções, estado/csv/save preservados; typecheck, suíte de 20 testes e build aprovados.
- [ ] Dashboard apresenta total de oportunidades encontradas, licitações abertas, licitações com encerramento próximo, novas oportunidades nas últimas 24 horas, oportunidades por estado, modalidade e órgão, valor total estimado, favoritos e alertas recentes.
- [ ] Incluir gráficos interativos e indicadores atualizados a partir dos dados cadastrados, sem números fictícios apresentados como dados reais.
- [ ] Exibir estados claros de carregamento, erro, vazio e falta de integração/dados.

## 8. Busca avançada de licitações

- [ ] Permitir combinar vários filtros simultaneamente e manter os filtros selecionados ativos durante a navegação.
- [x] Salvar, listar, reabrir e reutilizar pesquisas salvas pelo usuário.
- [ ] Filtros de localização: Brasil inteiro, região, estado, município, múltiplos estados e múltiplos municípios.
- [ ] Filtros de órgãos: prefeituras, governos estaduais, Governo Federal, câmaras municipais, secretarias, autarquias, fundações, universidades, hospitais públicos, institutos, empresas públicas e outros órgãos.
- [ ] Filtros de modalidade: pregão eletrônico, pregão presencial, concorrência, dispensa, inexigibilidade, credenciamento, leilão, concurso, chamamento público e outros.
- [ ] Filtros de situação: publicada, recebendo propostas, em andamento, sessão agendada, suspensa, em julgamento, homologada, adjudicada, revogada, anulada e encerrada.
- [x] Mapear `Divulgada no PNCP` para `Publicada no PNCP`; quando a API fornecer uma situação, não exibir `Situação não informada`. Evidência: teste do normalizador e projeção de leitura dos três registros oficiais.
- [ ] Filtros por valor mínimo, valor máximo e faixas de valores.
- [ ] Filtros por data de publicação, data de abertura, prazo final de propostas e período personalizado.
- [ ] Pesquisa por palavra-chave, nome de produto, descrição de serviço, número do processo, nome do órgão, CNPJ, código CATMAT, código CATSER e código CNAE quando aplicável.
- [ ] Oferecer ordenação e paginação compreensíveis, preservando os critérios/filtros aplicados.

## 9. Detalhe da oportunidade e ações do assinante

- [ ] Abrir uma página individual de cada oportunidade com todas as informações efetivamente disponíveis: descrição completa, órgão, localização, datas, valor estimado, itens/quantidades, critério de julgamento, situação, documentos, edital, anexos, link ao portal original e histórico.
- [ ] A página identifica a fonte de origem, o link original e a última atualização.
- [x] Permitir abrir e atualizar diretamente `/app/opportunities/:id` para uma oportunidade existente, montando o shell do portal para todos os caminhos aninhados `/app/*`; não encaminhar uma rota de detalhe válida ao 404 global. Evidência: o parser Wouter confirmou o match do wildcard e do parâmetro; o deep link retornou HTTP 200 localmente e o manifesto lista a rota dinâmica.
- [x] Os cartões, busca, favoritos, dashboard e detalhe devem abrir a página humana PNCP específica `/app/editais/{cnpj}/{ano}/{sequencial}`, nunca a raiz nem a query JSON da API; se faltarem os identificadores necessários, não inventar nem mostrar um link quebrado. A projeção corrigida também cobre os registros já persistidos. Evidência: teste de helper e leitura somente dos três registros reais.
- [x] Exibir valores estimados em R$ com duas casas decimais, sem arredondar centavos da fonte. Evidência: formatação verificada com os três valores retornados pelas APIs oficiais.
- [ ] Disponibilizar ações funcionais de adicionar aos favoritos, compartilhar oportunidade, baixar edital, baixar documentos, criar lembrete, acompanhar licitação e consultar análise da IA.
- [ ] Proteger documentos e links conforme permissões/planos; downloads devem apontar para arquivo real disponível e nunca prometer conteúdo ausente.

## 10. Inteligência artificial para leitura e resumo de editais

- [ ] Permitir que o assinante solicite análise automática de edital PDF.
- [ ] A análise identifica, quando houver suporte no documento: exigências de habilitação, documentos obrigatórios, prazos, exigências técnicas e financeiras, condições de entrega, multas e penalidades, amostras, garantias, regras principais e cláusulas que merecem atenção.
- [ ] Gerar resumo estruturado que responda: o que está sendo comprado; qual órgão compra; qual valor estimado; quais produtos/serviços são solicitados; datas importantes; documentos exigidos; principais condições de participação; riscos e pontos de atenção.
- [ ] Indicar página ou trecho de origem de cada informação importante quando possível.
- [ ] Não inventar extrações ausentes e não apresentar a análise como aconselhamento jurídico definitivo.
- [ ] Exibir estados distintos de aguardando, concluído, falha, arquivo indisponível e limite/cota esgotada; apresentar custos/limites de IA de forma transparente.

## 11. Compatibilidade comercial e assistente

- [ ] Permitir que o assinante cadastre segmentos de atuação, produtos, serviços, palavras-chave, estados/municípios atendidos, faixas de valor e códigos CATMAT/CATSER de interesse.
- [ ] Analisar oportunidades e oferecer pontuação de compatibilidade de 0 a 100, sempre mostrando os motivos da pontuação.
- [ ] Os motivos podem incluir correspondência do objeto com os produtos/serviços cadastrados, região dentro da área atendida, valor dentro da faixa comercial e situação recebendo propostas.
- [ ] Não classificar oportunidade como adequada somente por correspondência de palavras-chave.
- [ ] Criar assistente conversacional capaz de responder perguntas sobre oportunidades e documentos, como: “Quais licitações de equipamentos estão abertas em Pernambuco?”, “Quais prefeituras estão comprando material de escritório?”, “Quais oportunidades possuem abertura nos próximos sete dias?”, “Quais licitações exigem atestado de capacidade técnica?”, “Quais editais exigem balanço patrimonial?” e “Quais oportunidades possuem valor estimado superior a R$ 100 mil?”.
- [ ] As respostas do assistente usam somente dados efetivamente cadastrados, distinguem falta de dados de resultado vazio e apresentam links para oportunidades correspondentes.

## 12. Alertas e notificações personalizadas

- [ ] Permitir configurar alertas por palavras-chave, produtos, serviços, estados, municípios, órgãos públicos, modalidades, faixas de valores, códigos CATMAT/CATSER e compatibilidade comercial.
- [ ] Disponibilizar notificação dentro da plataforma e suportar integração oficial de e-mail e WhatsApp; Telegram pode ser opção adicional.
- [ ] Permitir frequência imediata, diária e semanal.
- [ ] Notificar quando uma nova licitação compatível for publicada; data de abertura mudar; edital for atualizado; oportunidade for suspensa ou revogada; oportunidade se aproximar do encerramento; ou licitação acompanhada mudar de situação.
- [ ] Criar central de notificações com histórico e controle de leitura.
- [ ] Não mostrar envio de e-mail/WhatsApp como concluído sem provedor, credenciais e resposta efetiva do canal.

## 13. Organização comercial e acompanhamento

- [ ] Oferecer favoritos e oportunidades acompanhadas, anotações particulares, responsável interno, prazo de acompanhamento, status de interesse e histórico de atividades.
- [ ] Criar pipeline com as etapas, na ordem: Nova oportunidade; Em análise; Interessante; Preparando documentação; Proposta enviada; Participando; Venceu; Perdeu; Descartada.
- [ ] Permitir adicionar observações e acompanhar resultados.
- [ ] Gerar relatórios das oportunidades acompanhadas, respeitando isolamento de dados e permissões empresariais.

## 14. Painel administrativo e gestão operacional

- [ ] Disponibilizar painel administrativo apenas a administradores autorizados, independente do portal do assinante.
- [ ] Dashboard administrativo mostra total de licitações cadastradas, novas no dia, licitações por estado/modalidade, total de fontes integradas, fontes ativas/com falhas, última sincronização por fonte, usuários, assinantes ativos, assinaturas vencidas, receita mensal recorrente, receita acumulada, cancelamentos e novas assinaturas.
- [ ] Permitir consultar todas as oportunidades, pesquisar registros, editar/corrigir quando necessário, excluir indevidas com registro de auditoria, identificar duplicidades e consultar fonte original e histórico.
- [ ] Permitir cadastrar/editar usuários, bloqueá-los/desbloqueá-los, consultar assinaturas, alterar planos, conceder acesso manual, consultar histórico de pagamentos e atividades, gerenciar permissões.
- [ ] Criar perfis administrativos superadministrador, administrador, operador de fontes, suporte e financeiro, com permissões individuais por módulo.

## 15. Gestão financeira e de assinaturas

- [ ] Apresentar assinaturas ativas, receita mensal recorrente, receita anual, pagamentos aprovados/pendentes/recusados, reembolsos, cancelamentos e inadimplência.
- [ ] Criar relatórios financeiros e exportação CSV.
- [ ] Persistir status e histórico dos pagamentos/assinaturas com origem e identificadores do gateway necessários para conciliação e idempotência.
- [ ] Não armazenar número de cartão, código de segurança, validade, chaves privadas ou tokens de pagamento em registros de negócio.

## 16. Planos, checkout e controle de acesso

- [ ] Criar planos flexíveis com valores configuráveis pelo administrador, modalidades mensal e anual e limites/entitlements aplicados no servidor.
- [ ] Plano Gratuito — Demonstração: acesso limitado; visualização de oportunidades selecionadas; poucos filtros; sem alertas personalizados; sem análise completa de editais.
- [ ] Plano Starter: busca de licitações; filtros por localização e modalidade; favoritos; limite mensal de consultas IA; alertas básicos.
- [ ] Plano Profissional: todos os filtros; monitoramento personalizado; alertas automáticos; análise de editais com IA; compatibilidade comercial; downloads; gestão de oportunidades.
- [ ] Plano Empresarial: todas as funcionalidades; múltiplos usuários; gestão de equipe; relatórios avançados; limite maior de análises IA; alertas personalizados; gestão de oportunidades em equipe.
- [ ] Integrar gateway escolhido (preferencialmente Mercado Pago ou Asaas), com PIX, cartão de crédito e pagamentos recorrentes conforme disponibilidade do gateway.
- [ ] Implementar checkout, confirmação por webhook, renovação, cancelamento, histórico de pagamentos, controle de inadimplência, período de teste configurável, cupons, upgrade e downgrade.
- [ ] Bloquear automaticamente funcionalidades pagas após assinatura vencida/cancelada, respeitando período de tolerância configurado.
- [ ] Não inventar preços, pagamentos, receita ou confirmação. Até selecionar/configurar o gateway e credenciais, exibir estado honesto de configuração pendente.

## 17. Calendário, mapa e inteligência de mercado

- [ ] Criar calendário de sessões agendadas, prazos finais de propostas, licitações acompanhadas, outras datas importantes e lembretes personalizados.
- [ ] Criar mapa interativo do Brasil com visualização de oportunidades por estado e município.
- [ ] Ao selecionar uma região, mostrar quantidade de licitações abertas, valor estimado total, órgãos compradores, modalidades mais utilizadas e oportunidades disponíveis.
- [ ] Criar relatórios de órgãos que mais compram determinado produto, municípios com maior volume de compras, produtos mais procurados, categorias com maior número de oportunidades, valores médios, histórico de compras, empresas vencedoras quando houver dados públicos e histórico de preços homologados.
- [ ] Distinguir explicitamente métricas sem dados suficientes das métricas calculáveis; citar período e fonte dos dados apresentados.

## 18. Atas, contratos, comparador e exportações

- [ ] Criar módulo para localizar atas de registro de preços, contratos públicos, contratações homologadas, resultados de licitações e histórico de fornecedores vencedores, quando os dados forem públicos/disponíveis.
- [ ] Permitir pesquisa de atas/contratos por órgão, produto, fornecedor, período e localização.
- [ ] Permitir selecionar duas ou mais licitações e comparar objeto, quantidade, valor estimado, órgão, localização, datas, exigências e condições de entrega.
- [ ] Exportar resultados em Excel, CSV e PDF, respeitando limites definidos para cada plano.
- [ ] Permitir compartilhar oportunidades por link, WhatsApp e e-mail, respeitando permissões do assinante e regras de acesso a documentos.

## 19. Segurança, privacidade e LGPD

- [ ] Implementar autenticação segura, recuperação de senha, verificação de e-mail, controle de sessão, rotas protegidas, controle de permissões por perfil e proteção contra acessos indevidos.
- [ ] Registrar atividades administrativas e aplicar políticas de acesso ao banco de dados.
- [ ] Proteger dados pessoais, minimizar dados coletados e não armazenar dados sensíveis desnecessários.
- [ ] Disponibilizar política de privacidade, termos de uso, política de cookies e gestão de consentimento.
- [ ] Implementar procedimentos de exclusão de conta e dados pessoais conforme legislação aplicável, com feedback e auditoria apropriados.
- [ ] Manter arquivos e anotações particulares separados por titular/empresa; links privados e credenciais não devem vazar em telas públicas, logs ou respostas.

## 20. SEO, páginas públicas de oportunidades e acesso de visitantes

- [ ] Criar páginas públicas de oportunidades com indexação controlada, sem expor funcionalidades ou dados exclusivos de assinantes.
- [ ] Visitante não autenticado vê demonstração limitada claramente identificada e é direcionado a contratar um plano.
- [ ] Garantir metadados por rota, conteúdo público que possa ser indexado e políticas de robots/sitemap coerentes; não indexar conteúdo privado.

## 21. Estados da interface e funcionamento real

- [x] Todo botão/ação oferecida deve ter função real; não deixar botões decorativos.
- [ ] Todas as telas/formulários apresentam estados de carregamento, erro, sucesso, vazio, validação e feedback da operação.
- [ ] Identificar no painel qualquer fonte/conector ainda não implementado como pendente.
- [ ] Nunca utilizar dados fictícios como se fossem licitações reais; quando a demonstração exigir exemplos, marcá-los claramente como demonstração.
- [ ] Garantir boa performance, responsividade e mensagens compreensíveis em português brasileiro.

## 22. Dependências externas e operação comercial real

- [x] Confirmar conectividade PostgreSQL Supabase autenticada com TLS `verify-full` antes da primeira migração de negócio; os segredos `LICITAHUB_POSTGRES_URL` e `LICITAHUB_POSTGRES_CA_CERT` nunca devem aparecer em código público, arquivos versionados, logs ou respostas.
- [x] Implementar envio transacional gratuito por SMTP do Gmail com senha de app, sem domínio próprio nem custos adicionais de serviço: confirmação de cadastro e recuperação de senha devem enviar links seguros, temporários e de uso único; registrar aceite de envio e falhas; tratar erros sem declarar sucesso falso. Usar para baixo volume, sem prometer entrega garantida nem volume de produção em massa. Manter transporte desacoplado e preparado para trocar futuramente para Resend. Preservar todas as tabelas PostgreSQL já configuradas e não executar migrações/DDL nesta troca de transporte. Evidência: autenticação STARTTLS validada; Gmail aceitou confirmação e redefinição; eventos de tentativa/aceite registrados; falha de auditoria pré-envio bloqueia o envio; teste/build aprovados e nenhuma tabela foi alterada.
- [ ] Selecionar e configurar provedores/credenciais para WhatsApp oficial e pagamentos antes de prometer entrega desses recursos em produção.
- [ ] Estimar custos operacionais de banco, armazenamento, coleta, processamento, IA, e-mail, WhatsApp e gateway com base em plano e volume reais; não anunciar custo fechado sem dados do provedor.
- [x] Não habilitar Stripe no lugar de Mercado Pago/Asaas sem escolha explícita do usuário.

## 23. Fases de entrega

- [ ] Fase 1: identidade visual, site institucional, cadastro/login, painel administrativo, portal do assinante, banco de dados PostgreSQL externo e gestão de usuários/permissões.
- [ ] Fase 2: integração PNCP, integração Compras.gov.br, padronização, deduplicação, atualização automática, filtros e pesquisas.
- [ ] Fase 3: planos, checkout, pagamentos, assinaturas e controle de acesso.
- [ ] Fase 4: leitura de editais com IA, resumos, identificação de exigências, compatibilidade e assistente.
- [ ] Fase 5: novos portais, alertas por WhatsApp/e-mail, calendário, mapa, relatórios, inteligência de mercado e gestão comercial.
- [ ] Manter arquitetura preparada para expansão, escalabilidade e manutenção; apresentar como funcional apenas o comportamento efetivamente implementado e configurado.

# Auditoria do dashboard e oportunidades — branch feat/dashboard-opportunities-improvements

## Paginação e filtros

- [ ] A aba Oportunidades exibe exatamente 25 registros por página; a última página pode conter menos, o total e o total de páginas são reais e não há limite artificial de páginas.
  - [ ] A paginação é feita no backend com `COUNT`, `LIMIT/OFFSET` ou cursor, ordenação estável e sem carregar milhares de registros no navegador.
  - [ ] Existem controles para primeira, anterior, próxima e última página, mantendo os filtros e reiniciando na primeira página quando a busca/filtro mudar.
  - [ ] Não há duplicação entre páginas e existem estados de carregamento, erro e lista vazia.
- [ ] Os filtros combináveis de palavra-chave, estado, fonte e filtros já suportados pelo backend retornam quantidade e registros consistentes.

## Visão geral e dados reais

- [ ] A saudação usa `America/Sao_Paulo`, com “Bom dia” de 05:00 a 11:59, “Boa tarde” de 12:00 a 17:59 e “Boa noite” de 18:00 a 04:59, atualizando sem novo login.
- [ ] Os indicadores de total, abertas, encerrando hoje, próximos 7 dias, novas em 24 horas e sem prazo usam consultas reais, critérios documentados e contagem sem duplicidades.
- [ ] O resumo e as oportunidades recentes exibem órgão, cidade/UF, valor, prazo, situação, fonte e link oficial quando esses dados existirem.
- [ ] Valores ausentes são exibidos como “Valor não informado” ou “Não divulgado”; ausência nunca vira `R$ 0,00`.

## Fontes, integridade e operação

- [ ] Fontes são agrupadas sem duplicação e o status distingue ativa, pendente, com erro e desativada com base em execuções persistidas.
- [ ] A auditoria read-only registra achados sobre duplicidades, campos ausentes, datas inválidas, links, valores e histórico sem apagar ou alterar dados.
- [ ] A conexão PostgreSQL, autenticação, respostas JSON, CSRF, cookies e rotas tRPC continuam funcionando sem mudanças de produção.

## Validação e entrega

- [ ] Typecheck, testes automatizados e build passam na branch.
- [ ] Testes focados cobrem paginação, filtros, timezone, indicadores e apresentação de valores.
- [ ] O relatório final lista problemas, correções, arquivos, testes, limitações, situação do PostgreSQL e integrações.
- [ ] Criar commit na branch exclusiva e disponibilizar somente Preview/PR para revisão; não fazer merge nem publicar em produção.
