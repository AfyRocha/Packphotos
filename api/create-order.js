import { MercadoPagoConfig, Payment } from 'mercadopago';
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

  // 3. Criar pagamento Pix na API do Mercado Pago
  try {
    const payment = await new Payment(mp).create({
      body: {
        transaction_amount: config.packPrice,
        description: `Pack Pronto da Camisa do Brasil — ${order.order_number}`,
        payment_method_id: 'pix',
        payer: {
          email: data.email,
          first_name: data.client_name,
        },
        external_reference: order.id,
        notification_url: `${config.siteUrl}/api/mp-webhook`,
      },
      requestOptions: { idempotencyKey: order.id },
    });

    const tx = (payment.point_of_interaction && payment.point_of_interaction.transaction_data) || {};

    // Guardar o id do pagamento no pedido (rastreio)
    await supabase
      .from('orders')
      .update({ payment_id: String(payment.id), payment_method: 'pix' })
      .eq('id', order.id);

    return res.status(200).json({
      orderId: order.id,
      orderNumber: order.order_number,
      amount: config.packPrice,
      qrCode: tx.qr_code || '',
      qrCodeBase64: tx.qr_code_base64 || '',
      ticketUrl: tx.ticket_url || '',
    });
  } catch (mpError) {
    console.error('Mercado Pago Pix error:', mpError);
    // Pedido fica como aguardando_pagamento; cliente pode tentar de novo.
    return res.status(502).json({ error: 'payment_init_failed', orderNumber: order.order_number });
  }
}
