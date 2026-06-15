// Lê ?order=KR-XXXX da URL e monta o link do WhatsApp na página de status.
const NUMERO = '5513991577711'; // mesmo de WHATSAPP_NUMERO
const params = new URLSearchParams(location.search);
const order = params.get('order') || '';

const id = params.get('id') || '';

const orderEl = document.getElementById('orderNumber');
if (orderEl) orderEl.textContent = order || '(seu pedido)';

const waBtn = document.getElementById('whatsappBtn');
if (waBtn) {
  const msg = `Olá! Efetuei o pagamento do Kit Restaurante Lucrativo e quero ativar o meu diagnóstico gratuito. Pedido ${order}.`;
  waBtn.href = `https://wa.me/${NUMERO}?text=${encodeURIComponent(msg)}`;
}

// Download protegido: pede o link ao backend, que só libera se o pedido
// estiver pago. Mostra mensagens claras enquanto o pagamento processa.
const dlBtn = document.getElementById('downloadBtn');
const dlStatus = document.getElementById('downloadStatus');
const setStatus = (t) => { if (dlStatus) dlStatus.textContent = t; };

if (dlBtn) {
  if (!id) {
    dlBtn.style.display = 'none';
  } else {
    dlBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      dlBtn.textContent = 'Preparando seu download...';
      setStatus('');
      try {
        const r = await fetch(`/api/download-kit?id=${encodeURIComponent(id)}`);
        if (r.ok) {
          const { url } = await r.json();
          setStatus('Liberado! Iniciando o download...');
          location.href = url;
        } else if (r.status === 403) {
          setStatus('Seu pagamento Pix ainda está sendo confirmado. Aguarde cerca de 1 minuto e clique de novo.');
        } else if (r.status === 404) {
          setStatus('Pedido não encontrado. Chame a gente no WhatsApp que resolvemos.');
        } else {
          setStatus('Tivemos um problema ao liberar o arquivo. Chame no WhatsApp que enviamos na hora.');
        }
      } catch {
        setStatus('Falha de conexão. Tente novamente em instantes.');
      }
      dlBtn.textContent = '⬇️ Baixar meu Kit agora';
    });
  }
}
