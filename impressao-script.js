// /impressao-script.js

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        
        // --- AUTENTICAÇÃO E ELEMENTOS DO DOM ---
        const sessionToken = localStorage.getItem('sessionToken');
        if (!sessionToken) {
            window.location.href = 'login.html';
            return;
        }

        const impressoraFilterEl = document.getElementById('impressora-filter');
        const materialFilterEl = document.getElementById('material-filter');
        const btnFiltrar = document.getElementById('btn-filtrar');
        const board = document.querySelector('.kanban-board');

        // --- FUNÇÕES DE CARREGAMENTO DE DADOS ---

        async function carregarOpcoesDeFiltro() {
            try {
                const response = await fetch('/api/getProductionFilters');
                const filters = await response.json();
                if (!response.ok) throw new Error('Falha ao carregar filtros.');

                // Popula o dropdown de impressoras
                filters.impressoras.forEach(option => {
                    impressoraFilterEl.innerHTML += `<option value="${option.id}">${option.value}</option>`;
                });

                // Popula o dropdown de materiais
                filters.materiais.forEach(option => {
                    materialFilterEl.innerHTML += `<option value="${option.id}">${option.value}</option>`;
                });
            } catch (error) {
                console.error("Erro ao carregar opções de filtro:", error);
            }
        }

        async function carregarPedidosDeProducao() {
            // Limpa as colunas e mostra o spinner
            document.querySelectorAll('.column-cards').forEach(col => {
                col.innerHTML = '<div class="loading-pedidos"><div class="spinner"></div></div>';
            });
            
            try {
                const response = await fetch('/api/getProductionDeals', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        impressoraFilter: impressoraFilterEl.value,
                        materialFilter: materialFilterEl.value
                    })
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);

                organizarPedidosNasColunas(data.deals);

            } catch (error) {
                console.error("Erro ao carregar pedidos de produção:", error);
                board.innerHTML = `<p style="color:red; padding: 20px;">${error.message}</p>`;
            }
        }

        // --- FUNÇÃO PARA ORGANIZAR OS CARDS ---
        function organizarPedidosNasColunas(deals) {
            // Primeiro, limpa todas as colunas
            document.querySelectorAll('.column-cards').forEach(col => col.innerHTML = '');

            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0); // Zera a hora para comparar apenas a data

            deals.forEach(deal => {
                const prazo = deal.UF_CRM_PRAZO_PRODUCAO ? new Date(deal.UF_CRM_PRAZO_PRODUCAO) : null;
                let colunaId = 'SEM_DATA';

                if (prazo) {
                    prazo.setHours(0, 0, 0, 0);
                    const diffTime = prazo - hoje;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    if (diffDays < 0) colunaId = 'ATRASADO';
                    else if (diffDays === 0) colunaId = 'HOJE';
                    else if (diffDays <= 7) colunaId = 'ESSA_SEMANA';
                    else if (diffDays <= 14) colunaId = 'PROXIMA_SEMANA';
                    // Se for mais que 14 dias, fica em 'PROXIMA_SEMANA' para simplificar
                }
                
                const cardHtml = `
                    <div class="kanban-card">
                        <div class="card-title">#${deal.ID} - ${deal.TITLE}</div>
                        <!-- Adicionar mais detalhes do card aqui se necessário -->
                    </div>
                `;
                
                const coluna = document.getElementById(`cards-${colunaId}`);
                if (coluna) {
                    coluna.innerHTML += cardHtml;
                }
            });

             // Adiciona mensagem se a coluna estiver vazia
            document.querySelectorAll('.column-cards').forEach(col => {
                if (col.innerHTML === '') {
                    col.innerHTML = '<p class="info-text">Nenhum pedido aqui.</p>';
                }
            });
        }
        
        // --- EVENT LISTENERS E EXECUÇÃO INICIAL ---

        btnFiltrar.addEventListener('click', carregarPedidosDeProducao);
        
        // Carrega tudo ao iniciar a página
        async function init() {
            await carregarOpcoesDeFiltro();
            await carregarPedidosDeProducao();
        }

        init();
    });
})();