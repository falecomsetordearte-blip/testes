// /vendas-script.js

(function() {
    // Mapeamento dos stages para facilitar a leitura
    const STAGES = {
        contato_inicial: 'UC_Z087DH',
        orcamento_enviado: 'UC_56HAVY',
        aguardando_pagamento: 'UC_XF49AO',
        produzir: 'WON'
    };

    // Objeto para guardar o estado da paginação de cada coluna
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
        if (columnKey) {
            columnPages[columnKey]++;
        } else {
            // Se nenhuma coluna for especificada, reinicia a paginação de todas
            Object.keys(columnPages).forEach(key => columnPages[key] = 0);
        }

        try {
            const response = await fetch('/api/getSalesDeals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pages: columnPages })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);

            for (const key in data) {
                const container = document.getElementById(`cards-${key}`);
                if (!loadMore) container.innerHTML = ''; // Limpa a coluna antes de adicionar novos cards

                let columnTotal = 0;
                data[key].forEach(deal => {
                    container.innerHTML += createCardHtml(deal);
                    columnTotal += parseFloat(deal.OPPORTUNITY) || 0;
                });
                
                // Atualiza o total da coluna (soma com o valor existente se for "Carregar Mais")
                const totalEl = document.getElementById(`total-${key}`);
                const currentTotal = parseFloat(totalEl.textContent.replace('R$', '').replace('.', '').replace(',', '.')) || 0;
                const newTotal = loadMore ? currentTotal + columnTotal : columnTotal;
                totalEl.textContent = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(newTotal);
            }
        } catch (error) {
            console.error('Erro ao buscar negócios:', error);
            alert(`Erro ao carregar dados: ${error.message}`);
        }
    }
    
    // --- FUNÇÃO PARA ATUALIZAR ETAPA DE UM NEGÓCIO ---
    async function updateDealStage(dealId, newStageId) {
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
            console.log(`Negócio ${dealId} movido para a etapa ${newStageId}`);
        } catch (error) {
            console.error('Erro ao atualizar etapa:', error);
            alert(`Erro ao mover o card: ${error.message}`);
            // Recarrega a página para reverter a alteração visual
            window.location.reload();
        }
    }

    // --- INICIALIZAÇÃO DO DRAG AND DROP ---
    function initializeKanban() {
        const columns = document.querySelectorAll('.column-cards');
        columns.forEach(column => {
            new Sortable(column, {
                group: 'kanban', // Permite mover cards entre colunas com o mesmo grupo
                animation: 150,
                onEnd: function (evt) {
                    const card = evt.item;
                    const dealId = card.dataset.dealId;
                    const newColumn = evt.to;
                    const newStageId = newColumn.closest('.kanban-column').dataset.stageId;
                    
                    updateDealStage(dealId, newStageId);
                    // Aqui você também pode recalcular os totais das colunas de origem e destino
                }
            });
        });
    }

    // --- EVENT LISTENERS ---
    document.addEventListener('DOMContentLoaded', () => {
        // Carrega os dados iniciais
        fetchAndRenderDeals();
        // Inicializa o drag and drop
        initializeKanban();

        // Listener para os botões "Carregar Mais"
        document.querySelector('.kanban-board').addEventListener('click', (event) => {
            if (event.target.classList.contains('load-more-btn')) {
                const columnKey = event.target.dataset.column;
                fetchAndRenderDeals(columnKey, true);
            }
        });
        
        // Listener para os botões "PRODUZIR"
        document.querySelector('.kanban-board').addEventListener('click', (event) => {
            if (event.target.classList.contains('card-button-produzir')) {
                const dealId = event.target.dataset.dealId;
                if (confirm(`Tem certeza que deseja mover o pedido #${dealId} para a produção?`)) {
                    updateDealStage(dealId, STAGES.produzir);
                    // Remove o card da tela para um feedback imediato
                    event.target.closest('.kanban-card').remove();
                }
            }
        });
    });
})();