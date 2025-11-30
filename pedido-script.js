// painel-script.js - UI CRM STYLE, LÓGICA PRESERVADA

(function() {
    document.addEventListener('DOMContentLoaded', () => {

        const sessionToken = localStorage.getItem('sessionToken');
        if (!sessionToken) {
            window.location.href = 'login.html'; 
            return;
        }
        
        // --- CONSTANTES DO BITRIX (NÃO ALTERAR) ---
        const CAMPO_TIPO_ARTE = 'UF_CRM_1761269158';
        const CAMPO_LINK_ACOMPANHAR = 'UF_CRM_1752712769666'; 
        const CAMPO_LINK_FALAR_DESIGNER = 'UF_CRM_1764429361'; 
        const CAMPO_MEDIDAS = 'UF_CRM_1727464924690';
        const CAMPO_CLIENTE = 'UF_CRM_1741273407628';
        
        // Elementos do DOM
        const slideOverlay = document.getElementById('slide-overlay');
        const slidePanel = document.getElementById('slide-panel');
        const panelBody = document.getElementById('panel-body-content');
        const panelTitle = document.getElementById('panel-titulo');
        const panelIdDisplay = document.getElementById('panel-id');

        let allDealsData = [];

        // --- FUNÇÕES DE UTILIDADE ---
        
        function showToast(msg, type='success') {
            const container = document.querySelector('.toast-container');
            if(!container) return; // Segurança
            const t = document.createElement('div');
            t.className = `toast ${type}`;
            const icon = type === 'success' ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-exclamation-circle"></i>';
            t.innerHTML = `${icon} <span>${msg}</span>`;
            container.appendChild(t);
            setTimeout(() => { 
                t.style.animation = 'slideIn 0.3s reverse forwards';
                setTimeout(() => t.remove(), 300); 
            }, 4000);
        }

        window.fecharPanel = function() {
            if(slideOverlay) slideOverlay.classList.remove('active');
            if(slidePanel) slidePanel.classList.remove('active');
        };

        // --- LÓGICA PRINCIPAL (API) ---

        async function carregarPainelArte() {
            document.querySelectorAll('.column-cards').forEach(c => c.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:0.9rem"><i class="fas fa-circle-notch fa-spin"></i> Carregando...</div>');
            
            try {
                const res = await fetch('/api/arte/getBoardData', {
                    method: 'POST', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ sessionToken: sessionToken })
                });
                
                const data = await res.json();
                if(!res.ok) throw new Error(data.message);
                
                allDealsData = data.deals || [];
                renderizarBoard(allDealsData);

            } catch(e) {
                console.error(e);
                showToast('Erro ao carregar pedidos: ' + e.message, 'error');
            }
        }

        function renderizarBoard(deals) {
            // Limpa colunas
            document.querySelectorAll('.column-cards').forEach(c => c.innerHTML = '');
            
            deals.forEach(deal => {
                const colunaId = deal.coluna_local || 'NOVOS';
                const container = document.getElementById(`cards-${colunaId}`);
                
                if(container) {
                    container.innerHTML += criarCardHTML(deal);
                }
            });

            // Se coluna vazia, mostra mensagem
            document.querySelectorAll('.column-cards').forEach(c => {
                if(c.innerHTML === '') c.innerHTML = '<div style="padding:20px;text-align:center;color:#cbd5e1;font-size:0.85rem;font-style:italic;">Nenhum item nesta etapa</div>';
            });

            initDragAndDrop();
        }

        function criarCardHTML(deal) {
            const tipoArte = deal[CAMPO_TIPO_ARTE] || 'Interno';
            const isFreelancer = (tipoArte === 'Setor de Arte' || tipoArte === 'Freelancer');
            const nomeCliente = deal[CAMPO_CLIENTE] || 'Cliente não identificado';
            const displayId = deal.TITLE ? `${deal.TITLE}` : `#${deal.ID}`;
            
            // Definição de classes e estilo do card
            let cardClasses = 'kanban-card';
            let tagHtml = `<span class="card-tag tag-proprio"><i class="fas fa-user-pen"></i> Interno</span>`;
            
            if (isFreelancer) {
                cardClasses += ' card-locked';
                tagHtml = `<span class="card-tag tag-freela"><img src="/images/logo-redonda.svg" style="width:14px; opacity:0.6;"> Freela</span>`;
            }

            // Ações rápidas no rodapé do card
            let footerActions = '';
            if (isFreelancer) {
                if(deal[CAMPO_LINK_ACOMPANHAR]) {
                    footerActions += `<a href="${deal[CAMPO_LINK_ACOMPANHAR]}" target="_blank" class="btn-card-action btn-whatsapp" onclick="event.stopPropagation()"><i class="fab fa-whatsapp"></i> Acompanhar</a>`;
                }
            } else {
                footerActions += `<button class="btn-card-action btn-ver"><i class="fas fa-eye"></i> Detalhes</button>`;
            }

            return `
                <div class="${cardClasses}" data-deal-id="${deal.ID}" onclick="abrirPanelDetalhes(${deal.ID})">
                    <div class="card-header-row">
                        <span class="card-id">${displayId}</span>
                        ${tagHtml}
                    </div>
                    <div class="card-title">${nomeCliente}</div>
                    <div class="card-footer-row">
                        ${footerActions}
                    </div>
                </div>
            `;
        }

        function initDragAndDrop() {
            const columns = document.querySelectorAll('.column-cards');
            columns.forEach(col => {
                // Remove instâncias antigas se necessário (Sortable gerencia bem, mas é bom garantir)
                // Aqui criamos uma nova instância
                new Sortable(col, {
                    group: 'arteBoard',
                    animation: 150,
                    delay: 100, // Previne arraste acidental ao rolar no mobile
                    delayOnTouchOnly: true,
                    ghostClass: 'sortable-ghost',
                    filter: '.card-locked', // IMPORTANTE: Mantém a regra de bloquear freelas
                    onMove: function (evt) {
                        return !evt.dragged.classList.contains('card-locked');
                    },
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
                const res = await fetch('/api/arte/moveCard', {
                    method: 'POST', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ sessionToken, dealId, novaColuna })
                });
                
                if(!res.ok) throw new Error("Falha ao salvar movimento");

            } catch(e) {
                showToast('Erro ao mover card. Recarregando...', 'error');
                carregarPainelArte(); // Reverte visualmente em caso de erro
            }
        }

        // --- LÓGICA DO DRAWER (DETALHES) ---
        
        window.abrirPanelDetalhes = function(dealId) {
            const deal = allDealsData.find(d => d.ID == dealId);
            if(!deal) return;

            const tipoArte = deal[CAMPO_TIPO_ARTE];
            const isFreelancer = (tipoArte === 'Setor de Arte' || tipoArte === 'Freelancer');
            
            // Preenche Cabeçalho
            panelTitle.innerText = deal[CAMPO_CLIENTE] || 'Sem Nome';
            panelIdDisplay.innerText = deal.TITLE ? `#${deal.TITLE}` : `#${deal.ID}`;
            
            // Gera Conteúdo Dinâmico
            let conteudoAcao = '';
            
            if (isFreelancer) {
                // Conteúdo para Freelancer (Apenas Links)
                conteudoAcao = `
                    <div style="background:#fffbeb; color:#b45309; padding:15px; border-radius:8px; border:1px solid #fcd34d; margin-bottom:20px; font-size:0.9rem;">
                        <i class="fas fa-lock" style="margin-right:5px;"></i> 
                        Este pedido está com Freelancer/Setor de Arte. O status é atualizado automaticamente.
                    </div>
                    <div class="panel-actions">
                         ${deal[CAMPO_LINK_ACOMPANHAR] ? `<a href="${deal[CAMPO_LINK_ACOMPANHAR]}" target="_blank" class="btn-large-action" style="background:#25D366; color:white; text-decoration:none;"><i class="fab fa-whatsapp"></i> Grupo WhatsApp</a>` : ''}
                         ${deal[CAMPO_LINK_FALAR_DESIGNER] ? `<a href="${deal[CAMPO_LINK_FALAR_DESIGNER]}" target="_blank" class="btn-large-action" style="background:#3498db; color:white; text-decoration:none;"><i class="fas fa-comment"></i> Falar com Designer</a>` : ''}
                    </div>
                `;
            } else {
                // Conteúdo Interno (Botões de Ação)
                conteudoAcao = `
                    <div class="panel-actions">
                        <button class="btn-large-action btn-ajustes" onclick="atualizarStatusArte(${deal.ID}, 'AJUSTES')">
                            <i class="fas fa-sync-alt"></i> Solicitar Ajustes
                        </button>
                        <button class="btn-large-action btn-aprovar" onclick="atualizarStatusArte(${deal.ID}, 'APROVADO')">
                            <i class="fas fa-check-circle"></i> Aprovar Arte
                        </button>
                    </div>
                    <p style="margin-top:10px; font-size:0.8rem; color:#94a3b8; text-align:center;">
                        Ao aprovar, o pedido será movido para Impressão.
                    </p>
                `;
            }

            panelBody.innerHTML = `
                ${conteudoAcao}

                <div class="image-placeholder">
                    <i class="fas fa-image" style="font-size:3rem; margin-bottom:10px; opacity:0.3;"></i>
                    <span>Visualização do Layout</span>
                    <small>(Em breve)</small>
                </div>

                <div class="detail-group">
                    <span class="detail-label">Medidas / Formato</span>
                    <div class="detail-value">${deal[CAMPO_MEDIDAS] || 'Não informado'}</div>
                </div>

                <div class="detail-group">
                    <span class="detail-label">Responsável pela Arte</span>
                    <div class="detail-value">${tipoArte || 'Designer Interno'}</div>
                </div>
            `;

            // Abre o painel
            slideOverlay.classList.add('active');
            slidePanel.classList.add('active');
        }

        window.atualizarStatusArte = async function(dealId, action) {
            const isApprove = action === 'APROVADO';
            const msg = isApprove ? 'Confirma que a arte está aprovada e pronta para impressão?' : 'Mover o card para a coluna de Ajustes?';
            
            if(!confirm(msg)) return;

            // Bloqueia botões visualmente
            const btns = document.querySelectorAll('.btn-large-action');
            btns.forEach(b => { b.disabled = true; b.style.opacity = 0.6; });

            try {
                const res = await fetch('/api/arte/updateStatus', {
                    method: 'POST', headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({ sessionToken, dealId, action })
                });
                const data = await res.json();
                
                if(!res.ok) throw new Error(data.message);

                showToast(data.message, 'success');
                fecharPanel();
                
                // Remove o card da tela se foi aprovado (vai pra impressão)
                if(data.movedToNextStage) {
                    const card = document.querySelector(`.kanban-card[data-deal-id="${dealId}"]`);
                    if(card) {
                        card.style.transition = 'all 0.3s';
                        card.style.opacity = '0';
                        card.style.transform = 'scale(0.9)';
                        setTimeout(() => card.remove(), 300);
                    }
                } else {
                    // Se foi ajuste, apenas recarrega para mudar de coluna
                    carregarPainelArte();
                }

            } catch(e) {
                showToast('Erro: ' + e.message, 'error');
                btns.forEach(b => { b.disabled = false; b.style.opacity = 1; });
            }
        }

        // Inicializa ao carregar
        carregarPainelArte();
    });
})();