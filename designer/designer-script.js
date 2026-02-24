// /designer/designer-script.js - VERSÃO UBER DE DESIGNERS (NEON)

(function() {
    const sessionToken = localStorage.getItem('designerToken');

    // Redireciona se não estiver logado
    if (!sessionToken && !window.location.href.includes('login.html')) {
        window.location.href = 'login.html';
        return;
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (document.querySelector('main.main-painel')) {
            carregarDashboardDesigner();
        }
        configurarFormulariosAuth();
    });

    async function carregarDashboardDesigner() {
        const containerAtendimentos = document.getElementById('atendimentos-list');
        const containerMercado = document.getElementById('saques-list'); // Vamos usar a aba de "Saques" temporariamente como "Pedidos Disponíveis" ou ajustar o HTML
        
        try {
            const res = await fetch('/api/designer/getDashboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: sessionToken })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            // 1. Atualizar Cabeçalho e Saldo
            document.getElementById('designer-greeting').textContent = `Olá, ${data.designer.nome}!`;
            document.getElementById('designer-saldo-disponivel').textContent = formatarMoeda(data.designer.saldo);
            document.getElementById('designer-saldo-pendente').textContent = formatarMoeda(data.designer.pendente);
            document.getElementById('designer-pedidos-ativos').textContent = data.meusPedidos.length;

            // 2. Renderizar Meus Trabalhos (Pedidos que ele já assumiu)
            renderizarMeusTrabalhos(data.meusPedidos);

            // 3. Renderizar Mercado (Pedidos disponíveis para o nível dele)
            // DICA: No seu HTML, mude o texto da segunda aba para "Pedidos Disponíveis"
            renderizarMercado(data.mercado);

        } catch (error) {
            console.error(error);
            showToast("Erro ao carregar dados.", "error");
        }
    }

    // --- LISTA 1: TRABALHOS ATIVOS ---
    function renderizarMeusTrabalhos(pedidos) {
        const container = document.getElementById('atendimentos-list');
        if (pedidos.length === 0) {
            container.innerHTML = `<div class="loading-pedidos">Você não tem trabalhos ativos. Pegue um pedido na aba ao lado!</div>`;
            return;
        }

        container.innerHTML = pedidos.map(p => `
            <div class="list-item" style="grid-template-columns: 0.5fr 2fr 1fr 1fr 1fr;">
                <div class="col-id">#${p.id}</div>
                <div class="col-titulo">${p.titulo}</div>
                <div><span class="status-badge status-andamento">Em Produção</span></div>
                <div class="col-valor">${formatarMoeda(p.valor_designer)}</div>
                <div style="text-align: right; display: flex; gap: 5px; justify-content: flex-end;">
                    <a href="${p.link_acompanhar}" target="_blank" class="btn-action" style="background:#25D366"><i class="fab fa-whatsapp"></i> Chat</a>
                    <button onclick="prepararFinalizacao(${p.id})" class="btn-action" style="background:#4f46e5"><i class="fas fa-check"></i> Finalizar</button>
                </div>
            </div>
        `).join('');
    }

    // --- LISTA 2: MERCADO (DISPONÍVEIS) ---
    function renderizarMercado(pedidos) {
        const container = document.getElementById('saques-list');
        if (pedidos.length === 0) {
            container.innerHTML = `<div class="loading-pedidos">Nenhum pedido disponível no momento para o seu nível.</div>`;
            return;
        }

        container.innerHTML = pedidos.map(p => `
            <div class="list-item" style="grid-template-columns: 0.5fr 3fr 1fr 1fr;">
                <div class="col-id">#${p.id}</div>
                <div class="col-titulo">
                    <strong>${p.titulo}</strong><br>
                    <small style="color:#aaa">${p.servico}</small>
                </div>
                <div class="col-valor">${formatarMoeda(p.valor_designer)}</div>
                <div style="text-align: right;">
                    <button onclick="assumirPedido(${p.id})" class="btn-action" style="background:#2ecc71; padding: 8px 15px;">ATENDER</button>
                </div>
            </div>
        `).join('');
    }

    // --- AÇÃO: ASSUMIR PEDIDO ---
    window.assumirPedido = async (id) => {
        if (!confirm("Deseja assumir este pedido?")) return;

        try {
            const res = await fetch('/api/designer/assumirPedido', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: sessionToken, pedidoId: id })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            alert("Pedido assumido! O chat será aberto.");
            if (data.chatLink) window.open(data.chatLink, '_blank');
            carregarDashboardDesigner();
        } catch (e) { alert(e.message); }
    };

    // --- AÇÃO: FINALIZAR (ABRE PROMPT PARA LINKS) ---
    window.prepararFinalizacao = async (id) => {
        const linkLayout = prompt("Cole o link da imagem do LAYOUT (ex: Google Drive, Imgur):");
        if (!linkLayout) return;

        const linkImpressao = prompt("Cole o link do ARQUIVO FINAL para impressão:");
        if (!linkImpressao) return;

        try {
            const res = await fetch('/api/designer/finalizarPedido', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    token: sessionToken, 
                    pedidoId: id, 
                    linkLayout, 
                    linkImpressao 
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            alert("Sucesso! Pedido enviado para impressão e comissão creditada.");
            carregarDashboardDesigner();
        } catch (e) { alert(e.message); }
    };

    // Helpers
    function formatarMoeda(valor) {
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);
    }

    function configurarFormulariosAuth() {
        // Mantenha aqui sua lógica de login.html e resetPassword.js se necessário
    }

})();