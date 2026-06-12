const revealElements = document.querySelectorAll('.reveal');
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add('visible');
    });
  },
  { threshold: 0.12 }
);
revealElements.forEach((element) => revealObserver.observe(element));

const lightbox = document.getElementById('lightbox');
const lightboxImage = lightbox.querySelector('img');
const lightboxClose = lightbox.querySelector('.lightbox-close');

document.querySelectorAll('[data-lightbox]').forEach((button) => {
  button.addEventListener('click', () => {
    lightboxImage.src = button.dataset.lightbox;
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
  });
});

function closeLightbox() {
  lightbox.classList.remove('open');
  lightbox.setAttribute('aria-hidden', 'true');
  lightboxImage.src = '';
}

lightboxClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (event) => {
  if (event.target === lightbox) closeLightbox();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeLightbox();
});

const priceInput = document.getElementById('jerseyPrice');
priceInput.addEventListener('input', () => {
  const digits = priceInput.value.replace(/\D/g, '');
  if (!digits) {
    priceInput.value = '';
    return;
  }
  const value = Number(digits) / 100;
  priceInput.value = value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
});

const orderForm = document.getElementById('orderForm');
const formStatus = document.getElementById('formStatus');

orderForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!orderForm.reportValidity()) return;

  const data = new FormData(orderForm);
  const message = [
    'Olá! Quero comprar o Pack Pronto da Camisa do Brasil.',
    '',
    `Responsável: ${data.get('customerName')}`,
    `Loja: ${data.get('storeName')}`,
    `E-mail: ${data.get('email')}`,
    `WhatsApp: ${data.get('whatsapp')}`,
    `Instagram: ${data.get('instagram') || 'Não informado'}`,
    `Preço da camiseta: ${data.get('jerseyPrice')}`,
    `CTA do criativo: ${data.get('cta')}`,
    `Contato no criativo: ${data.get('creativeContact')}`,
    `Observações: ${data.get('notes') || 'Nenhuma'}`,
    '',
    'Produto: Pack Pronto da Camisa do Brasil',
    'Valor do pack: R$ 57,00'
  ].join('\n');

  const whatsappNumber = '5511999999999'; // TROQUE PELO SEU NÚMERO COM DDI + DDD
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

  formStatus.textContent = 'Abrindo o WhatsApp para finalizar seu pedido...';
  window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
});
