// painel-script.js - KANBAN DE ARTE (Lógica Completa)

(function() {
    document.addEventListener('DOMContentLoaded', () => {

        const sessionToken = localStorage.getItem('sessionToken');
        if (!sessionToken) {
            window.location.href = 'login.html'; 
            return;
        }
        
        // --- CONFIGURAÇÕES ---
        const CAMPO_TIPO_ARTE = 'UF_CRM_1761269158';
        const CAMPO_LINK_ACOMPANHAR = 'UF_CRM_1752712769666'; 
        const CAMPO_LINK_FALAR_DESIGNER = 'UF_CRM_1764429361'; 
        const CAMPO_MEDIDAS = 'UF_CRM_1727464924690';
        const CAMPO_CLIENTE = 'UF_CRM_1741273407628';
        
        const board = document.querySelector('.kanban-board');
        const modal = document.getElementById('modal-detalhes-rapidos');
        const modalTitle = document.getElementById('modal-titulo');
        const modalBody = document.getElementById('modal-body-content');
        const closeModalBtn = modal.querySelector('.close-modal');

        let allDealsData = [];

        // --- ESTILOS VISUAIS INJETADOS ---
        const style = document.createElement('style');
        style.textContent = `
            :root {
                --primary: #e67e22; 
                --locked: #95a5a6;
                --success: #27ae60;
                --bg-card: #fff;
                --shadow-sm: 0 2px 5px rgba(0,0,0,0.05);
            }

            .kanban-board { display: flex; gap: 20px; overflow-x: auto; padding-bottom: 20px; align-items: flex-start; height: calc(100vh - 150px); }
            .kanban-column { min-width: 300px; width: 300px; background: transparent; display: flex; flex-direction: column; max-height: 100%; }
            
            .column-header { padding: 12px; border-radius: 8px; font-weight: 700; color: white; text-align: center; margin-bottom: 15px; box-shadow: var(--shadow-sm); text-transform: uppercase; font-size: 0.9rem; }
            .col-novos .column-header { background-color: #3498db; }
            .col-andamento .column-header { background-color: #e67e22; }
            .col-ajustes .column-header { background-color: #e74c3c; }
            .col-aguardando .column-header { background-color: #f1c40f; color: #333; }

            .column-cards { flex-grow: 1; overflow-y: auto; padding-right: 5px; display: flex; flex-direction: column; gap: 10px; min-height: 100px; }

            .kanban-card { 
                background: var(--bg-card); border-radius: 10px; padding: 15px; 
                box-shadow: var(--shadow-sm); border-left: 5px solid var(--primary); 
                cursor: grab; position: relative; transition: transform 0.2s;
            }
            .kanban-card:hover { transform: translateY(-3px); box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
            
            /* Card Bloqueado (Freelancer) */
            .kanban-card.card-locked { 
                border-left-color: var(--locked); 
                background-color: #f8f9fa; 
                opacity: 0.9; 
                cursor: default !important;
            }
            .kanban-card.card-locked:hover { transform: none; box-shadow: var(--shadow-sm); }
            
            .card-id { font-size: 0.75rem; color: #aaa; font-weight: 600; position: absolute; top: 15px; right: 15px; }
            .card-title { font-size: 1rem; font-weight: 600; color: #333; margin-bottom: 10px; padding-right: 40px; }
            
            .freelancer-tag { 
                display: flex; align-items: center; gap: 8px; margin-bottom: 10px; 
                background: #eee; padding: 5px 10px; border-radius: 20px; width: fit-content;
            }
            .freelancer-tag img { width: 20px; height: 20px; border-radius: 50%; }
            .freelancer-tag span { font-size: 0.75rem; font-weight: 600; color: #555; text-transform: uppercase; }

            .card-actions { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 10px; }
            .btn-card { 
                flex: 1; padding: 6px; border-radius: 4px; border: none; font-size: 0.8rem; font-weight: 600; 
                cursor: pointer; text-decoration: none; text-align: center; display: flex; 
                align-items: center; justify-content: center; gap: 5px; color: white;
            }
            .btn-acompanhar { background-color: #2ecc71; }
            .btn-acompanhar:hover { background-color: #27ae60; }
            .btn-designer { background-color: #3498db; }
            .btn-designer:hover { background-color: #2980b9; }
            .btn-visualizar { background-color: #ecf0f1; color: #333; border: 1px solid #ddd; }
            .btn-visualizar:hover { background-color: #e0e0e0; }

            .detalhe-layout { display: grid; grid-template-columns: 1.5fr 1fr; gap: 20px; min-height: 400px; }
            .detalhe-col-esq { background: #f8f9fa; border: 2px dashed #ddd; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
            .detalhe-col-dir { display: flex; flex-direction: column; gap: 15px; }
            .card-detalhe { background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #eee; }
            .info-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f5f5f5; font-size: 0.9rem; }
            
            .btn-status-action { width: 100%; padding: 12px; border-radius: 6px; font-weight: 700; border: none; cursor: pointer; margin-bottom: 10px; font-size: 0.95rem; color: white; transition: transform 0.2s; }
            .btn-ajustes { background-color: #e74c3c; }
            .btn-aprovado { background-color: #27ae60; }
            .btn-status-action:hover { transform: translateY(-2px); }
            
            .alert-bloqueado { background: #fff3cd; color: #856404; padding: 10px; border-radius: 6px; font-size: 0.85rem; border: 1px solid #ffeeba; text-align: center; }

            /* TOAST SYSTEM (Reutilizado do script.js ou criado aqui) */
            .toast-container { position: fixed; top: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px; }
            .toast { background: white; padding: 15px 20px; border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.15); border-left: 5px solid #ccc; animation: slideIn 0.3s forwards; }
            .toast.success { border-left-color: #2ecc71; }
            .toast.error { border-left-color: #e74c3c; }
            @keyframes slideIn { from { opacity:0; transform:translateX(50px); } to { opacity:1; transform:translateX(0); } }
        `;
        document.head.appendChild(style);

        // --- TOAST LOCAL (Caso script.js não tenha carregado ainda) ---
        let toastContainer = document.querySelector('.toast-container');
        if(!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
        }
        function showToast(msg, type='success') {
            const t = document.createElement('div');
            t.className = `toast ${type}`;
            t.textContent = msg;
            toastContainer.appendChild(t);
            setTimeout(() => { t.remove(); }, 4000);
        }

        // --- CARREGAMENTO ---
        async function carregarPainelArte() {
            document.querySelectorAll('.column-cards').forEach(c => c.innerHTML = '<div style="padding:20px;text-align:center;color:#ccc">Carregando...</div>');
            try {
                const res = await fetch('/api/arte/getBoardData', {
                    method: 'POST', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ sessionToken: sessionToken })
                });
                const data = await res.json();
                if(!res.ok) throw new Error(data.message);
                
                allDealsData = data.deals;
                renderizarBoard(allDealsData);
            } catch(e) {
                console.error(e);
                showToast(e.message || 'Erro ao carregar', 'error');
            }
        }

        function renderizarBoard(deals) {
            document.querySelectorAll('.column-cards').forEach(c => c.innerHTML = '');
            
            deals.forEach(deal => {
                const colunaId = deal.coluna_local || 'NOVOS';
                const container = document.getElementById(`cards-${colunaId}`);
                if(container) container.innerHTML += criarCardHTML(deal);
            });

            initDragAndDrop();
        }

        function criarCardHTML(deal) {
            const tipoArte = deal[CAMPO_TIPO_ARTE];
            const isFreelancer = (tipoArte === 'Setor de Arte' || tipoArte === 'Freelancer');
            const linkAcompanhar = deal[CAMPO_LINK_ACOMPANHAR];
            const linkDesigner = deal[CAMPO_LINK_FALAR_DESIGNER];
            const displayId = deal.TITLE ? `#${deal.TITLE}` : `#${deal.ID}`;
            const nomeCliente = deal[CAMPO_CLIENTE] || 'Cliente não id.';

            let extraContent = '';
            let cardClass = 'kanban-card';

            if (isFreelancer) {
                cardClass += ' card-locked';
                extraContent += `
                    <div class="freelancer-tag">
                        <img src="/images/logo-redonda.svg" alt="Logo">
                        <span>Freelancer</span>
                    </div>
                    <div class="card-actions">
                        ${linkAcompanhar ? `<a href="${linkAcompanhar}" target="_blank" class="btn-card btn-acompanhar"><i class="fab fa-whatsapp"></i> Acompanhar</a>` : ''}
                        ${linkDesigner ? `<a href="${linkDesigner}" target="_blank" class="btn-card btn-designer"><i class="fab fa-whatsapp"></i> Designer</a>` : ''}
                        <button class="btn-card btn-visualizar" onclick="abrirModal(${deal.ID})">Visualizar</button>
                    </div>
                `;
            } else {
                extraContent += `
                    <div class="card-actions">
                        <button class="btn-card btn-visualizar" style="background:#fff; border:1px solid #ccc; color:#333;" onclick="abrirModal(${deal.ID})">
                            <i class="fas fa-eye"></i> Abrir Detalhes
                        </button>
                    </div>
                `;
            }

            return `
                <div class="${cardClass}" data-deal-id="${deal.ID}" ${isFreelancer ? 'data-locked="true"' : ''}>
                    <div class="card-id">${displayId}</div>
                    <div class="card-title">${nomeCliente}</div>
                    ${extraContent}
                </div>
            `;
        }

        function initDragAndDrop() {
            const columns = document.querySelectorAll('.column-cards');
            columns.forEach(col => {
                new Sortable(col, {
                    group: 'arteBoard',
                    animation: 150,
                    filter: '.card-locked', // Bloqueia freelancer
                    onMove: function (evt) { return !evt.dragged.classList.contains('card-locked'); },
                    onEnd: function (evt) {
                        if (evt.from !== evt.to) {
                            const dealId = evt.item.dataset.dealId;
                            const novaColuna = evt.to.parentElement.dataset.columnId;
                            moverCard(dealId, novaColuna);
                        }
                    }
                });
            });
        }

        async function moverCard(dealId, novaColuna) {
            try {
                await fetch('/api/arte/moveCard', {
                    method: 'POST', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ sessionToken, dealId, novaColuna })
                });
            } catch(e) {
                showToast('Erro ao mover. Recarregando...', 'error');
                carregarPainelArte();
            }
        }

        // --- MODAL ---
        window.abrirModal = function(dealId) {
            const deal = allDealsData.find(d => d.ID == dealId);
            if(!deal) return;

            const tipoArte = deal[CAMPO_TIPO_ARTE];
            const isFreelancer = (tipoArte === 'Setor de Arte' || tipoArte === 'Freelancer');
            
            modalTitle.innerText = `Arte #${deal.TITLE || deal.ID}`;
            
            const leftCol = `
                <div class="detalhe-col-esq">
                    <div style="text-align:center; color:#ccc;">
                        <i class="fas fa-image" style="font-size:3rem;"></i>
                        <p>Layout / Imagem</p>
                    </div>
                </div>
            `;

            let actionsHtml = '';
            if (isFreelancer) {
                actionsHtml = `
                    <div class="alert-bloqueado">
                        <i class="fas fa-lock"></i> Pedido com Freelancer/Setor de Arte.<br>
                        Acompanhe o status pelo Bitrix ou WhatsApp.
                    </div>
                    <div class="card-actions" style="margin-bottom:15px;">
                        ${deal[CAMPO_LINK_ACOMPANHAR] ? `<a href="${deal[CAMPO_LINK_ACOMPANHAR]}" target="_blank" class="btn-card btn-acompanhar" style="padding:12px;">Acompanhar (Zap)</a>` : ''}
                        ${deal[CAMPO_LINK_FALAR_DESIGNER] ? `<a href="${deal[CAMPO_LINK_FALAR_DESIGNER]}" target="_blank" class="btn-card btn-designer" style="padding:12px;">Falar c/ Designer</a>` : ''}
                    </div>
                `;
            } else {
                actionsHtml = `
                    <button id="btn-ajustes" class="btn-status-action btn-ajustes" onclick="atualizarStatusArte(${deal.ID}, 'AJUSTES')">
                        <i class="fas fa-exclamation-circle"></i> Solicitar Ajustes
                    </button>
                    <button id="btn-aprovado" class="btn-status-action btn-aprovado" onclick="atualizarStatusArte(${deal.ID}, 'APROVADO')">
                        <i class="fas fa-check-circle"></i> Aprovar Arte
                    </button>
                `;
            }

            const infoHtml = `
                <div class="card-detalhe">
                    <div class="info-item"><span>Cliente:</span> <strong>${deal[CAMPO_CLIENTE] || '-'}</strong></div>
                    <div class="info-item"><span>Medidas:</span> ${deal[CAMPO_MEDIDAS] || '-'}</div>
                    <div class="info-item"><span>Tipo:</span> ${tipoArte || 'Próprio'}</div>
                </div>
            `;

            modalBody.innerHTML = `<div class="detalhe-layout">${leftCol}<div class="detalhe-col-dir">${actionsHtml}${infoHtml}</div></div>`;
            modal.classList.add('active');
        }

        window.atualizarStatusArte = async function(dealId, action) {
            // Confirmação via Botão (2 etapas)
            const btn = document.getElementById(action === 'AJUSTES' ? 'btn-ajustes' : 'btn-aprovado');
            if(btn && !btn.dataset.confirming) {
                btn.dataset.confirming = "true";
                const originalText = btn.innerHTML;
                btn.innerHTML = "Clique para confirmar";
                setTimeout(() => { 
                    btn.innerHTML = originalText; 
                    delete btn.dataset.confirming; 
                }, 3000);
                return;
            }

            if(btn) btn.innerHTML = "Processando...";

            try {
                const res = await fetch('/api/arte/updateStatus', {
                    method: 'POST', headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({ sessionToken, dealId, action })
                });
                const data = await res.json();
                if(!res.ok) throw new Error(data.message);

                showToast(data.message, 'success');
                modal.classList.remove('active');
                
                if(data.movedToNextStage) {
                    const card = document.querySelector(`.kanban-card[data-deal-id="${dealId}"]`);
                    if(card) card.remove();
                } else {
                    carregarPainelArte(); 
                }
            } catch(e) {
                showToast('Erro: ' + e.message, 'error');
            }
        }

        closeModalBtn.addEventListener('click', () => modal.classList.remove('active'));
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });

        carregarPainelArte();
    });
})();