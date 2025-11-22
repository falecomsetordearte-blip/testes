function calcular() {
  // Obter os valores dos campos
  let largura = parseFloat(document.getElementById('largura').value);
  let altura = parseFloat(document.getElementById('altura').value);
  let valorMetro = parseFloat(document.getElementById('valor-metro').value);

  // Validar entradas
  if (isNaN(largura) || isNaN(altura) || isNaN(valorMetro) || largura <= 0 || altura <= 0 || valorMetro <= 0) {
    alert("Por favor, preencha todos os campos corretamente.");
    return;
  }

  // Calcular a área
  let area = largura * altura;

  // Calcular o custo
  let custo = area * valorMetro;

  // Exibir o resultado
  document.getElementById('resultado').innerHTML = `Área: ${area.toFixed(2)} m² <br> Custo total: R$ ${custo.toFixed(2)}`;
}
