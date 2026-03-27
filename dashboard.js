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

    // 3. CARREGAR GRÁFICO DE ECONOMIA (Substitui o Artes a Pagar)
    async function loadGraficoEconomia() {
        try {
            // Usa a rota de dados da carteira para saber quanto ele já gastou esse mês
            const res = await fetch('/api/carteira/dados', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionToken: sessionToken })
            });
            const data = await res.json();
            const container = document.getElementById('modulo-economia');

            // Calcula tudo que foi gerado no mês (pago + pendente + atrasado)
            const totalGasto = (data.pago_mes || 0) + (data.saldo_pendente || 0) + (data.saldo_atrasado || 0);

            // --- REGRA DE NEGÓCIO DA ECONOMIA ---
            // Custo base de um CLT (Salário 2.5k + Encargos + Assinatura Adobe + Luz/Equipamento)
            const custoCLTBase = 5800.00;

            let custoCLTCalculado = custoCLTBase;
            let labelCLT = "Custo Fixo (1 CLT)";
            let disclaimer = "*Cálculo base: Salário + Férias + 13º + FGTS + Licença Adobe + Equipamentos.";

            // SE O CLIENTE GASTAR MUITO COM FREELA (Ex: 6 mil reais), um funcionário só não daria conta.
            // Para não deixar o gráfico negativo, escalamos o "Custo CLT" para simular uma EQUIPE.
            if (totalGasto >= (custoCLTBase * 0.8)) {
                custoCLTCalculado = totalGasto * 1.6; // Força o CLT a ser sempre ~60% mais caro
                labelCLT = "Custo de Equipe Equivalente";
                disclaimer = "*Baseado no volume de demanda, que exigiria múltiplos profissionais contratados.";
            }

            const economia = custoCLTCalculado - totalGasto;

            // Cálculos percentuais para as barras do gráfico
            // A maior barra (CLT) será sempre 100%
            const pctCLT = 100;
            const pctFreela = (totalGasto / custoCLTCalculado) * 100;

            const html = `
                <div class="economy-widget">
                    
                    <div class="economy-header">
                        <p>Você já economizou</p>
                        <div class="economy-value">+ ${fmtMoeda(economia)}</div>
                    </div>

                    <div style="margin-top: 15px;">
                        <!-- BARRA 1: CLT -->
                        <div class="bar-container">
                            <div class="bar-labels">
                                <span><i class="fa-solid fa-building-user"></i> ${labelCLT}</span>
                                <span>${fmtMoeda(custoCLTCalculado)}</span>
                            </div>
                            <div class="bar-track">
                                <div class="bar-fill fill-clt" style="width: 0%;" data-target="${pctCLT}%"></div>
                            </div>
                        </div>

                        <!-- BARRA 2: FREELA (Setor de Arte) -->
                        <div class="bar-container" style="margin-top: 12px;">
                            <div class="bar-labels">
                                <span style="color:#2ecc71;"><i class="fa-solid fa-check-circle"></i> Gastos na Plataforma</span>
                                <span style="color:#2ecc71;">${fmtMoeda(totalGasto)}</span>
                            </div>
                            <div class="bar-track">
                                <div class="bar-fill fill-freela" style="width: 0%;" data-target="${pctFreela}%"></div>
                            </div>
                        </div>
                    </div>

                    <div class="economy-disclaimer">
                        ${disclaimer}
                    </div>
                </div>
            `;

            container.innerHTML = html;

            // Animação das barras (delay pequeno para o CSS rodar macio)
            setTimeout(() => {
                const barras = container.querySelectorAll('.bar-fill');
                barras.forEach(barra => {
                    barra.style.width = barra.getAttribute('data-target');
                });
            }, 100);

        } catch (e) {
            console.error(e);
            document.getElementById('modulo-economia').innerHTML = `<p class="empty-state" style="color:red;">Erro ao calcular economia.</p>`;
        }
    }

    // Dispara as 3 chamadas
    loadAtividadeRecente();
    loadMiniExpedicao();
    loadGraficoEconomia();
});