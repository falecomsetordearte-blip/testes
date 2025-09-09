// /financeiro-script.js

(function() {
    // --- ELEMENTOS DO DOM ---
    const listBody = document.getElementById('financeiro-list-body');
    const paginationContainer = document.getElementById('pagination-container');
    const paginationInfo = document.getElementById('pagination-info-text');
    const pageIndicator = document.getElementById('page-indicator');
    const btnPrev = document.getElementById('btn-prev-page');
    const btnNext = document.getElementById('btn-next-page');

    let currentPage = 0;
    let totalPages = 1;

    // --- FUNÇÃO PARA BUSCAR OS DADOS ---
    async function fetchFinancialDeals(page = 0) {
        listBody.innerHTML = `<div class="loading-pedidos"><div class="spinner"></div><span>Carregando...</span></div>`;
        
        try {
            const response = await fetch('/api/getFinancialDeals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ page: page })
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
        if (!deals || deals.length === 0) {
            listBody.innerHTML = `<div class="loading-pedidos" style="padding: 20px;">Nenhuma pendência encontrada.</div>`;
            return;
        }

        let html = '';
        deals.forEach(deal => {
            let statusInfo = { texto: 'Desconhecido', classe: '' };
            let actionsHtml = '';

            const verifyLink = `https://www.visiva.com.br/admin/?imprimastore=pedidos/detalhes&id=${deal.TITLE}`;

            if (deal.STAGE_ID === 'C11:UC_YYHPKI') { // Verificar Pendência
                statusInfo = { texto: 'Verificar Pendência', classe: 'status-analise' };
                actionsHtml = `
                    <a href="${verifyLink}" target="_blank" class="btn-acao btn-verificar">Verificar</a>
                    <div class="radio-group" data-deal-id="${deal.ID}">
                        <label><input type="radio" name="status_${deal.ID}" value="PAGO"> Pago</label>
                        <label><input type="radio" name="status_${deal.ID}" value="DEVEDOR"> Devedor</label>
                    </div>
                `;
            } else if (deal.STAGE_ID === 'C11:UC_4SNWR7') {
                statusInfo = { texto: 'Pago', classe: 'status-aprovado' };
                actionsHtml = `<a href="${verifyLink}" target="_blank" class="btn-acao btn-verificar">Ver Detalhes</a>`;
            } else if (deal.STAGE_ID === 'C11:UC_W0DCSV') {
                statusInfo = { texto: 'Devedor', classe: 'status-cancelado' };
                actionsHtml = `<a href="${verifyLink}" target="_blank" class="btn-acao btn-verificar">Ver Detalhes</a>`;
            }

            html += `
                <div class="pedido-item" id="deal-${deal.ID}">
                    <div class="col-id"><strong>#${deal.ID}</strong></div>
                    <div class="col-titulo">${deal.TITLE}</div>
                    <div class="col-status"><span class="status-badge ${statusInfo.classe}">${statusInfo.texto}</span></div>
                    <div class="col-acoes" style="flex-grow: 1.5; text-align: center;">${actionsHtml}</div>
                </div>
            `;
        });
        listBody.innerHTML = html;
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
    async function updateStatus(dealId, status, radioElement) {
        const itemRow = document.getElementById(`deal-${dealId}`);
        itemRow.style.opacity = '0.5'; // Feedback visual imediato

        try {
            const response = await fetch('/api/updateFinancialDealStatus', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dealId: dealId, status: status })
            });
            
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message);
            }

            // Ação rápida: simplesmente remove o item da lista para indicar sucesso
            itemRow.style.transition = 'all 0.5s ease';
            itemRow.style.transform = 'translateX(100%)';
            setTimeout(() => itemRow.remove(), 500);

        } catch (error) {
            alert(`Erro ao atualizar status: ${error.message}`);
            itemRow.style.opacity = '1'; // Reverte o feedback visual em caso de erro
            radioElement.checked = false; // Desmarca o radio
        }
    }
    
    // --- EVENT LISTENERS ---
    
    // Listener para os botões de rádio
    listBody.addEventListener('change', (event) => {
        if (event.target.type === 'radio') {
            const dealId = event.target.closest('.radio-group').dataset.dealId;
            const status = event.target.value;
            updateStatus(dealId, status, event.target);
        }
    });

    // Listeners para a paginação
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

    // --- EXECUÇÃO INICIAL ---
    fetchFinancialDeals();
})();