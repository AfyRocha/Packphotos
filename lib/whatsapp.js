// Função pura usada tanto no backend quanto (copiada) no front da página de sucesso.
export function buildWhatsappLink(numero, orderNumber) {
  const msg = `Olá! Efetuei o pagamento e estou aguardando o meu pack. Pedido ${orderNumber}.`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(msg)}`;
}
