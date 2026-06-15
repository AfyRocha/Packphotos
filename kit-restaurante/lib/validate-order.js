const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Recebe o corpo do formulário, devolve { ok, data, errors }.
// data já está no formato das colunas da tabela restaurant_orders.
export function validateOrder(body = {}) {
  const errors = [];
  const str = (v) => (typeof v === 'string' ? v.trim() : '');

  const name = str(body.name);
  const restaurantName = str(body.restaurantName);
  const city = str(body.city);
  const email = str(body.email);
  const whatsapp = str(body.whatsapp);
  const operationType = str(body.operationType);
  const hasDigitalMenu = str(body.hasDigitalMenu);
  const hasInstagram = str(body.hasInstagram);

  if (!name) errors.push('name');
  if (!restaurantName) errors.push('restaurantName');
  if (!city) errors.push('city');
  if (!email || !EMAIL_RE.test(email)) errors.push('email');
  if (!whatsapp) errors.push('whatsapp');
  if (!operationType) errors.push('operationType');
  if (!hasDigitalMenu) errors.push('hasDigitalMenu');
  if (!hasInstagram) errors.push('hasInstagram');

  const data = {
    client_name: name,
    restaurant_name: restaurantName,
    city,
    email,
    whatsapp,
    instagram: str(body.instagram) || null,
    has_instagram: hasInstagram,
    gmb_link: str(body.gmbLink) || null,
    operation_type: operationType,
    has_digital_menu: hasDigitalMenu,
    google_reviews: str(body.googleReviews) || null,
    avg_ticket: str(body.avgTicket) || null,
    notes: str(body.notes) || null,
  };

  return { ok: errors.length === 0, data, errors };
}
