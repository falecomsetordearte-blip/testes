// painel-script.js

(function() {
    document.addEventListener('DOMContentLoaded', () => {

        const sessionToken = localStorage.getItem('sessionToken');
        if (!sessionToken) { window.location.href = 'login.html'; return; }
        
        // --- CONSTANTES DE CAMPOS BITRIX ---
        const CAMPO_TIPO_ARTE = 'UF_CRM_1761269158';
        const CAMPO_LINK_ACOMPANHAR = 'UF_CRM_1752712769666'; 
        const CAMPO_LINK_FALAR_DESIGNER = 'UF_CRM_1764429361'; 
        const CAMPO_MEDIDAS = 'UF_CRM_1727464924690';
        const CAMPO_CLIENTE = 'UF_CRM_1741273407628';
        const CAMPO_BRIEFING = 'UF_CRM_1738249371'; // Novo
        const CAMPO_SERVICO = 'UF_CRM_1761123161542'; // Novo
        
        const FASES_ANALISE = ['C17:NEW', 'C17:UC_2OEE24'];

        const modalDetalhes = document.getElementById('modal-detalhes-rapidos');
        const modalTitle = document.getElementById('modal-titulo');
        const modalBody = document.getElementById('modal-body-content');
        const closeModalBtn = modalDetalhes.querySelector('.close-modal');

        let allDealsData = [];

        // --- ESTILOS VISUAIS (CSS) ---
        const style = document.createElement('style');
        style.textContent = `
            :root { 
                --primary: #e67e22; 
                --purple-badge: #9b59b6; 
                --bg-card: #fff;
                --text-dark: #2c3e50;
                --text-muted: #7f8c8d;
            }
            
            .kanban-board { display: flex; gap: 20px; overflow-x: auto; padding-bottom: 20px; align-items: flex-start; height: calc(100vh - 150px); }
            .kanban-column { min-width: 320px; width: 320px; display: flex; flex-direction: column; max-height: 100%; }
            .column-header { padding: 12px; border-radius: 8px; font-weight: 700; color: white; text-align: center; margin-bottom: 15px; text-transform: uppercase; font-size: 0.9rem; letter-spacing: 0.5px; }
            .col-novos .column-header { background-color: #3498db; }
            .col-andamento .column-header { background-color: #f39c12; }
            .col-ajustes .column-header { background-color: #e74c3c; }
            .col-aguardando .column-header { background-color: #2c3e50; }
            
            .column-cards { flex-grow: 1; overflow-y: auto; padding-right: 5px; display: flex; flex-direction: column; gap: 12px; }
            
            /* --- CARD BASE (CLICÁVEL) --- */
            .kanban-card { 
                background: var(--bg-card); border-radius: 12px; padding: 15px; 
                box-shadow: 0 3px 6px rgba(0,0,0,0.04); 
                cursor: pointer; position: relative; transition: all 0.2s; 
                border: 1px solid #f0f0f0;
            }
            .kanban-card:hover { transform: translateY(-3px); box-shadow: 0 8px 15px rgba(0,0,0,0.08); }
            
            /* CARD ESMAECIDO (FREELANCER) */
            .card-faded { 
                opacity: 0.75; 
                background-color: #fafafa; 
                border-left: 4px solid #bdc3c7; 
            }
            .card-faded:hover { opacity: 1; border-color: #95a5a6; }

            /* CARD DESIGNER PRÓPRIO (MAIS BONITO) */
            .card-internal-styled {
                border-left: 5px solid #3498db;
                background: white;
            }
            .internal-info-row {
                display: flex; justify-content: space-between; align-items: center;
                margin-top: 10px; padding-top: 10px; border-top: 1px solid #f5f5f5;
            }
            .tag-servico {
                background: #eaf2f8; color: #2980b9; 
                padding: 4px 8px; border-radius: 4px; 
                font-size: 0.75rem; font-weight: 700; text-transform: uppercase;
            }
            .internal-icon { font-size: 1.2rem; color: #ecf0f1; }

            /* TARJA ROXA */
            .badge-analise {
                background: var(--purple-badge); color: white; padding: 6px 10px; 
                border-radius: 8px 8px 0 0; font-size: 0.8rem; font-weight: 700; 
                display: flex; align-items: center; justify-content: space-between;
                margin: -16px -16px 12px -16px; 
            }
            .info-icon-btn { cursor: pointer; color: white; margin-left: 8px; }
            .info-icon-btn:hover { transform: scale(1.1); }

            /* TIPOGRAFIA DO CARD */
            .card-id { font-size: 0.7rem; color: #bbb; font-weight: 700; position: absolute; top: 15px; right: 15px; }
            .badge-analise + .card-id { top: 40px; }
            .card-title { font-size: 1rem; font-weight: 600; color: var(--text-dark); margin-bottom: 5px; padding-right: 40px; line-height: 1.3; }
            .card-subtitle { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 10px; }

            /* BOTÕES INTERNOS DO CARD */
            .card-actions { display: flex; gap: 8px; margin-top: 10px; }
            .btn-card { 
                flex: 1; padding: 8px; border-radius: 6px; border: none; 
                font-size: 0.8rem; font-weight: 600; cursor: pointer; text-decoration: none; 
                text-align: center; color: white; display: flex; align-items: center; justify-content: center; gap: 5px;
                transition: opacity 0.2s;
            }
            .btn-card:hover { opacity: 0.9; }
            .btn-acompanhar { background-color: #27ae60; }
            .btn-designer { background-color: #2980b9; }

            /* TAG FREELANCER */
            .freelancer-tag { display: flex; align-items: center; gap: 6px; background: #eee; padding: 4px 8px; border-radius: 20px; width: fit-content; margin-bottom: 8px; }
            .freelancer-tag img { width: 18px; height: 18px; border-radius: 50%; }
            .freelancer-tag span { font-size: 0.7rem; font-weight: 700; color: #666; }

            /* --- MODAL STYLES --- */
            .detalhe-layout { display: grid; grid-template-columns: 2fr 1fr; gap: 25px; min-height: 400px; }
            
            /* Área do Briefing */
            .briefing-area {
                background: #fdfdfd; border: 1px solid #e0e0e0; border-radius: 8px;
                padding: 20px; overflow-y: auto; max-height: 500px;
                font-family: 'Courier New', Courier, monospace; font-size: 0.9rem; color: #444;
                white-space: pre-wrap; /* Mantém quebra de linha */
                box-shadow: inset 0 2px 5px rgba(0,0,0,0.03);
            }
            .briefing-label { font-weight: 700; color: #3498db; margin-bottom: 10px; display: block; font-family: 'Poppins', sans-serif; }

            /* Coluna Direita Modal */
            .detalhe-col-dir { display: flex; flex-direction: column; gap: 15px; }
            .card-info-modal { background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #eee; }
            .modal-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.9rem; border-bottom: 1px solid #eee; padding-bottom: 5px; }
            .modal-row strong { color: #2c3e50; }
            
            .btn-modal-action { width: 100%; padding: 12px; border-radius: 6px; font-weight: 700; border: none; cursor: pointer; color: white; margin-top: 10px; }
            .btn-aprovar { background-color: #27ae60; }
            .btn-aprovar:hover { background-color: #219150; }

            /* MODAL INFO (Alert Replacement) */
            .custom-info-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 10000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(2px); animation: fadeIn 0.2s; }
            .custom-info-box { background: white; padding: 30px; border-radius: 12px; width: 90%; max-width: 400px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
            .custom-info-box h3 { color: var(--purple-badge); margin-top: 0; }
            .btn-info-action { background: var(--purple-badge); color: white; padding: 10px 20px; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; margin-top: 20px; width: 100%; }
            .btn-info-close { background: transparent; color: #888; border: none; margin-top: 10px; cursor: pointer; font-size: 0.9rem; }
            @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        `;
        document.head.appendChild(style);

        // --- LÓGICA DE DADOS ---

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
            } catch(e) {
                console.error(e);
            }
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

        // --- CRIAÇÃO DOS CARDS ---
        function criarCardHTML(deal) {
            const tipoArte = deal[CAMPO_TIPO_ARTE];
            const isFreelancer = (tipoArte === 'Setor de Arte' || tipoArte === 'Freelancer');
            const linkAcompanhar = deal[CAMPO_LINK_ACOMPANHAR];
            const linkDesigner = deal[CAMPO_LINK_FALAR_DESIGNER];
            const displayId = deal.TITLE ? `#${deal.TITLE}` : `#${deal.ID}`;
            const nomeCliente = deal[CAMPO_CLIENTE] || 'Cliente não ident.';
            const servico = deal['UF_CRM_1761123161542'] || 'Arte Digital'; // Campo Serviço
            
            const isEmAnalise = FASES_ANALISE.includes(deal.STAGE_ID);

            // Variáveis de construção
            let cardClasses = 'kanban-card';
            let headerHtml = '';
            let bodyHtml = '';
            let footerHtml = '';
            let dragLocked = false;

            // --- TIPO 1: EM ANÁLISE (Roxo + Faded) ---
            if (isEmAnalise) {
                cardClasses += ' card-faded card-locked';
                dragLocked = true;
                headerHtml = `
                    <div class="badge-analise">
                        <span>EM ANÁLISE</span>
                        <i class="far fa-question-circle info-icon-btn" onclick="abrirInfoModal(event)"></i>
                    </div>`;
                
                bodyHtml = `
                    <div class="freelancer-tag">
                        <img src="/images/logo-redonda.svg" alt="Logo"><span>FREELANCER</span>
                    </div>
                    <div class="card-title">${nomeCliente}</div>
                    <div class="card-subtitle">Aguardando aceite...</div>`;
                
                footerHtml = `
                    <div class="card-actions">
                        ${linkDesigner ? `<a href="${linkDesigner}" target="_blank" class="btn-card btn-designer" onclick="event.stopPropagation()"><i class="fab fa-whatsapp"></i> Designer</a>` : ''}
                    </div>`;
            }
            // --- TIPO 2: FREELANCER PADRÃO (Faded) ---
            else if (isFreelancer) {
                cardClasses += ' card-faded card-locked';
                dragLocked = true; // Freelancer geralmente não move manualmente nas colunas internas
                
                bodyHtml = `
                    <div class="freelancer-tag">
                        <img src="/images/logo-redonda.svg" alt="Logo"><span>FREELANCER</span>
                    </div>
                    <div class="card-title">${nomeCliente}</div>
                    <div class="card-subtitle">${servico}</div>`;
                
                footerHtml = `
                    <div class="card-actions">
                        ${linkAcompanhar ? `<a href="${linkAcompanhar}" target="_blank" class="btn-card btn-acompanhar" onclick="event.stopPropagation()"><i class="fab fa-whatsapp"></i> Acompanhar</a>` : ''}
                        ${linkDesigner ? `<a href="${linkDesigner}" target="_blank" class="btn-card btn-designer" onclick="event.stopPropagation()"><i class="fab fa-whatsapp"></i> Designer</a>` : ''}
                    </div>`;
            }
            // --- TIPO 3: DESIGNER PRÓPRIO (Estilizado e Cheio) ---
            else {
                cardClasses += ' card-internal-styled';
                
                bodyHtml = `
                    <div class="card-title" style="font-size:1.1rem;">${nomeCliente}</div>
                    <div class="card-subtitle" style="margin-bottom:5px;">ID: ${displayId}</div>
                    
                    <div class="internal-info-row">
                        <span class="tag-servico">${servico}</span>
                        <i class="fas fa-pencil-ruler internal-icon"></i>
                    </div>`;
                
                // Sem botões no footer, pois o clique no card abre tudo
            }

            // O ID flutuante
            const idHtml = `<div class="card-id">${displayId}</div>`;

            // Clique no card abre modal (exceto se clicar nos botões internos)
            return `
                <div class="${cardClasses}" data-deal-id="${deal.ID}" onclick="abrirModal(${deal.ID})" ${dragLocked ? 'data-locked="true"' : ''}>
                    ${headerHtml}
                    ${!isEmAnalise ? idHtml : ''}
                    ${bodyHtml}
                    ${footerHtml}
                </div>
            `;
        }

        // --- MODAL DETALHES (Com Briefing e Sem Ajustes) ---
        window.abrirModal = function(dealId) {
            const deal = allDealsData.find(d => d.ID == dealId);
            if(!deal) return;

            const tipoArte = deal[CAMPO_TIPO_ARTE];
            const isFreelancer = (tipoArte === 'Setor de Arte' || tipoArte === 'Freelancer');
            const briefingTexto = deal['UF_CRM_1738249371'] || 'Nenhum briefing registrado no sistema.';

            modalTitle.innerText = `Detalhes: ${deal.TITLE || deal.ID}`;

            // Coluna Esquerda: BRIEFING COMPLETO
            const leftCol = `
                <div class="briefing-area">
                    <span class="briefing-label"><i class="fas fa-file-alt"></i> BRIEFING DO PEDIDO</span>
                    ${briefingTexto}
                </div>
            `;

            // Coluna Direita: INFO + AÇÕES
            let actionsHtml = '';
            if (isFreelancer) {
                actionsHtml = `
                    <div class="alert-bloqueado">
                        <i class="fas fa-lock"></i> Pedido Freelancer<br>
                        Gerencie pelo WhatsApp.
                    </div>
                `;
            } else {
                // Apenas Aprovar (Removeu "Ajustes")
                actionsHtml = `
                    <button class="btn-modal-action btn-aprovar" onclick="atualizarStatusArte(${deal.ID}, 'APROVADO')">
                        <i class="fas fa-check-circle"></i> Aprovar e Finalizar
                    </button>
                    <p style="font-size:0.8rem; color:#aaa; text-align:center; margin-top:10px;">
                        Para ajustes, mova o card manualmente para a coluna correspondente.
                    </p>
                `;
            }

            const infoHtml = `
                <div class="card-info-modal">
                    <div class="modal-row"><span>Cliente:</span> <strong>${deal[CAMPO_CLIENTE] || '-'}</strong></div>
                    <div class="modal-row"><span>Medidas:</span> <strong>${deal[CAMPO_MEDIDAS] || '-'}</strong></div>
                    <div class="modal-row"><span>Serviço:</span> <strong>${deal['UF_CRM_1761123161542'] || '-'}</strong></div>
                </div>
                ${actionsHtml}
            `;

            modalBody.innerHTML = `
                <div class="detalhe-layout">
                    ${leftCol}
                    <div class="detalhe-col-dir">
                        ${infoHtml}
                    </div>
                </div>
            `;

            modalDetalhes.classList.add('active');
        }

        // --- FUNÇÕES AUXILIARES ---
        window.abrirInfoModal = function(event) {
            event.stopPropagation();
            const existente = document.getElementById('custom-info-modal');
            if(existente) existente.remove();

            const overlay = document.createElement('div');
            overlay.id = 'custom-info-modal';
            overlay.className = 'custom-info-overlay';
            overlay.innerHTML = `
                <div class="custom-info-box">
                    <h3><i class="fas fa-info-circle"></i> Em Análise</h3>
                    <p>O pedido está sendo analisado pelos freelancers.</p>
                    <p>Use o botão azul <strong>'Designer'</strong> para conversar com eles.</p>
                    <button class="btn-info-action" onclick="window.open('/pedido-em-analise.html', '_blank')">Saiba Mais</button>
                    <button class="btn-info-close" onclick="document.getElementById('custom-info-modal').remove()">Fechar</button>
                </div>`;
            
            overlay.onclick = (e) => { if(e.target === overlay) overlay.remove(); };
            document.body.appendChild(overlay);
        };

        window.atualizarStatusArte = async function(dealId, action) {
            if(!confirm('Confirma a aprovação da arte?')) return;
            const btn = document.activeElement;
            btn.innerText = '...'; btn.disabled = true;

            try {
                const res = await fetch('/api/arte/updateStatus', {
                    method: 'POST', headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({ sessionToken, dealId, action })
                });
                const data = await res.json();
                if(!res.ok) throw new Error(data.message);

                modalDetalhes.classList.remove('active');
                if(data.movedToNextStage) {
                    const card = document.querySelector(`.kanban-card[data-deal-id="${dealId}"]`);
                    if(card) card.remove();
                } else {
                    carregarPainelArte();
                }
            } catch(e) {
                console.error(e);
                btn.disabled = false;
            }
        }

        function initDragAndDrop() {
            const columns = document.querySelectorAll('.column-cards');
            columns.forEach(col => {
                new Sortable(col, {
                    group: 'arteBoard',
                    animation: 150,
                    filter: '.card-locked',
                    onMove: (evt) => !evt.dragged.classList.contains('card-locked'),
                    onEnd: (evt) => {
                        if (evt.from !== evt.to) {
                            moverCard(evt.item.dataset.dealId, evt.to.parentElement.dataset.columnId);
                        }
                    }
                });
            });
        }

        async function moverCard(dealId, novaColuna) {
            await fetch('/api/arte/moveCard', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ sessionToken, dealId, novaColuna })
            });
        }

        closeModalBtn.addEventListener('click', () => modalDetalhes.classList.remove('active'));
        carregarPainelArte();
    });
})();