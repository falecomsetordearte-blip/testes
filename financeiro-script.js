// /financeiro-script.js - VERSÃO LOCAL COM DRAWER
(function() {
    console.log("[Financeiro] Script inicializado.");

    // --- 1. SEGURANÇA ---
    const sessionToken = localStorage.getItem('sessionToken');
    if (!sessionToken) {
        window.location.href = '../login.html'; 
        return;
    }

    // --- 2. ELEMENTOS DO DOM ---
    const listBody = document.getElementById('financeiro-list-body');
    const paginationContainer = document.getElementById('pagination-container');
    const paginationInfo = document.getElementById('pagination-info-text');
    const btnPrev = document.getElementById('btn-prev-page');
    const btnNext = document.getElementById('btn-next-page');
    const btnBuscar = document.getElementById('btn-buscar');
    const nameFilterInput = document.getElementById('name-filter-input');
    const tabContainer = document.querySelector('.tab-buttons');

    // Elementos da Gaveta
    const drawer = document.getElementById('drawer');
    const drawerOverlay = document.getElementById('drawer-overlay');
    const drawerContent = document.getElementById('drawer-content');
    const btnCloseDrawer = document.getElementById('btn-close-drawer');
    const btnDrawerPago = document.getElementById('btn-drawer-pago');
    const btnDrawerCobrar = document.getElementById('btn-drawer-cobrar');
    
    // --- 3. ESTADO DA APLICAÇÃO ---
    let currentPage = 0;
    let currentStatusFilter = 'todos'; 
    let selectedPedidoId = null;
    let pedidosCache = [];
    let currentEmpresaId = null; // ID da empresa logada (VISIVA = 4)

    // --- 4. FUNÇÃO DE BUSCA ---
    async function fetchFinancialDeals(page = 0) {
        console.log(`[Financeiro] Buscando pedidos... Filtro: ${currentStatusFilter}, Pagina: ${page}`);
        listBody.innerHTML = `<div class="loading-pedidos"><div class="spinner"></div><span>Carregando financeiro local...</span></div>`;
        
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
            
            pedidosCache = data.deals;
            currentEmpresaId = data.empresaId || null;
            currentPage = data.pagination.currentPage;
            renderDeals(data.deals);
            updatePagination(data.pagination);

            console.log(`[Financeiro] ${data.deals.length} pedidos carregados. Empresa ID: ${currentEmpresaId}`);
        } catch (error) {
            console.error("[Financeiro] Erro no Fetch:", error);
            listBody.innerHTML = `<div class="loading-pedidos" style="color: red;">Erro: ${error.message}</div>`;
        }
    }

    // --- 5. RENDERIZAÇÃO DA LISTA ---
    function renderDeals(deals) {
        listBody.innerHTML = ''; 

        if (!deals || deals.length === 0) {
            listBody.innerHTML = `<div class="loading-pedidos" style="padding: 20px;">Nenhum pedido encontrado.</div>`;
            return;
        }

        deals.forEach(deal => {
            const statusClass = deal.STAGE_ID === 'PAGO' ? 'status-aprovado' : (deal.STAGE_ID === 'COBRAR' ? 'status-cancelado' : 'status-analise');
            const statusLabel = deal.STAGE_ID || 'PENDENTE';

            const item = document.createElement('div');
            item.className = 'pedido-item';
            item.style.gridTemplateColumns = '1fr 4fr 2fr 1.5fr';
            item.onclick = () => openDrawer(deal.ID);
            
            item.innerHTML = `
                <div class="col-id"><strong>#${deal.ID}</strong></div>
                <div class="col-titulo">${deal.TITLE}</div>
                <div class="col-status"><span class="status-badge ${statusClass}">${statusLabel}</span></div>
                <div class="col-acoes" style="text-align: center;"><button class="btn-verificar">Detalhes</button></div>
            `;
            listBody.appendChild(item);
        });
    }

    // --- 6. GAVETA (DRAWER) ---
    function openDrawer(pedidoId) {
        console.log(`[Financeiro] Abrindo detalhes do pedido: ${pedidoId}`);
        const pedido = pedidosCache.find(p => p.ID === pedidoId);
        if (!pedido) return;

        selectedPedidoId = pedidoId;
        
        // Botão exclusivo VISIVA (empresa ID = 4)
        const VISIVA_EMPRESA_ID = 4;
        const btnVisivaHtml = currentEmpresaId === VISIVA_EMPRESA_ID ? `
            <div class="detail-item" style="margin-top: 5px;">
                <a 
                    href="https://visiva.com.br/admin/?imprimastore=pedidos/detalhes&id=${pedido.TITLE}" 
                    target="_blank"
                    id="btn-visiva-admin"
                    style="
                        display: inline-flex;
                        align-items: center;
                        gap: 8px;
                        background: linear-gradient(135deg, #1a56db, #1e40af);
                        color: white;
                        text-decoration: none;
                        padding: 10px 18px;
                        border-radius: 8px;
                        font-weight: 600;
                        font-size: 0.9rem;
                        transition: opacity 0.2s;
                    "
                    onmouseover="this.style.opacity='0.85'"
                    onmouseout="this.style.opacity='1'"
                >
                    <i class='fas fa-external-link-alt'></i>
                    Ver Pedido no Admin VISIVA
                </a>
            </div>
        ` : '';

        console.log(`[Financeiro] Gaveta aberta. Empresa: ${currentEmpresaId}, É VISIVA: ${currentEmpresaId === VISIVA_EMPRESA_ID}`);

        drawerContent.innerHTML = `
            <div class="detail-item">
                <div class="detail-label">ID do Pedido</div>
                <div class="detail-value">#${pedido.ID}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Título / Briefing</div>
                <div class="detail-value">${pedido.TITLE}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Cliente</div>
                <div class="detail-value">${pedido.CLIENTE || 'Não informado'}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Valor Restante</div>
                <div class="detail-value">R$ ${parseFloat(pedido.OPPORTUNITY).toFixed(2)}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Etapa Atual</div>
                <div class="detail-value">${pedido.ETAPA_ATUAL}</div>
            </div>
            ${btnVisivaHtml}
        `;

        drawer.classList.add('active');
        drawerOverlay.style.display = 'block';
    }

    function closeDrawer() {
        drawer.classList.remove('active');
        drawerOverlay.style.display = 'none';
        selectedPedidoId = null;
    }

    // --- 7. ATUALIZAR STATUS ---
    async function updateStatus(acao) {
        if (!selectedPedidoId) return;

        console.log(`[Financeiro] Solicitando mudança para ${acao} no pedido ${selectedPedidoId}`);
        
        try {
            const response = await fetch('/api/updateFinancialDealStatus', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionToken: sessionToken,
                    dealId: selectedPedidoId,
                    acao: acao
                })
            });
            
            if (!response.ok) throw new Error('Falha ao atualizar status.');

            console.log(`[Financeiro] Status atualizado com sucesso: ${acao}`);
            closeDrawer();
            fetchFinancialDeals(currentPage);
        } catch (error) {
            console.error("[Financeiro] Erro ao atualizar:", error);
            alert("Erro ao atualizar: " + error.message);
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
    btnCloseDrawer.onclick = closeDrawer;
    drawerOverlay.onclick = closeDrawer;
    btnDrawerPago.onclick = () => updateStatus('PAGO');
    btnDrawerCobrar.onclick = () => updateStatus('COBRAR');

    if (tabContainer) {
        tabContainer.onclick = (e) => {
            const btn = e.target.closest('.tab-btn');
            if (!btn) return;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentStatusFilter = btn.dataset.tab;
            fetchFinancialDeals(0);
        };
    }

    btnBuscar.onclick = () => fetchFinancialDeals(0);
    btnPrev.onclick = () => fetchFinancialDeals(currentPage - 1);
    btnNext.onclick = () => fetchFinancialDeals(currentPage + 1);

    // --- 10. INICIALIZAÇÃO ---
    document.addEventListener('DOMContentLoaded', () => {
        // Ajustar as abas no HTML para os novos filtros
        const tabs = document.querySelectorAll('.tab-btn');
        if (tabs.length >= 3) {
            tabs[0].dataset.tab = 'todos';
            tabs[1].textContent = 'Aguardando Pagamento';
            tabs[1].dataset.tab = 'PENDENTE';
            tabs[2].textContent = 'Pago';
            tabs[2].dataset.tab = 'PAGO';
            if(tabs[3]) {
                tabs[3].textContent = 'Cobrar / Devedor';
                tabs[3].dataset.tab = 'COBRAR';
            }
        }
        fetchFinancialDeals();
    });
})();