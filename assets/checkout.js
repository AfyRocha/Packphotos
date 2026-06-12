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
