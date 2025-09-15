// /financeiro-script.js - VERSÃO SEGURA E CORRIGIDA

(function() {
    // --- NOVO BLOCO DE SEGURANÇA ---
    const sessionToken = localStorage.getItem('sessionToken');
    if (!sessionToken) {
        window.location.href = 'login.html'; // Redireciona se não estiver logado
        return; // Para a execução do script
    }
    // --- FIM DO NOVO BLOCO DE SEGURANÇA ---

    // --- ELEMENTOS DO DOM ---
    const listBody = document.getElementById('financeiro-list-body');
    const paginationContainer = document.getElementById('pagination-container');
    const paginationInfo = document.getElementById('pagination-info-text');
    const pageIndicator = document.getElementById('page-indicator');
    const btnPrev = document.getElementById('btn-prev-page');
    const btnNext = document.getElementById('btn-next-page');
    const btnBuscar = document.getElementById('btn-buscar');
    const nameFilterInput = document.getElementById('name-filter-input');
    const tabButtonsContainer = document.querySelector('.tab-buttons');
    const tabButtons = document.querySelectorAll('.tab-btn');

    // --- ESTADO DA APLICAÇÃO ---
    let currentPage = 0;
    let totalPages = 1;
    let currentStatusFilter = 'todos'; // Começa com a aba "Todos" selecionada

    // --- FUNÇÃO PARA BUSCAR OS DADOS ---
    async function fetchFinancialDeals(page = 0) {
        listBody.innerHTML = `<div class="loading-pedidos"><div class="spinner"></div><span>Carregando...</span></div>`;
        const nameFilter = nameFilterInput.value;
        
        try {
            const response = await fetch('/api/getFinancialDeals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionToken: sessionToken, // <-- TOKEN ADICIONADO AQUI
                    page: page, 
                    statusFilter: currentStatusFilter,
                    nameFilter: nameFilter 
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            
            currentPage = data.pagination.currentPage;
            totalPages = data.pagination.totalPages;

            renderDeals(data.deals);
            updatePagination(data.pagination);

        } catch (error) {
            listBody.innerHTML = `<div class="loading-pedidos" style="color: red;">${error.message}</div>`;
        }
    }

    // --- FUNÇÃO PARA RENDERIZAR A LISTA ---
    function renderDeals(deals) {
        listBody.innerHTML = ''; 

        if (!deals || deals.length === 0) {
            listBody.innerHTML = `<div class="loading-pedidos" style="padding: 20px;">Nenhuma pendência encontrada para os filtros selecionados.</div>`;
            return;
        }

        deals.forEach(deal => {
            let statusInfo = { texto: 'Desconhecido', classe: '' };
            const verifyLink = `https://www.visiva.com.br/admin/?imprimastore=pedidos/detalhes&id=${deal.TITLE}`;

            if (deal.STAGE_ID === 'C11:UC_YYHPKI') {
                statusInfo = { texto: 'Verificar Pendência', classe: 'status-analise' };
            } else if (deal.STAGE_ID === 'C11:UC_4SNWR7') {
                statusInfo = { texto: 'Pago', classe: 'status-aprovado' };
            } else if (deal.STAGE_ID === 'C11:UC_W0DCSV') {
                statusInfo = { texto: 'Devedor', classe: 'status-cancelado' };
            }
            
            const isPago = deal.STAGE_ID === 'C11:UC_4SNWR7';
            const isDevedor = deal.STAGE_ID === 'C11:UC_W0DCSV';

            const actionsHtml = `
                <div class="financial-actions-group">
                    <a href="${verifyLink}" target="_blank" class="btn-verificar">Ver Detalhes</a>
                    <div class="radio-group" data-deal-id="${deal.ID}">
                        <label><input type="radio" name="status_${deal.ID}" value="PAGO" ${isPago ? 'checked' : ''}> Pago</label>
                        <label><input type="radio" name="status_${deal.ID}" value="DEVEDOR" ${isDevedor ? 'checked' : ''}> Devedor</label>
                    </div>
                </div>
            `;

            const pedidoItem = document.createElement('div');
            pedidoItem.className = 'pedido-item';
            pedidoItem.id = `deal-${deal.ID}`;
            pedidoItem.style.gridTemplateColumns = '1fr 4fr 2fr 1.5fr';
            pedidoItem.innerHTML = `
                <div class="col-id"><strong>#${deal.ID}</strong></div>
                <div class="col-titulo">${deal.TITLE}</div>
                <div class="col-status"><span class="status-badge ${statusInfo.classe}">${statusInfo.texto}</span></div>
                <div class="col-acoes" style="text-align: center;">${actionsHtml}</div>
            `;
            listBody.appendChild(pedidoItem);
        });
    }

    // --- FUNÇÃO PARA ATUALIZAR A PAGINAÇÃO ---
    function updatePagination(pagination) {
        if (pagination.totalPages > 1) {
            paginationContainer.classList.remove('hidden');
            paginationInfo.textContent = `Página ${pagination.currentPage + 1} de ${pagination.totalPages}`;
            pageIndicator.textContent = `${pagination.currentPage + 1} / ${pagination.totalPages}`;
            btnPrev.disabled = pagination.currentPage === 0;
            btnNext.disabled = pagination.currentPage + 1 >= pagination.totalPages;
        } else {
            paginationContainer.classList.add('hidden');
        }
    }

    // --- FUNÇÃO PARA ATUALIZAR O STATUS DE UM NEGÓCIO ---
    async function updateStatus(dealId, status) {
        const itemRow = document.getElementById(`deal-${dealId}`);
        itemRow.style.opacity = '0.5';

        try {
            const response = await fetch('/api/updateFinancialDealStatus', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionToken: sessionToken, // <-- TOKEN ADICIONADO AQUI
                    dealId: dealId,
                    status: status
                })
            });
            
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message);
            }

            itemRow.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            itemRow.style.opacity = '0';
            itemRow.style.transform = 'translateX(50px)';
            setTimeout(() => {
                itemRow.remove();
                if (listBody.children.length === 0) {
                    fetchFinancialDeals(currentPage);
                }
            }, 500);

        } catch (error) {
            alert(`Erro ao atualizar status: ${error.message}`);
            itemRow.style.opacity = '1';
        }
    }
    
    // --- EVENT LISTENERS ---
    tabButtonsContainer.addEventListener('click', (event) => {
        const clickedButton = event.target.closest('.tab-btn');
        if (!clickedButton) return;

        tabButtons.forEach(btn => btn.classList.remove('active'));
        clickedButton.classList.add('active');
        currentStatusFilter = clickedButton.dataset.tab;
        fetchFinancialDeals(0);
    });

    listBody.addEventListener('change', (event) => {
        if (event.target.type === 'radio') {
            const dealId = event.target.closest('.radio-group').dataset.dealId;
            const status = event.target.value;
            updateStatus(dealId, status);
        }
    });

    btnPrev.addEventListener('click', () => {
        if (currentPage > 0) {
            fetchFinancialDeals(currentPage - 1);
        }
    });

    btnNext.addEventListener('click', () => {
        if (currentPage + 1 < totalPages) {
            fetchFinancialDeals(currentPage + 1);
        }
    });

    btnBuscar.addEventListener('click', () => {
        fetchFinancialDeals(0);
    });

    // --- EXECUÇÃO INICIAL ---
    document.addEventListener('DOMContentLoaded', () => {
        const userName = localStorage.getItem('userName');
        const headerContent = document.querySelector('.header-content');
        if (headerContent && !headerContent.querySelector('.user-menu')) {
            const userMenuHTML = `
                <div class="user-menu">
                    <span id="user-greeting">Olá, ${userName || ''}!</span>
                    <button id="logout-button">Sair</button>
                </div>
            `;
            headerContent.insertAdjacentHTML('beforeend', userMenuHTML);
            const logoutButton = document.getElementById('logout-button');
            if(logoutButton) logoutButton.addEventListener('click', () => {
                localStorage.clear();
                window.location.href = 'login.html';
            });
        }

        fetchFinancialDeals();
    });
})();