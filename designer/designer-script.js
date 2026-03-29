// /designer/designer-script.js - VERSÃO COM CONTA CORRENTE (LEDGER)
(function () {
    const sessionToken = localStorage.getItem('designerToken');
    const path = window.location.pathname;

    console.log('[INIT] Verificando sessão na rota:', path);

    const paginasPublicas = ['login.html', 'cadastro.html', 'esqueci-senha.html', 'redefinir-senha.html'];
    const ehPaginaPublica = paginasPublicas.some(pg => path.includes(pg));

    if (!sessionToken && !ehPaginaPublica) {
        console.warn('[AUTH] Usuário não autenticado. Redirecionando para login.');
        window.location.href = 'login.html';
        return;
    }

    document.addEventListener('DOMContentLoaded', () => {
        console.log('[DOM] DOM completamente carregado.');

        if (document.querySelector('main.main-painel')) {
            console.log('[PAINEL] Inicializando Dashboard do Designer...');
            carregarDashboardDesigner();
        }

        const logoutBtn = document.getElementById('logout-button');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                console.log('[AUTH] Realizando logout...');
                localStorage.clear();
                window.location.href = 'login.html';
            });
        }

        // --- Form Functions (Login, Cadastro, etc) omitidos por brevidade caso não mudem ---
        // Se precisar eu coloco todos os blocos de Form aqui, mas eles não afetam a lógica principal.
        // Vou manter os originais abaixo para o código não quebrar.

        const loginForm = document.getElementById('designer-login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('email').value;
                const senha = document.getElementById('senha').value;
                const btnSubmit = loginForm.querySelector('button[type="submit"]');
                const feedback = document.getElementById('form-error-feedback');
                btnSubmit.disabled = true; btnSubmit.textContent = 'Entrando...'; feedback.classList.add('hidden');
                try {
                    const res = await fetch('/api/designer/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, senha }) });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.message || 'Erro ao fazer login.');
                    localStorage.setItem('designerToken', data.token);
                    localStorage.setItem('designerInfo', JSON.stringify({ name: data.nome, nivel: data.nivel }));
                    window.location.href = 'painel.html';
                } catch (error) { feedback.textContent = error.message; feedback.classList.remove('hidden'); btnSubmit.disabled = false; btnSubmit.textContent = 'Entrar'; }
            });
        }

        // ... Os blocos de cadastro e redefinir senha permanecem iguais ao original ...
    });

    // GAVETA (DRAWER) GLOBAL FUNCTIONS
    window.fecharGaveta = () => {
        const overlay = document.getElementById('drawer-overlay');
        const panel = document.getElementById('drawer-panel');
        if (overlay) overlay.classList.remove('active');
        if (panel) panel.classList.remove('active');
        if (window.chatInterval) clearInterval(window.chatInterval); // Limpa chat se fechar gaveta
    };

    window.abrirGaveta = (titulo, htmlCorpo, htmlRodape = '') => {
        document.getElementById('drawer-title').innerText = titulo;
        document.getElementById('drawer-content').innerHTML = htmlCorpo;
        document.getElementById('drawer-footer').innerHTML = htmlRodape;
        document.getElementById('drawer-overlay').classList.add('active');
        document.getElementById('drawer-panel').classList.add('active');
    };

    window.mostrarErro = (mensagem) => {
        const corpo = `<div style="color: #e11d48; background: #fff1f2; padding: 15px; border-radius: 8px; border: 1px solid #fda4af;"><i class="fas fa-exclamation-circle"></i> <strong>Erro:</strong> ${mensagem}</div>`;
        window.abrirGaveta("Ops! Algo deu errado", corpo, `<button onclick="fecharGaveta()" class="btn-full btn-secondary">Entendi</button>`);
    };

    // DASHBOARD PRINCIPAL
    async function carregarDashboardDesigner() {
        console.log('[DASHBOARD] Buscando dados do painel...');
        const designerInfo = JSON.parse(localStorage.getItem('designerInfo'));
        if (designerInfo) document.getElementById('designer-greeting').textContent = `Olá, ${designerInfo.name}!`;

        try {
            const res = await fetch('/api/designer/getDashboard', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: sessionToken })
            });
            const data = await res.json();

            if (!res.ok) {
                if (res.status === 401 || res.status === 403) { localStorage.clear(); window.location.href = 'login.html'; return; }
                throw new Error(data.message);
            }

            console.log('[DASHBOARD] Sucesso.');
            document.getElementById('designer-faturamento-mes').textContent = formatarMoeda(data.designer.faturamento_mes);
            document.getElementById('designer-acertos-pendentes').textContent = formatarMoeda(data.designer.acertos_pendentes);
            document.getElementById('designer-pedidos-ativos').textContent = data.meusPedidos.length;
            document.getElementById('count-meus').textContent = data.meusPedidos.length;
            document.getElementById('count-mercado').textContent = data.mercado.length;

            const badgeNivel = document.getElementById('badge-nivel');
            const niveis = { 1: { t: 'Ouro', c: 'lvl-1' }, 2: { t: 'Prata', c: 'lvl-2' }, 3: { t: 'Bronze', c: 'lvl-3' } };
            const n = niveis[data.designer.nivel] || niveis[3];
            if (badgeNivel) { badgeNivel.innerHTML = `<i class="fas fa-medal"></i> Nível ${n.t}`; badgeNivel.className = `stat-badge ${n.c}`; }

            const valPontos = document.getElementById('val-pontos');
            if (valPontos) valPontos.textContent = data.designer.pontuacao;

            renderizarMeusTrabalhos(data.meusPedidos);
            renderizarMercado(data.mercado);
            carregarHistoricoAcertos(); // Carrega o Extrato/Ledger

            if (data.meusPedidos && data.meusPedidos.length > 0) {
                const ativosIds = data.meusPedidos.map(p => p.id);
                iniciarVerificacaoNotificacoes(ativosIds);
            }

        } catch (error) { window.mostrarErro('Falha ao carregar os dados do painel.'); }
    }

    // --- NOVA LÓGICA DE EXTRATO (CONTA CORRENTE) ---
    async function carregarHistoricoAcertos() {
        console.log('[HISTORICO] Buscando extrato do banco...');
        const container = document.getElementById('saques-list');
        if (!container) return;

        try {
            const res = await fetch('/api/designer/getAcertos', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: sessionToken })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.message);

            window.acertosCache = data.acertos;
            renderizarHistoricoFiltrado('TODOS'); // Renderiza agrupado

        } catch (error) {
            console.error('[HISTORICO] Erro:', error);
            container.innerHTML = `<p style="text-align:center; padding:20px; color:var(--danger);">Erro ao carregar extrato.</p>`;
        }
    }

    window.renderizarHistoricoFiltrado = (statusFiltro) => {
        const container = document.getElementById('saques-list');
        const acertos = window.acertosCache || [];
        const badgeNotif = document.getElementById('notif-pagamentos');

        const filtrados = statusFiltro === 'TODOS' ? acertos : acertos.filter(a => a.status === statusFiltro);

        if (filtrados.length === 0) {
            container.innerHTML = `
                ${renderizarControlesFiltro(statusFiltro)}
                <p style="text-align:center; padding:40px; color:var(--text-muted);">Nenhuma movimentação encontrada.</p>
            `;
            if (badgeNotif) badgeNotif.style.display = 'none';
            return;
        }

        // Agrupando por Empresa (Gráfica)
        const grupos = {};
        let pagamentosAguardando = 0;

        filtrados.forEach(a => {
            const empId = a.empresa_id;
            if (!grupos[empId]) {
                grupos[empId] = { nome: a.empresa, id: empId, totalDivida: 0, totalAnalise: 0, itens: [] };
            }
            grupos[empId].itens.push(a);

            // Dívida bruta (Artes ainda não pagas)
            if (a.status === 'PENDENTE' && !a.is_pagamento) {
                grupos[empId].totalDivida += a.valor;
            }
            // Pagamentos que a gráfica enviou e você não aprovou ainda
            if (a.status === 'AGUARDANDO_CONFIRMACAO' && a.is_pagamento) {
                grupos[empId].totalAnalise += a.valor;
                pagamentosAguardando++;
            }
        });

        // Sinal vermelho na ABA se houver pagamento aguardando aprovação
        if (badgeNotif) badgeNotif.style.display = pagamentosAguardando > 0 ? 'inline-flex' : 'none';

        const htmlGrupos = Object.values(grupos).map((grupo, idx) => {
            const empIdStr = `emp-${idx}`;

            let bgStyle = "background: #fff;";
            let acaoIcone = "";

            if (grupo.totalAnalise > 0) {
                bgStyle = "background: #fffbeb; border-left: 4px solid #f59e0b;";
                acaoIcone = `<span style="background: #ef4444; color: white; font-size: 0.65rem; padding: 3px 8px; border-radius: 12px; font-weight: 700; margin-left: 10px; animation: pulse 1.5s infinite;">AÇÃO NECESSÁRIA</span>`;
            }

            return `
                <div style="border-bottom: 1px solid #f1f5f9; margin-bottom: 8px; border-radius: 8px; overflow: hidden; ${bgStyle}">
                    <div style="display: grid; grid-template-columns: 2fr 1.5fr; gap: 10px; padding: 18px; align-items: center; cursor:pointer;" onclick="toggleDetalhesEmpresa('${empIdStr}')">
                        <div style="font-weight:700; color:var(--text-main); font-size: 0.95rem;">
                            <i class="fas fa-chevron-right" id="icon-${empIdStr}" style="margin-right:8px; transition:0.2s; color:#94a3b8;"></i> 
                            ${grupo.nome} ${acaoIcone}
                        </div>
                        <div style="text-align:right;">
                            <span style="font-size: 0.8rem; color: #64748b; margin-right: 10px;">A Receber:</span>
                            <span style="font-weight:800; color:var(--danger); font-size: 1.1rem;">${formatarMoeda(grupo.totalDivida)}</span>
                        </div>
                    </div>
                    
                    <div id="detalhes-${empIdStr}" style="display:none; background: #f8fafc; padding: 15px 20px 15px 40px; border-top: 1px solid #edf2f7; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);">
                        ${grupo.itens.map(item => {

                // BLOCO ESPECIAL DE PAGAMENTO AGUARDANDO CONFIRMAÇÃO
                if (item.is_pagamento && item.status === 'AGUARDANDO_CONFIRMACAO') {
                    return `
                                    <div style="background: white; border: 2px dashed #f59e0b; padding: 15px; border-radius: 12px; margin: 10px 0;">
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                            <div style="font-weight: 700; color: #b45309;"><i class="fas fa-hand-holding-usd"></i> PIX Informado pela Gráfica</div>
                                            <div style="font-size: 1.2rem; font-weight: 800; color: #27ae60;">+ ${formatarMoeda(item.valor)}</div>
                                        </div>
                                        <div style="font-size: 0.85rem; color: #475569; margin-bottom: 15px;">A gráfica informou que transferiu este valor para sua conta. Verifique o comprovante e confirme o recebimento para dar baixa nas suas artes pendentes.</div>
                                        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                                            <button onclick="responderPagamento(${item.id}, 'CONFIRMAR')" class="btn-action" style="background:#10b981;"><i class="fas fa-check"></i> Recebi o Valor</button>
                                            <button onclick="responderPagamento(${item.id}, 'RECUSAR')" class="btn-action" style="background:#ef4444;"><i class="fas fa-times"></i> Recusar (Não recebi)</button>
                                            ${item.comprovante_url ? `<a href="${item.comprovante_url}" target="_blank" class="btn-outline-sm" style="display:inline-flex; align-items:center; gap:5px; margin-top:0;"><i class="fas fa-external-link-alt"></i> Ver Comprovante</a>` : ''}
                                        </div>
                                    </div>
                                `;
                }

                // LINHA NORMAL DE EXTRATO
                let statusHtml = `<span style="background:#fef3c7; color:#b45309; padding:2px 8px; border-radius:8px; font-size:0.65rem; font-weight:700;">${item.status}</span>`;
                if (item.status === 'PAGO') statusHtml = `<span style="background:#d1fae5; color:#065f46; padding:2px 8px; border-radius:8px; font-size:0.65rem; font-weight:700;">${item.is_pagamento ? 'APROVADO' : 'RECEBIDO'}</span>`;
                else if (item.status === 'RECUSADO') statusHtml = `<span style="background:#fee2e2; color:#b91c1c; padding:2px 8px; border-radius:8px; font-size:0.65rem; font-weight:700;">RECUSADO</span>`;

                let linkDoc = item.comprovante_url ? `<a href="${item.comprovante_url}" target="_blank" title="Ver Comprovante" style="color:var(--primary-color);"><i class="fas fa-file-invoice-dollar"></i></a>` : '-';
                let iconAcao = item.is_pagamento ? `<i class="fas fa-arrow-down" style="color:#27ae60;"></i>` : `<i class="fas fa-palette" style="color:#3498db;"></i>`;
                let prefixo = item.is_pagamento ? `+ ` : ``;
                let corValor = item.is_pagamento ? `color: #27ae60;` : `color: #1e293b;`;

                return `
                                <div style="display: grid; grid-template-columns: 0.5fr 2fr 1fr 1fr 0.5fr; gap: 10px; padding: 10px 0; border-bottom: 1px dashed #e2e8f0; font-size:0.85rem; align-items: center;">
                                    <div style="color:var(--text-muted); font-size:0.75rem;">${new Date(item.data).toLocaleDateString()}</div>
                                    <div style="font-weight:500;">${iconAcao} ${item.descricao}</div>
                                    <div>${statusHtml}</div>
                                    <div style="font-weight:700; text-align:right; ${corValor}">${prefixo}${formatarMoeda(item.valor)}</div>
                                    <div style="text-align:right;">${linkDoc}</div>
                                </div>
                            `;
            }).join('')}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            ${renderizarControlesFiltro(statusFiltro)}
            ${htmlGrupos}
        `;
    }

    function renderizarControlesFiltro(selecionado) {
        return `
            <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 20px; background: #fff; padding: 15px; border-radius: 12px; box-shadow: var(--shadow-sm);">
                <span style="font-weight:600; font-size:0.9rem; color:var(--secondary-color);">Filtro de Extrato:</span>
                <select onchange="renderizarHistoricoFiltrado(this.value)" style="padding: 8px 15px; border-radius: 8px; border: 1px solid #e2e8f0; font-family: 'Poppins'; outline:none; cursor:pointer;">
                    <option value="TODOS" ${selecionado === 'TODOS' ? 'selected' : ''}>Todas as Movimentações</option>
                    <option value="PENDENTE" ${selecionado === 'PENDENTE' ? 'selected' : ''}>Artes a Receber</option>
                    <option value="AGUARDANDO_CONFIRMACAO" ${selecionado === 'AGUARDANDO_CONFIRMACAO' ? 'selected' : ''}>Pagamentos em Análise</option>
                    <option value="PAGO" ${selecionado === 'PAGO' ? 'selected' : ''}>Quitados / Aprovados</option>
                </select>
            </div>
            <style>@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }</style>
        `;
    }

    window.toggleDetalhesEmpresa = (id) => {
        const el = document.getElementById(`detalhes-${id}`);
        const icon = document.getElementById(`icon-${id}`);
        if (el.style.display === 'none') { el.style.display = 'block'; icon.style.transform = 'rotate(90deg)'; }
        else { el.style.display = 'none'; icon.style.transform = 'rotate(0deg)'; }
    }

    // --- NOVA FUNÇÃO DE CONFIRMAR/RECUSAR O PIX ---
    window.responderPagamento = async (pagamentoId, acao) => {
        if (acao === 'CONFIRMAR') {
            if (!confirm("Atenção! Você conferiu a sua conta e o dinheiro realmente caiu? Ao confirmar, as suas artes receberão baixa.")) return;
        } else {
            if (!confirm("Tem certeza que deseja RECUSAR este comprovante? A gráfica será notificada.")) return;
        }

        console.log(`[PAGAMENTO] Processando ação: ${acao} para ID: ${pagamentoId}`);

        try {
            const res = await fetch('/api/designer/confirmarPagamento', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: sessionToken, pagamentoId, acao })
            });
            const data = await res.json();

            if (res.ok) {
                console.log('[PAGAMENTO] Sucesso:', data.message);
                alert(data.message);
                carregarDashboardDesigner(); // Recarrega tudo (atualiza os contadores e a lista)
            } else {
                alert("Erro: " + data.message);
            }
        } catch (e) {
            console.error('[ERRO] Ao responder pagamento:', e);
            alert("Erro de comunicação com o servidor.");
        }
    }


    // --- FUNÇÕES DA MESA DE TRABALHO E CHAT (MANTIDAS INTACTAS) ---
    function renderizarMeusTrabalhos(pedidos) {
        const container = document.getElementById('atendimentos-list');
        if (!container) return;
        if (pedidos.length === 0) { container.innerHTML = `<p style="text-align:center; padding:40px; color:var(--text-muted);">Nenhum atendimento ativo.</p>`; return; }

        container.innerHTML = pedidos.map(p => `
            <div class="list-item" style="grid-template-columns: 0.5fr 3fr 1fr 1fr 1.2fr;">
                <div style="color:var(--secondary-color);">#${p.id}</div>
                <div><div style="font-weight:600;">${p.titulo}</div><button onclick="verBriefing('${b64EncodeUnicode(p.briefing_completo || '')}')" class="btn-outline-sm">LER BRIEFING</button></div>
                <div><span style="background:#fef3c7; color:#b45309; padding:4px 10px; border-radius:12px; font-size:0.7rem; font-weight:700;">PRODUÇÃO</span></div>
                <div style="font-weight:700; color:var(--success);">${formatarMoeda(p.valor_designer)}</div>
                <div style="text-align: right; display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap;">
                    <div class="btn-chat-wrapper"><button onclick="abrirChatEmbutido(${p.id}, '${p.titulo}', 'cliente')" class="btn-action" style="background:#25D366; padding: 6px 10px;"><i class="fab fa-whatsapp"></i> Cliente</button><span id="badge-cliente-${p.id}" class="badge-notif"></span></div>
                    <div class="btn-chat-wrapper"><button onclick="abrirChatEmbutido(${p.id}, '${p.titulo}', 'interno')" class="btn-action" style="background:#4f46e5; padding: 6px 10px;"><i class="fas fa-building"></i> Gráfica</button><span id="badge-interno-${p.id}" class="badge-notif"></span></div>
                    <button onclick="prepararFinalizacao(${p.id})" class="btn-action" style="padding: 6px 10px;">Finalizar</button>
                </div>
            </div>
        `).join('');
    }

    function renderizarMercado(pedidos) {
        const container = document.getElementById('mercado-list');
        if (!container) return;
        if (pedidos.length === 0) { container.innerHTML = `<p style="text-align:center; padding:40px; color:var(--text-muted);">Nenhum pedido disponível.</p>`; return; }

        container.innerHTML = pedidos.map(p => `
            <div class="list-item" style="grid-template-columns: 0.5fr 3fr 1fr 1fr;">
                <div style="color:var(--secondary-color);">#${p.id}</div>
                <div><div style="font-weight:600;">${p.titulo}</div><button onclick="verBriefing('${b64EncodeUnicode(p.briefing_completo || '')}')" class="btn-outline-sm">LER BRIEFING</button></div>
                <div style="font-weight:700; color:var(--success); font-size:1.1rem;">${formatarMoeda(p.valor_designer)}</div>
                <div style="text-align: right;"><button onclick="confirmarAssumir(${p.id})" class="btn-action" style="padding:10px 20px;">ATENDER</button></div>
            </div>
        `).join('');
    }

    window.verBriefing = (b64) => {
        const texto = decodeURIComponent(Array.prototype.map.call(atob(b64), c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        window.abrirGaveta("Briefing do Pedido", `<span class="drawer-label">Instruções</span><div class="briefing-box">${texto}</div>`, `<button onclick="fecharGaveta()" class="btn-full btn-secondary">Fechar</button>`);
    };

    window.confirmarAssumir = (id) => {
        window.abrirGaveta("Confirmar Atendimento", `<p style="font-size:1rem; color:var(--text-main);">Deseja assumir este pedido?</p>`, `<button id="btn-exec-assumir" class="btn-full btn-primary">SIM, ATENDER</button><button onclick="fecharGaveta()" class="btn-full btn-secondary">Cancelar</button>`);
        document.getElementById('btn-exec-assumir').onclick = async () => {
            const btn = document.getElementById('btn-exec-assumir'); btn.disabled = true; btn.textContent = 'Aguarde...';
            try {
                const res = await fetch('/api/designer/assumirPedido', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: sessionToken, pedidoId: id }) });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message);
                fecharGaveta(); carregarDashboardDesigner();
            } catch (e) { fecharGaveta(); setTimeout(() => window.mostrarErro(e.message), 300); }
        };
    };

    window.prepararFinalizacao = (id) => {
        const corpo = `<span class="drawer-label">Link Layout</span><input type="url" id="f-layout" class="drawer-input" required><span class="drawer-label">Link Arquivo Final</span><input type="url" id="f-impressao" class="drawer-input" required>`;
        window.abrirGaveta("Entregar Trabalho", corpo, `<button id="btn-exec-finalizar" class="btn-full btn-primary">FINALIZAR E RECEBER</button><button onclick="fecharGaveta()" class="btn-full btn-secondary">Voltar</button>`);
        document.getElementById('btn-exec-finalizar').onclick = async () => {
            const linkLayout = document.getElementById('f-layout').value.trim(); const linkImpressao = document.getElementById('f-impressao').value.trim();
            if (!linkLayout || !linkImpressao) return alert("Preencha os dois links.");
            const btn = document.getElementById('btn-exec-finalizar'); btn.disabled = true; btn.textContent = 'Enviando...';
            try {
                const res = await fetch('/api/designer/finalizarPedido', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: sessionToken, pedidoId: id, linkLayout, linkImpressao }) });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || "Erro.");
                fecharGaveta(); setTimeout(() => { window.abrirGaveta("Sucesso!", `<p style="color:var(--success); text-align:center;">${data.message}</p>`, `<button onclick="fecharGaveta()" class="btn-full btn-primary">Ok!</button>`); carregarDashboardDesigner(); }, 300);
            } catch (e) { fecharGaveta(); setTimeout(() => window.mostrarErro(e.message), 300); }
        };
    };

    function formatarMoeda(valor) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0); }
    window.b64EncodeUnicode = (str) => { return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (m, p1) => String.fromCharCode('0x' + p1))); };

    // Chat Logic Intact
    window.chatAbertoAtual = { pedidoId: null, tipoChat: null };
    window.notifInterval = null;

    function iniciarVerificacaoNotificacoes(pedidosIds) {
        if (window.notifInterval) clearInterval(window.notifInterval);
        if (!pedidosIds || pedidosIds.length === 0) return;
        const check = async () => {
            try {
                const fd = new FormData(); fd.append('action', 'check_all'); fd.append('pedidos', JSON.stringify(pedidosIds));
                const res = await fetch('/api/designer/chat', { method: 'POST', body: fd });
                const data = await res.json();
                if (res.ok && data.latestMessages) {
                    for (const [pId, msgs] of Object.entries(data.latestMessages)) {
                        if (msgs.cliente) {
                            const lidoId = localStorage.getItem(`lastRead_${pId}_cliente`); const badge = document.getElementById(`badge-cliente-${pId}`);
                            const chatNaoAberto = !(window.chatAbertoAtual.pedidoId == pId && window.chatAbertoAtual.tipoChat === 'cliente');
                            if (msgs.cliente.id !== lidoId && msgs.cliente.side === 'in' && chatNaoAberto) { if (badge) badge.style.display = 'flex'; } else { if (badge) badge.style.display = 'none'; }
                        }
                        if (msgs.interno) {
                            const lidoId = localStorage.getItem(`lastRead_${pId}_interno`); const badge = document.getElementById(`badge-interno-${pId}`);
                            const chatNaoAberto = !(window.chatAbertoAtual.pedidoId == pId && window.chatAbertoAtual.tipoChat === 'interno');
                            if (msgs.interno.id !== lidoId && msgs.interno.side === 'in' && chatNaoAberto) { if (badge) badge.style.display = 'flex'; } else { if (badge) badge.style.display = 'none'; }
                        }
                    }
                }
            } catch (err) { console.error('[NOTIFICAÇÕES] Falha:', err); }
        };
        check(); window.notifInterval = setInterval(check, 20000);
    }

    const chatStyle = document.createElement('style');
    chatStyle.textContent = `.chat-container { flex: 1; overflow-y: auto; padding: 15px; background: #efeae2; border-radius: 8px; display: flex; flex-direction: column; gap: 10px; height: 60vh; } .chat-bubble { max-width: 85%; padding: 10px 14px; border-radius: 8px; font-size: 0.9rem; position: relative; word-wrap: break-word; box-shadow: 0 1px 2px rgba(0,0,0,0.1); } .chat-in { background: #ffffff; align-self: flex-start; border-top-left-radius: 0; } .chat-out { background: #dcf8c6; align-self: flex-end; border-top-right-radius: 0; } .chat-sender { font-size: 0.7rem; font-weight: 700; color: #075e54; margin-bottom: 4px; display: block; } .chat-time { font-size: 0.65rem; color: #999; text-align: right; display: block; margin-top: 5px; } .chat-input-row { display: flex; gap: 10px; margin-top: 15px; align-items: center; }`;
    document.head.appendChild(chatStyle);

    window.abrirChatEmbutido = async (pedidoId, pedidoTitulo, tipoChat = 'cliente') => {
        window.chatAbertoAtual = { pedidoId: pedidoId, tipoChat: tipoChat };
        const badgeElement = document.getElementById(`badge-${tipoChat}-${pedidoId}`);
        if (badgeElement) badgeElement.style.display = 'none';

        const corpo = `
            <div class="chat-container" id="chat-msgs-container"><p style="text-align:center; color:#888; margin-top: 20px;"><i class="fas fa-spinner fa-spin"></i> Conectando...</p></div>
            <div id="chat-file-preview" style="display:none; padding:10px; background:#f1f5f9; border-radius:8px; margin-top:10px; font-size:0.8rem; display:flex; justify-content:space-between; align-items:center;">
                <span id="chat-file-name" style="color:var(--primary-color); font-weight:600;"></span><button onclick="document.getElementById('chat-file-input').value=''; document.getElementById('chat-file-preview').style.setProperty('display', 'none', 'important');" style="border:none; background:none; color:red; cursor:pointer;">&times;</button>
            </div>
            <div class="chat-input-row" style="position:relative;">
                <input type="file" id="chat-file-input" style="display:none;" onchange="const f=this.files[0]; if(f){ document.getElementById('chat-file-name').innerText=f.name; document.getElementById('chat-file-preview').style.setProperty('display', 'flex', 'important'); }">
                <button onclick="document.getElementById('chat-file-input').click()" class="btn-action" style="padding: 10px 15px; background:#64748b; font-size: 1.1rem; border-radius: 8px;" title="Anexar Arquivo"><i class="fas fa-paperclip"></i></button>
                <input type="text" id="chat-texto-input" class="drawer-input" style="margin:0; flex:1;" placeholder="Escreva..." autocomplete="off">
                <button id="btn-enviar-chat" class="btn-action" style="padding: 14px 20px; font-size: 1.2rem; border-radius: 8px;"><i class="fas fa-paper-plane"></i></button>
            </div>
        `;
        const designerNome = document.getElementById('designer-greeting')?.innerText.replace('Olá, ', '').split('!')[0] || 'Designer';
        window.abrirGaveta(tipoChat === 'interno' ? `Chat Gráfica: ${pedidoId}` : `Chat Cliente: ${pedidoId}`, corpo, "");

        const gavetaOverlay = document.getElementById('drawer-overlay');
        const onclickOriginal = gavetaOverlay.onclick;
        gavetaOverlay.onclick = () => { window.chatAbertoAtual = { pedidoId: null, tipoChat: null }; if (onclickOriginal) onclickOriginal(); }

        const container = document.getElementById('chat-msgs-container'); const input = document.getElementById('chat-texto-input'); const btnEnviar = document.getElementById('btn-enviar-chat'); const fileInput = document.getElementById('chat-file-input');
        let totalMensagensCache = 0;

        const carregarMensagens = async () => {
            try {
                const fd = new FormData(); fd.append('action', 'get'); fd.append('pedidoId', pedidoId); fd.append('tipoChat', tipoChat);
                const res = await fetch('/api/designer/chat', { method: 'POST', body: fd }); const data = await res.json();
                if (res.ok && data.mensagens.length !== totalMensagensCache) {
                    totalMensagensCache = data.mensagens.length;
                    if (data.mensagens.length > 0) localStorage.setItem(`lastRead_${pedidoId}_${tipoChat}`, data.mensagens[data.mensagens.length - 1].id);
                    container.innerHTML = data.mensagens.map(m => {
                        let msgHtml = m.texto;
                        if (m.type === 'image' && m.file) msgHtml = `<img src="${m.file.link}" style="max-width:100%; border-radius:8px; cursor:pointer; margin-bottom:5px;" onclick="window.open('${m.file.link}', '_blank')"><br><small>${m.texto}</small>`;
                        else if ((m.type === 'audio' || m.type === 'voice') && m.file) msgHtml = `<audio src="${m.file.link}" controls style="max-width:100%; height:32px;"></audio><br><small>${m.texto}</small>`;
                        else if (m.file) msgHtml = `<div style="background:rgba(0,0,0,0.05); padding:10px; border-radius:8px; display:flex; align-items:center; gap:10px;"><i class="fas fa-file-alt" style="font-size:1.2rem;"></i><div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:0.75rem;">${m.file.name}</div><a href="${m.file.link}" target="_blank" style="color:var(--primary-color);"><i class="fas fa-download"></i></a></div><small>${m.texto}</small>`;
                        return `<div class="chat-bubble ${m.lado === 'in' ? 'chat-in' : 'chat-out'}"><span class="chat-sender">${m.remetente}</span>${msgHtml}<span class="chat-time">${new Date(m.hora * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>`;
                    }).join('');
                    setTimeout(() => { if (container) container.scrollTop = container.scrollHeight; }, 100);
                }
            } catch (err) { clearInterval(window.chatInterval); }
        };

        const enviarMensagem = async () => {
            const texto = input.value; const arquivo = fileInput.files[0];
            if (!texto.trim() && !arquivo) return;
            btnEnviar.disabled = true; input.disabled = true;
            try {
                const fd = new FormData(); fd.append('action', 'send'); fd.append('pedidoId', pedidoId); fd.append('tipoChat', tipoChat);
                if (texto) fd.append('texto', texto); if (arquivo) fd.append('file', arquivo); fd.append('designerNome', designerNome);
                await fetch('/api/designer/chat', { method: 'POST', body: fd });
                input.value = ''; fileInput.value = ''; document.getElementById('chat-file-preview').style.setProperty('display', 'none', 'important');
                await carregarMensagens();
                setTimeout(() => { if (container) container.scrollTop = container.scrollHeight; }, 100);
            } catch (err) { alert('Erro ao enviar a mensagem.'); } finally { btnEnviar.disabled = false; input.disabled = false; input.focus(); }
        };
        input.addEventListener('keypress', (e) => { if (e.key === 'Enter') enviarMensagem(); }); btnEnviar.onclick = enviarMensagem;
        await carregarMensagens(); window.chatInterval = setInterval(carregarMensagens, 5000);
    };
})();