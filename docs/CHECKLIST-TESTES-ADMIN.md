# OrbeEdital — Checklist de validação manual

Atualizado em 19/11/2026. Itens abaixo são **testes pendentes**; não marcar como aprovados apenas porque o código foi enviado. Executar em produção após deploy READY, com contas de teste sem dados reais sensíveis.

## Segurança de contas e sessões
- [ ] Alterar o papel de uma conta de teste e verificar encerramento de todas as sessões anteriores (commit 273e041).
- [ ] Tentar usar cookie de sessão antigo após mudança de papel: deve falhar.
- [ ] Suspender conta de cliente e verificar bloqueio de login, mesmo com senha correta (commit 5b5b237).
- [ ] Suspender conta conectada e verificar revogação da sessão.
- [ ] Reativar conta e verificar novo login.
- [ ] Confirmar que conta sem e-mail verificado não acessa endpoints administrativos.
- [ ] Confirmar que não é possível alterar papel de superadmin pela operação comum.

## Permissões de atendimento
- [ ] Entrar com conta role=support e consultar fila, mensagens e prioridade.
- [ ] Responder chamado como support e verificar recebimento pelo cliente.
- [ ] Criar nota interna e confirmar que o cliente não a visualiza.
- [ ] Alterar status, prioridade e responsável e verificar trilha de auditoria.
- [ ] Tentar atribuir atendimento a usuário suspenso: deve ser recusado.
- [ ] Verificar que support não pode acessar endpoints de clientes, preços, fontes ou configurações.
- [ ] Verificar que admin e superadmin mantêm acesso à fila.
- [ ] Confirmar que usuário comum não acessa fila administrativa.

## Menu administrativo por papel (commit 6c23c58)
- [ ] Superadmin visualiza todas as seções.
- [ ] Admin visualiza Visão geral, Fontes, Suporte e Financeiro, sem áreas exclusivas de superadmin.
- [ ] Operador de fontes visualiza somente Visão geral e Fontes.
- [ ] Financeiro visualiza somente Financeiro.
- [ ] Suporte visualiza somente Suporte.
- [ ] Digitar URL de área não permitida e confirmar que ela não é exibida.
- [ ] Validar menu mobile, navegação e retorno ao login em sessão expirada.
- [ ] Conferir se os indicadores da Visão geral não oferecem links para seções restritas.

## Cobrança e planos
- [ ] Conferir Essencial/Profissional, cotas e diferenças na página de assinatura.
- [ ] Testar pagamento Pix e cartão em ambiente de teste.
- [ ] Verificar cancelamento automático após estorno confirmado.
- [ ] Validar que nenhuma conta sem pagamento confirmado ganha acesso indevido.

## Publicação
- [ ] Verificar build READY do commit mais recente na Vercel.
- [ ] Executar testes de compilação/typecheck e testes automatizados do repositório.
- [ ] Testar a versão oficial https://orbeedital.vercel.app.

## Registro de execução
Preencher ao testar: data, ambiente, papel utilizado, resultado (aprovado/reprovado), evidência e eventual issue. Não usar dados pessoais reais nas evidências.
