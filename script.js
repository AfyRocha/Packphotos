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
  statusEl.textContent = 'Abrindo o pagamento via Pix...';

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
    statusEl.textContent = 'Não foi possível abrir o pagamento. Tente novamente em instantes.';
    submitBtn.disabled = false;
  }
});
