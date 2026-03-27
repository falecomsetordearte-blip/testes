// /dashboard.js

document.addEventListener("DOMContentLoaded", () => {
    const sessionToken = localStorage.getItem("sessionToken");

    if (!sessionToken) {
        window.location.href = "/login.html";
        return;
    }

    // --- LÓGICA DE CORES DO STATUS (Para os recentes) ---
    function getStatusInfo(etapa) {
        if (!etapa) return { texto: 'Aguardando', classe: 'status-pagamento' };
        const etapaUpper = etapa.toUpperCase();
        if (etapaUpper.includes("ATENDIMENTO") || etapaUpper.includes("NOVOS")) {
            return { texto: etapa, classe: 'status-pagamento' };
        } else if (etapaUpper.includes("CONCLUÍDO") || etapaUpper.includes("ENTREGUE") || etapaUpper.includes("EXPEDIÇÃO")) {
            return { texto: etapa, classe: "status-aprovado" };
        } else if (etapaUpper.includes("CANCELADO")) {
            return { texto: etapa, classe: 'status-cancelado' };
        } else {
            return { texto: etapa, classe: 'status-andamento' };
        }
    }

    // Formatação de Moeda
    const fmtMoeda = (valor) => parseFloat(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // 1. CARREGAR ATIVIDADE RECENTE
    async function loadAtividadeRecente() {
        try {
            const response = await fetch('/api/getPanelData', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: sessionToken })
            });
            const data = await response.json();
            const listEl = document.getElementById("recentes-pedidos-list");

            if (!response.ok) throw new Error(data.message);

            const pedidosRecentes = (data.pedidos || []).slice(0, 5);

            if (pedidosRecentes.length > 0) {
                listEl.innerHTML = pedidosRecentes.map(pedido => {
                    const status = getStatusInfo(pedido.STAGE_ID);
                    return `
                        <div class="dash-list-item" onclick="window.location.href='pedido.html?id=${pedido.ID}'">
                            <div>
                                <div class="dash-item-title">${pedido.TITLE}</div>
                                <div class="dash-item-subtitle">Pedido #${pedido.ID}</div>
                            </div>
                            <div></div>
                            <div style="text-align:right;">
                                <span class="badge-status ${status.classe}" style="font-size: 0.65rem;">${status.texto}</span>
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                listEl.innerHTML = `<p class="empty-state"><i class="fa-solid fa-folder-open" style="font-size:2rem; color:#cbd5e1; display:block; margin-bottom:10px;"></i>Nenhum pedido recente.</p>`;
            }
        } catch (error) {
            document.getElementById("recentes-pedidos-list").innerHTML = `<p class="empty-state" style="color:red;">Erro ao carregar recentes.</p>`;
        }
    }

    // 2. CARREGAR MINI EXPEDIÇÃO (Materiais Prontos)
    async function loadMiniExpedicao() {
        try {
            const res = await fetch('/api/expedicao/listar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionToken: sessionToken, query: '' })
            });
            const data = await res.json();
            const listEl = document.getElementById('mini-expedicao-list');

            if (!data.deals || data.deals.length === 0) {
                listEl.innerHTML = '<p class="empty-state"><i class="fa-solid fa-box-open" style="font-size:2rem; color:#cbd5e1; display:block; margin-bottom:10px;"></i>Nenhum material aguardando expedição no momento.</p>';
                return;
            }

            const html = data.deals.slice(0, 5).map(p => {
                const isEntregue = p.status_expedicao === 'Entregue';
                return `
                    <div class="dash-list-item" onclick="window.location.href='/expedicao/'">
                        <div>
                            <div class="dash-item-title">${p.titulo}</div>
                            <div class="dash-item-subtitle">${p.nome_cliente || 'Sem cliente vinculado'}</div>
                        </div>
                        <div></div>
                        <div style="text-align:right;">
                            <span class="badge-status ${isEntregue ? 'st-entregue' : 'st-aguardando'}">${p.status_expedicao || 'Aguardando'}</span>
                        </div>
                    </div>
                `;
            }).join('');
            listEl.innerHTML = html;

        } catch (e) {
            document.getElementById('mini-expedicao-list').innerHTML = `<p class="empty-state" style="color:red;">Erro ao buscar materiais.</p>`;
        }
    }

    // 3. CARREGAR MINI CARTEIRA (Artes à Pagar)
    async function loadMiniCarteira() {
        try {
            const res = await fetch('/api/carteira/extrato', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionToken: sessionToken })
            });
            const data = await res.json();
            const listEl = document.getElementById('mini-carteira-list');

            // Filtra apenas o que não for PAGO
            const pendentes = (data.extrato || []).filter(i => i.status !== 'PAGO');

            if (pendentes.length === 0) {
                listEl.innerHTML = '<p class="empty-state"><i class="fa-solid fa-check-double" style="font-size:2rem; color:#cbd5e1; display:block; margin-bottom:10px;"></i>Nenhuma arte pendente de pagamento!</p>';
                return;
            }

            const html = pendentes.slice(0, 5).map(i => {
                const isAguardando = i.status === 'AGUARDANDO_CONFIRMACAO';
                return `
                    <div class="dash-list-item" onclick="window.location.href='/carteira.html'">
                        <div>
                            <div class="dash-item-title">${i.descricao}</div>
                            <div class="dash-item-subtitle"><i class="fa-solid fa-palette"></i> ${i.designer || 'Designer'}</div>
                        </div>
                        <div>
                            ${isAguardando ? `<span class="badge-status st-entregue" style="font-size:0.6rem;">Analisando Comprovante</span>` : `<span class="badge-status st-pendente-pg" style="font-size:0.6rem;">Fazer PIX</span>`}
                        </div>
                        <div style="text-align:right; font-weight:700; color:#1e293b;">
                            ${fmtMoeda(i.valor)}
                        </div>
                    </div>
                `;
            }).join('');
            listEl.innerHTML = html;

        } catch (e) {
            document.getElementById('mini-carteira-list').innerHTML = `<p class="empty-state" style="color:red;">Erro ao buscar contas.</p>`;
        }
    }

    // Dispara as 3 chamadas simultaneamente para carregamento mais rápido
    loadAtividadeRecente();
    loadMiniExpedicao();
    loadMiniCarteira();
});