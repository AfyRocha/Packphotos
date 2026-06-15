import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateOrder } from './validate-order.js';

const valid = {
  name: 'Joao', restaurantName: 'Restaurante X', city: 'Santos', email: 'a@b.com',
  whatsapp: '13999999999', instagram: '@restaurante', operationType: 'Restaurante',
  hasDigitalMenu: 'Sim', hasInstagram: 'Sim', gmbLink: '', googleReviews: '12', avgTicket: '45,00', notes: '',
};

test('aceita um pedido válido e normaliza', () => {
  const { ok, data, errors } = validateOrder(valid);
  assert.equal(ok, true);
  assert.equal(errors.length, 0);
  assert.equal(data.client_name, 'Joao');
  assert.equal(data.restaurant_name, 'Restaurante X');
  assert.equal(data.city, 'Santos');
});

test('rejeita email inválido', () => {
  const { ok, errors } = validateOrder({ ...valid, email: 'naoehemail' });
  assert.equal(ok, false);
  assert.ok(errors.includes('email'));
});

test('rejeita campos obrigatórios vazios', () => {
  const { ok, errors } = validateOrder({ ...valid, name: '', restaurantName: '', city: '' });
  assert.equal(ok, false);
  assert.ok(errors.includes('name'));
  assert.ok(errors.includes('restaurantName'));
  assert.ok(errors.includes('city'));
});
