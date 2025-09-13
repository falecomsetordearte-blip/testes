// /impressao/painel-script.js
(function() {
    document.addEventListener('DOMContentLoaded', () => {
        
        // --- CONSTANTES DE CONFIGURAÇÃO ---
        const STATUS_IMPRESSAO_FIELD = 'UF_CRM_1757756651931';
        
        // O mapa de status agora inclui as cores de fundo "lavadas"
        const STATUS_MAP = {
            '2657': { nome: 'Preparação', cor: '#2ecc71', classe: 'preparacao', corFundo: 'rgba(46, 204, 113, 0.1)' },
            '2659': { nome: 'Na Fila',    cor: '#9b59b6', classe: 'na-fila',    corFundo: 'rgba(155, 89, 182, 0.1)' },
            '2661': { nome: 'Imprimindo', cor: '#e74c3c', classe: 'imprimindo', corFundo: 'rgba(231, 76, 60, 0.1)' },
            '2663': { nome: 'Pronto',     cor: '#27ae60', classe: 'pronto',     corFundo: 'rgba(39, 174, 96, 0.15)' }
        };
        const STATUS_ORDER = ['2657', '2659', '2661', '2663'];

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

        // --- ESTILOS DINÂMICOS ---
        const style = document.createElement('style');
        style.textContent = `
            /* Design dos Passos no Modal */
            .steps-container { display: flex; padding: 20px 10px; margin-bottom: 20px; border-bottom: 1px solid var(--borda); }
            .step { flex: 1; text-align: center; position: relative; color: #6c757d; font-weight: 600; font-size: 14px; padding: 10px 5px; background-color: #f8f9fa; border: 1px solid #dee2e6; cursor: pointer; transition: all 0.2s ease-in-out; }
            .step:first-child { border-radius: 6px 0 0 6px; }
            .step:last-child { border-radius: 0 6px 6px 0; }
            .step:not(:last-child)::after { content: ''; position: absolute; right: -13px; top: 50%; transform: translateY(-50%); width: 0; height: 0; border-top: 21px solid transparent; border-bottom: 21px solid transparent; border-left: 13px solid #f8f9fa; z-index: 2; transition: border-left-color 0.2s ease-in-out; }
            .step:not(:last-child)::before { content: ''; position: absolute; right: -14px; top: 50%; transform: translateY(-50%); width: 0; height: 0; border-top: 21px solid transparent; border-bottom: 21px solid transparent; border-left: 13px solid #dee2e6; z-index: 1; }
            .step.completed, .step.active { color: #fff; }
            .step.completed { background-color: #6c757d; border-color: #5c636a; }
            .step.completed:not(:last-child)::after { border-left-color: #6c757d; }
            .step.completed:not(:last-child)::before { border-left-color: #5c636a; }
            .step.active { z-index: 3; transform: scale(1.05); }
            .step.active.preparacao { background-color: ${STATUS_MAP['2657'].cor}; border-color: ${STATUS_MAP['2657'].cor}; }
            .step.active.preparacao:not(:last-child)::after, .step.active.preparacao:not(:last-child)::before { border-left-color: ${STATUS_MAP['2657'].cor}; }
            .step.active.na-fila { background-color: ${STATUS_MAP['2659'].cor}; border-color: ${STATUS_MAP['2659'].cor}; }
            .step.active.na-fila:not(:last-child)::after, .step.active.na-fila:not(:last-child)::before { border-left-color: ${STATUS_MAP['2659'].cor}; }
            .step.active.imprimindo { background-color: ${STATUS_MAP['2661'].cor}; border-color: ${STATUS_MAP['2661'].cor}; }
            .step.active.imprimindo:not(:last-child)::after, .step.active.imprimindo:not(:last-child)::before { border-left-color: ${STATUS_MAP['2661'].cor}; }
            .step.active.pronto { background-color: ${STATUS_MAP['2663'].cor}; border-color: ${STATUS_MAP['2663'].cor}; }
            .step.active.pronto:not(:last-child)::after, .step.active.pronto:not(:last-child)::before { border-left-color: ${STATUS_MAP['2663'].cor}; }
            
            /* NOVOS ESTILOS PARA O FUNDO DOS CARDS */
            .kanban-card.status-preparacao { background-color: ${STATUS_MAP['2657'].corFundo}; border-left-color: ${STATUS_MAP['2657'].cor} !important; }
            .kanban-card.status-na-fila { background-color: ${STATUS_MAP['2659'].corFundo}; border-left-color: ${STATUS_MAP['2659'].cor} !important; }
            .kanban-card.status-imprimindo { background-color: ${STATUS_MAP['2661'].corFundo}; border-left-color: ${STATUS_MAP['2661'].cor} !important; }
            .kanban-card.status-pronto { background-color: ${STATUS_MAP['2663'].corFundo}; border-left-color: ${STATUS_MAP['2663'].cor} !important; }
        `;
        document.head.appendChild(style);

        // ... o resto do arquivo permanece exatamente o mesmo
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
            const statusId = deal[STATUS_IMPRESSAO_FIELD];
            const statusInfo = STATUS_MAP[statusId] || {};
            
            // Adicionamos a classe de status aqui
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
            
            const statusAtualId = deal[STATUS_IMPRESSAO_FIELD] || STATUS_ORDER[0];
            const statusAtualIndex = STATUS_ORDER.indexOf(statusAtualId);
            let stepsHtml = '';
            STATUS_ORDER.forEach((id, index) => {
                const status = STATUS_MAP[id];
                let stepClass = 'step';
                if (index < statusAtualIndex) {
                    stepClass += ' completed';
                } else if (index === statusAtualIndex) {
                    stepClass += ' active ' + status.classe;
                }
                stepsHtml += `<div class="${stepClass}" data-status-id="${id}">${status.nome}</div>`;
            });
            
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

            modalBody.innerHTML = `
                <div class="steps-container">${stepsHtml}</div>
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
                        </div>
                    </div>
                </div>
            `;
            
            modal.classList.add('active');
            attachStatusStepListeners(deal.ID);
        }

        function attachStatusStepListeners(dealId) {
            const container = document.querySelector('.steps-container');
            container.addEventListener('click', async (event) => {
                const step = event.target.closest('.step');
                if (!step) return;
                
                const statusId = step.dataset.statusId;
                const steps = container.querySelectorAll('.step');
                
                container.style.pointerEvents = 'none';

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
                    
                    const newStatusIndex = STATUS_ORDER.indexOf(statusId);
                    steps.forEach((s, index) => {
                        const currentStatusId = s.dataset.statusId;
                        const statusInfo = STATUS_MAP[currentStatusId];
                        s.className = 'step';
                        if (index < newStatusIndex) {
                            s.classList.add('completed');
                        } else if (index === newStatusIndex) {
                            s.classList.add('active', statusInfo.classe);
                        }
                    });
                    
                    // ATUALIZA O CARD NA TELA PRINCIPAL APÓS A MUDANÇA
                    const card = document.querySelector(`.kanban-card[data-deal-id-card="${dealId}"]`);
                    if (card) {
                        card.className = 'kanban-card'; // Limpa classes antigas
                        const newStatusInfo = STATUS_MAP[statusId];
                        if (newStatusInfo) {
                            card.classList.add('status-' + newStatusInfo.classe);
                        }
                    }

                } catch (error) {
                    alert(error.message);
                } finally {
                    container.style.pointerEvents = 'auto';
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