import { supabase } from '../lib/supabase.js';

// Consultado pela página do Pix para saber se o pagamento já foi confirmado.
// Recebe ?id=<uuid do pedido> (não adivinhável) e devolve apenas o status.
export default async function handler(req, res) {
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: 'missing_id' });

  const { data, error } = await supabase
    .from('orders')
    .select('status')
    .eq('id', id)
    .single();

  if (error || !data) return res.status(404).json({ error: 'not_found' });
  return res.status(200).json({ status: data.status });
}
