// /dashboard.js

document.addEventListener("DOMContentLoaded", () => {
    const sessionToken = localStorage.getItem("sessionToken");
    const userName = localStorage.getItem("userName");

    if (!sessionToken) {
        window.location.href = "/login.html";
        return;
    }
    
    // Preenche o nome do usuário
    const welcomeUserName = document.getElementById('welcome-user-name');
    if (welcomeUserName && userName) {
        welcomeUserName.textContent = `Olá, ${userName}!`;
    }

    // --- NOVA LÓGICA DE STATUS (SEM BITRIX) ---
    function getStatusInfo(etapa) {
        if (!etapa) return { texto: 'Aguardando', classe: 'status-pagamento' };

        const etapaUpper = etapa.toUpperCase();

        // Mapeamento de Cores
        if (etapaUpper.includes("ATENDIMENTO") || etapaUpper.includes("NOVOS")) {
            return { texto: etapa, classe: 'status-pagamento' }; // Amarelo/Laranja
        } else if (etapaUpper.includes("CONCLUÍDO") || etapaUpper.includes("ENTREGUE") || etapaUpper.includes("EXPEDIÇÃO")) {
            return { texto: etapa, classe: "status-aprovado" }; // Verde
        } else if (etapaUpper.includes("CANCELADO")) {
            return { texto: etapa, classe: 'status-cancelado' }; // Vermelho
        } else {
            return { texto: etapa, classe: 'status-andamento' }; // Azul (Arte, Impressão, etc)
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
                if (response.status === 401) {
                    alert("Sessão expirada. Faça login novamente.");
                    window.location.href = "/login.html";
                    return;
                }
                throw new Error(data.message || "Erro ao buscar dados.");
            }

            // 1. Atualizar Saldo
            const saldoEl = document.getElementById("saldo-valor-dash");
            saldoEl.textContent = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(data.saldo || 0);

            // 2. Calcular Métricas
            const pedidos = data.pedidos || [];
            const andamentoEl = document.getElementById("pedidos-andamento-dash");
            const concluidosEl = document.getElementById("pedidos-concluidos-dash"); // Elemento oculto mas existente

            // Conta como concluído se tiver essas palavras
            const totalConcluidos = pedidos.filter(p => {
                const s = (p.STAGE_ID || '').toUpperCase();
                return s.includes('EXPEDIÇÃO') || s.includes('ENTREGUE') || s.includes('CONCLUÍDO');
            }).length;

            const totalAndamento = pedidos.length - totalConcluidos;

            andamentoEl.textContent = totalAndamento;
            // Atualiza o contador oculto caso queira exibir no futuro
            if(concluidosEl) concluidosEl.textContent = totalConcluidos;

            // 3. Lista Recente
            const recentesListEl = document.getElementById("recentes-pedidos-list");
            const pedidosRecentes = pedidos.slice(0, 5); // Pega os 5 primeiros
            
            if (pedidosRecentes.length > 0) {
                recentesListEl.innerHTML = `
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Título</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pedidosRecentes.map(pedido => {
                                const status = getStatusInfo(pedido.STAGE_ID);
                                return `
                                    <tr onclick="window.location.href='pedido.html?id=${pedido.ID}'" style="cursor:pointer">
                                        <td>#${pedido.ID}</td>
                                        <td>${pedido.TITLE}</td>
                                        <td><span class="status-badge ${status.classe}">${status.texto}</span></td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                `;
            } else {
                recentesListEl.innerHTML = `<p class="empty-state">Nenhum pedido encontrado.</p>`;
            }

        } catch (error) {
            console.error("Erro dashboard:", error);
            document.getElementById("recentes-pedidos-list").innerHTML = `<p style="color:red; text-align:center">Erro ao carregar dados.</p>`;
        }
    }
    
    loadDashboardData();
});