# Checkout Supabase + Mercado Pago — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar o formulário da landing a um fluxo real: grava o pedido no Supabase, cobra R$ 57 via Mercado Pago (Checkout Pro), confirma o pagamento por webhook e leva o cliente ao WhatsApp avisando que pagou.

**Architecture:** Site HTML estático na Vercel. O navegador só fala com funções serverless em `/api` (Opção B do spec). `create-order` grava no Supabase (service role) e cria a preference do Mercado Pago; `mp-webhook` confirma o pagamento. Páginas estáticas `sucesso/pendente/erro` recebem o retorno do MP; a de sucesso abre o WhatsApp.

**Tech Stack:** HTML/CSS/JS estático, Node.js (funções serverless Vercel, ESM), `@supabase/supabase-js`, `mercadopago` (SDK v2), testes com `node --test` (nativo).

**Spec:** `docs/superpowers/specs/2026-06-12-checkout-supabase-mercadopago-design.md`

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `package.json` | Declara `"type":"module"`, dependências e script de teste |
| `.env.example` | Documenta as variáveis necessárias (sem valores reais) |
| `lib/config.js` | Lê e valida env vars; expõe constantes (preço, whatsapp, urls) |
| `lib/supabase.js` | Cria o client do Supabase com service role |
| `lib/validate-order.js` | Função pura que valida/normaliza os dados do formulário |
| `lib/validate-order.test.js` | Testes da validação |
| `api/create-order.js` | Endpoint: valida → grava pedido → cria preference MP → devolve checkoutUrl |
| `api/mp-webhook.js` | Endpoint: valida assinatura → consulta pagamento → atualiza status |
| `lib/whatsapp.js` | Função pura que monta o link do WhatsApp pós-pagamento |
| `lib/whatsapp.test.js` | Testes do link do WhatsApp |
| `script.js` | (modificar) submit do form → POST /api/create-order → redirect |
| `sucesso.html` | Página de retorno (pago) → botão WhatsApp com nº do pedido |
| `pendente.html` | Página de retorno (Pix aguardando) |
| `erro.html` | Página de retorno (recusado) |
| `assets/checkout.js` | JS da página `sucesso.html` (lê `?order=` e monta o link) |

**Variáveis de ambiente (Vercel + `.env.local`):**
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `PACK_PRICE` (=57), `WHATSAPP_NUMERO` (=5513991577711), `SITE_URL` (=https://packphotosbr-nu.vercel.app).

---

## Task 0: Setup do projeto Node + Supabase

**Files:**
- Create: `package.json`
- Create: `.env.example`
- Manual: rodar o SQL no painel do Supabase

- [ ] **Step 1: Criar `package.json`**

```json
{
  "name": "pack-brasil-landing",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0",
    "mercadopago": "^2.0.15"
  }
}
```

- [ ] **Step 2: Instalar dependências**

Run: `npm install`
Expected: cria `node_modules/` e `package-lock.json` sem erros. (`node_modules/` já está no `.gitignore`.)

- [ ] **Step 3: Criar `.env.example`** (documentação, sem valores reais)

```bash
# Supabase (Project Settings → API)
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ... (service_role, NUNCA a anon)

# Mercado Pago (painel do desenvolvedor → credenciais)
MP_ACCESS_TOKEN=TEST-xxxx
MP_WEBHOOK_SECRET=xxxx  # gerado ao configurar o webhook no painel do MP

# Negócio
PACK_PRICE=57
WHATSAPP_NUMERO=5513991577711
SITE_URL=https://packphotosbr-nu.vercel.app
```

- [ ] **Step 4: Criar `.env.local` real** (cópia do exemplo com os valores reais)

Copie `.env.example` para `.env.local` e preencha com o `SUPABASE_*` e `MP_ACCESS_TOKEN` de teste reais. `.env.local` é ignorado pelo git (`*.local` no `.gitignore`). **Não commitar.**

- [ ] **Step 5: Rodar o schema SQL no Supabase**

No painel do Supabase → **SQL Editor**, rode primeiro o bloco de limpeza e depois o schema completo do resumo do projeto (tabelas `orders`, `order_status_log`, ENUM `order_status`, sequence, triggers e índices). Em seguida, rode o bloco de RLS abaixo:

```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_log ENABLE ROW LEVEL SECURITY;
-- Nenhuma policy criada de propósito: roles anon/authenticated ficam sem acesso.
-- O backend usa a service_role key, que ignora RLS.
```

Expected: `SELECT * FROM orders;` no SQL editor retorna vazio sem erro; a tabela existe.

- [ ] **Step 6: Commit (opcional — só se o repo for inicializado)**

```bash
git add package.json package-lock.json .env.example
git commit -m "chore: setup node serverless + deps"
```

---

## Task 1: Config e client do Supabase

**Files:**
- Create: `lib/config.js`
- Create: `lib/supabase.js`

- [ ] **Step 1: Criar `lib/config.js`**

```js
// Lê e valida as variáveis de ambiente uma vez. Lança erro claro se faltar.
function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`);
  return value;
}

