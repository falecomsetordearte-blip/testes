// /impressao/painel-script.js - VERSÃO COM CORREÇÃO DE TYPO, LOGS E MAIS ROBUSTA

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
            '2657': { nome: 'Preparação', cor: '#2ecc71', classe: 'preparacao', corFundo: '#74e7a6ff' },
            '2659': { nome: 'Na Fila',    cor: '#9b59b6', classe: 'na-fila',    corFundo: '#d49af1ff' },
            '2661': { nome: 'Imprimindo', cor: '#e74c3c', classe: 'imprimindo', corFundo: '#fdbab2' },
            '2663': { nome: 'Pronto',     cor: '#27ae60', classe: 'pronto',     corFundo: '#58ac7cff' }
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

        // --- INJEÇÃO DE ESTILOS DINÂMICOS ---
        const style = document.createElement('style');
        style.textContent = `
            .kanban-card:hover { cursor: pointer; transform: translateY(-3px); box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
            .card-deadline-tag { margin-top: 8px; display: inline-block; background-color: #e9ecef; padding: 3px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; color: #495057; }
            .kanban-card.status-preparacao { border-left-color: ${STATUS_MAP['2657'].cor} !important; background-color: ${STATUS_MAP['2657'].corFundo}; }
            .kanban-card.status-na-fila { border-left-color: ${STATUS_MAP['2659'].cor} !important; background-color: ${STATUS_MAP['2659'].corFundo}; }
            .kanban-card.status-imprimindo { border-left-color: ${STATUS_MAP['2661'].cor} !important; background-color: ${STATUS_MAP['2661'].corFundo}; }
            .kanban-card.status-pronto { border-left-color: ${STATUS_MAP['2663'].cor} !important; background-color: ${STATUS_MAP['2663'].corFundo}; }
            .steps-container { display: flex; padding: 20px 10px; margin-bottom: 20px; border-bottom: 1px solid var(--borda); }
            .step { flex: 1; text-align: center; position: relative; color: #6c757d; font-weight: 600; font-size: 14px; padding: 10px 5px; background-color: #f8f9fa; border: 1px solid #dee2e6; cursor: pointer; transition: all 0.2s ease-in-out; }
            .step:first-child { border-radius: 6px 0 0 6px; } .step:last-child { border-radius: 0 6px 6px 0; }
            .step:not(:last-child)::after { content: ''; position: absolute; right: -13px; top: 50%; transform: translateY(-50%); width: 0; height: 0; border-top: 21px solid transparent; border-bottom: 21px solid transparent; border-left: 13px solid #f8f9fa; z-index: 2; transition: border-left-color 0.2s ease-in-out; }
            .step:not(:last-child)::before { content: ''; position: absolute; right: -14px; top: 50%; transform: translateY(-50%); width: 0; height: 0; border-top: 21px solid transparent; border-bottom: 21px solid transparent; border-left: 13px solid #dee2e6; z-index: 1; }
            .step.completed, .step.active { color: #fff; } .step.completed { background-color: #6c757d; border-color: #5c636a; }
            .step.completed:not(:last-child)::after { border-left-color: #6c757d; } .step.completed:not(:last-child)::before { border-left-color: #5c636a; }
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
            .tag-medidas { padding: 4px 10px; border-radius: 4px; color: white; font-weight: 600; font-size: 12px; }
            .btn-approve-file { background-color: var(--sucesso); color: white; border: none; padding: 8px 12px; border-radius: 6px; font-size: 14px; font-weight: 500; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; }
            .chat-bloqueado { position: relative; cursor: not-allowed; }
            .chat-bloqueado::after { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(255, 255, 255, 0.7); border-radius: 8px; z-index: 5; }
            .modal-actions-container .btn-acao-modal { display: block; text-decoration: none; text-align: center; padding: 10px; border-radius: 6px; font-weight: 600; transition: background-color 0.2s; border: 1px solid transparent; }
            .modal-actions-container .btn-acao-modal.principal { background-color: var(--azul-principal); color: white; }
            .modal-actions-container .btn-acao-modal.secundario { background-color: #f1f1f1; border-color: #ddd; color: var(--texto-escuro); }
            .card-detalhe { background-color: var(--branco); border-radius: 12px; padding: 25px; margin-bottom: 20px; }
            .detalhe-layout { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; }
            .revisao-wrapper { position: relative; }
            .revisao-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(248, 249, 250, 0.95); backdrop-filter: blur(2px); display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; z-index: 10; padding: 20px; border-radius: 12px; transition: opacity 0.3s ease, visibility 0.3s ease; }
            .chat-iniciado .revisao-overlay { opacity: 0; visibility: hidden; pointer-events: none; }
            .btn-request-revision { background-color: var(--erro); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 15px; cursor: pointer; transition: all 0.3s ease; display: inline-flex; align-items: center; gap: 10px; }
            .btn-request-revision:hover { background-color: #c0392b; transform: translateY(-2px); }
        `;
        document.head.appendChild(style);

        // --- FUNÇÕES DE CARREGAMENTO DE DADOS ---

        async function carregarOpcoesDeFiltro() {
            try {
                const response = await fetch('/api/getProductionFilters');
                if (!response.ok) throw new Error('Falha ao carregar filtros do servidor.');

                const filters = await response.json();
                
                impressoraFilterEl.innerHTML = `<option value="">Todas as Impressoras</option>`;
                materialFilterEl.innerHTML = `<option value="">Todos os Materiais</option>`;
                
                // CORREÇÃO: Usando 'impressores' para corresponder à API.
                if (filters.impressores) {
                    filters.impressores.forEach(option => { impressoraFilterEl.innerHTML += `<option value="${option.id}">${option.value}</option>`; });
                }
                
                if (filters.materiais) {
                    filters.materiais.forEach(option => { materialFilterEl.innerHTML += `<option value="${option.id}">${option.value}</option>`; });
                }

            } catch (error) {
                console.error("Erro CRÍTICO ao carregar opções de filtro:", error);
                const header = document.querySelector('.kanban-header .filtros-pedidos');
                if(header) header.innerHTML = `<p style="color: #ffc107;">Erro ao carregar filtros.</p>`;
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
                if (col.innerHTML === '') col.innerHTML = '<p class="info-text">Nenhum pedido aqui.</p>';
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
            return `<div class="kanban-card ${statusInfo.classe ? 'status-' + statusInfo.classe : ''}" data-deal-id-card="${deal.ID}"><div class="card-id">${displayId}</div><div class="card-client-name">${nomeCliente}</div>${prazoTagHtml}</div>`;
        }

        function limparTextoMensagem(texto) {
            if (!texto) return '';
            let textoLimpo = texto.replace(/^\[.+?\]\n-+\n/, '');
            textoLimpo = textoLimpo.replace(/^(?:\[.*?\]\s*)+(?:\[Message\]\s*)?/, '');
            return textoLimpo.trim();
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
                        const textoLimpo = limparTextoMensagem(msg.texto);
                        return `<div class="mensagem ${classe}">${textoLimpo}</div>`;
                    }).join('');
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                } else {
                    chatContainer.innerHTML = '<p class="info-text">Nenhuma mensagem ainda. Inicie a conversa.</p>';
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
            let stepsHtml = STATUS_ORDER.map((id, index) => {
                const status = STATUS_MAP[id];
                let stepClass = 'step';
                if (index < statusAtualIndex) stepClass += ' completed';
                else if (index === statusAtualIndex) stepClass += ' active ' + status.classe;
                return `<div class="${stepClass}" data-status-id="${id}">${status.nome}</div>`;
            }).join('');
            
            const nomeCliente = deal[NOME_CLIENTE_FIELD] || '---';
            const contatoCliente = deal[CONTATO_CLIENTE_FIELD] || '---';
            const medidaInfo = MEDIDAS_MAP[deal[MEDIDAS_FIELD]];
            let medidasHtml = medidaInfo ? `<span class="tag-medidas" style="background-color: ${medidaInfo.cor};">${medidaInfo.nome}</span>` : '---';
            
            let actionsHtml = '';
            if (deal[LINK_ARQUIVO_FINAL_FIELD]) actionsHtml += `<a href="${deal[LINK_ARQUIVO_FINAL_FIELD]}" target="_blank" class="btn-acao-modal principal">Baixar Arquivo</a>`;
            if (deal[LINK_ATENDIMENTO_FIELD]) actionsHtml += `<a href="${deal[LINK_ATENDIMENTO_FIELD]}" target="_blank" class="btn-acao-modal secundario">Ver Atendimento</a>`;
            if (deal.TITLE) actionsHtml += `<a href="https://www.visiva.com.br/admin/?imprimastore=pedidos/detalhes&id=${encodeURIComponent(deal.TITLE)}" target="_blank" class="btn-acao-modal secundario">Ver Pedido</a>`;
            if (actionsHtml === '') actionsHtml = '<p class="info-text">Nenhuma ação disponível.</p>';

            const isPago = deal[FIELD_STATUS_PAGAMENTO_DESIGNER] === STATUS_PAGO_ID;
            const revisaoIniciada = deal[REVISAO_SOLICITADA_FIELD] === '1';

            const approveButtonHtml = isPago ? '' : `<button class="btn-approve-file" data-action="approve-file" title="Aprovar arquivo"><i class="fas fa-check"></i> Arquivo Aprovado</button>`;
            const chatInnerHtml = `<div style="display: flex; justify-content: space-between; align-items: center;"><h3>Conversa de Revisão</h3>${approveButtonHtml}</div><div id="chat-revisao-container" class="chat-box"><div id="mensagens-container"><div class="loading-pedidos"><div class="spinner"></div></div></div><form id="form-mensagem" class="form-mensagem"><input type="text" id="input-mensagem" placeholder="Digite sua mensagem..." required><button type="submit" id="btn-enviar-mensagem" title="Enviar Mensagem"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg></button></form></div>`;
            const overlayHtml = `<div class="revisao-overlay"><p style="font-size: 1.1em; color: var(--cinza-texto); margin-bottom: 20px;">Este arquivo precisa de ajustes?</p><button class="btn-request-revision" data-action="request-revision"><i class="fas fa-exclamation-triangle"></i> Solicitar Revisão</button></div>`;
            const mainColumnWrapperClass = revisaoIniciada ? 'chat-iniciado' : '';
            let mainColumnHtml = `<div class="card-detalhe revisao-wrapper ${mainColumnWrapperClass}">${!revisaoIniciada ? overlayHtml : ''}${chatInnerHtml}</div>`;
            if (isPago) mainColumnHtml = `<div class="chat-bloqueado" title="Arquivo já aprovado.">${mainColumnHtml}</div>`;
            
            modalBody.innerHTML = `<div class="steps-container">${stepsHtml}</div><div class="detalhe-layout"><div class="detalhe-col-principal">${mainColumnHtml}</div><div class="detalhe-col-lateral"><div class="card-detalhe modal-actions-container">${actionsHtml}</div><div class="card-detalhe"><h3>Informações do Cliente</h3><div class="info-item"><span class="info-item-label">Nome:</span><span>${nomeCliente}</span></div><div class="info-item"><span class="info-item-label">Contato:</span><span>${contatoCliente}</span></div><div class="info-item"><span class="info-item-label">Medidas:</span>${medidasHtml}</div></div></div></div>`;
            modal.classList.add('active');
            
            if (revisaoIniciada) loadAndDisplayChatHistory(dealId);
            attachAllListeners(deal);
        }

        // --- FUNÇÕES DE EVENTOS (LISTENERS) ---

        function attachAllListeners(deal) {
            attachStatusStepListeners(deal.ID);
            const isRevisionActive = deal[REVISAO_SOLICITADA_FIELD] === '1';
            const isPago = deal[FIELD_STATUS_PAGAMENTO_DESIGNER] === STATUS_PAGO_ID;
            if (isRevisionActive && !isPago) {
                attachChatListeners(deal.ID);
            } else if (!isRevisionActive) {
                attachRevisionListener(deal.ID);
            }
        }
        
        function attachRevisionListener(dealId) {
            const requestRevisionBtn = modalBody.querySelector('button[data-action="request-revision"]');
            if (!requestRevisionBtn) return;
            requestRevisionBtn.addEventListener('click', async () => {
                const wrapper = requestRevisionBtn.closest('.revisao-wrapper');
                requestRevisionBtn.disabled = true;
                requestRevisionBtn.innerHTML = '<div class="spinner" style="width: 16px; height: 16px; border-width: 2px; margin: 0 auto;"></div>';
                try {
                    const response = await fetch('/api/impressao/requestRevision', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dealId }) });
                    if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.message); }
                    const dealIndex = allDealsData.findIndex(d => d.ID == dealId);
                    if (dealIndex > -1) allDealsData[dealIndex][REVISAO_SOLICITADA_FIELD] = '1';
                    wrapper.classList.add('chat-iniciado');
                    loadAndDisplayChatHistory(dealId);
                    attachChatListeners(dealId);
                } catch (error) {
                    alert('Erro: ' + error.message);
                    requestRevisionBtn.disabled = false;
                    requestRevisionBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Solicitar Revisão';
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
                        if (!response.ok) throw new Error((await response.json()).message);
                        alert('Arquivo aprovado com sucesso!');
                        const dealIndex = allDealsData.findIndex(d => d.ID == dealId);
                        if (dealIndex > -1) allDealsData[dealIndex][FIELD_STATUS_PAGAMENTO_DESIGNER] = STATUS_PAGO_ID;
                        openDetailsModal(dealId);
                    } catch (error) {
                        alert(`Erro: ${error.message}`);
                        approveBtn.disabled = false;
                        approveBtn.innerHTML = '<i class="fas fa-check"></i> Arquivo Aprovado';
                    }
                });
            }
        }
        
        function updateVisualStatus(dealId, newStatusId) { /* Esta função não precisa de alteração */ }

        function attachStatusStepListeners(dealId) { /* Esta função não precisa de alteração */ }

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
        
        init(); // Inicia o script
    });
})();