const reveals = document.querySelectorAll('.reveal');
const io = new IntersectionObserver(entries => entries.forEach(e => { if(e.isIntersecting) e.target.classList.add('visible'); }), {threshold:.12});
reveals.forEach(el => io.observe(el));

const menuBtn = document.querySelector('.menu-btn');
const nav = document.querySelector('.nav');
if (menuBtn && nav) {
  menuBtn.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', String(open));
  });
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    nav.classList.remove('open');
    menuBtn.setAttribute('aria-expanded', 'false');
  }));
}

const form = document.getElementById('orderForm');
const statusEl = form.querySelector('.form-status');
const submitBtn = form.querySelector('[type="submit"]');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!form.reportValidity()) return;

  const d = new FormData(form);
  const payload = {
    name: d.get('name'), restaurantName: d.get('restaurantName'), city: d.get('city'),
    email: d.get('email'), whatsapp: d.get('whatsapp'), instagram: d.get('instagram'),
    operationType: d.get('operationType'), hasDigitalMenu: d.get('hasDigitalMenu'),
    hasInstagram: d.get('hasInstagram'),
    gmbLink: d.get('gmbLink'), googleReviews: d.get('googleReviews'), avgTicket: d.get('avgTicket'),
    notes: d.get('notes'),
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
