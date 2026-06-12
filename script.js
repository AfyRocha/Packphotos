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
form.addEventListener('submit', e => {
  e.preventDefault();
  if(!form.reportValidity()) return;
  const d = new FormData(form);
  const message = [
    'Olá! Quero comprar o Pack Pronto da Camisa do Brasil.',
    '',
    `Responsável: ${d.get('name')}`,
    `Loja: ${d.get('store')}`,
    `E-mail: ${d.get('email')}`,
    `WhatsApp: ${d.get('whatsapp')}`,
    `Instagram: ${d.get('instagram') || 'Não informado'}`,
    `Preço da camiseta: ${d.get('salePrice')}`,
    `CTA do criativo: ${d.get('cta')}`,
    `Contato no criativo: ${d.get('creativeContact')}`,
    `Observações: ${d.get('notes') || 'Nenhuma'}`
  ].join('\n');
  const whatsappNumber = '5511999999999'; // TROQUE PELO SEU NÚMERO
  const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
  statusEl.textContent = 'Abrindo o WhatsApp para finalizar seu pedido...';
  window.open(url, '_blank', 'noopener,noreferrer');
});
