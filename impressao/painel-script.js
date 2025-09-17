// /impressao/painel-script.js - VERSÃO COM FUNDO DO CARD COLORIDO E CHAT BLOQUEADO

(function() {
    document.addEventListener('DOMContentLoaded', () => {

        const sessionToken = localStorage.getItem('sessionToken');
        if (!sessionToken) {
            window.location.href = '../login.html'; 
            return;
        }
        
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
            '2657': { nome: 'Preparação', cor: '#2ecc71', classe: 'preparacao', corFundo: '#74e7a6ff' }, // Verde pastel sólido
            '2659': { nome: 'Na Fila',    cor: '#9b59b6', classe: 'na-fila',    corFundo: '#d49af1ff' }, // Roxo pastel sólido
            '2661': { nome: 'Imprimindo', cor: '#e74c3c', classe: 'imprimindo', corFundo: '#fdbab2' }, // Vermelho pastel sólido
            '2663': { nome: 'Pronto',     cor: '#27ae60', classe: 'pronto',     corFundo: '#58ac7cff' }  // Verde escuro pastel sólido
        };
        const STATUS_ORDER = ['2657', '2659', '2661', '2663'];

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
            /* Efeito de card clicável */
            .kanban-card {
                transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
            }
            .kanban-card:hover {
                cursor: pointer;
                transform: translateY(-3px);
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            }
            .card-deadline-tag {
                margin-top: 8px;
                display: inline-block;
                background-color: #e9ecef;
                padding: 3px 8px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: 600;
                color: #495057;
            }
            
            /* --- ALTERAÇÃO PRINCIPAL: CORES DE FUNDO DOS CARDS --- */
            .kanban-card.status-preparacao {
                border-left-color: ${STATUS_MAP['2657'].cor} !important;
                background-color: ${STATUS_MAP['2657'].corFundo};
            }
            .kanban-card.status-na-fila {
                border-left-color: ${STATUS_MAP['2659'].cor} !important;
                background-color: ${STATUS_MAP['2659'].corFundo};
            }
            .kanban-card.status-imprimindo {
                border-left-color: ${STATUS_MAP['2661'].cor} !important;
                background-color: ${STATUS_MAP['2661'].corFundo};
            }
            .kanban-card.status-pronto {
                border-left-color: ${STATUS_MAP['2663'].cor} !important;
                background-color: ${STATUS_MAP['2663'].corFundo};
            }
            /* --- FIM DA ALTERAÇÃO --- */

            #modal-detalhes-rapidos.modal-overlay,
            #modal-detalhes-rapidos .modal-content { transition: none !important; }
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
            .info-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--borda); }
            .info-item:last-child { border-bottom: none; }
            .info-item-label { font-weight: 600; }
            .tag-medidas { padding: 4px 10px; border-radius: 4px; color: white; font-weight: 600; font-size: 12px; }
            #chat-revisao-container { padding-top: 15px; }
            .revision-area { text-align: center; padding: 40px 20px; }
            .btn-request-revision { background: none; border: 2px dashed #d1d5db; color: var(--cinza-texto); padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 15px; cursor: pointer; transition: all 0.3s ease; }
            .btn-request-revision:hover { border-color: var(--azul-principal); background-color: rgba(56, 169, 244, 0.05); color: var(--azul-principal); }
            .btn-approve-file { background-color: var(--sucesso); color: white; border: none; padding: 8px 12px; border-radius: 6px; font-size: 14px; font-weight: 500; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; }
            #mensagens-container { display: flex; flex-direction: column; gap: 8px; }
            .mensagem { padding: 10px 15px; border-radius: 18px; max-width: 80%; word-wrap: break-word; line-height: 1.4; }
            .mensagem-cliente { background-color: #e9ecef; color: var(--texto-escuro); border-bottom-left-radius: 4px; margin-right: auto; align-self: flex-start; }
            .mensagem-designer { background-color: var(--azul-principal); color: white; border-bottom-right-radius: 4px; margin-left: auto; align-self: flex-end; }
            .form-mensagem { display: flex; gap: 10px; align-items: center; padding-top: 15px; margin-top: 15px !important; border-top: 1px solid var(--borda); }
            #input-mensagem { flex-grow: 1; border: 1px solid #ccc; border-radius: 20px; padding: 10px 18px; font-size: 14px; transition: border-color 0.2s, box-shadow 0.2s; }
            #input-mensagem:focus { outline: none; border-color: var(--azul-principal); box-shadow: 0 0 0 2px rgba(56, 169, 244, 0.2); }
            #btn-enviar-mensagem { flex-shrink: 0; background-color: var(--azul-principal); border: none; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background-color 0.2s; }
            #btn-enviar-mensagem svg { fill: white; width: 20px; height: 20px; transform: translateX(1px); }
            #btn-enviar-mensagem:hover { background-color: #2c89c8; }
            .chat-bloqueado { position: relative; cursor: not-allowed; }
            .chat-bloqueado::after { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(255, 255, 255, 0.7); border-radius: 8px; z-index: 5; }
            .modal-actions-container { display: flex; flex-direction: column; gap: 10px; }
            .modal-actions-container .btn-acao-modal { display: block; text-decoration: none; text-align: center; padding: 10px; border-radius: 6px; font-weight: 600; transition: background-color 0.2s, color 0.2s; border: 1px solid transparent; }
            .modal-actions-container .btn-acao-modal.principal { background-color: var(--azul-principal); color: white; }
            .modal-actions-container .btn-acao-modal.principal:hover { background-color: #2c89c8; }
            .modal-actions-container .btn-acao-modal.secundario { background-color: #f1f1f1; border-color: #ddd; color: var(--texto-escuro); }
            .modal-actions-container .btn-acao-modal.secundario:hover { background-color: #e9e9e9; }
            .card-detalhe { background-color: var(--branco); border-radius: 12px; padding: 25px; margin-bottom: 20px; }
            .detalhe-layout { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; }
        `;
        document.head.appendChild(style);
        
        async function carregarOpcoesDeFiltro() {
            try {
                const response = await fetch('/api/getProductionFilters');
                const filters = await response.json();
                if (!response.ok) throw new Error('Falha ao carregar filtros.');
                impressoraFilterEl.innerHTML = `<option value="">Todas as Impressoras</option>`;
                materialFilterEl.innerHTML = `<option value="">Todos os Materiais</option>`;
                filters.impressoras.forEach(option => { impressoraFilterEl.innerHTML += `<option value="${option.id}">${option.value}</option>`; });
                filters.materiais.forEach(option => { materialFilterEl.innerHTML += `<option value="${option.id}">${option.value}</option>`; });
            } catch (error) { console.error("Erro ao carregar opções de filtro:", error); }
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
            const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
            deals.forEach(deal => {
                let colunaId = 'SEM_DATA';
                const prazoFinalStr = deal[PRAZO_FINAL_FIELD];
                if (prazoFinalStr) {
                    const dateParts = prazoFinalStr.split('T')[0].split('-');
                    if (dateParts.length === 3) {
                        const ano = parseInt(dateParts[0], 10);
                        const mes = parseInt(dateParts[1], 10) - 1;
                        const dia = parseInt(dateParts[2], 10);
                        const prazoData = new Date(ano, mes, dia);
                        if (!isNaN(prazoData.getTime())) {
                            const diffTime = prazoData.getTime() - hoje.getTime();
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            if (diffDays < 0) {
                                colunaId = 'ATRASADO';
                            } else if (diffDays === 0) {
                                colunaId = 'HOJE';
                            } else if (diffDays <= 7) {
                                colunaId = 'ESSA_SEMANA';
                            } else {
                                colunaId = 'PROXIMA_SEMANA';
                            }
                        }
                    }
                }
                const cardHtml = createCardHtml(deal);
                const coluna = document.getElementById(`cards-${colunaId}`);
                if (coluna) {
                    coluna.innerHTML += cardHtml;
                }
            });
            document.querySelectorAll('.column-cards').forEach(col => {
                if (col.innerHTML === '') {
                    col.innerHTML = '<p class="info-text">Nenhum pedido aqui.</p>';
                }
            });
        }
        
        function createCardHtml(deal) {
            const nomeCliente = deal[NOME_CLIENTE_FIELD] || 'Cliente não informado';
            const statusId = deal[STATUS_IMPRESSAO_FIELD];
            const statusInfo = STATUS_MAP[statusId] || {};
            const displayId = deal.TITLE ? `#${deal.TITLE}` : `#${deal.ID}`;
            let prazoTagHtml = '';
            const prazoFinalStr = deal[PRAZO_FINAL_FIELD];
            if (prazoFinalStr) {
                const dataFormatada = new Date(prazoFinalStr).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit'
                });
                prazoTagHtml = `<div class="card-deadline-tag">Prazo: ${dataFormatada}</div>`;
            }
            return `
                <div class="kanban-card ${statusInfo.classe ? 'status-' + statusInfo.classe : ''}" data-deal-id-card="${deal.ID}">
                    <div class="card-id">${displayId}</div>
                    <div class="card-client-name">${nomeCliente}</div>
                    ${prazoTagHtml}
                </div>
            `;
        }
        
        function openDetailsModal(dealId) {
            const deal = allDealsData.find(d => d.ID == dealId);
            if (!deal) return;
            modalTitle.textContent = `Detalhes do Pedido #${deal.TITLE || deal.ID}`;
            const statusAtualId = deal[STATUS_IMPRESSAO_FIELD] || STATUS_ORDER[0];
            const statusAtualIndex = STATUS_ORDER.indexOf(statusAtualId);
            let stepsHtml = '';
            STATUS_ORDER.forEach((id, index) => {
                const status = STATUS_MAP[id];
                let stepClass = 'step';
                if (index < statusAtualIndex) stepClass += ' completed';
                else if (index === statusAtualIndex) stepClass += ' active ' + status.classe;
                stepsHtml += `<div class="${stepClass}" data-status-id="${id}">${status.nome}</div>`;
            });
            const nomeCliente = deal[NOME_CLIENTE_FIELD] || '---';
            const contatoCliente = deal[CONTATO_CLIENTE_FIELD] || '---';
            const medidasId = deal[MEDIDAS_FIELD];
            const medidaInfo = MEDIDAS_MAP[medidasId];
            let medidasHtml = '---';
            if (medidaInfo) { medidasHtml = `<span class="tag-medidas" style="background-color: ${medidaInfo.cor};">${medidaInfo.nome}</span>`; }
            const linkArquivo = deal[LINK_ARQUIVO_FINAL_FIELD];
            const linkAtendimento = deal[LINK_ATENDIMENTO_FIELD];

            let actionsHtml = '';
            if (linkArquivo) { actionsHtml += `<a href="${linkArquivo}" target="_blank" class="btn-acao-modal principal">Baixar Arquivo</a>`; }
            if (linkAtendimento) { actionsHtml += `<a href="${linkAtendimento}" target="_blank" class="btn-acao-modal secundario">Ver Atendimento</a>`; }
            if (deal.TITLE) {
                const urlVerPedido = `https://www.visiva.com.br/admin/?imprimastore=pedidos/detalhes&id=${encodeURIComponent(deal.TITLE)}`;
                actionsHtml += `<a href="${urlVerPedido}" target="_blank" class="btn-acao-modal secundario">Ver Pedido</a>`;
            }
            if (actionsHtml === '') { actionsHtml = '<p class="info-text" style="text-align:center; color: #555;">Nenhuma ação disponível.</p>'; }
            
            // <<-- ÚNICA ALTERAÇÃO REALIZADA -->>
            // Substituímos toda a lógica complexa do chat por este bloco estático.
            const mainColumnHtml = `
                <div class="card-detalhe" style="text-align: center; color: var(--cinza-texto); padding: 50px 20px; border-style: dashed; background-color: #f8f9fa;">
                    <i class="fas fa-comments" style="font-size: 2.5rem; margin-bottom: 15px; opacity: 0.4;"></i>
                    <h3 style="margin: 0 0 10px 0; color: var(--texto-escuro);">Chat de Revisão</h3>
                    <p style="font-size: 1.1rem; font-weight: 600; color: var(--cinza-neutro);">EM BREVE</p>
                </div>
            `;

            modalBody.innerHTML = `
                <div class="steps-container">${stepsHtml}</div>
                <div class="detalhe-layout">
                    <div class="detalhe-col-principal">${mainColumnHtml}</div>
                    <div class="detalhe-col-lateral">
                        <div class="card-detalhe modal-actions-container">${actionsHtml}</div>
                        <div class="card-detalhe">
                            <h3>Informações do Cliente</h3>
                            <div class="info-item"><span class="info-item-label">Nome:</span><span>${nomeCliente}</span></div>
                            <div class="info-item"><span class="info-item-label">Contato:</span><span>${contatoCliente}</span></div>
                            <div class="info-item"><span class="info-item-label">Medidas:</span>${medidasHtml}</div>
                        </div>
                    </div>
                </div>`;
            modal.classList.add('active');
            
            // Apenas o listener dos steps é anexado. O resto foi removido.
            attachStatusStepListeners(deal.ID);
        }

        function updateVisualStatus(dealId, newStatusId) {
            const dealIndex = allDealsData.findIndex(d => d.ID == dealId);
            if (dealIndex === -1) return;
            const stepsContainer = document.querySelector('.steps-container');
            if (stepsContainer && document.getElementById('modal-detalhes-rapidos').classList.contains('active')) {
                const steps = stepsContainer.querySelectorAll('.step');
                const newStatusIndex = STATUS_ORDER.indexOf(newStatusId);
                steps.forEach((s, index) => {
                    const currentStatusId = s.dataset.statusId;
                    const statusInfo = STATUS_MAP[currentStatusId];
                    s.className = 'step';
                    if (index < newStatusIndex) s.classList.add('completed');
                    else if (index === newStatusIndex) s.classList.add('active', statusInfo.classe);
                });
            }
            const card = document.querySelector(`.kanban-card[data-deal-id-card="${dealId}"]`);
            if (card) {
                card.className = 'kanban-card';
                const newStatusInfo = STATUS_MAP[newStatusId];
                if (newStatusInfo) card.classList.add('status-' + newStatusInfo.classe);
            }
        }

        function attachStatusStepListeners(dealId) {
            const container = document.querySelector('.steps-container');
            container.addEventListener('click', (event) => {
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
                    if (!response.ok) { return response.json().then(err => { throw new Error(err.message || 'Erro do servidor') }); }
                    return response.json();
                })
                .then(data => {
                    console.log(`[Optimistic Update] Backend success: ${data.message}`);
                    if (data.movedToNextStage) {
                        setTimeout(() => {
                            modal.classList.remove('active');
                            carregarPedidosDeImpressao();
                        }, 500);
                    }
                })
                .catch(error => {
                    alert(`Não foi possível atualizar o status para "${STATUS_MAP[newStatusId].nome}". Revertendo a alteração.`);
                    updateVisualStatus(dealId, oldStatusId);
                    allDealsData[dealIndex][STATUS_IMPRESSAO_FIELD] = oldStatusId;
                });
            });
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
        
        async function init() {
            await carregarOpcoesDeFiltro();
            await carregarPedidosDeImpressao();
        }
        init();
    });
})();