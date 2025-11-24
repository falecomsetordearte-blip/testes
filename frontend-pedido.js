// --- ARQUIVO: frontend-pedido.js ---

document.addEventListener('DOMContentLoaded', function() {
    
    // --- 1. LÓGICA DE SELEÇÃO DE SERVIÇO (ANIMAÇÃO) ---
    const servicoCards = document.querySelectorAll('.servico-card');
    const selectionContainer = document.getElementById('servico-selection-container');
    const formWrapper = document.getElementById('form-content-wrapper');
    const hiddenInputServico = document.getElementById('pedido-servico-hidden');

    servicoCards.forEach(card => {
        card.addEventListener('click', function() {
            // Remove classe ativa de todos
            servicoCards.forEach(c => c.classList.remove('active'));
            
            // Adiciona classe ativa ao clicado
            this.classList.add('active');
            
            // Salva o valor no input hidden
            hiddenInputServico.value = this.getAttribute('data-value');

            // Aplica a animação de retração
            selectionContainer.classList.add('selection-made');

            // Mostra o restante do formulário
            formWrapper.classList.add('visible');
        });
    });

    // --- 2. MÁSCARAS (IMASK) ---
    const phoneMaskOptions = { mask: '(00) 00000-0000' };
    
    const inputsTelefone = [
        document.getElementById('cliente-final-wpp'),
        document.getElementById('pedido-supervisao')
    ];

    inputsTelefone.forEach(input => {
        if(input) IMask(input, phoneMaskOptions);
    });

    // --- 3. CONTROLE DE VISIBILIDADE (ARTE) ---
    const radioArte = document.querySelectorAll('input[name="pedido-arte"]');
    const divArquivoCliente = document.getElementById('arquivo-cliente-fields');
    const divSetorArte = document.getElementById('setor-arte-fields');
    const inputLink = document.getElementById('link-arquivo');

    radioArte.forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.value === 'Arquivo do Cliente') {
                divArquivoCliente.classList.remove('hidden');
                divSetorArte.classList.add('hidden');
                inputLink.required = true; // Torna link obrigatório
            } else if (this.value === 'Setor de Arte') {
                divArquivoCliente.classList.add('hidden');
                divSetorArte.classList.remove('hidden');
                inputLink.required = false;
            } else {
                // Designer Próprio
                divArquivoCliente.classList.add('hidden');
                divSetorArte.classList.add('hidden');
                inputLink.required = false;
            }
        });
    });

    // --- 4. CONTROLE DO CORELDRAW (CDR) ---
    const selectFormato = document.getElementById('pedido-formato');
    const divCdrVersao = document.getElementById('cdr-versao-container');

    if(selectFormato) {
        selectFormato.addEventListener('change', function() {
            if (this.value === 'CDR') {
                divCdrVersao.classList.remove('hidden');
            } else {
                divCdrVersao.classList.add('hidden');
            }
        });
    }

    // --- 5. ADICIONAR MATERIAIS DINAMICAMENTE ---
    const btnAddMaterial = document.getElementById('btn-add-material');
    const containerMateriais = document.getElementById('materiais-container');
    let materialCount = 1;

    if(btnAddMaterial) {
        btnAddMaterial.addEventListener('click', function() {
            materialCount++;
            
            const div = document.createElement('div');
            div.className = 'material-item';
            div.style.marginTop = '20px';
            div.style.paddingTop = '20px';
            div.style.borderTop = '1px dashed #ccc';
            
            div.innerHTML = `
                <label class="item-label">Item ${materialCount}</label>
                <div class="form-group">
                    <label>Descreva o Material</label>
                    <input type="text" class="material-descricao" placeholder="Ex. Banner 60x100 3 unidades" required>
                </div>
                <div class="form-group">
                    <label>Como o cliente deseja a arte?</label>
                    <textarea class="material-detalhes" rows="3" required></textarea>
                </div>
                <button type="button" class="btn btn-sm btn-danger remove-material" style="margin-top:5px;">Remover Item</button>
            `;

            containerMateriais.appendChild(div);

            // Adicionar evento para remover
            div.querySelector('.remove-material').addEventListener('click', function() {
                div.remove();
            });
        });
    }

    // --- 6. SUBMISSÃO DO FORMULÁRIO ---
    const form = document.getElementById('novo-pedido-form');
    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        // Coleta dados simples
        const formData = {
            titulo: `Pedido - ${document.getElementById('cliente-final-nome').value}`,
            nomeCliente: document.getElementById('cliente-final-nome').value,
            wppCliente: document.getElementById('cliente-final-wpp').value,
            servico: hiddenInputServico.value,
            arte: document.querySelector('input[name="pedido-arte"]:checked').value,
            tipoEntrega: document.querySelector('input[name="tipo-entrega"]:checked').value,
            // Pegar sessão de algum lugar (ex: localStorage)
            sessionToken: localStorage.getItem('user_session_token') || 'TOKEN_DE_TESTE', 
        };

        // Dados condicionais
        if (formData.arte === 'Arquivo do Cliente') {
            formData.linkArquivo = document.getElementById('link-arquivo').value;
        } else if (formData.arte === 'Setor de Arte') {
            formData.supervisaoWpp = document.getElementById('pedido-supervisao').value;
            formData.valorDesigner = document.getElementById('valor-designer').value;
            formData.formato = document.getElementById('pedido-formato').value;
            if(formData.formato === 'CDR') {
                formData.cdrVersao = document.getElementById('cdr-versao').value;
            }
        }

        // Formatar Briefing (Materiais)
        let briefingTexto = "";
        const descricoes = document.querySelectorAll('.material-descricao');
        const detalhes = document.querySelectorAll('.material-detalhes');
        
        descricoes.forEach((desc, index) => {
            briefingTexto += `ITEM ${index + 1}: ${desc.value}\nDETALHES: ${detalhes[index].value}\n\n`;
        });
        formData.briefingFormatado = briefingTexto;

        console.log("Enviando dados:", formData);

        // Exemplo de envio para o seu Backend Node.js
        try {
            const response = await fetch('/api/createDealForGrafica', { // Ajuste a URL conforme sua rota real
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const result = await response.json();
            if(response.ok) {
                alert('Pedido criado com sucesso! ID: ' + result.dealId);
                window.location.reload();
            } else {
                alert('Erro: ' + result.message);
            }
        } catch (error) {
            console.error(error);
            alert('Erro ao comunicar com o servidor.');
        }
    });
});