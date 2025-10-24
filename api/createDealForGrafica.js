document.addEventListener('DOMContentLoaded', () => {
    // --- Seletores dos Elementos ---
    const wppClienteInput = document.getElementById('cliente-final-wpp');
    const wppSupervisaoInput = document.getElementById('pedido-supervisao');
    const pedidoArteSelect = document.getElementById('pedido-arte');
    const arquivoClienteFields = document.getElementById('arquivo-cliente-fields');
    const setorArteFields = document.getElementById('setor-arte-fields');
    const valorDesignerInput = document.getElementById('valor-designer');
    const valorDesignerAlerta = document.getElementById('valor-designer-alerta');
    const pedidoFormatoSelect = document.getElementById('pedido-formato');
    const cdrVersaoContainer = document.getElementById('cdr-versao-container');

    // --- Máscaras de Input ---
    if (typeof IMask !== 'undefined') {
        if (wppClienteInput) IMask(wppClienteInput, { mask: '(00) 00000-0000' });
        if (wppSupervisaoInput) IMask(wppSupervisaoInput, { mask: '(00) 00000-0000' });
    }

    // --- Lógica de Exibição Condicional ---

    // 1. Lógica principal baseada no tipo de "Arte"
    pedidoArteSelect.addEventListener('change', (e) => {
        const selection = e.target.value;
        
        // Esconde todos os containers condicionais
        arquivoClienteFields.classList.add('hidden');
        setorArteFields.classList.add('hidden');
        
        // Remove 'required' de todos os inputs condicionais para não bloquear o submit
        document.querySelectorAll('#arquivo-cliente-fields input, #setor-arte-fields input, #setor-arte-fields select').forEach(input => input.required = false);

        if (selection === 'Arquivo do Cliente') {
            arquivoClienteFields.classList.remove('hidden');
            document.getElementById('link-arquivo').required = true;
        } else if (selection === 'Setor de Arte') {
            setorArteFields.classList.remove('hidden');
            // Torna os campos de "Setor de Arte" obrigatórios
            document.getElementById('pedido-servico').required = true;
            document.getElementById('pedido-supervisao').required = true;
            document.getElementById('valor-designer').required = true;
            document.getElementById('pedido-formato').required = true;
        }
    });

    // 2. Lógica para o alerta de valor do designer
    valorDesignerInput.addEventListener('input', (e) => {
        const valor = parseFloat(e.target.value);
        if (valor > 0 && valor < 50) {
            valorDesignerAlerta.classList.remove('hidden');
        } else {
            valorDesignerAlerta.classList.add('hidden');
        }
    });

    // 3. Lógica para exibir o campo de versão do CorelDRAW
    pedidoFormatoSelect.addEventListener('change', (e) => {
        const cdrVersaoInput = document.getElementById('cdr-versao');
        if (e.target.value === 'CDR') {
            cdrVersaoContainer.classList.remove('hidden');
            cdrVersaoInput.required = true;
        } else {
            cdrVersaoContainer.classList.add('hidden');
            cdrVersaoInput.required = false;
        }
    });
    
    // --- Lógica de Adicionar Materiais (Inalterada) ---
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
                <div class="form-group"><label for="material-descricao-${newItemNumber}">Descreva o Material</label><input type="text" id="material-descricao-${newItemNumber}" class="material-descricao" placeholder="Ex. Banner 60x100 3 unidades" required></div>
                <div class="form-group"><label for="material-detalhes-${newItemNumber}">Como o cliente deseja a arte?</label><textarea id="material-detalhes-${newItemNumber}" class="material-detalhes" rows="3" required></textarea></div>`;
            materiaisContainer.appendChild(newItemDiv);
        });
    }

    // --- Lógica de Submissão do Formulário (Atualizada) ---
    const form = document.getElementById('novo-pedido-form');
    const feedbackDiv = document.getElementById('pedido-form-feedback');
    if (form && feedbackDiv) {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const submitButton = form.querySelector("button[type='submit']");
            submitButton.disabled = true;
            submitButton.textContent = "Criando...";
            feedbackDiv.classList.add('hidden');

            // --- Formatação do Briefing e Coleta de Dados ---
            let briefingFormatado = '';
            document.querySelectorAll('#materiais-container .material-item').forEach((item, index) => {
                const descricao = item.querySelector('.material-descricao').value;
                const detalhes = item.querySelector('.material-detalhes').value;
                briefingFormatado += `--- Item ${index + 1} ---\nMaterial: ${descricao}\nDetalhes da Arte: ${detalhes}\n\n`;
            });

            const arteSelecionada = document.getElementById("pedido-arte").value;
            const pedidoData = {
                sessionToken: localStorage.getItem("sessionToken"),
                titulo: document.getElementById("pedido-id").value,
                arte: arteSelecionada,
                nomeCliente: document.getElementById("cliente-final-nome").value,
                wppCliente: document.getElementById("cliente-final-wpp").value,
                briefingFormatado: briefingFormatado.trim()
            };
            
            // Adiciona dados condicionais baseados na seleção de "Arte"
            if (arteSelecionada === 'Setor de Arte') {
                pedidoData.servico = document.getElementById("pedido-servico").value;
                pedidoData.supervisaoWpp = document.getElementById("pedido-supervisao").value;
                pedidoData.valorDesigner = document.getElementById("valor-designer").value;
                
                let formato = document.getElementById("pedido-formato").value;
                if (formato === 'CDR') {
                    const versao = document.getElementById("cdr-versao").value;
                    formato += ` (Versão: ${versao})`;
                }
                pedidoData.formato = formato;
                 // Adiciona formato ao briefing
                pedidoData.briefingFormatado += `\n\n--- Formato de Entrega ---\n${formato}`;

            } else if (arteSelecionada === 'Arquivo do Cliente') {
                pedidoData.linkArquivo = document.getElementById("link-arquivo").value;
            }

            try {
                const response = await fetch('/api/createDealForGrafica', {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(pedidoData)
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || "Erro ao criar pedido.");

                feedbackDiv.textContent = `Pedido #${data.dealId} criado com sucesso! Redirecionando...`;
                feedbackDiv.className = 'form-feedback success';
                
                setTimeout(() => {
                    window.location.href = '/painel.html';
                }, 2000);

            } catch (error) {
                feedbackDiv.textContent = error.message;
                feedbackDiv.className = 'form-feedback error';
                submitButton.disabled = false;
                submitButton.textContent = "Criar Pedido";
            } finally {
                feedbackDiv.classList.remove('hidden');
            }
        });
    }
});