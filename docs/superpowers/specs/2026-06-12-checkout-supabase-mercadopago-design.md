# Design — Checkout: Supabase + Mercado Pago

**Data:** 2026-06-12
**Projeto:** Pack Brasil — landing page (HTML estático na Vercel)

## Objetivo

Conectar o formulário de pedido a um fluxo de pagamento real. Hoje o formulário
apenas monta uma mensagem e abre o WhatsApp ([script.js](../../../script.js)). O novo
fluxo grava o pedido no Supabase, cobra via Mercado Pago e, após o pagamento, leva
o cliente ao WhatsApp para avisar que pagou e aguarda o pack.

## Fluxo desejado

```
Form → grava no Supabase → checkout Mercado Pago → pagamento confirmado
     → WhatsApp ("Efetuei o pagamento, estou aguardando meu pack — Pedido PB-XXXX")
```

## Decisões tomadas

- **Preço do pack:** fixo único de **R$ 57,00** (`PACK_PRICE=57` → `amount_cents = 5700`).
  O campo "preço da camiseta" do formulário é o preço de venda
  da loja (entra no criativo, gravado em `shirt_price`), **não** é o valor cobrado.
- **WhatsApp:** vai para o final do fluxo, como confirmação pós-pagamento — não é
  mais o canal principal de pedido.
- **Arquitetura (Opção B):** o navegador fala apenas com o nosso backend `/api`. O
  backend grava no Supabase (service role) e cria a cobrança no Mercado Pago,
  devolvendo só o link de checkout. O navegador nunca acessa o Supabase diretamente.
  - Motivos: nenhuma chave do Supabase exposta no navegador; RLS 100% trancado;
    uma única chamada do front; e o backend já é necessário para o Mercado Pago.

## Arquitetura

```
Cliente preenche form
        │
        ▼
POST /api/create-order ───────────────┐
        │ 1. valida os dados           │
        │ 2. grava pedido no Supabase  │  (service role; status: aguardando_pagamento)
        │ 3. cria preference no MP     │  (external_reference = id do pedido)
        ◄── devolve link do checkout ──┘
        │
        ▼
Navegador redireciona → Checkout Mercado Pago (Pix / cartão)
        │
   ┌────┴───────────────────────────┐
   ▼ (cliente paga)                 ▼ (MP notifica o servidor)
back_url → /sucesso.html       POST /api/mp-webhook
   │                                │ consulta a API do MP, confirma pagamento
   ▼                                ▼ atualiza pedido → pagamento_confirmado
Página "pagamento ok" +         (paid_at, payment_id, payment_method)
botão WhatsApp com mensagem
pronta + nº do pedido
```

- **Fonte da verdade da confirmação:** o webhook (`/api/mp-webhook`), não o redirect.
  Se o cliente fechar o navegador após pagar, o pedido ainda é confirmado.
- **Caminho visível ao cliente:** a página `/sucesso.html` é quem leva ao WhatsApp.

## Componentes

### Frontend (estático, Vercel)
- **index.html** — sem mudança estrutural; o formulário permanece igual.
- **script.js** — altera o `submit`: em vez de abrir o WhatsApp, faz
  `POST /api/create-order` e redireciona para o `checkoutUrl` retornado.
- **sucesso.html** (novo) — destino do `back_url` de sucesso do MP. Mostra
  "pagamento confirmado / Pedido PB-XXXX" e botão WhatsApp com a mensagem pronta:
  *"Efetuei o pagamento, estou aguardando meu pack — Pedido PB-XXXX"*.
- **pendente.html** (novo, simples) — Pix aguardando compensação.
- **erro.html** (novo, simples) — pagamento recusado, com opção de tentar de novo.

### Backend (funções serverless, pasta `/api`)
- **/api/create-order.js**
  - valida os campos no servidor;
  - grava o pedido no Supabase (service role, `status = aguardando_pagamento`,
    `amount_cents` = preço fixo do pack);
  - cria a *preference* no Mercado Pago: `external_reference = id do pedido`,
    `back_urls` → sucesso/pendente/erro, `auto_return = approved`,
    `notification_url` → `/api/mp-webhook`;
  - devolve `{ checkoutUrl: init_point }`.
- **/api/mp-webhook.js**
  - valida a assinatura `x-signature` do Mercado Pago;
  - consulta a API do MP pelo `payment_id` para confirmar o status real;
  - se aprovado, atualiza o pedido → `pagamento_confirmado` (`paid_at`,
    `payment_id`, `payment_method`); idempotente (checa status antes de regravar).

### Supabase
- Schema SQL (limpeza + criação) conforme o resumo do projeto: tabela `orders`,
  `order_status_log`, ENUM `order_status`, triggers de número de pedido
  (`PB-0001`), `updated_at` e log de status.
- **RLS ligado, sem nenhuma policy pública.** Todo acesso é via service role
  (que ignora RLS). Ninguém de fora lê/escreve nada.

### Configuração (variáveis de ambiente na Vercel — nunca no código)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `MP_ACCESS_TOKEN`
- `PACK_PRICE` (= `57`, preço fixo do pack), `WHATSAPP_NUMERO` (= `5513991577711`,
  da loja: (13) 99157-7711), `SITE_URL`

### Dependências / build
- Adicionar `package.json` com `@supabase/supabase-js` e o SDK do Mercado Pago.
- A Vercel detecta as funções em `/api` e serve os arquivos estáticos da raiz.

## Tratamento de erros e casos de borda

- **Validação dupla:** cliente (como hoje) e servidor (`/api/create-order`).
- **Falha ao gravar no Supabase:** retorna erro, o form exibe mensagem e **não**
  redireciona ao pagamento.
- **Falha ao criar a cobrança no MP:** pedido permanece `aguardando_pagamento`;
  cliente pode tentar novamente. Sem pedido fantasma.
- **Webhook idempotente:** duplicatas do MP não causam problema; status é checado
  antes de regravar.
- **Segurança do webhook:** valida `x-signature` para impedir confirmação forjada.

## Testes

- Credenciais e cartões/Pix de teste do Mercado Pago — fluxo completo sem dinheiro
  real.
- Verificar: `create-order` devolve `checkoutUrl`; webhook com pagamento aprovado
  de teste leva o pedido a `pagamento_confirmado`; `sucesso.html` monta o botão do
  WhatsApp com a mensagem e o número de pedido corretos.
- `vercel dev` roda funções `/api` + estático localmente antes de publicar.

## Fora de escopo (próximos passos, não neste ciclo)

- Painel admin de pedidos.
- Notificações automáticas por e-mail.
- Pós-venda / solicitação de depoimento.
- Planos/níveis de preço (decidido: preço fixo único).
