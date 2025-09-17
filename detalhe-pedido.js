// /impressao/painel-script.js - VERSÃO COM FUNDO DO CARD COLORIDO E CHAT MELHORADO

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

        const impressoraFilterEl = document.getElementById('impressora-filter');
        const materialFilterEl = document.getElementById('material-filter');
        const btnFiltrar = document.getElementById('btn-filtrar');
        const board = document.querySelector('.kanban-board');
        const modal = document.getElementById('modal-detalhes-rapidos');
        const modalTitle = document.getElementById('modal-titulo');
        const modalBody = document.getElementById('modal-body-content');
        const closeModalBtn = modal.querySelector('.close-modal');

        let allDealsData = [];

        // <-- MUDANÇA AQUI: Adicionamos o CSS para o overlay do chat -->
        const style = document.createElement('style');
        style.textContent = `
            /* Efeito de card clicável */
            .kanhan-card { transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out; }
            .kanban-card:hover { cursor: pointer; transform: translateY(-3px); box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
            .card-deadline-tag { margin-top: 8px; display: inline-block; background-color: #e9ecef; padding: 3px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; color: #495057; }
            .kanban-card.status-preparacao { border-left-color: ${STATUS_MAP['2657'].cor} !important; background-color: ${STATUS_MAP['2657'].corFundo}; }
            .kanban-card.status-na-fila { border-left-color: ${STATUS_MAP['2659'].cor} !important; background-color: ${STATUS_MAP['2659'].corFundo}; }
            .kanban-card.status-imprimindo { border-left-color: ${STATUS_MAP['2661'].cor} !important; background-color: ${STATUS_MAP['2661'].corFundo}; }
            .kanban-card.status-pronto { border-left-color: ${STATUS_MAP['2663'].cor} !important; background-color: ${STATUS_MAP['2663'].corFundo}; }

            /* --- ESTILOS DO MODAL E CHAT --- */
            #modal-detalhes-rapidos.modal-overlay, #modal-detalhes-rapidos .modal-content { transition: none !important; }
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
            .btn-approve-file { background-color: var(--sucesso); color: white; border: none; padding: 8px 12px; border-radius: 6px; font-size: 14px; font-weight: 500; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; }
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
            
            /* --- NOVOS ESTILOS PARA O OVERLAY DE REVISÃO --- */
            .revisao-wrapper { position: relative; }
            .revisao-overlay {
                position: absolute;
                top: 0; left: 0; right: 0; bottom: 0;
                background-color: rgba(248, 249, 250, 0.95);
                backdrop-filter: blur(2px);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                text-align: center;
                z-index: 10;
                padding: 20px;
                border-radius: 12px;
                transition: opacity 0.3s ease, visibility 0.3s ease;
            }
            .chat-iniciado .revisao-overlay {
                opacity: 0;
                visibility: hidden;
                pointer-events: none;
            }
            .btn-request-revision {
                background-color: var(--erro);
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 8px;
                font-weight: 600;
                font-size: 15px;
                cursor: pointer;
                transition: all 0.3s ease;
                display: inline-flex;
                align-items: center;
                gap: 10px;
            }
            .btn-request-revision:hover { background-color: #c0392b; transform: translateY(-2px); }
        `;
        document.head.appendChild(style);
        
        async function carregarOpcoesDeFiltro() { /* ...código sem alteração... */ }
        async function carregarPedidosDeImpressao() { /* ...código sem alteração... */ }
        function organizarPedidosNasColunas(deals) { /* ...código sem alteração... */ }
        function createCardHtml(deal) { /* ...código sem alteração... */ }

        // <-- MUDANÇA AQUI: Corrigimos a limpeza do texto da mensagem -->
        function limparTextoMensagem(texto) {
            if (!texto) return '';
            // Remove o padrão [Autor]\n---\n
            let textoLimpo = texto.replace(/^\[.+?\]\n-+\n/, '');
            // Remove o padrão [ChatApp robot][...][Message]
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
                        const textoLimpo = limparTextoMensagem(msg.texto); // Usando a nova função
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
        
        // <-- MUDANÇA AQUI: A maior alteração está na construção do modal -->
        function openDetailsModal(dealId) {
            const deal = allDealsData.find(d => d.ID == dealId);
            if (!deal) return;
            modalTitle.textContent = `Detalhes do Pedido #${deal.TITLE || deal.ID}`;
            
            // --- Construção dos Steps (sem alteração) ---
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
            
            // --- Construção das informações laterais (sem alteração) ---
            const nomeCliente = deal[NOME_CLIENTE_FIELD] || '---';
            const contatoCliente = deal[CONTATO_CLIENTE_FIELD] || '---';
            const medidasId = deal[MEDIDAS_FIELD];
            const medidaInfo = MEDIDAS_MAP[medidasId];
            let medidasHtml = medidaInfo ? `<span class="tag-medidas" style="background-color: ${medidaInfo.cor};">${medidaInfo.nome}</span>` : '---';
            const linkArquivo = deal[LINK_ARQUIVO_FINAL_FIELD];
            const linkAtendimento = deal[LINK_ATENDIMENTO_FIELD];
            let actionsHtml = '';
            if (linkArquivo) actionsHtml += `<a href="${linkArquivo}" target="_blank" class="btn-acao-modal principal">Baixar Arquivo</a>`;
            if (linkAtendimento) actionsHtml += `<a href="${linkAtendimento}" target="_blank" class="btn-acao-modal secundario">Ver Atendimento</a>`;
            if (deal.TITLE) {
                const urlVerPedido = `https://www.visiva.com.br/admin/?imprimastore=pedidos/detalhes&id=${encodeURIComponent(deal.TITLE)}`;
                actionsHtml += `<a href="${urlVerPedido}" target="_blank" class="btn-acao-modal secundario">Ver Pedido</a>`;
            }
            if (actionsHtml === '') actionsHtml = '<p class="info-text" style="text-align:center; color: #555;">Nenhuma ação disponível.</p>';

            // --- REESTRUTURAÇÃO DA COLUNA PRINCIPAL (CHAT) ---
            const isPago = deal[FIELD_STATUS_PAGAMENTO_DESIGNER] === STATUS_PAGO_ID;
            const revisaoIniciada = deal[REVISAO_SOLICITADA_FIELD] === '1';

            // 1. O HTML do chat é sempre criado
            const approveButtonHtml = isPago ? '' : `<button class="btn-approve-file" data-action="approve-file" title="Aprovar o arquivo, processar pagamento e finalizar."><i class="fas fa-check"></i> Arquivo Aprovado</button>`;
            const chatInnerHtml = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3>Conversa de Revisão</h3>
                    ${approveButtonHtml}
                </div>
                <div id="chat-revisao-container" class="chat-box">
                    <div id="mensagens-container" style="flex-grow: 1; overflow-y: auto; padding-right: 10px;">
                        <div class="loading-pedidos"><div class="spinner"></div></div>
                    </div>
                    <form id="form-mensagem" class="form-mensagem">
                        <input type="text" id="input-mensagem" placeholder="Digite sua mensagem..." required>
                        <button type="submit" id="btn-enviar-mensagem" title="Enviar Mensagem">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>
                        </button>
                    </form>
                </div>`;
            
            // 2. O HTML do overlay para iniciar a revisão é sempre criado
            const overlayHtml = `
                <div class="revisao-overlay">
                    <p style="font-size: 1.1em; color: var(--cinza-texto); margin-bottom: 20px;">Este arquivo precisa de ajustes?</p>
                    <button class="btn-request-revision" data-action="request-revision">
                        <i class="fas fa-exclamation-triangle"></i>
                        Solicitar Revisão
                    </button>
                </div>`;

            // 3. Montamos a coluna principal com base no estado
            const mainColumnWrapperClass = revisaoIniciada ? 'chat-iniciado' : '';
            let mainColumnHtml = `
                <div class="card-detalhe revisao-wrapper ${mainColumnWrapperClass}">
                    ${!revisaoIniciada ? overlayHtml : ''}
                    ${chatInnerHtml}
                </div>
            `;
            
            // Se já foi pago, bloqueamos tudo
            if (isPago) {
                mainColumnHtml = `<div class="chat-bloqueado" title="Arquivo desse Pedido já foi aprovado.">${mainColumnHtml}</div>`;
            }
            
            // --- MONTAGEM FINAL DO MODAL ---
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
            
            if (revisaoIniciada) {
                loadAndDisplayChatHistory(dealId);
            }
            attachAllListeners(deal);
        }

        function attachAllListeners(deal) {
            attachStatusStepListeners(deal.ID);
            const isRevisionActive = deal[REVISAO_SOLICITADA_FIELD] === '1';
            const isPago = deal[FIELD_STATUS_PAGAMENTO_DESIGNER] === STATUS_PAGO_ID;
            if (isRevisionActive && !isPago) { attachChatListeners(deal.ID); } 
            else if (!isRevisionActive) { attachRevisionListener(deal.ID); }
        }
        
        // <-- MUDANÇA AQUI: Simplificamos o listener de revisão -->
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
                    
                    // Atualiza o estado localmente para consistência
                    const dealIndex = allDealsData.findIndex(d => d.ID == dealId);
                    if (dealIndex > -1) { allDealsData[dealIndex][REVISAO_SOLICITADA_FIELD] = '1'; }

                    // Apenas remove a classe para mostrar o chat, sem recarregar tudo
                    wrapper.classList.add('chat-iniciado');
                    loadAndDisplayChatHistory(dealId); // Carrega o histórico de chat
                    attachChatListeners(dealId); // Anexa os listeners do chat
                    
                } catch (error) {
                    alert('Erro: ' + error.message);
                    // Restaura o botão em caso de falha
                    requestRevisionBtn.disabled = false;
                    requestRevisionBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Solicitar Revisão';
                }
            });
        }
        
        function attachChatListeners(dealId) { /* ...código sem alteração... */ }
        function updateVisualStatus(dealId, newStatusId) { /* ...código sem alteração... */ }
        function attachStatusStepListeners(dealId) { /* ...código sem alteração... */ }
        
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