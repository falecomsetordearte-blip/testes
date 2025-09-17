// /impressao/painel-script.js - VERSÃO FINAL COM A ÁREA DE CHAT DESATIVADA E SUBSTITUÍDA POR "EM BREVE"

(function() {
    document.addEventListener('DOMContentLoaded', () => {

        const sessionToken = localStorage.getItem('sessionToken');
        if (!sessionToken) {
            window.location.href = '../login.html';
            return;
        }

        // --- CONSTANTES DE CAMPOS E CONFIGURAÇÕES ---
        const STATUS_IMPRESSAO_FIELD = 'UF_CRM_1757756651931';
        const NOME_CLIENTE_FIELD = 'UF_CRM_1741273407628';
        const CONTATO_CLIENTE_FIELD = 'UF_CRM_1749481565243';
        const LINK_ATENDIMENTO_FIELD = 'UF_CRM_1752712769666';
        const MEDIDAS_FIELD = 'UF_CRM_1727464924690';
        const LINK_ARQUIVO_FINAL_FIELD = 'UF_CRM_1748277308731';
        const REVISAO_SOLICITADA_FIELD = 'UF_CRM_1757765731136';
        const FIELD_STATUS_PAGAMENTO_DESIGNER = 'UF_CRM_1757789502613';
        const STATUS_PAGO_ID = '2675';
        const PRAZO_FINAL_FIELD = 'UF_CRM_1757794109';

        const STATUS_MAP = {
            '2657': { nome: 'Preparação', cor: '#2ecc71', classe: 'preparacao' },
            '2659': { nome: 'Na Fila',    cor: '#9b59b6', classe: 'na-fila' },
            '2661': { nome: 'Imprimindo', cor: '#e74c3c', classe: 'imprimindo' },
            '2663': { nome: 'Pronto',     cor: '#27ae60', classe: 'pronto' }
        };
        const STATUS_ORDER = ['2657', '2659', '2661', '2663'];

        const MEDIDAS_MAP = {
            '1437': { nome: 'Conferir', cor: '#e74c3c' },
            '1439': { nome: 'Cliente', cor: '#f1c40f' },
            '1441': { nome: 'Conferida', cor: '#2ecc71' }
        };

        // --- ELEMENTOS DO DOM ---
        const impressoraFilterEl = document.getElementById('impressora-filter');
        const materialFilterEl = document.getElementById('material-filter');
        const btnFiltrar = document.getElementById('btn-filtrar');
        const board = document.querySelector('.kanban-board');
        const modal = document.getElementById('modal-detalhes-rapidos');
        const modalTitle = document.getElementById('modal-titulo');
        const modalBody = document.getElementById('modal-body-content');
        const closeModalBtn = modal.querySelector('.close-modal');

        let allDealsData = [];

        // --- FUNÇÕES DE CARREGAMENTO DE DADOS ---
        async function carregarOpcoesDeFiltro() {
            try {
                const response = await fetch('/api/getProductionFilters');
                if (!response.ok) throw new Error('Falha ao carregar filtros do servidor.');
                const filters = await response.json();
                impressoraFilterEl.innerHTML = `<option value="">Todas as Impressoras</option>`;
                materialFilterEl.innerHTML = `<option value="">Todos os Materiais</option>`;
                if (filters.impressores) {
                    filters.impressores.forEach(option => { impressoraFilterEl.innerHTML += `<option value="${option.id}">${option.value}</option>`; });
                }
                if (filters.materiais) {
                    filters.materiais.forEach(option => { materialFilterEl.innerHTML += `<option value="${option.id}">${option.value}</option>`; });
                }
            } catch (error) {
                console.error("Erro CRÍTICO ao carregar opções de filtro:", error);
                const header = document.querySelector('.kanban-header .filtros-pedidos');
                if (header) header.innerHTML = `<p style="color: #ffc107;">Erro ao carregar filtros.</p>`;
            }
        }

        async function carregarPedidosDeImpressao() {
            document.querySelectorAll('.column-cards').forEach(col => col.innerHTML = '<div class="loading-pedidos"><div class="spinner"></div></div>');
            try {
                const response = await fetch('/api/impressao/getDeals', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionToken: sessionToken,
                        impressoraFilter: impressoraFilterEl.value,
                        materialFilter: materialFilterEl.value
                    })
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Erro do servidor');
                }
                const data = await response.json();
                allDealsData = data.deals;
                organizarPedidosNasColunas(allDealsData);
            } catch (error) {
                console.error("Erro CRÍTICO ao carregar pedidos de impressão:", error);
                board.innerHTML = `<p style="color:red; padding: 20px;">${error.message}</p>`;
            }
        }

        // --- FUNÇÕES DE RENDERIZAÇÃO E UI ---
        function organizarPedidosNasColunas(deals) {
            document.querySelectorAll('.column-cards').forEach(col => col.innerHTML = '');
            const agora = new Date();
            const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
            deals.forEach(deal => {
                let colunaId = 'SEM_DATA';
                const prazoFinalStr = deal[PRAZO_FINAL_FIELD];
                if (prazoFinalStr) {
                    const dateParts = prazoFinalStr.split('T')[0].split('-');
                    if (dateParts.length === 3) {
                        const [ano, mes, dia] = dateParts.map(p => parseInt(p, 10));
                        const prazoData = new Date(ano, mes - 1, dia);
                        if (!isNaN(prazoData.getTime())) {
                            const diffTime = prazoData.getTime() - hoje.getTime();
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            if (diffDays < 0) colunaId = 'ATRASADO';
                            else if (diffDays === 0) colunaId = 'HOJE';
                            else if (diffDays <= 7) colunaId = 'ESSA_SEMANA';
                            else colunaId = 'PROXIMA_SEMANA';
                        }
                    }
                }
                const cardHtml = createCardHtml(deal);
                const coluna = document.getElementById(`cards-${colunaId}`);
                if (coluna) coluna.innerHTML += cardHtml;
            });
            document.querySelectorAll('.column-cards').forEach(col => {
                if (col.innerHTML === '') col.innerHTML = '<p class="info-text" style="color: rgba(255,255,255,0.6); text-align: center;">Nenhum pedido aqui.</p>';
            });
        }

        function createCardHtml(deal) {
            const nomeCliente = deal[NOME_CLIENTE_FIELD] || 'Cliente não informado';
            const statusId = deal[STATUS_IMPRESSAO_FIELD];
            const statusInfo = STATUS_MAP[statusId] || {};
            const displayId = deal.TITLE ? `#${deal.TITLE}` : `#${deal.ID}`;
            let prazoTagHtml = '';
            if (deal[PRAZO_FINAL_FIELD]) {
                const dataFormatada = new Date(deal[PRAZO_FINAL_FIELD]).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                prazoTagHtml = `<div class="card-deadline-tag">Prazo: ${dataFormatada}</div>`;
            }
            return `<div class="kanban-card status-${statusInfo.classe || 'default'}" style="border-left-color: ${statusInfo.cor || 'var(--cinza-neutro)'}" data-deal-id-card="${deal.ID}"><div class="card-id">${displayId}</div><div class="card-client-name">${nomeCliente}</div>${prazoTagHtml}</div>`;
        }

        function openDetailsModal(dealId) {
            const deal = allDealsData.find(d => d.ID == dealId);
            if (!deal) return;
            modalTitle.textContent = `Detalhes do Pedido #${deal.TITLE || deal.ID}`;

            const statusAtualId = deal[STATUS_IMPRESSAO_FIELD] || STATUS_ORDER[0];
            const statusAtualIndex = STATUS_ORDER.indexOf(statusAtualId);
            let stepsHtml = STATUS_ORDER.map((id, index) => {
                const status = STATUS_MAP[id];
                let stepClass = 'step';
                if (index < statusAtualIndex) stepClass += ' completed';
                else if (index === statusAtualIndex) stepClass += ' active';
                return `<div class="${stepClass}" data-status-id="${id}" style="--step-color: ${status.cor};">${status.nome}</div>`;
            }).join('');
            
            const nomeCliente = deal[NOME_CLIENTE_FIELD] || '---';
            const contatoCliente = deal[CONTATO_CLIENTE_FIELD] || '---';
            const medidaInfo = MEDIDAS_MAP[deal[MEDIDAS_FIELD]];
            let medidasHtml = medidaInfo ? `<span class="tag-medidas" style="background-color: ${medidaInfo.cor};">${medidaInfo.nome}</span>` : '---';
            
            let actionsHtml = '';
            if (deal[LINK_ARQUIVO_FINAL_FIELD]) actionsHtml += `<a href="${deal[LINK_ARQUIVO_FINAL_FIELD]}" target="_blank" class="btn-acao-modal principal">Baixar Arquivo</a>`;
            if (deal[LINK_ATENDIMENTO_FIELD]) actionsHtml += `<a href="${deal[LINK_ATENDIMENTO_FIELD]}" target="_blank" class="btn-acao-modal secundario">Ver Atendimento</a>`;
            if (deal.ID) actionsHtml += `<a href="/pedido.html?id=${encodeURIComponent(deal.ID)}" target="_blank" class="btn-acao-modal secundario">Ver Pedido do Cliente</a>`;
            if (actionsHtml === '') actionsHtml = '<p class="info-text" style="text-align: center; color: var(--cinza-texto);">Nenhuma ação disponível.</p>';

            // <<-- AQUI ESTÁ A MUDANÇA PRINCIPAL -->>
            // Substituímos toda a lógica do chat por um placeholder simples e estático.
            const mainColumnHtml = `
                <div class="card-detalhe" style="text-align: center; color: var(--cinza-texto); padding: 50px 20px;">
                    <i class="fas fa-comments" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                    <h3 style="margin: 0 0 10px 0;">Chat de Revisão</h3>
                    <p style="font-size: 1.2rem; font-weight: 600; color: var(--cinza-neutro);">EM BREVE</p>
                </div>
            `;
            
            modalBody.innerHTML = `
                <div class="steps-container">${stepsHtml}</div>
                <div class="detalhe-layout">
                    <div class="detalhe-col-principal">${mainColumnHtml}</div>
                    <div class="detalhe-col-lateral">
                        <div class="card-detalhe">${actionsHtml}</div>
                        <div class="card-detalhe">
                            <h3>Informações do Cliente</h3>
                            <div class="info-item"><span class="info-item-label">Nome:</span><span>${nomeCliente}</span></div>
                            <div class="info-item"><span class="info-item-label">Contato:</span><span>${contatoCliente}</span></div>
                            <div class="info-item"><span class="info-item-label">Medidas:</span>${medidasHtml}</div>
                        </div>
                    </div>
                </div>
            `;
            modal.classList.add('active');
            
            // Apenas o listener dos steps é necessário agora
            attachStatusStepListeners(deal.ID);
        }

        // --- FUNÇÕES DE EVENTOS (LISTENERS) ---
        
        function updateVisualStatus(dealId, newStatusId) {
            const dealIndex = allDealsData.findIndex(d => d.ID == dealId);
            if (dealIndex === -1) return;
            const stepsContainer = document.querySelector('.steps-container');
            if (stepsContainer && modal.classList.contains('active')) {
                const steps = stepsContainer.querySelectorAll('.step');
                const newStatusIndex = STATUS_ORDER.indexOf(newStatusId);
                steps.forEach((s, index) => {
                    s.classList.remove('active', 'completed');
                    if (index < newStatusIndex) s.classList.add('completed');
                    else if (index === newStatusIndex) s.classList.add('active');
                });
            }
            const card = document.querySelector(`.kanban-card[data-deal-id-card="${dealId}"]`);
            if (card) {
                card.className = 'kanban-card';
                const newStatusInfo = STATUS_MAP[newStatusId];
                if (newStatusInfo) card.classList.add(`status-${newStatusInfo.classe}`);
                card.style.borderLeftColor = newStatusInfo.cor || 'var(--cinza-neutro)';
            }
        }

        function attachStatusStepListeners(dealId) {
            const container = document.querySelector('.steps-container');
            if (!container) return;
        
            const clickHandler = (event) => {
                const step = event.target.closest('.step');
                if (!step) return;
        
                const newStatusId = step.dataset.statusId;
                const dealIndex = allDealsData.findIndex(d => d.ID == dealId);
                if (dealIndex === -1) return;
                const oldStatusId = allDealsData[dealIndex][STATUS_IMPRESSAO_FIELD];
                if (newStatusId === oldStatusId) return;
        
                updateVisualStatus(dealId, newStatusId);
                allDealsData[dealIndex][STATUS_IMPRESSAO_FIELD] = newStatusId;
        
                fetch('/api/impressao/updateStatus', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dealId, statusId: newStatusId })
                })
                .then(response => {
                    if (!response.ok) return response.json().then(err => { throw new Error(err.message || 'Erro do servidor') });
                    return response.json();
                })
                .then(data => {
                    if (data.movedToNextStage) {
                        setTimeout(() => {
                            modal.classList.remove('active');
                            carregarPedidosDeImpressao();
                        }, 500);
                    }
                })
                .catch(error => {
                    alert(`Não foi possível atualizar o status. Revertendo. Erro: ${error.message}`);
                    updateVisualStatus(dealId, oldStatusId);
                    allDealsData[dealIndex][STATUS_IMPRESSAO_FIELD] = oldStatusId;
                });
            };
            
            container.addEventListener('click', clickHandler);
        
            const observer = new MutationObserver(() => {
                if (!modal.classList.contains('active')) {
                    if(container.removeEventListener) container.removeEventListener('click', clickHandler);
                    observer.disconnect();
                }
            });
            observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
        }
        
        // --- INICIALIZAÇÃO E EVENTOS GLOBAIS ---
        async function init() {
            await Promise.all([
                carregarOpcoesDeFiltro(),
                carregarPedidosDeImpressao()
            ]);
        }
        
        btnFiltrar.addEventListener('click', carregarPedidosDeImpressao);
        closeModalBtn.addEventListener('click', () => modal.classList.remove('active'));
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });

        board.addEventListener('click', (event) => {
            const card = event.target.closest('.kanban-card');
            if (card) {
                const dealId = card.dataset.dealIdCard;
                if (dealId) {
                    openDetailsModal(dealId);
                }
            }
        });
        
        init();
    });
})();