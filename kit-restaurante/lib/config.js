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
  kitPrice: Number(process.env.KIT_PRICE || '27'),
  whatsappNumero: process.env.WHATSAPP_NUMERO || '5513991577711',
  siteUrl: (process.env.SITE_URL || 'https://kit-restaurante-lucrativo.vercel.app').replace(/\/$/, ''),
};
