const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Recebe o corpo do formulário, devolve { ok, data, errors }.
// data já está no formato das colunas da tabela orders.
export function validateOrder(body = {}) {
  const errors = [];
  const str = (v) => (typeof v === 'string' ? v.trim() : '');

  const name = str(body.name);
  const store = str(body.store);
  const email = str(body.email);
  const whatsapp = str(body.whatsapp);
  const salePrice = str(body.salePrice);
  const cta = str(body.cta);
  const creativeContact = str(body.creativeContact);

  if (!name) errors.push('name');
  if (!store) errors.push('store');
  if (!email || !EMAIL_RE.test(email)) errors.push('email');
  if (!whatsapp) errors.push('whatsapp');
  if (!salePrice) errors.push('salePrice');
  if (!creativeContact) errors.push('creativeContact');

  const data = {
    client_name: name,
    store_name: store,
    email,
    whatsapp,
    instagram: str(body.instagram) || null,
    shirt_price: salePrice,
    creative_contact: creativeContact,
    cta_text: cta || null,
    notes: str(body.notes) || null,
  };

  return { ok: errors.length === 0, data, errors };
}
