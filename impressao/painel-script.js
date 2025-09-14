// /impressao/painel-script.js
(function() {
    document.addEventListener('DOMContentLoaded', () => {
        
        // --- CONSTANTES DE CONFIGURAÇÃO ---
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
            '2657': { nome: 'Preparação', cor: '#2ecc71', classe: 'preparacao', corFundo: 'rgba(46, 204, 113, 0.1)' },
            '2659': { nome: 'Na Fila',    cor: '#9b59b6', classe: 'na-fila',    corFundo: 'rgba(155, 89, 182, 0.1)' },
            '2661': { nome: 'Imprimindo', cor: '#e74c3c', classe: 'imprimindo', corFundo: 'rgba(231, 76, 60, 0.1)' },
            '2663': { nome: 'Pronto',     cor: '#27ae60', classe: 'pronto',     corFundo: 'rgba(39, 174, 96, 0.15)' }
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
            #modal-detalhes-rapidos.modal-overlay,
            #modal-detalhes-rapidos .modal-content {
                transition: none !important;
            }
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
            .kanban-card.status-preparacao { border-left-color: ${STATUS_MAP['2657'].cor} !important; }
            .kanban-card.status-na-fila { border-left-color: ${STATUS_MAP['2659'].cor} !important; }
            .kanban-card.status-imprimindo { border-left-color: ${STATUS_MAP['2661'].cor} !important; }
            .kanban-card.status-pronto { border-left-color: ${STATUS_MAP['2663'].cor} !important; }
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
                    body: JSON.stringify({ impressoraFilter: impressoraFilterEl.value, materialFilter: materialFilterEl.value })
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

        // --- FUNÇÃO ATUALIZADA ---
        function createCardHtml(deal) {
            const nomeCliente = deal[NOME_CLIENTE_FIELD] || 'Cliente não informado';
            const statusId = deal[STATUS_IMPRESSAO_FIELD];
            const statusInfo = STATUS_MAP[statusId] || {};
            
            // Usamos deal.TITLE para o ID visível se ele existir, senão deal.ID
            const displayId = deal.TITLE ? `#${deal.TITLE}` : `#${deal.ID}`;

            return `
                <div class="kanban-card ${statusInfo.classe ? 'status-' + statusInfo.classe : ''}" data-deal-id-card="${deal.ID}">
                    <div class="card-id">${displayId}</div>
                    <div class="card-client-name">${nomeCliente}</div>
                    <button class="btn-detalhes" data-action="open-details-modal" data-deal-id="${deal.ID}">Detalhes</button>
                </div>
            `;
        }

        async function loadAndDisplayChatHistory(dealId) {
            const chatContainer = document.getElementById('mensagens-container');
            if (!chatContainer) return;
            try {
                const response = await fetch('/api/impressao/getChatHistory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dealId }) });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);
                const messages = data.messages || [];
                if (messages.length > 0) {
                    chatContainer.innerHTML = messages.map(msg => {
                        const classe = msg.remetente === 'operador' ? 'mensagem-designer' : 'mensagem-cliente';
                        const textoLimpo = msg.texto ? msg.texto.replace(/^\[.+?\]\n-+\n/, '') : '';
                        return `<div class="mensagem ${classe}">${textoLimpo}</div>`;
                    }).join('');
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                } else {
                    chatContainer.innerHTML = '<p class="info-text" style="color: #555;">Nenhuma mensagem ainda. Inicie a conversa.</p>';
                }
            } catch (error) {
                chatContainer.innerHTML = `<p class="info-text" style="color: red;">Erro ao carregar mensagens.</p>`;
            }
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
            const revisaoSolicitada = deal[REVISAO_SOLICITADA_FIELD] === '1';
            const isPago = deal[FIELD_STATUS_PAGAMENTO_DESIGNER] === STATUS_PAGO_ID;

            let actionsHtml = '';
            if (linkArquivo) { actionsHtml += `<a href="${linkArquivo}" target="_blank" class="btn-acao-modal principal">Baixar Arquivo</a>`; }
            if (linkAtendimento) { actionsHtml += `<a href="${linkAtendimento}" target="_blank" class="btn-acao-modal secundario">Ver Atendimento</a>`; }
            if (deal.TITLE) {
                const urlVerPedido = `https://www.visiva.com.br/admin/?imprimastore=pedidos/detalhes&id=${encodeURIComponent(deal.TITLE)}`;
                actionsHtml += `<a href="${urlVerPedido}" target="_blank" class="btn-acao-modal secundario">Ver Pedido</a>`;
            }
            if (actionsHtml === '') { actionsHtml = '<p class="info-text" style="text-align:center; color: #555;">Nenhuma ação disponível.</p>'; }

            let mainColumnHtml = '';
            if (revisaoSolicitada) {
                const approveButtonHtml = isPago ? '' : `<button class="btn-approve-file" data-action="approve-file" title="Aprovar o arquivo, processar pagamento e finalizar."><i class="fas fa-check"></i> Arquivo Aprovado</button>`;
                let chatHtml = `<div class="card-detalhe"><div style="display: flex; justify-content: space-between; align-items: center;"><h3>Conversa de Revisão</h3>${approveButtonHtml}</div><div id="chat-revisao-container" class="chat-box"><div id="mensagens-container" style="flex-grow: 1; overflow-y: auto; padding-right: 10px;"><div class="loading-pedidos"><div class="spinner"></div></div></div><form id="form-mensagem" class="form-mensagem"><input type="text" id="input-mensagem" placeholder="Digite sua mensagem..." required><button type="submit" id="btn-enviar-mensagem" title="Enviar Mensagem"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg></button></form></div></div>`;
                mainColumnHtml = isPago ? `<div class="chat-bloqueado" title="Arquivo desse Pedido já foi aprovado.">${chatHtml}</div>` : chatHtml;
            } else {
                mainColumnHtml = `<div class="card-detalhe"><div class="revision-area"><button class="btn-request-revision" data-action="request-revision">Solicitar Revisão</button></div></div>`;
            }

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
                </div>
            `;
            
            modal.classList.add('active');
            if (revisaoSolicitada) { loadAndDisplayChatHistory(dealId); }
            attachAllListeners(deal);
        }

        function attachAllListeners(deal) {
            attachStatusStepListeners(deal.ID);
            const isRevisionActive = deal[REVISAO_SOLICITADA_FIELD] === '1';
            const isPago = deal[FIELD_STATUS_PAGAMENTO_DESIGNER] === STATUS_PAGO_ID;
            if (isRevisionActive && !isPago) { attachChatListeners(deal.ID); } 
            else if (!isRevisionActive) { attachRevisionListener(deal.ID); }
        }
        
        function attachRevisionListener(dealId) {
            const requestRevisionBtn = modalBody.querySelector('button[data-action="request-revision"]');
            if (!requestRevisionBtn) return;
            requestRevisionBtn.addEventListener('click', async () => {
                const container = requestRevisionBtn.closest('.revision-area');
                container.innerHTML = '<div class="loading-pedidos"><div class="spinner"></div></div>';
                try {
                    const response = await fetch('/api/impressao/requestRevision', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dealId }) });
                    if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.message); }
                    const dealIndex = allDealsData.findIndex(d => d.ID == dealId);
                    if (dealIndex > -1) { allDealsData[dealIndex][REVISAO_SOLICITADA_FIELD] = '1'; }
                    openDetailsModal(dealId);
                } catch (error) {
                    alert('Erro: ' + error.message);
                    openDetailsModal(dealId);
                }
            });
        }
        
        function attachChatListeners(dealId) {
            const formMensagem = document.getElementById('form-mensagem');
            if (formMensagem) {
                formMensagem.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const input = formMensagem.querySelector('#input-mensagem');
                    const btn = formMensagem.querySelector('#btn-enviar-mensagem');
                    const container = document.getElementById('mensagens-container');
                    const mensagem = input.value.trim();
                    if (!mensagem) return;
                    input.disabled = true; btn.disabled = true;
                    try {
                        await fetch('/api/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dealId, message: mensagem }) });
                        input.value = '';
                        const div = document.createElement('div');
                        div.className = 'mensagem mensagem-designer';
                        div.textContent = mensagem;
                        if(container.querySelector('.info-text') || container.querySelector('.loading-pedidos')) container.innerHTML = '';
                        container.appendChild(div);
                        container.scrollTop = container.scrollHeight;
                    } catch (error) {
                        alert('Erro ao enviar mensagem.');
                    } finally {
                        input.disabled = false; btn.disabled = false; input.focus();
                    }
                });
            }

            const approveBtn = document.querySelector('button[data-action="approve-file"]');
            if (approveBtn) {
                approveBtn.addEventListener('click', async () => {
                    if (!confirm('Tem certeza que deseja aprovar este arquivo? Esta ação irá processar o pagamento do designer e finalizar o pedido.')) return;
                    approveBtn.disabled = true;
                    approveBtn.innerHTML = '<div class="spinner" style="width: 16px; height: 16px; border-width: 2px; margin: 0 auto;"></div>';
                    try {
                        const response = await fetch('/api/impressao/approveFile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dealId }) });
                        const data = await response.json();
                        if (!response.ok) throw new Error(data.message);
                        alert('Arquivo aprovado com sucesso!');
                        const dealIndex = allDealsData.findIndex(d => d.ID == dealId);
                        if (dealIndex > -1) { allDealsData[dealIndex][FIELD_STATUS_PAGAMENTO_DESIGNER] = STATUS_PAGO_ID; }
                        openDetailsModal(dealId);
                    } catch (error) {
                        alert(`Erro: ${error.message}`);
                        approveBtn.disabled = false;
                        approveBtn.innerHTML = '<i class="fas fa-check"></i> Arquivo Aprovado';
                    }
                });
            }
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
                    if (!response.ok) {
                        return response.json().then(err => { throw new Error(err.message || 'Erro do servidor') });
                    }
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