export const config = {
  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  mpAccessToken: required('MP_ACCESS_TOKEN'),
  mpWebhookSecret: process.env.MP_WEBHOOK_SECRET || '',
  packPrice: Number(process.env.PACK_PRICE || '57'),
  whatsappNumero: process.env.WHATSAPP_NUMERO || '5513991577711',
  siteUrl: (process.env.SITE_URL || 'https://packphotosbr-nu.vercel.app').replace(/\/$/, ''),
};
```

- [ ] **Step 2: Criar `lib/supabase.js`**

```js
import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

// Client com service role: ignora RLS. Use SOMENTE no backend.
export const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
  auth: { persistSession: false },
});
```

- [ ] **Step 3: Commit (opcional)**

```bash
git add lib/config.js lib/supabase.js
git commit -m "feat: config e client supabase (service role)"
```

---

## Task 2: Validação dos dados do pedido (pura, testável)

**Files:**
- Create: `lib/validate-order.js`
- Test: `lib/validate-order.test.js`

- [ ] **Step 1: Escrever o teste que falha**

```js
// lib/validate-order.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateOrder } from './validate-order.js';

const valid = {
  name: 'Joao', store: 'Loja X', email: 'a@b.com', whatsapp: '13999999999',
  salePrice: '120,00', cta: 'Compre agora', creativeContact: '@loja', notes: '',
};

test('aceita um pedido válido e normaliza', () => {
  const { ok, data, errors } = validateOrder(valid);
  assert.equal(ok, true);
  assert.equal(errors.length, 0);
  assert.equal(data.client_name, 'Joao');
  assert.equal(data.store_name, 'Loja X');
});

test('rejeita email inválido', () => {
  const { ok, errors } = validateOrder({ ...valid, email: 'naoehemail' });
  assert.equal(ok, false);
  assert.ok(errors.includes('email'));
});

