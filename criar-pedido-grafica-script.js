document.addEventListener('DOMContentLoaded', () => {
    // Máscaras para os campos de WhatsApp
    const wppGraficaInput = document.getElementById('grafica-wpp');
    const wppClienteInput = document.getElementById('cliente-final-wpp');
    if (typeof IMask !== 'undefined') {
        if (wppGraficaInput) IMask(wppGraficaInput, { mask: '(00) 00000-0000' });
        if (wppClienteInput) IMask(wppClienteInput, { mask: '(00) 00000-0000' });
    }

    // Lógica para adicionar mais materiais
    const btnAddMaterial = document.getElementById('btn-add-material');
    const materiaisContainer = document.getElementById('materiais-container');
    if (btnAddMaterial && materiaisContainer) {
        btnAddMaterial.addEventListener('click', () => {
            const itemCount = materiaisContainer.querySelectorAll('.material-item').length;
            const newItemNumber = itemCount + 1;
            const newItemDiv = document.createElement('div');
            newItemDiv.classList.add('material-item');
            newItemDiv.innerHTML = `
                <label class="item-label">Item ${newItemNumber}</label>
                <div class="form-group"><label for="material-descricao-${newItemNumber}">Descreva o Material</label><input type="text" id="material-descricao-${newItemNumber}" class="material-descricao" required></div>
                <div class="form-group"><label for="material-detalhes-${newItemNumber}">Como o cliente deseja a arte?</label><textarea id="material-detalhes-${newItemNumber}" class="material-detalhes" rows="3" required></textarea></div>`;
            materiaisContainer.appendChild(newItemDiv);
        });
    }

    // Lógica de submissão do formulário
    const form = document.getElementById('novo-pedido-form');
    const feedbackDiv = document.getElementById('pedido-form-feedback');
    if (form && feedbackDiv) {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const submitButton = form.querySelector("button[type='submit']");
            submitButton.disabled = true;
            submitButton.textContent = "Criando...";
            feedbackDiv.classList.add('hidden');

            // Formata o briefing
            let briefingFormatado = '';
            document.querySelectorAll('#materiais-container .material-item').forEach((item, index) => {
                const descricao = item.querySelector('.material-descricao').value;
                const detalhes = item.querySelector('.material-detalhes').value;
                briefingFormatado += `--- Item ${index + 1} ---\nMaterial: ${descricao}\nDetalhes da Arte: ${detalhes}\n\n`;
            });
            briefingFormatado += `--- Formato de Entrega ---\n${document.getElementById("pedido-formato").value}`;

            // Coleta todos os dados para enviar
            const pedidoData = {
                sessionToken: localStorage.getItem("sessionToken"),
                titulo: document.getElementById("pedido-titulo").value,
                valorDesigner: document.getElementById("valor-designer").value,
                servico: document.getElementById("pedido-servico").value, // <-- NOVO CAMPO ADICIONADO
                graficaWpp: document.getElementById("grafica-wpp").value,
                nomeCliente: document.getElementById("cliente-final-nome").value,
                wppCliente: document.getElementById("cliente-final-wpp").value,
                briefingFormatado: briefingFormatado
            };

            try {
                // Chama a NOVA função da API
                const response = await fetch('/api/createDealForGrafica', {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(pedidoData)
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || "Erro ao criar pedido.");

                feedbackDiv.textContent = `Pedido #${data.dealId} criado com sucesso! Redirecionando...`;
                feedbackDiv.className = 'form-feedback success';
                feedbackDiv.classList.remove('hidden');
                
                setTimeout(() => {
                    window.location.href = '/painel.html'; // Redireciona para o painel principal
                }, 2000);

            } catch (error) {
                feedbackDiv.textContent = error.message;
                feedbackDiv.className = 'form-feedback error';
                feedbackDiv.classList.remove('hidden');
                submitButton.disabled = false;
                submitButton.textContent = "Criar Pedido";
            }
        });
    }
});
