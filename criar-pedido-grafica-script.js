document.addEventListener('DOMContentLoaded', () => {
    // --- Seletores dos Elementos ---
    const servicoSelectionContainer = document.getElementById('servico-selection-container');
    const servicoCards = document.querySelectorAll('.servico-card');
    const servicoHiddenInput = document.getElementById('pedido-servico-hidden');
    const formContentWrapper = document.getElementById('form-content-wrapper');
    
    const pedidoArteContainer = document.getElementById('pedido-arte-container'); 
    const arquivoClienteFields = document.getElementById('arquivo-cliente-fields');
    const setorArteFields = document.getElementById('setor-arte-fields');
    
    const wppClienteInput = document.getElementById('cliente-final-wpp');
    const wppSupervisaoInput = document.getElementById('pedido-supervisao');
    const valorDesignerInput = document.getElementById('valor-designer');
    const valorDesignerAlerta = document.getElementById('valor-designer-alerta');
    const pedidoFormatoSelect = document.getElementById('pedido-formato');
    const cdrVersaoContainer = document.getElementById('cdr-versao-container');

    // --- SELEÇÃO DE SERVIÇO ---
    servicoCards.forEach(card => {
        card.addEventListener('click', () => {
            if (servicoSelectionContainer.classList.contains('selection-made')) { return; }
            servicoCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            servicoHiddenInput.value = card.dataset.value;
            servicoSelectionContainer.classList.add('selection-made');
            formContentWrapper.classList.add('visible');
        });
    });

    // --- Lógica Condicional para "Arte" ---
    pedidoArteContainer.addEventListener('change', (e) => {
        const selection = e.target.value;
        
        // Esconde tudo
        arquivoClienteFields.classList.add('hidden');
        setorArteFields.classList.add('hidden');
        
        // Limpa required
        document.querySelectorAll('#arquivo-cliente-fields input, #setor-arte-fields input, #setor-arte-fields select').forEach(input => input.required = false);
        
        if (selection === 'Arquivo do Cliente') {
            arquivoClienteFields.classList.remove('hidden');
            document.getElementById('link-arquivo').required = true; // Volta a exigir Link
            
        } else if (selection === 'Setor de Arte') {
            setorArteFields.classList.remove('hidden');
            document.getElementById('pedido-supervisao').required = true;
            document.getElementById('valor-designer').required = true;
            document.getElementById('pedido-formato').required = true;
        }
    });

    // --- Máscaras e Helpers ---
    if (typeof IMask !== 'undefined') {
        if (wppClienteInput) IMask(wppClienteInput, { mask: '(00) 00000-0000' });
        if (wppSupervisaoInput) IMask(wppSupervisaoInput, { mask: '(00) 00000-0000' });
    }
    valorDesignerInput.addEventListener('input', (e) => {
        const valor = parseFloat(e.target.value);
        if (valor > 0 && valor < 50) { valorDesignerAlerta.classList.remove('hidden'); } 
        else { valorDesignerAlerta.classList.add('hidden'); }
    });
    pedidoFormatoSelect.addEventListener('change', (e) => {
        const cdrVersaoInput = document.getElementById('cdr-versao');
        if (e.target.value === 'CDR') { cdrVersaoContainer.classList.remove('hidden'); cdrVersaoInput.required = true; } 
        else { cdrVersaoContainer.classList.add('hidden'); cdrVersaoInput.required = false; }
    });

    // --- Materiais ---
    const btnAddMaterial = document.getElementById('btn-add-material');
    const materiaisContainer = document.getElementById('materiais-container');
    if (btnAddMaterial && materiaisContainer) {
        btnAddMaterial.addEventListener('click', () => {
            const itemCount = materiaisContainer.querySelectorAll('.material-item').length;
            const newItemNumber = itemCount + 1;
            const newItemDiv = document.createElement('div');
            newItemDiv.classList.add('material-item');
            newItemDiv.innerHTML = `<label class="item-label">Item ${newItemNumber}</label><div class="form-group"><label for="material-descricao-${newItemNumber}">Descreva o Material</label><input type="text" id="material-descricao-${newItemNumber}" class="material-descricao" placeholder="Ex. Banner 60x100 3 unidades" required></div><div class="form-group"><label for="material-detalhes-${newItemNumber}">Como o cliente deseja a arte?</label><textarea id="material-detalhes-${newItemNumber}" class="material-detalhes" rows="3" required></textarea></div>`;
            materiaisContainer.appendChild(newItemDiv);
        });
    }

    // --- SUBMISSÃO (SEM UPLOAD, APENAS DADOS TEXTUAIS) ---
    const form = document.getElementById('novo-pedido-form');
    const feedbackDiv = document.getElementById('pedido-form-feedback');
    
    if (form && feedbackDiv) {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            
            const submitButton = form.querySelector("button[type='submit']");
            const originalBtnText = submitButton.textContent;
            submitButton.disabled = true;
            submitButton.textContent = "Criando Pedido...";
            feedbackDiv.classList.add('hidden');

            const arteSelecionadaNode = document.querySelector('input[name="pedido-arte"]:checked');
            const tipoEntregaNode = document.querySelector('input[name="tipo-entrega"]:checked');

            if (!servicoHiddenInput.value) {
                feedbackDiv.textContent = "Por favor, selecione um tipo de serviço para começar.";
                feedbackDiv.className = 'form-feedback error';
                feedbackDiv.classList.remove('hidden');
                submitButton.disabled = false;
                submitButton.textContent = originalBtnText;
                return;
            }

            let briefingFormatado = '';
            document.querySelectorAll('#materiais-container .material-item').forEach((item, index) => {
                const descricao = item.querySelector('.material-descricao').value;
                const detalhes = item.querySelector('.material-detalhes').value;
                briefingFormatado += `--- Item ${index + 1} ---\nMaterial: ${descricao}\nDetalhes da Arte: ${detalhes}\n\n`;
            });

            // Preparar Dados
            const pedidoData = {
                sessionToken: localStorage.getItem("sessionToken"),
                titulo: document.getElementById("pedido-id").value,
                servico: servicoHiddenInput.value,
                arte: arteSelecionadaNode ? arteSelecionadaNode.value : '',
                nomeCliente: document.getElementById("cliente-final-nome").value,
                wppCliente: document.getElementById("cliente-final-wpp").value,
                briefingFormatado: briefingFormatado.trim(),
                tipoEntrega: tipoEntregaNode ? tipoEntregaNode.value : ''
            };

            // Coletar campos específicos
            if (pedidoData.arte === 'Arquivo do Cliente') {
                // Pega URL direto
                pedidoData.linkArquivo = document.getElementById("link-arquivo").value;
            } 
            else if (pedidoData.arte === 'Setor de Arte') {
                pedidoData.supervisaoWpp = document.getElementById("pedido-supervisao").value;
                pedidoData.valorDesigner = document.getElementById("valor-designer").value;
                pedidoData.formato = document.getElementById("pedido-formato").value;
                if (pedidoData.formato === 'CDR') {
                    pedidoData.cdrVersao = document.getElementById("cdr-versao").value;
                }
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
                setTimeout(() => { window.location.href = '/painel.html'; }, 2000);

            } catch (error) {
                console.error(error);
                feedbackDiv.textContent = error.message;
                feedbackDiv.className = 'form-feedback error';
                submitButton.disabled = false;
                submitButton.textContent = originalBtnText;
            } finally {
                feedbackDiv.classList.remove('hidden');
            }
        });
    }
});