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
