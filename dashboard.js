// /dashboard.js

// Variável Global para a Gaveta
let currentLocalCompanyId = 0;

document.addEventListener("DOMContentLoaded", () => {
    const sessionToken = localStorage.getItem("sessionToken");

    if (!sessionToken) {
        window.location.href = "/login.html";
        return;
    }

    // Formatação de Moeda e Status
    const fmtMoeda = (valor) => parseFloat(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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

    // 2. LÓGICA COMPLETA DE EXPEDIÇÃO NA DASHBOARD
    let debounceTimeout = null;
    const inputBusca = document.getElementById('input-busca-expedicao');

    // Configura evento de digitação na busca (debounce 600ms)
    inputBusca.addEventListener('input', (e) => {
        clearTimeout(debounceTimeout);
        document.getElementById('lista-expedicao').innerHTML = '<div class="spinner"></div>';
        debounceTimeout = setTimeout(() => carregarExpedicaoDash(e.target.value), 600);
    });

    async function carregarExpedicaoDash(termoBusca = '') {
        const container = document.getElementById('lista-expedicao');
        try {
            const res = await fetch('/api/expedicao/listar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionToken: sessionToken,
                    query: termoBusca
                })
            });
            const data = await res.json();

            currentLocalCompanyId = data.localCompanyId;

            if (!data.deals || data.deals.length === 0) {
                container.innerHTML = '<p class="empty-state"><i class="fa-solid fa-box-open" style="font-size:2rem; color:#cbd5e1; display:block; margin-bottom:10px;"></i>Nenhum material encontrado.</p>';
                return;
            }

            // Renderiza todos que vieram do BD (pois a div tem scroll)
            container.innerHTML = data.deals.map(p => {
                const isEntregue = p.status_expedicao === 'Entregue';
                // Convertemos o objeto em string para passar no onclick sem quebrar aspas
                const objStr = encodeURIComponent(JSON.stringify(p));

                return `
                    <div class="dash-list-item" onclick="abrirGavetaDash('${objStr}')">
                        <div>
                            <div class="dash-item-title">${p.titulo}</div>
                            <div class="dash-item-subtitle">${p.nome_cliente || 'Sem cliente'}</div>
                        </div>
                        <div></div>
                        <div style="text-align:right;">
                            <span class="badge-status ${isEntregue ? 'st-entregue' : 'st-aguardando'}">${p.status_expedicao || 'Aguardando'}</span>
                        </div>
                    </div>
                `;
            }).join('');

        } catch (e) {
            container.innerHTML = `<p class="empty-state" style="color:red;">Erro ao buscar materiais.</p>`;
        }
    }

    // Funções da Gaveta (Expostas no window para o onclick funcionar dinâmico)
    window.abrirGavetaDash = function (pedidoEncoded) {
        const p = JSON.parse(decodeURIComponent(pedidoEncoded));
        const overlay = document.getElementById('drawer-overlay');
        const panel = document.getElementById('drawer-panel');

        document.getElementById('drawer-header-title').innerText = p.titulo;
        document.getElementById('d-cliente').innerText = p.nome_cliente || '--';
        document.getElementById('d-wpp').innerText = p.whatsapp || '--';
        document.getElementById('d-briefing').innerText = p.briefing || 'Sem detalhes registrados.';
        document.getElementById('d-status').innerText = p.status_expedicao || 'Aguardando';

        document.getElementById('d-valor-pago').innerText = fmtMoeda(p.valor_pago || 0);
        document.getElementById('d-valor-restante').innerText = fmtMoeda(p.valor_restante || 0);

        const btnExterno = document.getElementById('btn-ver-pedido-externo');
        if (p.titulo && (currentLocalCompanyId === 4 || currentLocalCompanyId === 24)) {
            btnExterno.href = `https://www.visiva.com.br/admin/?imprimastore=pedidos/detalhes&id=${encodeURIComponent(p.titulo)}`;
            btnExterno.style.display = 'flex';
        } else {
            btnExterno.style.display = 'none';
        }

        const btnWpp = document.getElementById('btn-wpp-link');
        if (p.whatsapp && p.whatsapp.length > 5) {
            btnWpp.href = `https://wa.me/55${p.whatsapp.replace(/\D/g, '')}`;
            btnWpp.style.display = 'inline-block';
        } else {
            btnWpp.style.display = 'none';
        }

        configurarBotaoAcaoDash(p);
        overlay.classList.add('active');
        panel.classList.add('active');
    };

    window.fecharGaveta = function () {
        document.getElementById('drawer-overlay').classList.remove('active');
        document.getElementById('drawer-panel').classList.remove('active');
    };

    function configurarBotaoAcaoDash(p) {
        const btnAcao = document.getElementById('btn-gaveta-entregar');
        const isEntregue = p.status_expedicao === 'Entregue';

        btnAcao.dataset.confirming = "false";
        btnAcao.classList.remove('btn-confirm-state');

        if (isEntregue) {
            btnAcao.innerHTML = '<i class="fas fa-check-circle"></i> PEDIDO JÁ ENTREGUE';
            btnAcao.className = 'btn-base btn-acao-entregue';
            btnAcao.disabled = true;
            btnAcao.onclick = null;
        } else {
            btnAcao.innerHTML = '<i class="fas fa-box-open"></i> MARCAR COMO ENTREGUE';
            btnAcao.className = 'btn-base btn-acao-entregar';
            btnAcao.disabled = false;
            btnAcao.onclick = () => {
                if (btnAcao.dataset.confirming === "true") {
                    marcarEntregueDash(p.id_interno, btnAcao);
                } else {
                    btnAcao.dataset.confirming = "true";
                    btnAcao.innerHTML = '<i class="fas fa-exclamation-triangle"></i> CLIQUE PARA CONFIRMAR';
                    btnAcao.classList.add('btn-confirm-state');
                    setTimeout(() => {
                        btnAcao.dataset.confirming = "false";
                        btnAcao.innerHTML = '<i class="fas fa-box-open"></i> MARCAR COMO ENTREGUE';
                        btnAcao.classList.remove('btn-confirm-state');
                    }, 3000);
                }
            };
        }
    }

    async function marcarEntregueDash(idInterno, btnElement) {
        btnElement.disabled = true;
        btnElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
        try {
            const res = await fetch('/api/expedicao/entregar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionToken: sessionToken, id: idInterno })
            });
            if (res.ok) {
                window.fecharGaveta();
                // Recarrega a lista usando o termo que estiver na busca
                carregarExpedicaoDash(document.getElementById('input-busca-expedicao').value);
            } else {
                alert("Erro ao atualizar o pedido.");
                btnElement.disabled = false;
            }
        } catch (err) {
            alert("Erro de comunicação com o servidor.");
            btnElement.disabled = false;
        }
    }

    // 3. CARREGAR GRÁFICO DE ECONOMIA
    async function loadGraficoEconomia() {
        try {
            const res = await fetch('/api/carteira/dados', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionToken: sessionToken })
            });
            const data = await res.json();
            const container = document.getElementById('modulo-economia');

            const totalGasto = (data.pago_mes || 0) + (data.saldo_pendente || 0) + (data.saldo_atrasado || 0);

            // Valor CLT realista no Brasil (Salário R$ 2.000 + Férias, 13º, FGTS e Encargos Mensais) = ~R$ 3.200
            const custoCLTBase = 3200.00;

            let custoCLTCalculado = custoCLTBase;
            let labelCLT = "Custo Fixo (1 CLT)";
            let disclaimer = "*Cálculo base: Salário médio (R$ 2.000) + provisões mensais de Férias, 13º, FGTS e Encargos.";

            if (totalGasto >= (custoCLTBase * 0.8)) {
                custoCLTCalculado = totalGasto * 1.6;
                labelCLT = "Custo de Equipe Equivalente";
                disclaimer = "*Baseado no volume de demanda, que exigiria múltiplos profissionais contratados.";
            }

            const economia = custoCLTCalculado - totalGasto;
            const pctCLT = 100;
            const pctFreela = (totalGasto / custoCLTCalculado) * 100;

            const html = `
                <div class="economy-widget">
                    <div class="economy-header">
                        <p>Você já economizou</p>
                        <div class="economy-value">+ ${fmtMoeda(economia)}</div>
                    </div>
                    <div style="margin-top: 15px;">
                        <div class="bar-container">
                            <div class="bar-labels">
                                <span><i class="fa-solid fa-building-user"></i> ${labelCLT}</span>
                                <span>${fmtMoeda(custoCLTCalculado)}</span>
                            </div>
                            <div class="bar-track">
                                <div class="bar-fill fill-clt" style="width: 0%;" data-target="${pctCLT}%"></div>
                            </div>
                        </div>
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
                    <div class="economy-disclaimer">${disclaimer}</div>
                </div>
            `;

            container.innerHTML = html;

            setTimeout(() => {
                const barras = container.querySelectorAll('.bar-fill');
                barras.forEach(barra => {
                    barra.style.width = barra.getAttribute('data-target');
                });
            }, 100);

        } catch (e) {
            document.getElementById('modulo-economia').innerHTML = `<p class="empty-state" style="color:red;">Erro ao calcular economia.</p>`;
        }
    }

    // Dispara as 3 chamadas simultâneas
    loadAtividadeRecente();
    carregarExpedicaoDash(); // Carrega a lista com scroll baseada no DB
    loadGraficoEconomia();
});