// Função pura usada tanto no backend quanto (copiada) no front da página de sucesso.
export function buildWhatsappLink(numero, orderNumber) {
  const msg = `Olá! Efetuei o pagamento do Kit Restaurante Lucrativo e estou aguardando o material e o diagnóstico. Pedido ${orderNumber}.`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(msg)}`;
}
