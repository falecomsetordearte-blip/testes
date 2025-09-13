// /impressao/painel-script.js
(function() {
    document.addEventListener('DOMContentLoaded', () => {
        
        // --- CONSTANTES DE CONFIGURAÇÃO (AGORA USANDO OS IDs REAIS) ---
        const STATUS_IMPRESSAO_FIELD = 'UF_CRM_1757756651931';
        
        // O mapa agora usa os IDs dos status como chaves.
        const STATUS_MAP = {
            '2657': { nome: 'Preparação', cor: '#d4edda', classe: 'preparacao' },
            '2659': { nome: 'Na Fila', cor: '#e6d7ff', classe: 'na-fila' },
            '2661': { nome: 'Imprimindo', cor: '#f8d7da', classe: 'imprimindo' },
            '2663': { nome: 'Pronto', cor: '#a3d9a5', classe: 'pronto' }
        };

        const sessionToken = localStorage.getItem('sessionToken');
        if (!sessionToken) { window.location.href = '../login.html'; return; }

        const impressoraFilterEl = document.getElementById('impressora-filter');
        const materialFilterEl = document.getElementById('material-filter');
        const btnFiltrar = document.getElementById('btn-filtrar');
        const board = document.querySelector('.kanban-board');
        const modal = document.getElementById('modal-detalhes-rapidos');
        const modalTitle = document.getElementById('modal-titulo');
        const modalBody = document.getElementById('modal-body-content');
        const closeModalBtn = modal.querySelector('.close-modal');

        let allDealsData = [];

        // Adiciona os estilos dinâmicos (CSS permanece o mesmo)
        const style = document.createElement('style');
        style.textContent = `
            .status-impressao-container { display: flex; gap: 10px; margin-top: 15px; }
            .status-impressao-btn { flex: 1; padding: 10px; border: 2px solid transparent; border-radius: 6px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; }
            .status-impressao-btn.active.preparacao { background-color: #d4edda; border-color: #28a745; }
            .status-impressao-btn.active.na-fila { background-color: #e6d7ff; border-color: #6b46c1; }
            .status-impressao-btn.active.imprimindo { background-color: #f8d7da; border-color: #dc3545; }
            .status-impressao-btn.active.pronto { background-color: #a3d9a5; border-color: #1e7e34; }
            .kanban-card.status-preparacao { border-left-color: #28a745 !important; }
            .kanban-card.status-na-fila { border-left-color: #6b46c1 !important; }
            .kanban-card.status-imprimindo { border-left-color: #dc3545 !important; }
            .kanban-card.status-pronto { border-left-color: #1e7e34 !important; }
        `;
        document.head.appendChild(style);


        async function carregarOpcoesDeFiltro() {
            try {
                const response = await fetch('/api/getProductionFilters');
                const filters = await response.json();
                if (!response.ok) throw new Error('Falha ao carregar filtros.');

                filters.impressoras.forEach(option => {
                    impressoraFilterEl.innerHTML += `<option value="${option.id}">${option.value}</option>`;
                });
                filters.materiais.forEach(option => {
                    materialFilterEl.innerHTML += `<option value="${option.id}">${option.value}</option>`;
                });
            } catch (error) { console.error("Erro ao carregar opções de filtro:", error); }
        }

        async function carregarPedidosDeImpressao() {
            document.querySelectorAll('.column-cards').forEach(col => col.innerHTML = '<div class="loading-pedidos"><div class="spinner"></div></div>');
            
            try {
                const response = await fetch('/api/impressao/getDeals', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        impressoraFilter: impressoraFilterEl.value,
                        materialFilter: materialFilterEl.value
                    })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);

                allDealsData = data.deals;
                organizarPedidosNasColunas(allDealsData);

            } catch (error) {
                console.error("Erro ao carregar pedidos de impressão:", error);
                board.innerHTML = `<p style="color:red; padding: 20px;">${error.message}</p>`;
            }
        }

        function organizarPedidosNasColunas(deals) {
            document.querySelectorAll('.column-cards').forEach(col => col.innerHTML = '');
            const agora = new Date();
            
            deals.forEach(deal => {
                let colunaId = 'SEM_DATA';
                const prazoEmMinutos = parseInt(deal.UF_CRM_17577566402085, 10);
                
                if (!isNaN(prazoEmMinutos)) {
                    const dataCriacao = new Date(deal.DATE_CREATE);
                    const prazoFinal = new Date(dataCriacao.getTime() + prazoEmMinutos * 60000);
                    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
                    const prazoData = new Date(prazoFinal.getFullYear(), prazoFinal.getMonth(), prazoFinal.getDate());
                    const diffDays = Math.ceil((prazoData - hoje) / (1000 * 60 * 60 * 24));

                    if (diffDays < 0) colunaId = 'ATRASADO';
                    else if (diffDays === 0) colunaId = 'HOJE';
                    else if (diffDays <= 7) colunaId = 'ESSA_SEMANA';
                    else if (diffDays <= 14) colunaId = 'PROXIMA_SEMANA';
                }
                
                const cardHtml = createCardHtml(deal);
                const coluna = document.getElementById(`cards-${colunaId}`);
                if (coluna) coluna.innerHTML += cardHtml;
            });

            document.querySelectorAll('.column-cards').forEach(col => {
                if (col.innerHTML === '') col.innerHTML = '<p class="info-text">Nenhum pedido aqui.</p>';
            });
        }

        function createCardHtml(deal) {
            const linkVerPedido = deal.UF_CRM_1741349861326;
            const statusId = deal[STATUS_IMPRESSAO_FIELD]; // Agora é o ID numérico
            const statusInfo = STATUS_MAP[statusId] || {};
            
            return `
                <div class="kanban-card ${statusInfo.classe ? 'status-' + statusInfo.classe : ''}" data-deal-id-card="${deal.ID}">
                    <div class="card-title">#${deal.ID} - ${deal.TITLE}</div>
                    <div class="card-actions" style="margin-top: 15px; display: flex; gap: 10px;">
                        ${linkVerPedido ? `<a href="${linkVerPedido}" target="_blank" class="btn-acao btn-verificar">Ver Pedido</a>` : ''}
                        <button class="btn-acao" data-action="open-details-modal" data-deal-id="${deal.ID}">Detalhes</button>
                    </div>
                </div>
            `;
        }
        
        function openDetailsModal(dealId) {
            const deal = allDealsData.find(d => d.ID == dealId);
            if (!deal) return;

            modalTitle.textContent = `Detalhes do Pedido #${deal.ID} - ${deal.TITLE}`;
            
            let chatHtml = '<p class="info-text">Nenhuma mensagem.</p>';
            if (deal.historicoMensagens && deal.historicoMensagens.length > 0) {
                chatHtml = deal.historicoMensagens.map(msg => {
                    const classe = msg.remetente === 'cliente' ? 'mensagem-cliente' : 'mensagem-designer';
                    return `<div class="mensagem ${classe}">${msg.texto.replace(/^\[Mensagem do Cliente\]\n-+\n/, '')}</div>`;
                }).join('');
            }
            
            const linkArquivo = deal.UF_CRM_1748277308731;
            let arquivoHtml = '<p class="info-text">Nenhum arquivo final disponível.</p>';
            if (linkArquivo) {
                arquivoHtml = `<a href="${linkArquivo}" target="_blank" class="btn-acao btn-download">Baixar Arquivo</a>`;
            }

            const statusAtualId = deal[STATUS_IMPRESSAO_FIELD];
            let statusButtonsHtml = '';
            for (const id in STATUS_MAP) {
                const status = STATUS_MAP[id];
                const isActive = id == statusAtualId ? 'active ' + status.classe : '';
                // O data-attribute agora guarda o ID do status
                statusButtonsHtml += `<button class="status-impressao-btn ${isActive}" data-status-id="${id}">${status.nome}</button>`;
            }

            modalBody.innerHTML = `
                <div class="detalhe-layout">
                    <div class="detalhe-col-principal">
                        <div class="card-detalhe">
                            <h3>Conversa</h3>
                            <div class="chat-box" style="height: 300px;">
                                <div id="modal-mensagens-container" style="overflow-y: auto; flex-grow: 1;">${chatHtml}</div>
                            </div>
                        </div>
                    </div>
                    <div class="detalhe-col-lateral">
                        <div class="card-detalhe">
                            <h3>Arquivos</h3>
                            <div id="modal-arquivos-box">${arquivoHtml}</div>
                            <h3 style="margin-top: 20px;">Status da Impressão</h3>
                            <div class="status-impressao-container">${statusButtonsHtml}</div>
                        </div>
                    </div>
                </div>
            `;
            
            modal.classList.add('active');
            attachStatusButtonListeners(deal.ID);
        }

        function attachStatusButtonListeners(dealId) {
            const container = document.querySelector('.status-impressao-container');
            container.addEventListener('click', async (event) => {
                if (event.target.tagName !== 'BUTTON') return;
                
                const statusId = event.target.dataset.statusId;
                const buttons = container.querySelectorAll('button');
                buttons.forEach(btn => btn.disabled = true);

                try {
                    const response = await fetch('/api/impressao/updateStatus', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ dealId, statusId })
                    });
                    if (!response.ok) throw new Error('Falha ao atualizar o status.');

                    const dealIndex = allDealsData.findIndex(d => d.ID == dealId);
                    if (dealIndex > -1) {
                        allDealsData[dealIndex][STATUS_IMPRESSAO_FIELD] = statusId;
                    }
                    
                    buttons.forEach(btn => {
                        btn.classList.remove('active', 'preparacao', 'na-fila', 'imprimindo', 'pronto');
                        if (btn.dataset.statusId === statusId) {
                            const statusInfo = STATUS_MAP[statusId];
                            btn.classList.add('active', statusInfo.classe);
                        }
                    });

                    const card = document.querySelector(`.kanban-card[data-deal-id-card="${dealId}"]`);
                    if (card) {
                        card.className = 'kanban-card';
                        const statusInfo = STATUS_MAP[statusId];
                        if (statusInfo) card.classList.add('status-' + statusInfo.classe);
                    }

                } catch (error) {
                    alert(error.message);
                } finally {
                    buttons.forEach(btn => btn.disabled = false);
                }
            });
        }
        
        btnFiltrar.addEventListener('click', carregarPedidosDeImpressao);
        closeModalBtn.addEventListener('click', () => modal.classList.remove('active'));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });

        board.addEventListener('click', (event) => {
            const button = event.target.closest('button[data-action="open-details-modal"]');
            if (button) openDetailsModal(button.dataset.dealId);
        });
        
        async function init() {
            await carregarOpcoesDeFiltro();
            await carregarPedidosDeImpressao();
        }

        init();
    });
})();