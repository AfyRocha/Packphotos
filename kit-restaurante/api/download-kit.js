import { supabase } from '../lib/supabase.js';

// Bucket PRIVADO no Supabase Storage onde o PDF do kit fica guardado.
const BUCKET = 'entregaveis';
const PDF_PATH = 'kiti-restaurante-lucrativo.pdf'; // nome do arquivo dentro do bucket
const DOWNLOAD_NAME = 'Kit-Restaurante-Lucrativo.pdf'; // nome que o cliente recebe
const SIGNED_URL_TTL = 120;                // segundos que o link fica válido

// Entrega protegida: só libera o PDF para quem realmente pagou.
// Recebe ?id=<uuid do pedido>, confere no banco se o status é
// 'pagamento_confirmado' e devolve um link temporário assinado.
export default async function handler(req, res) {
  const id = (req.query && req.query.id) || '';
  if (!id) return res.status(400).json({ error: 'missing_id' });

  // 1. Busca o pedido e confere o pagamento
  const { data: order, error } = await supabase
    .from('restaurant_orders')
    .select('status')
    .eq('id', id)
    .single();

  if (error || !order) return res.status(404).json({ error: 'order_not_found' });
  if (order.status !== 'pagamento_confirmado') {
    return res.status(403).json({ error: 'payment_not_confirmed' });
  }

  // 2. Gera link temporário assinado do PDF no bucket privado
  const { data: signed, error: signErr } = await supabase
    .storage.from(BUCKET)
    .createSignedUrl(PDF_PATH, SIGNED_URL_TTL, { download: DOWNLOAD_NAME });

  if (signErr || !signed) {
    console.error('Erro ao gerar signed URL:', signErr);
    return res.status(500).json({ error: 'storage_failed' });
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ url: signed.signedUrl });
}
