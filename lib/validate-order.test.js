import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateOrder } from './validate-order.js';

const valid = {
  name: 'Joao', store: 'Loja X', email: 'a@b.com', whatsapp: '13999999999',
  salePrice: '120,00', cta: 'Compre agora', creativeContact: '@loja', notes: '',
};

test('aceita um pedido válido e normaliza', () => {
  const { ok, data, errors } = validateOrder(valid);
  assert.equal(ok, true);
  assert.equal(errors.length, 0);
  assert.equal(data.client_name, 'Joao');
  assert.equal(data.store_name, 'Loja X');
});

test('rejeita email inválido', () => {
  const { ok, errors } = validateOrder({ ...valid, email: 'naoehemail' });
  assert.equal(ok, false);
  assert.ok(errors.includes('email'));
});

test('rejeita campos obrigatórios vazios', () => {
  const { ok, errors } = validateOrder({ ...valid, name: '', store: '' });
  assert.equal(ok, false);
  assert.ok(errors.includes('name'));
  assert.ok(errors.includes('store'));
});
