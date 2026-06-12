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
