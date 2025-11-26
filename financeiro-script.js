// /financeiro-script.js - VERSÃO ATUALIZADA (PAGO vs COBRAR SEPARADOS)

(function() {
    // --- 1. SEGURANÇA ---
    const sessionToken = localStorage.getItem('sessionToken');
    if (!sessionToken) {
        window.location.href = '../login.html'; 
        return;
    }

    // --- 2. CONFIGURAÇÃO DOS IDs DO BITRIX ---
    const STAGE_VERIFICAR = 'C17:UC_IKPW6X';
    const STAGE_PAGO      = 'C17:UC_WFTT1A';
    const STAGE_COBRAR    = 'C17:UC_G2024K'; // Novo ID separado

    // --- 3. ELEMENTOS DO DOM ---
    const listBody = document.getElementById('financeiro-list-body');
    const paginationContainer = document.getElementById('pagination-container');
    const paginationInfo = document.getElementById('pagination-info-text');
    const btnPrev = document.getElementById('btn-prev-page');
    const btnNext = document.getElementById('btn-next-page');
    const btnBuscar = document.getElementById('btn-buscar');
    const nameFilterInput = document.getElementById('name-filter-input');
    const tabContainer = document.querySelector('.tab-buttons');
    
    // --- 4. ESTADO DA APLICAÇÃO ---
    let currentPage = 0;
    let totalPages = 1;
    let currentStatusFilter = 'todos'; 

    // --- 5. FUNÇÃO DE BUSCA ---
    async function fetchFinancialDeals(page = 0) {
        listBody.innerHTML = `<div class="loading-pedidos"><div class="spinner"></div><span>Carregando financeiro...</span></div>`;
        
        try {
            const response = await fetch('/api/getFinancialDeals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionToken: sessionToken,
                    page: page,
                    statusFilter: currentStatusFilter,
                    nameFilter: nameFilterInput.value
                })
            });
            
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Erro ao buscar dados');
            
            currentPage = data.pagination.currentPage;
            totalPages = data.pagination.totalPages;

            renderDeals(data.deals);
            updatePagination(data.pagination);

        } catch (error) {
            console.error(error);
            listBody.innerHTML = `<div class="loading-pedidos" style="color: red;">Erro: ${error.message}</div>`;
        }
    }

    // --- 6. RENDERIZAÇÃO DA LISTA ---
    function renderDeals(deals) {
        listBody.innerHTML = ''; 

        if (!deals || deals.length === 0) {
            listBody.innerHTML = `<div class="loading-pedidos" style="padding: 20px;">Nenhum pedido encontrado nesta aba.</div>`;
            return;
        }

        deals.forEach(deal => {
            let statusBadge = '';
            let statusClass = '';
            
            // Define o Badge Visual
            if (deal.STAGE_ID === STAGE_VERIFICAR) {
                statusBadge = 'Verificar Pendência';
                statusClass = 'status-analise'; // Amarelo/Laranja
            } else if (deal.STAGE_ID === STAGE_PAGO) {
                statusBadge = 'Pago';
                statusClass = 'status-aprovado'; // Verde
            } else if (deal.STAGE_ID === STAGE_COBRAR) {
                statusBadge = 'Cobrar';
                statusClass = 'status-cancelado'; // Vermelho
            } else {
                statusBadge = 'Outro';
                statusClass = '';
            }

            const verifyLink = `https://www.visiva.com.br/admin/?imprimastore=pedidos/detalhes&id=${deal.TITLE}`;

            // Lógica dos Radios:
            // Se já for Pago, marca Pago. Se for Cobrar, marca Cobrar.
            const isPago = deal.STAGE_ID === STAGE_PAGO;
            const isCobrar = deal.STAGE_ID === STAGE_COBRAR;

            // Se o pedido já saiu da pendência, mostramos apenas o status, ou permitimos alterar?
            // Vou permitir alterar, mas mostrando o que está selecionado.
            
            const actionsHtml = `
                <div class="financial-actions-group">
                    <a href="${verifyLink}" target="_blank" class="btn-verificar">Ver Detalhes</a>
                    <div class="radio-group" data-deal-id="${deal.ID}">
                        <label>
                            <input type="radio" name="status_${deal.ID}" value="PAGO" ${isPago ? 'checked' : ''}> 
                            Pago
                        </label>
                        <label>
                            <input type="radio" name="status_${deal.ID}" value="DEVEDOR" ${isCobrar ? 'checked' : ''}> 
                            Cobrar
                        </label>
                    </div>
                </div>
            `;

            const item = document.createElement('div');
            item.className = 'pedido-item';
            item.id = `deal-${deal.ID}`;
            item.style.gridTemplateColumns = '1fr 4fr 2fr 1.5fr'; // Mantendo layout do CSS
            
            item.innerHTML = `
                <div class="col-id"><strong>#${deal.ID}</strong></div>
                <div class="col-titulo">${deal.TITLE || 'Sem título'}</div>
                <div class="col-status"><span class="status-badge ${statusClass}">${statusBadge}</span></div>
                <div class="col-acoes" style="text-align: center;">${actionsHtml}</div>
            `;
            listBody.appendChild(item);
        });
    }

    // --- 7. ATUALIZAR STATUS (QUANDO CLICA NO RADIO) ---
    async function updateStatus(dealId, acao) {
        const itemRow = document.getElementById(`deal-${dealId}`);
        if(itemRow) itemRow.style.opacity = '0.5'; // Feedback visual

        try {
            const response = await fetch('/api/updateFinancialDealStatus', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionToken: sessionToken,
                    dealId: dealId,
                    acao: acao // 'PAGO' ou 'DEVEDOR'
                })
            });
            
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || 'Falha ao atualizar');
            }

            // Sucesso: Removemos a linha da tela (pois o status mudou e pode sair do filtro atual)
            // Se estiver na aba "Todos", poderíamos apenas atualizar o badge, mas recarregar é mais seguro para garantir consistência.
            if(itemRow) {
                itemRow.style.transition = 'opacity 0.5s, transform 0.5s';
                itemRow.style.transform = 'translateX(50px)';
                itemRow.style.opacity = '0';
                setTimeout(() => {
                    itemRow.remove();
                    if (listBody.children.length === 0) fetchFinancialDeals(currentPage);
                    else if (currentStatusFilter === 'todos') fetchFinancialDeals(currentPage); // Refresh para atualizar o badge se estiver em "Todos"
                }, 500);
            }

        } catch (error) {
            alert('Erro ao atualizar: ' + error.message);
            if(itemRow) itemRow.style.opacity = '1';
        }
    }

    // --- 8. PAGINAÇÃO ---
    function updatePagination(pagination) {
        if (pagination.totalPages > 1) {
            paginationContainer.classList.remove('hidden');
            paginationInfo.textContent = `Página ${pagination.currentPage + 1} de ${pagination.totalPages}`;
            btnPrev.disabled = pagination.currentPage === 0;
            btnNext.disabled = pagination.currentPage + 1 >= pagination.totalPages;
        } else {
            paginationContainer.classList.add('hidden');
        }
    }

    // --- 9. EVENT LISTENERS ---
    
    // Clique nas Abas
    if (tabContainer) {
        tabContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.tab-btn');
            if (!btn) return;
            
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            currentStatusFilter = btn.dataset.tab;
            fetchFinancialDeals(0);
        });
    }

    // Clique nos Radios (Mudança de Status)
    listBody.addEventListener('change', (e) => {
        if (e.target.type === 'radio' && e.target.name.startsWith('status_')) {
            const dealId = e.target.closest('.radio-group').dataset.dealId;
            const valor = e.target.value; // 'PAGO' ou 'DEVEDOR'
            
            // Pequeno delay para a UI do radio atualizar antes da animação
            setTimeout(() => {
                if (confirm(`Confirmar mudança para ${valor}?`)) {
                    updateStatus(dealId, valor);
                } else {
                    // Reverte a seleção se cancelar (recarrega a lista pra facilitar)
                    fetchFinancialDeals(currentPage);
                }
            }, 50);
        }
    });

    btnBuscar.addEventListener('click', () => fetchFinancialDeals(0));
    btnPrev.addEventListener('click', () => fetchFinancialDeals(currentPage - 1));
    btnNext.addEventListener('click', () => fetchFinancialDeals(currentPage + 1));

    // --- 10. INICIALIZAÇÃO ---
    document.addEventListener('DOMContentLoaded', () => {
        // Configura os Data-Tabs corretos nos botões do HTML via JS
        // (Isso evita que você precise editar o HTML manualmente se não quiser)
        const tabs = document.querySelectorAll('.tab-btn');
        if(tabs.length >= 4) {
            tabs[0].dataset.tab = 'todos';
            tabs[1].dataset.tab = STAGE_VERIFICAR;
            tabs[2].dataset.tab = STAGE_PAGO;
            tabs[3].dataset.tab = STAGE_COBRAR;
        }
        
        fetchFinancialDeals();
    });
})();