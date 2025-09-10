// /vendas-script.js - VERSÃO COMPLETA COM DEPURAÇÃO DETALHADA

(function() {
    console.log("[DEBUG] Script vendas-script.js iniciado.");
    
    document.addEventListener('DOMContentLoaded', () => {
        / Define a altura do quadro Kanban
        setKanbanHeight();
        // E recalcula a altura se a janela for redimensionada
        window.addEventListener('resize', setKanbanHeight);
        
        console.log("[DEBUG] DOM completamente carregado.");

        // PONTO DE VERIFICAÇÃO 1: Autenticação
        const sessionToken = localStorage.getItem('sessionToken');
        const userName = localStorage.getItem('userName');

        if (!sessionToken) {
            console.error("[ERRO FATAL] Token de sessão não encontrado. Esta página requer login.");
            // Se esta página for para usuários logados, descomente a linha abaixo para redirecionar.
            // window.location.href = 'login.html'; 
            return;
        }
        console.log("[DEBUG] Token de sessão encontrado.");

        const greetingEl = document.getElementById('user-greeting'); // Assumindo que o cabeçalho tem esse ID
        if (greetingEl && userName) {
            greetingEl.textContent = `Olá, ${userName}!`;
            console.log(`[DEBUG] Saudação preenchida para: ${userName}`);
        }
        function setKanbanHeight() {
        const header = document.querySelector('.app-header');
        const kanbanHeader = document.querySelector('.kanban-header');
        const kanbanBoard = document.querySelector('.kanban-board');

        if (header && kanbanHeader && kanbanBoard) {
            const headerHeight = header.offsetHeight;
            const kanbanHeaderHeight = kanbanHeader.offsetHeight;
            const extraPadding = 40; // 20px de padding em cima e 20px em baixo no .main-kanban

            // Calcula a altura restante na tela
            const availableHeight = window.innerHeight - headerHeight - kanbanHeaderHeight - extraPadding;
            
            // Define a altura do quadro Kanban
            kanbanBoard.style.height = `${availableHeight}px`;
        }
    }
        // --- CONSTANTES E ELEMENTOS DO DOM ---
        const STAGES = {
            contato_inicial: 'UC_Z087DH',      // CONFIRME ESTES VALORES
            orcamento_enviado: 'UC_56HAVY',    // CONFIRME ESTES VALORES
            aguardando_pagamento: 'UC_XF49AO', // CONFIRME ESTES VALORES
            produzir: 'WON'
        };

        const columnPages = {
            contato_inicial: 0,
            orcamento_enviado: 0,
            aguardando_pagamento: 0
        };

        // --- FUNÇÃO PARA RENDERIZAR UM CARD ---
        function createCardHtml(deal) {
            const valorFormatado = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(deal.OPPORTUNITY) || 0);
            return `
                <div class="kanban-card" data-deal-id="${deal.ID}">
                    <div class="card-title">${deal.TITLE}</div>
                    <div class="card-contact">${deal.CONTACT_NAME}</div>
                    <div class="card-footer">
                        <span class="card-value">${valorFormatado}</span>
                        <button class="card-button-produzir" data-deal-id="${deal.ID}">PRODUZIR</button>
                    </div>
                </div>
            `;
        }

        // --- FUNÇÃO PARA BUSCAR E RENDERIZAR DADOS ---
        async function fetchAndRenderDeals(columnKey = null, loadMore = false) {
            console.log(`[DEBUG] Iniciando fetchAndRenderDeals. Coluna: ${columnKey || 'todas'}, LoadMore: ${loadMore}`);
            
            if (columnKey) {
                columnPages[columnKey]++;
            } else {
                Object.keys(columnPages).forEach(key => columnPages[key] = 0);
            }

            try {
                const response = await fetch('/api/getSalesDeals', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pages: columnPages })
                });

                console.log(`[DEBUG] Resposta da API /api/getSalesDeals recebida com status: ${response.status}`);
                
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || `Erro de servidor ${response.status}`);
                }
                
                console.log("[DEBUG] Dados recebidos da API:", data);

                for (const key in data) {
                    const container = document.getElementById(`cards-${key}`);
                    if (!loadMore && container) container.innerHTML = '';

                    let columnTotal = 0;
                    if (data[key] && container) {
                        data[key].forEach(deal => {
                            container.innerHTML += createCardHtml(deal);
                            columnTotal += parseFloat(deal.OPPORTUNITY) || 0;
                        });
                    }
                    
                    const totalEl = document.getElementById(`total-${key}`);
                    if (totalEl) {
                        const currentTotal = loadMore ? (parseFloat(totalEl.textContent.replace('R$', '').replace(/\./g, '').replace(',', '.')) || 0) : 0;
                        const newTotal = currentTotal + columnTotal;
                        totalEl.textContent = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(newTotal);
                    }
                }
            } catch (error) {
                console.error('Erro ao buscar negócios:', error);
                const firstColumn = document.getElementById('cards-contato_inicial');
                if (firstColumn) {
                    firstColumn.innerHTML = `<p style="color:red; padding: 15px;">Erro ao carregar: ${error.message}</p>`;
                }
            }
        }
        
        // --- FUNÇÃO PARA ATUALIZAR ETAPA DE UM NEGÓCIO ---
        async function updateDealStage(dealId, newStageId) {
            console.log(`[DEBUG] Tentando mover o deal ${dealId} para a etapa ${newStageId}`);
            try {
                const response = await fetch('/api/updateDealStage', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dealId, newStageId })
                });
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.message);
                }
                console.log(`[SUCESSO] Negócio ${dealId} movido.`);
            } catch (error) {
                console.error('Erro ao atualizar etapa:', error);
                alert(`Erro ao mover o card: ${error.message}. A página será recarregada para reverter.`);
                window.location.reload();
            }
        }

        // --- INICIALIZAÇÃO DO DRAG AND DROP ---
        function initializeKanban() {
            const columns = document.querySelectorAll('.column-cards');
            columns.forEach(column => {
                new Sortable(column, {
                    group: 'kanban',
                    animation: 150,
                    onEnd: function (evt) {
                        const card = evt.item;
                        const dealId = card.dataset.dealId;
                        const newColumn = evt.to;
                        const newStageId = newColumn.closest('.kanban-column').dataset.stageId;
                        
                        updateDealStage(dealId, newStageId);
                    }
                });
            });
            console.log("[DEBUG] Kanban (Drag and Drop) inicializado.");
        }

        // --- EVENT LISTENERS ---
        document.querySelector('.kanban-board').addEventListener('click', (event) => {
            if (event.target.classList.contains('load-more-btn')) {
                const columnKey = event.target.dataset.column;
                fetchAndRenderDeals(columnKey, true);
            }
            if (event.target.classList.contains('card-button-produzir')) {
                const dealId = event.target.dataset.dealId;
                if (confirm(`Tem certeza que deseja mover o pedido #${dealId} para a produção?`)) {
                    updateDealStage(dealId, STAGES.produzir);
                    event.target.closest('.kanban-card').remove();
                }
            }
        });

        // --- EXECUÇÃO INICIAL ---
        console.log("[DEBUG] Chamando fetchAndRenderDeals e initializeKanban.");
        fetchAndRenderDeals();
        initializeKanban(); 
    });
})();