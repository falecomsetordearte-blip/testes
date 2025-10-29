// /instalacao/painel-script.js

(function() {
    document.addEventListener('DOMContentLoaded', () => {

        const sessionToken = localStorage.getItem('sessionToken');
        if (!sessionToken) {
            window.location.href = '../login.html'; 
            return;
        }
        
        // --- CONFIGURAÇÕES PRINCIPAIS PARA INSTALAÇÃO ---

        // TODO: Substitua pelo ID do seu NOVO campo customizado "Status da Instalação".
        const STATUS_INSTALACAO_FIELD = 'UF_CRM_NOVO_CAMPO_STATUS_INSTALACAO'; 

        // TODO: Substitua pelos IDs REAIS das opções do seu novo campo de lista.
        const STATUS_MAP = {
            '3001': { nome: 'Instalando', cor: '#3498db', classe: 'instalando', corFundo: '#aed6f1' }, // Azul
            '3003': { nome: 'Pronto',     cor: '#27ae60', classe: 'pronto',     corFundo: '#a9dfbf' }  // Verde
        };
        const STATUS_ORDER = ['3001', '3003']; // A ordem das etapas no modal

        // Campos do Bitrix que usamos (mantidos da impressão, ajuste se necessário)
        const NOME_CLIENTE_FIELD = 'UF_CRM_1741273407628';
        const CONTATO_CLIENTE_FIELD = 'UF_CRM_1749481565243';
        const LINK_ATENDIMENTO_FIELD = 'UF_CRM_1752712769666';
        const MEDIDAS_FIELD = 'UF_CRM_1727464924690';
        const LINK_ARQUIVO_FINAL_FIELD = 'UF_CRM_1748277308731';
        const PRAZO_FINAL_FIELD = 'UF_CRM_1757794109';
        
        // Mapeamento de medidas (pode ser mantido ou removido se não for usado)
        const MEDIDAS_MAP = {
            '1437': { nome: 'Conferir', cor: '#e74c3c' },
            '1439': { nome: 'Cliente', cor: '#f1c40f' },
            '1441': { nome: 'Conferida', cor: '#2ecc71' }
        };
        // --- FIM DAS CONFIGURAÇÕES ---

        const board = document.querySelector('.kanban-board');
        const modal = document.getElementById('modal-detalhes-rapidos');
        const modalTitle = document.getElementById('modal-titulo');
        const modalBody = document.getElementById('modal-body-content');
        const closeModalBtn = modal.querySelector('.close-modal');

        let allDealsData = [];

        // O CSS dinâmico agora cria as classes para os novos status
        const style = document.createElement('style');
        style.textContent = `
            .kanban-card:hover { cursor: pointer; transform: translateY(-3px); box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
            .card-deadline-tag { margin-top: 8px; display: inline-block; background-color: #e9ecef; padding: 3px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; color: #495057; }
            
            .kanban-card.status-instalando { border-left-color: ${STATUS_MAP['3001'].cor} !important; background-color: ${STATUS_MAP['3001'].corFundo}; }
            .kanban-card.status-pronto { border-left-color: ${STATUS_MAP['3003'].cor} !important; background-color: ${STATUS_MAP['3003'].corFundo}; }

            .steps-container { display: flex; padding: 20px 10px; margin-bottom: 20px; border-bottom: 1px solid #ddd; }
            .step { flex: 1; text-align: center; position: relative; color: #6c757d; font-weight: 600; font-size: 14px; padding: 10px 5px; background-color: #f8f9fa; border: 1px solid #dee2e6; cursor: pointer; transition: all 0.2s ease-in-out; }
            .step:first-child { border-radius: 6px 0 0 6px; } .step:last-child { border-radius: 0 6px 6px 0; }
            .step:not(:last-child)::after { content: ''; position: absolute; right: -13px; top: 50%; transform: translateY(-50%); width: 0; height: 0; border-top: 21px solid transparent; border-bottom: 21px solid transparent; border-left: 13px solid #f8f9fa; z-index: 2; }
            .step:not(:last-child)::before { content: ''; position: absolute; right: -14px; top: 50%; transform: translateY(-50%); width: 0; height: 0; border-top: 21px solid transparent; border-bottom: 21px solid transparent; border-left: 13px solid #dee2e6; z-index: 1; }
            .step.completed { background-color: #6c757d; border-color: #5c636a; color: #fff; }
            .step.completed:not(:last-child)::after { border-left-color: #6c757d; }
            .step.active { z-index: 3; transform: scale(1.05); color: #fff; }
            .step.active.instalando { background-color: ${STATUS_MAP['3001'].cor}; border-color: ${STATUS_MAP['3001'].cor}; }
            .step.active.instalando:not(:last-child)::after { border-left-color: ${STATUS_MAP['3001'].cor}; }
            .step.active.pronto { background-color: ${STATUS_MAP['3003'].cor}; border-color: ${STATUS_MAP['3003'].cor}; }

            /* Estilos de modal (sem alterações) */
            .detalhe-layout { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; }
            .card-detalhe { background-color: #fff; border-radius: 12px; padding: 25px; margin-bottom: 20px; }
            .modal-actions-container { display: flex; flex-direction: column; gap: 10px; }
            .modal-actions-container .btn-acao-modal { display: block; text-decoration: none; text-align: center; padding: 10px; border-radius: 6px; font-weight: 600; }
            .modal-actions-container .btn-acao-modal.principal { background-color: #007bff; color: white; }
            .modal-actions-container .btn-acao-modal.secundario { background-color: #f1f1f1; border: 1px solid #ddd; color: #333; }
            .info-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #eee; }
            .tag-medidas { padding: 4px 10px; border-radius: 4px; color: white; font-weight: 600; font-size: 12px; }
        `;
        document.head.appendChild(style);
        
        // Função para carregar os pedidos de instalação
        async function carregarPedidos() {
            document.querySelectorAll('.column-cards').forEach(col => col.innerHTML = '<div class="loading-pedidos"><div class="spinner"></div></div>');
            try {
                // Chama a nova API de instalação
                const response = await fetch('/api/instalacao/getDeals', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionToken: sessionToken }) // Envia apenas o token
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);
                allDealsData = data.deals;
                organizarPedidosNasColunas(allDealsData);
            } catch (error) {
                console.error("Erro ao carregar pedidos de instalação:", error);
                board.innerHTML = `<p style="color:red; padding: 20px;">${error.message}</p>`;
            }
        }

        // Organiza os cards nas colunas por prazo (lógica idêntica à de impressão)
        function organizarPedidosNasColunas(deals) {
            document.querySelectorAll('.column-cards').forEach(col => col.innerHTML = '');
            deals.forEach(deal => {
                let colunaId = 'SEM_DATA';
                const prazoFinalStr = deal[PRAZO_FINAL_FIELD];
                if (prazoFinalStr) {
                    const prazoData = new Date(prazoFinalStr.split('T')[0]);
                    const hoje = new Date();
                    hoje.setHours(0,0,0,0);
                    const diffDays = Math.ceil((prazoData - hoje) / (1000 * 60 * 60 * 24));
                    if (diffDays < 0) colunaId = 'ATRASADO';
                    else if (diffDays === 0) colunaId = 'HOJE';
                    else if (diffDays <= 7) colunaId = 'ESSA_SEMANA';
                    else colunaId = 'PROXIMA_SEMANA';
                }
                const cardHtml = createCardHtml(deal);
                const coluna = document.getElementById(`cards-${colunaId}`);
                if (coluna) coluna.innerHTML += cardHtml;
            });
            document.querySelectorAll('.column-cards').forEach(col => {
                if (col.innerHTML === '') col.innerHTML = '<p class="info-text">Nenhum pedido aqui.</p>';
            });
        }
        
        // Cria o HTML de um card individual
        function createCardHtml(deal) {
            const nomeCliente = deal[NOME_CLIENTE_FIELD] || 'Cliente não informado';
            const statusId = deal[STATUS_INSTALACAO_FIELD];
            const statusInfo = STATUS_MAP[statusId] || {};
            const displayId = deal.TITLE ? `#${deal.TITLE}` : `#${deal.ID}`;
            let prazoTagHtml = '';
            if (deal[PRAZO_FINAL_FIELD]) {
                const dataFormatada = new Date(deal[PRAZO_FINAL_FIELD]).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                prazoTagHtml = `<div class="card-deadline-tag">Prazo: ${dataFormatada}</div>`;
            }
            return `
                <div class="kanban-card ${statusInfo.classe ? 'status-' + statusInfo.classe : ''}" data-deal-id-card="${deal.ID}">
                    <div class="card-id">${displayId}</div>
                    <div class="card-client-name">${nomeCliente}</div>
                    ${prazoTagHtml}
                </div>`;
        }
        
        // Abre o modal de detalhes (aqui a mágica dos 2 status acontece)
        function openDetailsModal(dealId) {
            const deal = allDealsData.find(d => d.ID == dealId);
            if (!deal) return;
            modalTitle.textContent = `Detalhes da Instalação #${deal.TITLE || deal.ID}`;
            
            // Define o status inicial. Se não houver, assume o primeiro da lista.
            const statusAtualId = deal[STATUS_INSTALACAO_FIELD] || STATUS_ORDER[0];
            const statusAtualIndex = STATUS_ORDER.indexOf(statusAtualId);
            
            // Graças ao STATUS_ORDER com 2 itens, este loop criará apenas 2 steps.
            let stepsHtml = '';
            STATUS_ORDER.forEach((id, index) => {
                const status = STATUS_MAP[id];
                let stepClass = 'step';
                if (index < statusAtualIndex) stepClass += ' completed';
                else if (index === statusAtualIndex) stepClass += ' active ' + status.classe;
                stepsHtml += `<div class="${stepClass}" data-status-id="${id}">${status.nome}</div>`;
            });

            // Coleta outras informações para o modal
            const nomeCliente = deal[NOME_CLIENTE_FIELD] || '---';
            const contatoCliente = deal[CONTATO_CLIENTE_FIELD] || '---';
            const medidaInfo = MEDIDAS_MAP[deal[MEDIDAS_FIELD]];
            let medidasHtml = medidaInfo ? `<span class="tag-medidas" style="background-color: ${medidaInfo.cor};">${medidaInfo.nome}</span>` : '---';
            
            let actionsHtml = '';
            if (deal[LINK_ARQUIVO_FINAL_FIELD]) { actionsHtml += `<a href="${deal[LINK_ARQUIVO_FINAL_FIELD]}" target="_blank" class="btn-acao-modal principal">Baixar Arquivo</a>`; }
            if (deal[LINK_ATENDIMENTO_FIELD]) { actionsHtml += `<a href="${deal[LINK_ATENDIMENTO_FIELD]}" target="_blank" class="btn-acao-modal secundario">Ver Atendimento</a>`; }

            modalBody.innerHTML = `
                <div class="steps-container">${stepsHtml}</div>
                <div class="detalhe-layout">
                    <div class="detalhe-col-principal">
                       <div class="card-detalhe" style="text-align: center; color: #888; padding: 50px 20px;">
                            <i class="fas fa-tools" style="font-size: 2.5rem; margin-bottom: 15px; opacity: 0.4;"></i>
                            <h3 style="margin:0;">Informações Adicionais</h3>
                            <p>Esta área pode ser usada para checklists ou observações.</p>
                       </div>
                    </div>
                    <div class="detalhe-col-lateral">
                        <div class="card-detalhe modal-actions-container">${actionsHtml || '<p>Nenhuma ação disponível.</p>'}</div>
                        <div class="card-detalhe">
                            <h3>Informações do Cliente</h3>
                            <div class="info-item"><span>Nome:</span><span>${nomeCliente}</span></div>
                            <div class="info-item"><span>Contato:</span><span>${contatoCliente}</span></div>
                            <div class="info-item"><span>Medidas:</span>${medidasHtml}</div>
                        </div>
                    </div>
                </div>`;
            modal.classList.add('active');
            attachStatusStepListeners(deal.ID);
        }

        // Função para atualizar o status (chama a nova API)
        function attachStatusStepListeners(dealId) {
            const container = document.querySelector('.steps-container');
            container.addEventListener('click', (event) => {
                const step = event.target.closest('.step');
                if (!step) return;
                const newStatusId = step.dataset.statusId;
                
                // Atualização otimista na interface
                const dealIndex = allDealsData.findIndex(d => d.ID == dealId);
                const oldStatusId = allDealsData[dealIndex][STATUS_INSTALACAO_FIELD];
                if (newStatusId === oldStatusId) return;
                updateVisualStatus(dealId, newStatusId);
                allDealsData[dealIndex][STATUS_INSTALACAO_FIELD] = newStatusId;

                // Envia a atualização para o backend
                fetch('/api/instalacao/updateStatus', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dealId, statusId: newStatusId })
                })
                .then(res => res.json().then(data => ({ ok: res.ok, data })))
                .then(({ ok, data }) => {
                    if (!ok) throw new Error(data.message);
                    console.log(`[Update Instalação] Sucesso: ${data.message}`);
                    if (data.movedToNextStage) {
                        setTimeout(() => {
                            modal.classList.remove('active');
                            carregarPedidos(); // Recarrega o painel para remover o card concluído
                        }, 500);
                    }
                })
                .catch(error => {
                    alert(`Erro: ${error.message}. Revertendo alteração.`);
                    updateVisualStatus(dealId, oldStatusId); // Reverte a UI em caso de erro
                    allDealsData[dealIndex][STATUS_INSTALACAO_FIELD] = oldStatusId;
                });
            });
        }

        function updateVisualStatus(dealId, newStatusId) {
            // Atualiza o modal
            const steps = document.querySelectorAll('.steps-container .step');
            const newStatusIndex = STATUS_ORDER.indexOf(newStatusId);
            steps.forEach((s, index) => {
                s.className = 'step';
                if (index < newStatusIndex) s.classList.add('completed');
                else if (index === newStatusIndex) s.classList.add('active', STATUS_MAP[newStatusId].classe);
            });
            // Atualiza o card no painel
            const card = document.querySelector(`.kanban-card[data-deal-id-card="${dealId}"]`);
            if (card) {
                card.className = 'kanban-card';
                card.classList.add('status-' + STATUS_MAP[newStatusId].classe);
            }
        }
        
        // Listeners de eventos
        closeModalBtn.addEventListener('click', () => modal.classList.remove('active'));
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });
        board.addEventListener('click', (event) => {
            const card = event.target.closest('.kanban-card');
            if (card) openDetailsModal(card.dataset.dealIdCard);
        });
        
        // Função inicial que carrega a página
        async function init() {
            await carregarPedidos();
        }
        init();
    });
})();