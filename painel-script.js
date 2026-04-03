// painel-script.js - VERSÃO COM DESIGNER VISÍVEL

(function() {
    document.addEventListener('DOMContentLoaded', () => {

        const sessionToken = localStorage.getItem('sessionToken');
        if (!sessionToken) { window.location.href = 'login.html'; return; }
        
        // --- CONSTANTES ---
        const CAMPO_TIPO_ARTE = 'UF_CRM_1761269158';
        const CAMPO_LINK_ACOMPANHAR = 'UF_CRM_1752712769666'; 
        const CAMPO_LINK_FALAR_DESIGNER = 'UF_CRM_1764429361'; 
        const CAMPO_MEDIDAS = 'UF_CRM_1727464924690';
        const CAMPO_CLIENTE = 'UF_CRM_1741273407628';
        const CAMPO_BRIEFING = 'UF_CRM_1738249371'; 
        const CAMPO_SERVICO = 'UF_CRM_1761123161542'; 
        
        // Elementos Modais
        const modalDetalhes = document.getElementById('modal-detalhes-rapidos');
        const modalTitle = document.getElementById('modal-titulo');
        const modalBody = document.getElementById('modal-body-content');
        const closeModalBtn = modalDetalhes.querySelector('.close-modal');

        const modalAprovacao = document.getElementById('modal-aprovacao-link');
        const inputLinkImpressao = document.getElementById('input-link-impressao');
        const btnConfirmarAprovacao = document.getElementById('btn-confirmar-aprovacao');
        const closeModalAprovacaoBtn = document.querySelector('.close-modal-aprovacao');
        
        let allDealsData = [];
        let dealIdPendenteAprovacao = null;

        // --- CSS INJETADO ---
        const style = document.createElement('style');
        style.textContent = `
            :root { --primary: #e67e22; --purple-badge: #9b59b6; --bg-card: #fff; --text-dark: #2c3e50; --text-muted: #7f8c8d; }
            .kanban-board { display: flex; gap: 20px; overflow-x: auto; padding-bottom: 20px; align-items: flex-start; height: calc(100vh - 150px); }
            .kanban-column { min-width: 320px; width: 320px; display: flex; flex-direction: column; max-height: 100%; }
            .column-header { padding: 12px; border-radius: 8px; font-weight: 700; color: white; text-align: center; margin-bottom: 15px; text-transform: uppercase; font-size: 0.9rem; letter-spacing: 0.5px; }
            .col-novos .column-header { background-color: #3498db; }
            .col-andamento .column-header { background-color: #f39c12; }
            .col-ajustes .column-header { background-color: #e74c3c; }
            .col-aguardando .column-header { background-color: #2c3e50; }
            .column-cards { flex-grow: 1; overflow-y: auto; padding-right: 5px; display: flex; flex-direction: column; gap: 12px; }
            .column-cards::-webkit-scrollbar { width: 5px; }
            .column-cards::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
            
            .kanban-card { background: var(--bg-card); border-radius: 12px; padding: 15px; box-shadow: 0 3px 6px rgba(0,0,0,0.04); cursor: pointer; position: relative; transition: all 0.2s; border: 1px solid #f0f0f0; }
            .kanban-card:hover { transform: translateY(-3px); box-shadow: 0 8px 15px rgba(0,0,0,0.08); }
            
            .card-internal-styled { border-left: 5px solid #3498db; background: white; }
            .internal-info-row { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 10px; border-top: 1px solid #f5f5f5; }
            .tag-servico { background: #eaf2f8; color: #2980b9; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }
            
            /* TAG DESIGNER */
            .designer-badge { 
                display: inline-flex; align-items: center; gap: 6px; 
                background: #e0f2fe; color: #0284c7; 
                padding: 4px 8px; border-radius: 20px; 
                font-size: 0.75rem; font-weight: 600; margin-bottom: 8px;
            }
            .designer-badge i { font-size: 0.8rem; }

            .card-id { font-size: 0.7rem; color: #bbb; font-weight: 700; position: absolute; top: 15px; right: 15px; }
            .card-title { font-size: 1rem; font-weight: 600; color: var(--text-dark); margin-bottom: 5px; padding-right: 40px; line-height: 1.3; }
            .card-subtitle { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 10px; }

            /* MODAL */
            .detalhe-layout { display: grid; grid-template-columns: 2fr 1fr; gap: 25px; min-height: 400px; }
            .briefing-area { background: #fdfdfd; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; overflow-y: auto; max-height: 500px; font-family: 'Courier New', Courier, monospace; font-size: 0.9rem; color: #444; white-space: pre-wrap; }
            .briefing-label { font-weight: 700; color: #3498db; margin-bottom: 10px; display: block; font-family: 'Poppins', sans-serif; }
            .card-info-modal { background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #eee; }
            .modal-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.9rem; border-bottom: 1px solid #eee; padding-bottom: 5px; }
            .btn-modal-action { width: 100%; padding: 12px; border-radius: 6px; font-weight: 700; border: none; cursor: pointer; color: white; margin-top: 10px; }
            .btn-aprovar { background-color: #27ae60; }
            .btn-aprovar:hover { background-color: #219150; }
        `;
        document.head.appendChild(style);

        // --- LÓGICA ---

        async function carregarPainelArte() {
            document.querySelectorAll('.column-cards').forEach(c => c.innerHTML = '<div style="padding:20px;text-align:center;color:#ccc"><i class="fas fa-spinner fa-spin"></i></div>');
            try {
                const res = await fetch('/api/arte/getBoardData', {
                    method: 'POST', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ sessionToken: sessionToken })
                });
                const data = await res.json();
                if(!res.ok) throw new Error(data.message);
                
                allDealsData = data.deals;
                renderizarBoard(allDealsData);
            } catch(e) { console.error(e); }
        }

        function renderizarBoard(deals) {
            document.querySelectorAll('.column-cards').forEach(c => c.innerHTML = '');
            if (deals.length === 0) {
                document.getElementById('cards-NOVOS').innerHTML = '<div style="padding:20px;text-align:center;color:#ccc">Nenhum pedido.</div>';
                return;
            }
            deals.forEach(deal => {
                const container = document.getElementById(`cards-${deal.coluna_local}`);
                if(container) container.innerHTML += criarCardHTML(deal);
            });
            initDragAndDrop();
        }

        function criarCardHTML(deal) {
            const displayId = deal.TITLE ? `#${deal.TITLE}` : `#${deal.ID}`;
            const nomeCliente = deal[CAMPO_CLIENTE] || 'Cliente não ident.';
            const servico = deal[CAMPO_SERVICO] || 'Arte Digital'; 
            
            // Verifica se tem designer nomeado
            let designerHtml = '';
            if (deal.DESIGNER_NOME) {
                designerHtml = `<div class="designer-badge"><i class="fas fa-user-pen"></i> ${deal.DESIGNER_NOME.split(' ')[0]}</div>`;
            }

            const isAdmin = localStorage.getItem('userPermissoes')?.includes('"admin"');
            const adminHtml = isAdmin ? `<div class="btn-master-icon" onclick="event.stopPropagation(); if(window.abrirAdminModal) window.abrirAdminModal('${deal.ID}')" title="Ações Forçadas do Mestre (BD)"><i class="fas fa-ellipsis-v"></i></div>` : '';

            return `
                <div class="kanban-card card-internal-styled" data-deal-id="${deal.ID}" onclick="abrirModal(${deal.ID})" style="position: relative;">
                    ${adminHtml}
                    <div class="card-id">${displayId}</div>
                    
                    ${designerHtml} <!-- Exibe o nome do designer aqui -->
                    
                    <div class="card-title" style="font-size:1.1rem;">${nomeCliente}</div>
                    
                    <div class="internal-info-row">
                        <span class="tag-servico">${servico}</span>
                        ${deal.coluna_local === 'EM_ANDAMENTO' ? '' : '<i class="fas fa-pencil-ruler internal-icon"></i>'}
                    </div>
                </div>
            `;
        }

        window.abrirModal = function(dealId) {
            const deal = allDealsData.find(d => d.ID == dealId);
            if(!deal) return;

            const briefingTexto = deal[CAMPO_BRIEFING] || 'Nenhum briefing registrado no sistema.';
            modalTitle.innerText = `Detalhes: ${deal.TITLE || deal.ID}`;

            const leftCol = `
                <div class="briefing-area">
                    <span class="briefing-label"><i class="fas fa-file-alt"></i> BRIEFING DO PEDIDO</span>
                    ${briefingTexto}
                </div>`;

            const actionsHtml = `
                <button class="btn-modal-action btn-aprovar" onclick="atualizarStatusArte(${deal.ID}, 'APROVADO')">
                    <i class="fas fa-check-circle"></i> Aprovar e Finalizar
                </button>
                <p style="font-size:0.8rem; color:#aaa; text-align:center; margin-top:10px;">
                    Para ajustes, mova o card manualmente.
                </p>`;

            const designerInfo = deal.DESIGNER_NOME 
                ? `<div class="modal-row" style="background:#e0f2fe; padding:8px; border-radius:4px; color:#0284c7; font-weight:600;"><span>Designer:</span> <span>${deal.DESIGNER_NOME}</span></div>` 
                : '';

            const infoHtml = `
                <div class="card-info-modal">
                    ${designerInfo}
                    <div class="modal-row"><span>Cliente:</span> <strong>${deal[CAMPO_CLIENTE] || '-'}</strong></div>
                    <div class="modal-row"><span>Medidas:</span> <strong>${deal[CAMPO_MEDIDAS] || '-'}</strong></div>
                    <div class="modal-row"><span>Serviço:</span> <strong>${deal[CAMPO_SERVICO] || '-'}</strong></div>
                </div>
                ${actionsHtml}`;

            modalBody.innerHTML = `<div class="detalhe-layout">${leftCol}<div class="detalhe-col-dir">${infoHtml}</div></div>`;
            modalDetalhes.classList.add('active');
        }

        // --- ATUALIZAR STATUS ---
        window.atualizarStatusArte = async function(dealId, action) {
            if (action === 'APROVADO') {
                dealIdPendenteAprovacao = dealId;
                inputLinkImpressao.value = ''; 
                modalAprovacao.classList.add('active'); 
                return; 
            }
            await enviarAtualizacao(dealId, action, null);
        }

        async function enviarAtualizacao(dealId, action, linkArquivo) {
            try {
                // Aqui usamos o finalizarPedido do DESIGNER para manter a lógica de pagamento e status
                // Mas adaptado para ser chamado pelo Admin. 
                // Se a API for diferente, ajustar a URL. Assumindo que o Admin usa a mesma lógica:
                const res = await fetch('/api/arte/updateStatus', { // Crie essa rota ou use a existente
                    method: 'POST', headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({ sessionToken, dealId, action, linkArquivo }) 
                });
                
                const data = await res.json();
                if(!res.ok) throw new Error(data.message);

                modalDetalhes.classList.remove('active'); 
                modalAprovacao.classList.remove('active'); 
                
                // Remove o card da tela
                const card = document.querySelector(`.kanban-card[data-deal-id="${dealId}"]`);
                if(card) card.remove();
                
            } catch(e) {
                console.error(e);
                window.adminCustomDialog({ type: 'alert', title: 'Erro', message: 'Erro: ' + e.message });
            }
        }

        if(btnConfirmarAprovacao) {
            btnConfirmarAprovacao.addEventListener('click', () => {
                const link = inputLinkImpressao.value.trim();
                if(!link) { window.adminCustomDialog({ type: 'alert', title: 'Aviso', message: 'Insira o link.' }); return; }
                
                if(dealIdPendenteAprovacao) {
                    const textoOriginal = btnConfirmarAprovacao.innerText;
                    btnConfirmarAprovacao.innerText = 'Enviando...';
                    btnConfirmarAprovacao.disabled = true;

                    enviarAtualizacao(dealIdPendenteAprovacao, 'APROVADO', link)
                        .then(() => {
                            btnConfirmarAprovacao.innerText = textoOriginal;
                            btnConfirmarAprovacao.disabled = false;
                        })
                        .catch(() => {
                            btnConfirmarAprovacao.innerText = textoOriginal;
                            btnConfirmarAprovacao.disabled = false;
                        });
                }
            });
        }

        if(closeModalAprovacaoBtn) closeModalAprovacaoBtn.addEventListener('click', () => modalAprovacao.classList.remove('active'));

        function initDragAndDrop() {
            const columns = document.querySelectorAll('.column-cards');
            columns.forEach(col => {
                new Sortable(col, {
                    group: 'arteBoard', animation: 150,
                    onEnd: (evt) => {
                        if (evt.from !== evt.to) {
                            // moverCard(evt.item.dataset.dealId, evt.to.parentElement.dataset.columnId);
                            // Implementar lógica de mover se necessário
                        }
                    }
                });
            });
        }

        closeModalBtn.addEventListener('click', () => modalDetalhes.classList.remove('active'));
        carregarPainelArte();
    });
})();