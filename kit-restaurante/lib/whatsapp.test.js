import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWhatsappLink } from './whatsapp.js';

test('monta link com número do pedido e mensagem', () => {
  const link = buildWhatsappLink('5513991577711', 'KR-0001');
  assert.ok(link.startsWith('https://wa.me/5513991577711?text='));
  const text = decodeURIComponent(link.split('text=')[1]);
  assert.ok(text.includes('KR-0001'));
  assert.ok(text.toLowerCase().includes('paguei') || text.toLowerCase().includes('pagamento'));
});