test('rejeita campos obrigatórios vazios', () => {
  const { ok, errors } = validateOrder({ ...valid, name: '', store: '' });
  assert.equal(ok, false);
  assert.ok(errors.includes('name'));
  assert.ok(errors.includes('store'));
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `node --test lib/validate-order.test.js`
Expected: FAIL — `Cannot find module './validate-order.js'`.

- [ ] **Step 3: Implementar `lib/validate-order.js`**

```js
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Recebe o corpo do formulário, devolve { ok, data, errors }.
// data já está no formato das colunas da tabela orders.
export function validateOrder(body = {}) {
  const errors = [];
  const str = (v) => (typeof v === 'string' ? v.trim() : '');

  const name = str(body.name);
  const store = str(body.store);
  const email = str(body.email);
  const whatsapp = str(body.whatsapp);
  const salePrice = str(body.salePrice);
  const cta = str(body.cta);
  const creativeContact = str(body.creativeContact);

  if (!name) errors.push('name');
  if (!store) errors.push('store');
  if (!email || !EMAIL_RE.test(email)) errors.push('email');
  if (!whatsapp) errors.push('whatsapp');
  if (!salePrice) errors.push('salePrice');
  if (!creativeContact) errors.push('creativeContact');

  const data = {
    client_name: name,
    store_name: store,
    email,
    whatsapp,
    instagram: str(body.instagram) || null,
    shirt_price: salePrice,
    creative_contact: creativeContact,
    cta_text: cta || null,
    notes: str(body.notes) || null,
  };

  return { ok: errors.length === 0, data, errors };
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `node --test lib/validate-order.test.js`
Expected: PASS — 3 testes ok.

- [ ] **Step 5: Commit (opcional)**

```bash
git add lib/validate-order.js lib/validate-order.test.js
git commit -m "feat: validação dos dados do pedido"
```

---

## Task 3: Link do WhatsApp pós-pagamento (puro, testável)

**Files:**
- Create: `lib/whatsapp.js`
- Test: `lib/whatsapp.test.js`

- [ ] **Step 1: Escrever o teste que falha**

```js
// lib/whatsapp.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWhatsappLink } from './whatsapp.js';

test('monta link com número do pedido e mensagem', () => {
  const link = buildWhatsappLink('5513991577711', 'PB-0001');
  assert.ok(link.startsWith('https://wa.me/5513991577711?text='));
  const text = decodeURIComponent(link.split('text=')[1]);
  assert.ok(text.includes('PB-0001'));
  assert.ok(text.toLowerCase().includes('paguei') || text.toLowerCase().includes('pagamento'));
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test lib/whatsapp.test.js`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar `lib/whatsapp.js`**

```js
// Função pura usada tanto no backend quanto (copiada) no front da página de sucesso.
export function buildWhatsappLink(numero, orderNumber) {
  const msg = `Olá! Efetuei o pagamento e estou aguardando o meu pack. Pedido ${orderNumber}.`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(msg)}`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test lib/whatsapp.test.js`
Expected: PASS.

- [ ] **Step 5: Commit (opcional)**

```bash
git add lib/whatsapp.js lib/whatsapp.test.js
git commit -m "feat: link whatsapp pós-pagamento"
```

---

## Task 4: Endpoint `/api/create-order`

**Files:**
- Create: `api/create-order.js`

- [ ] **Step 1: Implementar `api/create-order.js`**

```js
import { MercadoPagoConfig, Preference } from 'mercadopago';
import { config } from '../lib/config.js';
import { supabase } from '../lib/supabase.js';
import { validateOrder } from '../lib/validate-order.js';

const mp = new MercadoPagoConfig({ accessToken: config.mpAccessToken });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  // 1. Validar
  const { ok, data, errors } = validateOrder(req.body || {});
  if (!ok) {
    return res.status(400).json({ error: 'validation', fields: errors });
  }

  // 2. Gravar pedido (status default = aguardando_pagamento, número gerado por trigger)
  const amountCents = Math.round(config.packPrice * 100);
  const { data: order, error: dbError } = await supabase
    .from('orders')
    .insert({ ...data, amount_cents: amountCents })
    .select('id, order_number')
    .single();

  if (dbError) {
    console.error('Supabase insert error:', dbError);
    return res.status(500).json({ error: 'db_insert_failed' });
  }

  // 3. Criar preference no Mercado Pago
  try {
    const preference = await new Preference(mp).create({
      body: {
        items: [{
          id: order.order_number,
          title: `Pack Pronto da Camisa do Brasil — ${order.order_number}`,
          quantity: 1,
          unit_price: config.packPrice,
          currency_id: 'BRL',
        }],
        external_reference: order.id,
        payer: { email: data.email, name: data.client_name },
        back_urls: {
          success: `${config.siteUrl}/sucesso.html?order=${order.order_number}`,
          pending: `${config.siteUrl}/pendente.html?order=${order.order_number}`,
          failure: `${config.siteUrl}/erro.html?order=${order.order_number}`,
        },
        auto_return: 'approved',
        notification_url: `${config.siteUrl}/api/mp-webhook`,
      },
    });

    // Guardar o id da preference no pedido (rastreio)
    await supabase.from('orders').update({ payment_id: preference.id }).eq('id', order.id);

    return res.status(200).json({
      checkoutUrl: preference.init_point,
      orderNumber: order.order_number,
    });
  } catch (mpError) {
    console.error('Mercado Pago error:', mpError);
    // Pedido fica como aguardando_pagamento; cliente pode tentar de novo.
    return res.status(502).json({ error: 'payment_init_failed', orderNumber: order.order_number });
  }
}
```

- [ ] **Step 2: Verificação manual local com `vercel dev`**

Run (terminal 1): `vercel dev` (requer Vercel CLI: `npm i -g vercel` e `vercel link` na pasta uma vez; usa `.env.local`)
Run (terminal 2):
```bash
curl -X POST http://localhost:3000/api/create-order \
  -H "Content-Type: application/json" \
  -d '{"name":"Joao","store":"Loja X","email":"a@b.com","whatsapp":"13999999999","salePrice":"120,00","cta":"Compre","creativeContact":"@loja"}'
```
Expected: JSON `{ "checkoutUrl": "https://www.mercadopago.com.br/...", "orderNumber": "PB-0001" }`. No painel do Supabase, a tabela `orders` tem uma linha nova com status `aguardando_pagamento`.

- [ ] **Step 3: Commit (opcional)**

```bash
git add api/create-order.js
git commit -m "feat: endpoint create-order (supabase + mercado pago)"
```

---

## Task 5: Endpoint `/api/mp-webhook`

**Files:**
- Create: `api/mp-webhook.js`

- [ ] **Step 1: Implementar `api/mp-webhook.js`**

```js
import crypto from 'node:crypto';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { config } from '../lib/config.js';
import { supabase } from '../lib/supabase.js';

const mp = new MercadoPagoConfig({ accessToken: config.mpAccessToken });

// Valida a assinatura x-signature do Mercado Pago.
// Manifesto: id:<data.id>;request-id:<x-request-id>;ts:<ts>;
function isValidSignature(req, dataId) {
  if (!config.mpWebhookSecret) return true; // sem segredo configurado: pula (dev)
  const sig = req.headers['x-signature'] || '';
  const requestId = req.headers['x-request-id'] || '';
  const parts = Object.fromEntries(
    sig.split(',').map((p) => p.split('=').map((s) => s.trim())),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const hmac = crypto.createHmac('sha256', config.mpWebhookSecret).update(manifest).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(v1));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const body = req.body || {};
  const dataId = (body.data && body.data.id) || req.query['data.id'];
  const type = body.type || req.query.type;

  // Só tratamos notificações de pagamento
  if (type !== 'payment' || !dataId) return res.status(200).json({ ignored: true });

  if (!isValidSignature(req, dataId)) {
    console.warn('Webhook com assinatura inválida');
    return res.status(401).json({ error: 'invalid_signature' });
  }

  try {
    // Fonte da verdade: consultar o pagamento na API do MP
    const payment = await new Payment(mp).get({ id: dataId });
    const orderId = payment.external_reference;
    if (!orderId) return res.status(200).json({ ignored: 'no_external_reference' });

    if (payment.status === 'approved') {
      // Idempotente: só atualiza se ainda não estava confirmado
      const { data: current } = await supabase
        .from('orders').select('status').eq('id', orderId).single();
      if (current && current.status !== 'pagamento_confirmado') {
        await supabase.from('orders').update({
          status: 'pagamento_confirmado',
          paid_at: new Date().toISOString(),
          payment_id: String(payment.id),
          payment_method: payment.payment_method_id || null,
        }).eq('id', orderId);
      }
    } else if (payment.status === 'rejected') {
      await supabase.from('orders').update({ status: 'pagamento_recusado' }).eq('id', orderId);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: 'webhook_failed' });
  }
}
```

- [ ] **Step 2: Verificação manual (após deploy + pagamento de teste)**

A verificação real do webhook acontece na Task 8 (ponta a ponta), porque o Mercado Pago precisa de uma URL pública pra notificar. Smoke test local de que a rota responde:
```bash
curl -X POST http://localhost:3000/api/mp-webhook \
  -H "Content-Type: application/json" -d '{"type":"ping"}'
```
Expected: `{ "ignored": true }` com HTTP 200.

- [ ] **Step 3: Commit (opcional)**

```bash
git add api/mp-webhook.js
git commit -m "feat: webhook mercado pago confirma pagamento"
```

---

## Task 6: Frontend — submit do formulário

**Files:**
- Modify: `script.js:17-40` (bloco do formulário)

- [ ] **Step 1: Substituir o handler do form em `script.js`**

Trocar o bloco atual (linhas 17-40, que monta a mensagem e abre o WhatsApp) por:

```js
const form = document.getElementById('orderForm');
const statusEl = form.querySelector('.form-status');
const submitBtn = form.querySelector('[type="submit"]');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!form.reportValidity()) return;

  const d = new FormData(form);
  const payload = {
    name: d.get('name'), store: d.get('store'), email: d.get('email'),
    whatsapp: d.get('whatsapp'), instagram: d.get('instagram'),
    salePrice: d.get('salePrice'), cta: d.get('cta'),
    creativeContact: d.get('creativeContact'), notes: d.get('notes'),
  };

  submitBtn.disabled = true;
  statusEl.textContent = 'Criando seu pedido e abrindo o pagamento...';

  try {
    const resp = await fetch('/api/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await resp.json();
    if (!resp.ok || !result.checkoutUrl) {
      throw new Error(result.error || 'falha');
    }
    window.location.href = result.checkoutUrl;
  } catch (err) {
    statusEl.textContent = 'Não foi possível criar seu pedido. Tente novamente em instantes.';
    submitBtn.disabled = false;
  }
});
```

- [ ] **Step 2: Verificação manual**

Com `vercel dev` rodando, abra `http://localhost:3000`, preencha o form e envie.
Expected: a página redireciona para o checkout do Mercado Pago (sandbox).

- [ ] **Step 3: Commit (opcional)**

```bash
git add script.js
git commit -m "feat: form envia para /api/create-order e redireciona ao checkout"
```

---

## Task 7: Páginas de retorno (sucesso/pendente/erro)

**Files:**
- Create: `sucesso.html`
- Create: `pendente.html`
- Create: `erro.html`
- Create: `assets/checkout.js`

- [ ] **Step 1: Criar `assets/checkout.js`**

```js
// Lê ?order=PB-XXXX da URL e monta o link do WhatsApp na página de sucesso.
const NUMERO = '5513991577711'; // mesmo de WHATSAPP_NUMERO
const params = new URLSearchParams(location.search);
const order = params.get('order') || '';

const orderEl = document.getElementById('orderNumber');
if (orderEl) orderEl.textContent = order || '(seu pedido)';

const waBtn = document.getElementById('whatsappBtn');
if (waBtn) {
  const msg = `Olá! Efetuei o pagamento e estou aguardando o meu pack. Pedido ${order}.`;
  waBtn.href = `https://wa.me/${NUMERO}?text=${encodeURIComponent(msg)}`;
}
```

- [ ] **Step 2: Criar `sucesso.html`**

```html
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pagamento confirmado — Pack Brasil</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main style="max-width:560px;margin:10vh auto;padding:2rem;text-align:center">
    <h1>Pagamento confirmado! ✅</h1>
    <p>Seu pedido <strong id="orderNumber"></strong> foi recebido.</p>
    <p>Agora é só nos chamar no WhatsApp para finalizar a personalização do seu pack.</p>
    <a id="whatsappBtn" class="btn" href="#" target="_blank" rel="noopener noreferrer">
      Avisar no WhatsApp que paguei
    </a>
  </main>
  <script src="assets/checkout.js"></script>
</body>
</html>
```

- [ ] **Step 3: Criar `pendente.html`**

```html
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pagamento pendente — Pack Brasil</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main style="max-width:560px;margin:10vh auto;padding:2rem;text-align:center">
    <h1>Pagamento em processamento ⏳</h1>
    <p>Seu pedido <strong id="orderNumber"></strong> está aguardando a confirmação do pagamento
       (Pix pode levar alguns minutos). Assim que confirmar, você pode nos chamar no WhatsApp.</p>
    <a id="whatsappBtn" class="btn" href="#" target="_blank" rel="noopener noreferrer">
      Falar no WhatsApp
    </a>
  </main>
  <script src="assets/checkout.js"></script>
</body>
</html>
```

- [ ] **Step 4: Criar `erro.html`**

```html
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pagamento não concluído — Pack Brasil</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main style="max-width:560px;margin:10vh auto;padding:2rem;text-align:center">
    <h1>Pagamento não concluído</h1>
    <p>Não foi possível confirmar o pagamento do pedido <strong id="orderNumber"></strong>.</p>
    <p><a href="/">Voltar e tentar novamente</a></p>
  </main>
  <script src="assets/checkout.js"></script>
</body>
</html>
```

- [ ] **Step 5: Verificação manual**

Abra `http://localhost:3000/sucesso.html?order=PB-0001`.
Expected: mostra "PB-0001" e o botão do WhatsApp com a mensagem pronta (passar o mouse mostra o link `wa.me/5513991577711?text=...PB-0001`).

- [ ] **Step 6: Commit (opcional)**

```bash
git add sucesso.html pendente.html erro.html assets/checkout.js
git commit -m "feat: páginas de retorno do pagamento + link whatsapp"
```

---

## Task 8: Deploy na Vercel + teste ponta a ponta

**Files:**
- (nenhum arquivo novo; configuração na Vercel)

- [ ] **Step 1: Configurar variáveis de ambiente na Vercel**

No painel da Vercel → Project → Settings → Environment Variables, adicione (Production + Preview):
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MP_ACCESS_TOKEN` (teste), `PACK_PRICE=57`, `WHATSAPP_NUMERO=5513991577711`, `SITE_URL=https://packphotosbr-nu.vercel.app`. (`MP_WEBHOOK_SECRET` será adicionado no Step 3.)

- [ ] **Step 2: Deploy**

Run: `vercel --prod` (ou push para a branch conectada à Vercel).
Expected: build conclui; as funções `/api/create-order` e `/api/mp-webhook` aparecem como Serverless Functions no deploy.

- [ ] **Step 3: Configurar o webhook no Mercado Pago**

No painel do MP → sua aplicação → **Webhooks**, cadastre a URL `https://packphotosbr-nu.vercel.app/api/mp-webhook`, evento **Pagamentos**. Copie o **segredo** gerado e adicione na Vercel como `MP_WEBHOOK_SECRET`, depois rode `vercel --prod` de novo para aplicar.

- [ ] **Step 4: Teste ponta a ponta com cartão de teste**

Abra o site em produção, preencha o formulário, e no checkout use um **cartão de teste** do Mercado Pago (painel → Cartões de teste) com resultado **aprovado**.
Expected:
1. Redireciona para `sucesso.html?order=PB-XXXX` com botão do WhatsApp correto.
2. No Supabase, o pedido vai para `status = pagamento_confirmado` com `paid_at`, `payment_id` e `payment_method` preenchidos (o webhook rodou).
3. `order_status_log` registra a transição.

- [ ] **Step 5: Teste de recusa**

Repita usando um cartão de teste com resultado **recusado**.
Expected: redireciona para `erro.html`; pedido fica `pagamento_recusado` (ou permanece `aguardando_pagamento` se o pagamento nem foi criado).

- [ ] **Step 6: Trocar para produção (quando tudo validar)**

Substitua `MP_ACCESS_TOKEN` pelo de **produção** (`APP_USR-...`) na Vercel, atualize o webhook do MP para o ambiente de produção, e rode `vercel --prod`. Faça uma compra real de baixo valor de teste, se possível.

---

## Self-Review (preenchido pelo autor do plano)

- **Cobertura do spec:** form→Supabase (Task 4), checkout MP (Task 4), webhook confirma (Task 5), sucesso→WhatsApp (Task 7), RLS trancado (Task 0 Step 5), erros/validação (Tasks 2,4,6), testes (Tasks 2,3,8). ✔
- **Sem placeholders:** todo passo de código tem o código real. ✔
- **Consistência de tipos:** `validateOrder` devolve `{ ok, data, errors }` usado igual na Task 4; `data.email`/`data.client_name` batem com as colunas; `external_reference = order.id` (UUID) usado tanto no create quanto no webhook; `order_number` usado nas URLs e na página de sucesso. ✔
- **Número do WhatsApp** `5513991577711` consistente em `config.js`, `whatsapp.js` e `assets/checkout.js`. ✔
```
