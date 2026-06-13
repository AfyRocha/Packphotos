const reveals = document.querySelectorAll('.reveal');
const io = new IntersectionObserver(entries => entries.forEach(e => { if(e.isIntersecting) e.target.classList.add('visible'); }), {threshold:.12});
reveals.forEach(el => io.observe(el));

const lb = document.querySelector('.lightbox');
const lbImg = lb.querySelector('img');
document.querySelectorAll('.gallery-item').forEach(btn => btn.addEventListener('click', () => {
  lbImg.src = btn.dataset.src;
  lb.classList.add('open');
  lb.setAttribute('aria-hidden','false');
}));
function closeLb(){lb.classList.remove('open');lb.setAttribute('aria-hidden','true')}
lb.querySelector('button').addEventListener('click', closeLb);
lb.addEventListener('click', e => { if(e.target===lb) closeLb(); });
document.addEventListener('keydown', e => { if(e.key==='Escape') closeLb(); });

const form = document.getElementById('orderForm');
const statusEl = form.querySelector('.form-status');
const submitBtn = form.querySelector('[type="submit"]');
const pixResult = document.getElementById('pixResult');
let pollTimer = null;

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
  statusEl.textContent = 'Gerando seu Pix...';

  try {
    const resp = await fetch('/api/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await resp.json();
    if (!resp.ok || !result.qrCodeBase64) {
      throw new Error(result.error || 'falha');
    }
    showPix(result);
  } catch (err) {
    statusEl.textContent = 'Não foi possível gerar o Pix. Tente novamente em instantes.';
    submitBtn.disabled = false;
  }
});

function showPix(r) {
  document.getElementById('pixOrder').textContent = r.orderNumber;
  document.getElementById('pixQr').src = 'data:image/png;base64,' + r.qrCodeBase64;
  document.getElementById('pixCode').value = r.qrCode;
  form.hidden = true;
  pixResult.hidden = false;
  pixResult.scrollIntoView({ behavior: 'smooth', block: 'center' });
  startPolling(r.orderId, r.orderNumber);
}

const pixCopyBtn = document.getElementById('pixCopy');
if (pixCopyBtn) {
  pixCopyBtn.addEventListener('click', () => {
    const code = document.getElementById('pixCode');
    code.select();
    if (navigator.clipboard) navigator.clipboard.writeText(code.value).catch(() => {});
    else document.execCommand('copy');
    pixCopyBtn.textContent = 'Copiado!';
    setTimeout(() => { pixCopyBtn.textContent = 'Copiar'; }, 2000);
  });
}

function startPolling(orderId, orderNumber) {
  const statusP = document.getElementById('pixStatus');
  pollTimer = setInterval(async () => {
    try {
      const r = await fetch('/api/order-status?id=' + encodeURIComponent(orderId));
      const j = await r.json();
      if (j.status === 'pagamento_confirmado') {
        clearInterval(pollTimer);
        statusP.textContent = 'Pagamento confirmado! Redirecionando...';
        window.location.href = 'sucesso.html?order=' + encodeURIComponent(orderNumber);
      } else if (j.status === 'pagamento_recusado') {
        clearInterval(pollTimer);
        statusP.textContent = 'Pagamento não aprovado. Recarregue a página para tentar de novo.';
      }
    } catch (e) { /* ignora e tenta de novo */ }
  }, 4000);
}
