// /acabamento/acabamento-script.js
(function() {
    document.addEventListener('DOMContentLoaded', () => {
        
        // --- CONSTANTES DE CONFIGURAÇÃO ---
        const NOME_CLIENTE_FIELD = 'UF_CRM_1741273407628';
        const CONTATO_CLIENTE_FIELD = 'UF_CRM_1749481565243';
        const MEDIDAS_FIELD = 'UF_CRM_1727464924690';
        const PRAZO_FINAL_FIELD = 'UF_CRM_1757794109';

        const MEDIDAS_MAP = {
            '1437': { nome: 'Conferir', cor: '#e74c3c' },
            '1439': { nome: 'Cliente', cor: '#f1c40f' },
            '1441': { nome: 'Conferida', cor: '#2ecc71' }
        };

        const impressoraFilterEl = document.getElementById('impressora-filter');
        const materialFilterEl = document.getElementById('material-filter');
        const btnFiltrar = document.getElementById('btn-filtrar');
        const board = document.querySelector('.kanban-board');
        const modal = document.getElementById('modal-detalhes-rapidos');
        const modalTitle = document.getElementById('modal-titulo');
        const modalBody = document.getElementById('modal-body-content');
        const closeModalBtn = modal.querySelector('.close-modal');

        let allDealsData = [];

        const style = document.createElement('style');
        style.textContent = `
            #modal-detalhes-rapidos.modal-overlay,
            #modal-detalhes-rapidos .modal-content {
                transition: none !important;
            }
            .card-client-name { font-size: 0.9em; color: #555; margin-top: 5px; }
            .info-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--borda); }
            .info-item:last-child { border-bottom: none; }
            .info-item-label { font-weight: 600; }
            .tag-medidas { padding: 4px 10px; border-radius: 4px; color: white; font-weight: 600; font-size: 12px; }
            .modal-actions-container { display: flex; flex-direction: column; gap: 10px; }
            .modal-actions-container .btn-acao-modal { display: block; text-decoration: none; text-align: center; padding: 10px; border-radius: 6px; font-weight: 600; transition: background-color 0.2s, color 0.2s; border: 1px solid transparent; cursor: pointer; }
            .modal-actions-container .btn-acao-modal.principal { background-color: var(--sucesso); color: white; }
            .modal-actions-container .btn-acao-modal.principal:hover { background-color: #27ae60; }
            .modal-actions-container .btn-acao-modal.secundario { background-color: #f1f1f1; border-color: #ddd; color: var(--texto-escuro); }
            .modal-actions-container .btn-acao-modal.secundario:hover { background-color: #e9e9e9; }
        `;
        document.head.appendChild(style);

        async function carregarOpcoesDeFiltro() {
            try {
                const response = await fetch('/api/getProductionFilters');
                const filters = await response.json();
                if (!response.ok) throw new Error('Falha ao carregar filtros.');
                filters.impressoras.forEach(option => { impressoraFilterEl.innerHTML += `<option value="${option.id}">${option.value}</option>`; });
                filters.materiais.forEach(option => { materialFilterEl.innerHTML += `<option value="${option.id}">${option.value}</option>`; });
            } catch (error) { console.error("Erro ao carregar opções de filtro:", error); }
        }

        async function carregarPedidosDeAcabamento() {
            document.querySelectorAll('.column-cards').forEach(col => col.innerHTML = '<div class="loading-pedidos"><div class="spinner"></div></div>');
            try {
                const response = await fetch('/api/acabamento/getDeals', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ impressoraFilter: impressoraFilterEl.value, materialFilter: materialFilterEl.value })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);
                allDealsData = data.deals;
                organizarPedidosNasColunas(allDealsData);
            } catch (error) {
                console.error("Erro ao carregar pedidos de acabamento:", error);
                board.innerHTML = `<p style="color:red; padding: 20px;">${error.message}</p>`;
            }
        }

        function organizarPedidosNasColunas(deals) {
            document.querySelectorAll('.column-cards').forEach(col => col.innerHTML = '');
            const agora = new Date();
            deals.forEach(deal => {
                let colunaId = 'SEM_DATA';
                const prazoFinalStr = deal[PRAZO_FINAL_FIELD];
                if (prazoFinalStr) {
                    const prazoFinal = new Date(prazoFinalStr);
                    if (!isNaN(prazoFinal.getTime())) {
                        const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
                        const prazoData = new Date(prazoFinal.getFullYear(), prazoFinal.getMonth(), prazoFinal.getDate());
                        const diffDays = Math.ceil((prazoData - hoje) / (1000 * 60 * 60 * 24));
                        if (diffDays < 0) { colunaId = 'ATRASADO'; } 
                        else if (diffDays === 0) { colunaId = 'HOJE'; } 
                        else if (diffDays <= 7) { colunaId = 'ESSA_SEMANA'; } 
                        else if (diffDays <= 14) { colunaId = 'PROXIMA_SEMANA'; }
                    }
                }
                const cardHtml = createCardHtml(deal);
                const coluna = document.getElementById(`cards-${colunaId}`);
                if (coluna) { coluna.innerHTML += cardHtml; }
            });
            document.querySelectorAll('.column-cards').forEach(col => {
                if (col.innerHTML === '') col.innerHTML = '<p class="info-text">Nenhum pedido aqui.</p>';
            });
        }

        function createCardHtml(deal) {
            const nomeCliente = deal[NOME_CLIENTE_FIELD] || 'Cliente não informado';
            return `
                <div class="kanban-card" data-deal-id-card="${deal.ID}">
                    <div class="card-title">#${deal.ID} - ${deal.TITLE}</div>
                    <div class="card-client-name">${nomeCliente}</div>
                    <div class="card-actions" style="margin-top: 15px; display: flex; gap: 10px;">
                        <button class="btn-acao" data-action="open-details-modal" data-deal-id="${deal.ID}">Detalhes</button>
                    </div>
                </div>
            `;
        }
        
        function openDetailsModal(dealId) {
            const deal = allDealsData.find(d => d.ID == dealId);
            if (!deal) return;
            
            modalTitle.textContent = `Detalhes do Pedido #${deal.ID} - ${deal.TITLE}`;
            
            const nomeCliente = deal[NOME_CLIENTE_FIELD] || '---';
            const contatoCliente = deal[CONTATO_CLIENTE_FIELD] || '---';
            const medidasId = deal[MEDIDAS_FIELD];
            const medidaInfo = MEDIDAS_MAP[medidasId];
            let medidasHtml = '---';
            if (medidaInfo) { medidasHtml = `<span class="tag-medidas" style="background-color: ${medidaInfo.cor};">${medidaInfo.nome}</span>`; }

            let actionsHtml = '';
            if (deal.TITLE) {
                const urlVerPedido = `https://www.visiva.com.br/admin/?imprimastore=pedidos/detalhes&id=${encodeURIComponent(deal.TITLE)}`;
                actionsHtml += `<a href="${urlVerPedido}" target="_blank" class="btn-acao-modal secundario">Ver Pedido</a>`;
            }
            // Adiciona o novo botão "Concluir"
            actionsHtml += `<button class="btn-acao-modal principal" data-action="concluir-deal">Concluir</button>`;

            modalBody.innerHTML = `
                <div class="detalhe-layout">
                    <div class="detalhe-col-principal">
                        <div class="card-detalhe">
                             <h3>Informações do Pedido</h3>
                             <div class="info-item"><span class="info-item-label">Nome:</span><span>${nomeCliente}</span></div>
                             <div class="info-item"><span class="info-item-label">Contato:</span><span>${contatoCliente}</span></div>
                             <div class="info-item"><span class="info-item-label">Medidas:</span>${medidasHtml}</div>
                        </div>
                    </div>
                    <div class="detalhe-col-lateral">
                        <div class="card-detalhe modal-actions-container">
                            ${actionsHtml}
                        </div>
                    </div>
                </div>
            `;
            
            modal.classList.add('active');
            attachConcluirListener(deal.ID); // Anexa o listener para o novo botão
        }
        
        function attachConcluirListener(dealId) {
            const concluirBtn = modalBody.querySelector('button[data-action="concluir-deal"]');
            if (!concluirBtn) return;

            concluirBtn.addEventListener('click', async () => {
                if (!confirm('Tem certeza que deseja concluir este pedido?')) return;
                
                concluirBtn.disabled = true;
                concluirBtn.textContent = 'Concluindo...';

                try {
                    const response = await fetch('/api/acabamento/concluirDeal', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ dealId })
                    });

                    if (!response.ok) {
                        const data = await response.json();
                        throw new Error(data.message || 'Falha ao concluir o pedido.');
                    }
                    
                    alert('Pedido concluído com sucesso!');
                    modal.classList.remove('active');
                    carregarPedidosDeAcabamento(); // Atualiza o painel para remover o card

                } catch (error) {
                    alert(`Erro: ${error.message}`);
                    concluirBtn.disabled = false;
                    concluirBtn.textContent = 'Concluir';
                }
            });
        }
        
        btnFiltrar.addEventListener('click', carregarPedidosDeAcabamento);
        closeModalBtn.addEventListener('click', () => modal.classList.remove('active'));
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });
        board.addEventListener('click', (event) => {
            const button = event.target.closest('button[data-action="open-details-modal"]');
            if (button) openDetailsModal(button.dataset.dealId);
        });
        
        async function init() {
            await carregarOpcoesDeFiltro();
            await carregarPedidosDeAcabamento();
        }
        init();
    });
})();