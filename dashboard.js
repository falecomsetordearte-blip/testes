// /dashboard.js

document.addEventListener("DOMContentLoaded", () => {
    const sessionToken = localStorage.getItem("sessionToken");
    const userName = localStorage.getItem("userName");

    if (!sessionToken || !userName) {
        window.location.href = "/login.html";
        return;
    }
    
    // Preenche o nome do usuário no cabeçalho
    const welcomeUserName = document.getElementById('welcome-user-name');
    if (welcomeUserName) {
        welcomeUserName.textContent = `Olá, ${userName}!`;
    }

    // Função para mapear STAGE_ID para um status amigável
    function getStatusInfo(stageId) {
        if (!stageId) return { texto: 'Desconhecido', classe: '' };

        if (stageId.includes("NEW")) {
            return { texto: 'Aguardando Pagamento', classe: 'status-pagamento' };
        } else if (stageId.includes("LOSE")) {
            return { texto: 'Cancelado', classe: 'status-cancelado' };
        } else if (stageId.includes("WON")) {
            return { texto: "Concluído", classe: "status-aprovado" };
        } else {
            return { texto: 'Em Andamento', classe: 'status-andamento' };
        }
    }

    async function loadDashboardData() {
        try {
            const response = await fetch('/api/getPanelData', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: sessionToken })
            });

            const data = await response.json();
            if (!response.ok) {
                // Se for erro de autenticação, o layout.js já deve redirecionar
                throw new Error(data.message || "Erro ao buscar dados do painel.");
            }

            // 1. Atualizar Cards de Métricas (KPIs)
            const saldoEl = document.getElementById("saldo-valor-dash");
            const andamentoEl = document.getElementById("pedidos-andamento-dash");
            const concluidosEl = document.getElementById("pedidos-concluidos-dash");

            saldoEl.textContent = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(data.saldo || 0);

            const pedidos = data.pedidos || [];
            // CORRIGIDO: Pedidos em andamento não devem incluir os que aguardam pagamento
            const pedidosEmAndamento = pedidos.filter(p => !p.STAGE_ID.includes('WON') && !p.STAGE_ID.includes('LOSE') && !p.STAGE_ID.includes('NEW')).length;
            const pedidosConcluidos = pedidos.filter(p => p.STAGE_ID.includes('WON')).length;
            
            andamentoEl.textContent = pedidosEmAndamento;
            concluidosEl.textContent = pedidosConcluidos;

            // 2. Atualizar Lista de Pedidos Recentes (últimos 5)
            const recentesListEl = document.getElementById("recentes-pedidos-list");
            const pedidosRecentes = pedidos.slice(0, 5);
            
            if (pedidosRecentes.length > 0) {
                recentesListEl.innerHTML = pedidosRecentes.map(pedido => {
                    const status = getStatusInfo(pedido.STAGE_ID);
                    return `
                        <a href="pedido.html?id=${pedido.ID}" class="recent-pedido-item">
                            <div class="pedido-info">
                                <span class="pedido-id">#${pedido.ID}</span>
                                <span class="pedido-title">${pedido.TITLE}</span>
                            </div>
                            <span class="status-badge ${status.classe}">${status.texto}</span>
                        </a>
                    `;
                }).join('');
            } else {
                recentesListEl.innerHTML = `<p class="empty-state">Você ainda não tem nenhum pedido.</p>`;
            }

        } catch (error) {
            console.error("Erro ao carregar dados do dashboard:", error);
            document.getElementById("recentes-pedidos-list").innerHTML = `<p class="empty-state error">Não foi possível carregar os pedidos.</p>`;
        }
    }

    // Chama a função para inicializar o modal de novo pedido
    if (typeof inicializarModalNovoPedido === 'function') {
        inicializarModalNovoPedido();
    }

    // Carrega os dados do dashboard ao entrar na página
    loadDashboardData();
});