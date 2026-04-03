// /designer/designer-script.js - VERSÃO INTEGRAL COMPLETA COM TRAVA DE TRIAL E CHAT
(function () {
    console.log('[INIT] -> Iniciando sistema do designer com logs detalhados...');
    const sessionToken = localStorage.getItem('designerToken');
    const path = window.location.pathname;

    const paginasPublicas = ['login.html', 'cadastro.html', 'esqueci-senha.html', 'redefinir-senha.html'];
    const ehPaginaPublica = paginasPublicas.some(pg => path.includes(pg));
    const ehPaginaAssinatura = path.includes('/assinatura.html');

    // 1. Bloqueio de usuário não logado
    if (!sessionToken && !ehPaginaPublica) {
        console.warn('[AUTH] -> Sessão não encontrada. Redirecionando para login.');
        window.location.href = 'login.html';
        return;
    }

    // 2. Trava de Segurança Híbrida (Trial 13 dias + Assinatura ACTIVE/ATIVO)
    async function validarAcessoDesigner() {
        if (ehPaginaPublica) return;

        console.log('[SECURITY] -> Validando permissão de acesso no servidor...');
        try {
            const res = await fetch('/api/trial-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: sessionToken, type: 'DESIGNER' })
            });
            const data = await res.json();

            if (!res.ok) {
                console.error('[SECURITY] -> Falha na resposta da API de segurança.');
                return;
            }

            console.log(`[SECURITY] -> Status: ${data.status_atual} | Trial Ativo: ${data.is_active}`);

            // Sincroniza o status no cache local
            const info = JSON.parse(localStorage.getItem('designerInfo') || '{}');
            info.assinaturaStatus = data.status_atual;
            localStorage.setItem('designerInfo', JSON.stringify(info));

            // Verifica se deve bloquear (Se o trial acabou E não está ATIVO/ACTIVE)
            const statusPagos = ['ACTIVE', 'ATIVO', 'CONFIRMED', 'PAGO', 'ASSINADO'];
            const temAssinaturaPaga = statusPagos.includes(data.status_atual.toUpperCase());

            if (!data.is_active && !temAssinaturaPaga) {
                console.warn('[SECURITY] -> Acesso negado. Redirecionando para assinatura.');
                if (!ehPaginaAssinatura) {
                    window.location.href = '/assinatura.html';
                }
            } else {
                console.log('[SECURITY] -> Acesso permitido.');
                if (ehPaginaAssinatura) {
                    window.location.href = 'painel.html';
                }
            }
        } catch (error) {
            console.error('[SECURITY] -> Erro ao validar trial/assinatura:', error);
        }
    }

    if (!ehPaginaPublica) validarAcessoDesigner();

    // --- UTILITÁRIOS GLOBAIS DE INTERFACE ---
    window.customAlert = (mensagem, isError = false) => {
        console.log(`[UI_ALERT] -> ${mensagem}`);
        const id = 'alert-' + Date.now();
        const cor = isError ? '#ef4444' : '#10b981';
        const html = `
            <div id="${id}" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:999999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(2px);">
                <div style="background:white; padding:30px; border-radius:12px; width:90%; max-width:350px; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.2); animation: popIn 0.3s ease;">
                    <div style="font-size:3rem; color:${cor}; margin-bottom:15px;"><i class="fas ${isError ? 'fa-times-circle' : 'fa-check-circle'}"></i></div>
                    <h3 style="margin:0 0 10px 0; color:#1e293b;">${isError ? 'Erro' : 'Sucesso'}</h3>
                    <p style="color:#64748b; font-size:0.95rem; margin-bottom:25px; line-height:1.5;">${mensagem}</p>
                    <button onclick="document.getElementById('${id}').remove()" style="width:100%; padding:12px; border:none; border-radius:8px; background:${cor}; color:white; font-weight:600; cursor:pointer;">Entendi</button>
                </div>
            </div>
            <style>@keyframes popIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }</style>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
    };

    window.customConfirm = (mensagem, callbackSim) => {
        console.log(`[UI_CONFIRM] -> ${mensagem}`);
        const id = 'confirm-' + Date.now();
        const html = `
            <div id="${id}" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:999999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(2px);">
                <div style="background:white; padding:30px; border-radius:12px; width:90%; max-width:400px; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.2);">
                    <div style="font-size:3rem; color:#f59e0b; margin-bottom:15px;"><i class="fas fa-exclamation-triangle"></i></div>
                    <h3 style="margin:0 0 10px 0; color:#1e293b;">Atenção</h3>
                    <p style="color:#64748b; font-size:0.95rem; margin-bottom:25px; line-height:1.5;">${mensagem}</p>
                    <div style="display:flex; gap:10px;">
                        <button onclick="document.getElementById('${id}').remove()" style="flex:1; padding:12px; border:none; border-radius:8px; background:#f1f5f9; color:#475569; font-weight:600; cursor:pointer;">Cancelar</button>
                        <button id="btn-sim-${id}" style="flex:1; padding:12px; border:none; border-radius:8px; background:#10b981; color:white; font-weight:600; cursor:pointer;">Sim, Confirmar</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
        document.getElementById(`btn-sim-${id}`).onclick = () => {
            document.getElementById(id).remove();
            callbackSim();
        };
    };

    // --- DASHBOARD E MESA DE TRABALHO ---
    async function carregarDashboardDesigner() {
        console.log('[DASHBOARD] -> Buscando dados do painel...');
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

            // Atualização dos Cards
            document.getElementById('designer-faturamento-mes').textContent = formatarMoeda(data.designer.faturamento_mes);
            document.getElementById('designer-acertos-pendentes').textContent = formatarMoeda(data.designer.acertos_pendentes);
            document.getElementById('designer-pedidos-ativos').textContent = data.meusPedidos.length;
            document.getElementById('count-meus').textContent = data.meusPedidos.length;
            document.getElementById('count-mercado').textContent = data.mercado.length;

            const badgeNivel = document.getElementById('badge-nivel');
            const niveis = { 1: { t: 'Ouro', c: 'lvl-1' }, 2: { t: 'Prata', c: 'lvl-2' }, 3: { t: 'Bronze', c: 'lvl-3' } };
            const n = niveis[data.designer.nivel] || niveis[3];
            if (badgeNivel) {
                badgeNivel.innerHTML = `<i class="fas fa-medal"></i> Nível ${n.t}`;
                badgeNivel.className = `stat-badge ${n.c}`;
            }

            const valPontos = document.getElementById('val-pontos');
            if (valPontos) valPontos.textContent = data.designer.pontuacao;

            // Renderizações de listas
            renderizarMeusTrabalhos(data.meusPedidos);
            renderizarMercado(data.mercado);
            carregarHistoricoAcertos();

            if (data.meusPedidos && data.meusPedidos.length > 0) {
                const ativosIds = data.meusPedidos.map(p => p.id);
                iniciarVerificacaoNotificacoes(ativosIds);
            }
        } catch (error) {
            console.error('[DASHBOARD] -> Erro fatal:', error);
            window.mostrarErro('Falha ao carregar os dados do painel.');
        }
    }
    // --- HISTÓRICO E EXTRATO DETALHADO ---
    async function carregarHistoricoAcertos() {
        const container = document.getElementById('saques-list');
        if (!container) return;

        console.log('[HISTORICO] -> Solicitando extrato de movimentações...');
        try {
            const res = await fetch('/api/designer/getAcertos', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: sessionToken })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            console.log(`[HISTORICO] -> ${data.acertos.length} registros encontrados.`);
            window.acertosCache = data.acertos;
            renderizarHistoricoFiltrado('TODOS');
        } catch (error) {
            console.error('[HISTORICO] -> Erro ao carregar extrato:', error);
            container.innerHTML = `<p style="text-align:center; padding:20px; color:var(--danger);">Erro ao carregar extrato.</p>`;
        }
    }

    window.renderizarHistoricoFiltrado = (statusFiltro) => {
        console.log(`[HISTORICO_FILTRO] -> Filtrando por: ${statusFiltro}`);
        const container = document.getElementById('saques-list');
        const acertos = window.acertosCache || [];
        const badgeNotif = document.getElementById('notif-pagamentos');

        const filtrados = statusFiltro === 'TODOS' ? acertos : acertos.filter(a => a.status === statusFiltro);

        if (filtrados.length === 0) {
            container.innerHTML = `${renderizarControlesFiltro(statusFiltro)}<p style="text-align:center; padding:40px; color:var(--text-muted);">Nenhuma movimentação encontrada.</p>`;
            if (badgeNotif) badgeNotif.style.display = 'none';
            return;
        }

        const grupos = {};
        let pagamentosAguardando = 0;

        filtrados.forEach(a => {
            const empId = a.empresa_id;
            if (!grupos[empId]) grupos[empId] = { nome: a.empresa, id: empId, totalDivida: 0, totalAnalise: 0, itens: [] };
            grupos[empId].itens.push(a);

            if (a.status === 'PENDENTE' && !a.is_pagamento) grupos[empId].totalDivida += a.valor;
            if (a.status === 'AGUARDANDO_CONFIRMACAO' && a.is_pagamento) { grupos[empId].totalAnalise += a.valor; pagamentosAguardando++; }
        });

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
                    
                    <div id="detalhes-${empIdStr}" style="display:none; background: #f8fafc; padding: 15px 20px 15px 40px; border-top: 1px solid #edf2f7;">
                        ${grupo.itens.map(item => {
                if (item.is_pagamento && item.status === 'AGUARDANDO_CONFIRMACAO') {
                    return `
                                    <div style="background: white; border: 2px dashed #f59e0b; padding: 15px; border-radius: 12px; margin: 10px 0;">
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                            <div style="font-weight: 700; color: #b45309;"><i class="fas fa-hand-holding-usd"></i> PIX Informado pela Gráfica</div>
                                            <div style="font-size: 1.2rem; font-weight: 800; color: #27ae60;">+ ${formatarMoeda(item.valor)}</div>
                                        </div>
                                        <p style="font-size:0.85rem; color:#475569; margin-bottom:15px;">Confirme se o valor caiu em sua conta bancária.</p>
                                        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                                            <button onclick="responderPagamento(${item.id}, 'CONFIRMAR')" class="btn-action" style="background:#10b981;"><i class="fas fa-check"></i> Recebi o Valor</button>
                                            <button onclick="responderPagamento(${item.id}, 'RECUSAR')" class="btn-action" style="background:#ef4444;"><i class="fas fa-times"></i> Recusar</button>
                                            ${item.comprovante_url ? `<a href="${item.comprovante_url}" target="_blank" class="btn-outline-sm"><i class="fas fa-external-link-alt"></i> Ver Comprovante</a>` : ''}
                                        </div>
                                    </div>`;
                }
                let statusHtml = `<span style="background:#fef3c7; color:#b45309; padding:2px 8px; border-radius:8px; font-size:0.65rem; font-weight:700;">${item.status}</span>`;
                if (item.status === 'PAGO') statusHtml = `<span style="background:#d1fae5; color:#065f46; padding:2px 8px; border-radius:8px; font-size:0.65rem; font-weight:700;">PAGO</span>`;
                return `
                                <div style="display: grid; grid-template-columns: 0.5fr 2fr 1fr 1fr 0.5fr; gap: 10px; padding: 10px 0; border-bottom: 1px dashed #e2e8f0; font-size:0.85rem; align-items: center;">
                                    <div style="color:var(--text-muted); font-size:0.75rem;">${new Date(item.data).toLocaleDateString()}</div>
                                    <div style="font-weight:500;">${item.is_pagamento ? '↓ PIX Recebido' : '🎨 ' + item.descricao}</div>
                                    <div>${statusHtml}</div>
                                    <div style="font-weight:700; text-align:right; color: ${item.is_pagamento ? '#27ae60' : '#1e293b'}">${item.is_pagamento ? '+' : ''}${formatarMoeda(item.valor)}</div>
                                    <div style="text-align:right;">${item.comprovante_url ? `<a href="${item.comprovante_url}" target="_blank"><i class="fas fa-file-invoice-dollar"></i></a>` : '-'}</div>
                                </div>`;
            }).join('')}
                    </div>
                </div>`;
        }).join('');

        container.innerHTML = `${renderizarControlesFiltro(statusFiltro)}${htmlGrupos}`;
    }

    function renderizarControlesFiltro(selecionado) {
        return `
            <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 20px; background: #fff; padding: 15px; border-radius: 12px; box-shadow: var(--shadow-sm);">
                <span style="font-weight:600; font-size:0.9rem;">Filtro:</span>
                <select onchange="renderizarHistoricoFiltrado(this.value)" style="padding: 8px; border-radius: 8px; border: 1px solid #e2e8f0; font-family: 'Poppins';">
                    <option value="TODOS" ${selecionado === 'TODOS' ? 'selected' : ''}>Tudo</option>
                    <option value="PENDENTE" ${selecionado === 'PENDENTE' ? 'selected' : ''}>Artes a Receber</option>
                    <option value="AGUARDANDO_CONFIRMACAO" ${selecionado === 'AGUARDANDO_CONFIRMACAO' ? 'selected' : ''}>Pagamentos em Análise</option>
                    <option value="PAGO" ${selecionado === 'PAGO' ? 'selected' : ''}>Quitados</option>
                </select>
            </div>`;
    }

    window.toggleDetalhesEmpresa = (id) => {
        const el = document.getElementById(`detalhes-${id}`);
        const icon = document.getElementById(`icon-${id}`);
        if (el.style.display === 'none') { el.style.display = 'block'; icon.style.transform = 'rotate(90deg)'; }
        else { el.style.display = 'none'; icon.style.transform = 'rotate(0deg)'; }
    }

    window.responderPagamento = (pagamentoId, acao) => {
        const msg = acao === 'CONFIRMAR' ? "Confirma que o dinheiro caiu na sua conta?" : "Recusar este comprovante?";
        window.customConfirm(msg, async () => {
            console.log(`[PAGAMENTO] -> Respondendo: ${acao} para ID: ${pagamentoId}`);
            try {
                const res = await fetch('/api/designer/confirmarPagamento', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: sessionToken, pagamentoId, acao })
                });
                if (res.ok) { window.customAlert("Sucesso!"); carregarDashboardDesigner(); }
                else { window.customAlert("Erro ao processar.", true); }
            } catch (e) { console.error(e); }
        });
    }

    // --- MESA DE TRABALHO RENDER ---
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
                <div style="text-align: right; display: flex; gap: 8px; justify-content: flex-end;">
                    <div class="btn-chat-wrapper"><button onclick="abrirChatEmbutido(${p.id}, '${p.titulo}', 'cliente')" class="btn-action" style="background:#25D366; padding: 6px 10px;"><i class="fab fa-whatsapp"></i></button><span id="badge-cliente-${p.id}" class="badge-notif"></span></div>
                    <div class="btn-chat-wrapper"><button onclick="abrirChatEmbutido(${p.id}, '${p.titulo}', 'interno')" class="btn-action" style="background:#4f46e5; padding: 6px 10px;"><i class="fas fa-building"></i></button><span id="badge-interno-${p.id}" class="badge-notif"></span></div>
                    <button onclick="prepararFinalizacao(${p.id})" class="btn-action">Finalizar</button>
                </div>
            </div>`).join('');
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
            </div>`).join('');
    }

    window.verBriefing = (b64) => {
        const texto = decodeURIComponent(Array.prototype.map.call(atob(b64), c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        window.abrirGaveta("Briefing do Pedido", `<div class="briefing-box">${texto}</div>`, `<button onclick="fecharGaveta()" class="btn-full btn-secondary">Fechar</button>`);
    };

    window.confirmarAssumir = (id) => {
        window.customConfirm("Deseja assumir este pedido?", async () => {
            try {
                const res = await fetch('/api/designer/assumirPedido', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: sessionToken, pedidoId: id }) });
                if (res.ok) { window.customAlert("Pedido assumido!"); carregarDashboardDesigner(); }
                else { const d = await res.json(); window.customAlert(d.message, true); }
            } catch (e) { console.error(e); }
        });
    };

    window.prepararFinalizacao = (id) => {
        const corpo = `<span class="drawer-label">Link Layout</span><input type="url" id="f-layout" class="drawer-input" required><span class="drawer-label">Link Impressão</span><input type="url" id="f-impressao" class="drawer-input" required>`;
        window.abrirGaveta("Finalizar Pedido", corpo, `<button id="btn-finalizar-exec" class="btn-full btn-primary">ENVIAR TRABALHO</button>`);
        document.getElementById('btn-finalizar-exec').onclick = async () => {
            const l1 = document.getElementById('f-layout').value;
            const l2 = document.getElementById('f-impressao').value;
            if (!l1 || !l2) return window.customAlert("Preencha os links", true);
            try {
                const res = await fetch('/api/designer/finalizarPedido', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: sessionToken, pedidoId: id, linkLayout: l1, linkImpressao: l2 }) });
                if (res.ok) { window.fecharGaveta(); window.customAlert("Trabalho entregue!"); carregarDashboardDesigner(); }
                else { const d = await res.json(); window.customAlert(d.message, true); }
            } catch (e) { console.error(e); }
        };
    };

    // --- CHAT E GAVETA ---
    window.abrirGaveta = (titulo, htmlCorpo, htmlRodape = '') => {
        console.log(`[GAVETA] -> Abrindo: ${titulo}`);
        document.getElementById('drawer-title').innerText = titulo;
        document.getElementById('drawer-content').innerHTML = htmlCorpo;
        document.getElementById('drawer-footer').innerHTML = htmlRodape;
        document.getElementById('drawer-overlay').classList.add('active');
        document.getElementById('drawer-panel').classList.add('active');
    };

    window.fecharGaveta = () => {
        document.getElementById('drawer-overlay').classList.remove('active');
        document.getElementById('drawer-panel').classList.remove('active');
        if (window.chatInterval) clearInterval(window.chatInterval);
    };

    window.abrirChatEmbutido = async (pedidoId, pedidoTitulo, tipoChat = 'cliente') => {
        console.log(`[CHAT] -> Abrindo chat ${tipoChat} para pedido ${pedidoId}`);
        window.chatAbertoAtual = { pedidoId, tipoChat };
        const corpo = `
            <div id="chat-msgs-container" style="height:60vh; overflow-y:auto; background:#f1f5f9; padding:15px; border-radius:8px; display:flex; flex-direction:column; gap:10px;"></div>
            <div id="chat-file-preview" style="display:none; background:#e0e7ff; padding:8px 12px; border-radius:8px; margin-top:10px; font-size:0.82rem; color:#4f46e5; display:flex; align-items:center; gap:8px;">
                <i class='fas fa-file'></i> <span id="chat-file-nome"></span>
                <button onclick="document.getElementById('chat-file-input').value=''; document.getElementById('chat-file-preview').style.display='none';" style="background:none; border:none; cursor:pointer; color:#ef4444; font-size:1rem; margin-left:auto;"><i class='fas fa-times'></i></button>
            </div>
            <div class="chat-input-row" style="display:flex; gap:10px; margin-top:10px; align-items:center;">
                <input type="file" id="chat-file-input" style="display:none;">
                <button id="btn-clip-chat" title="Anexar arquivo" style="background:#e0e7ff; border:none; border-radius:8px; padding:10px 12px; cursor:pointer; color:#4f46e5; font-size:1rem; flex-shrink:0;"><i class="fas fa-paperclip"></i></button>
                <input type="text" id="chat-texto-input" class="drawer-input" placeholder="Escreva aqui..." style="flex:1; margin:0;">
                <button id="btn-enviar-chat" class="btn-action" style="padding:10px 20px;"><i class="fas fa-paper-plane"></i></button>
            </div>`;
        window.abrirGaveta(tipoChat === 'interno' ? `Chat Gráfica: ${pedidoId}` : `Chat Cliente: ${pedidoId}`, corpo, "");

        const container = document.getElementById('chat-msgs-container');
        const input = document.getElementById('chat-texto-input');

        const carregar = async () => {
            const fd = new FormData(); fd.append('action', 'get'); fd.append('pedidoId', pedidoId); fd.append('tipoChat', tipoChat);
            const res = await fetch('/api/designer/chat', { method: 'POST', body: fd });
            const data = await res.json();
            if (res.ok) {
                container.innerHTML = data.mensagens.map(m => {
                    const isIn = m.lado === 'in';
                    const bg = isIn ? '#fff' : '#dcf8c6';
                    let conteudo = '';
                    if (m.file) {
                        const isImagem = m.file.contentType && m.file.contentType.startsWith('image/');
                        if (isImagem) {
                            conteudo = `<a href="${m.file.link}" target="_blank"><img src="${m.file.link}" alt="${m.file.name}" style="max-width:200px; border-radius:6px; display:block; margin-bottom:4px;"></a>`;
                        } else {
                            conteudo = `<a href="${m.file.link}" target="_blank" style="display:inline-flex; align-items:center; gap:6px; background:#e0e7ff; padding:6px 10px; border-radius:6px; color:#4f46e5; font-weight:600; text-decoration:none; font-size:0.82rem;"><i class='fas fa-file'></i> ${m.file.name}</a>`;
                        }
                    }
                    if (m.texto) conteudo += `<span>${m.texto}</span>`;
                    return `<div style="align-self: ${isIn ? 'flex-start' : 'flex-end'}; background: ${bg}; padding:10px; border-radius:8px; max-width:80%; font-size:0.9rem;">
                        <small style="display:block; font-weight:700; color:#4f46e5; margin-bottom:4px;">${m.remetente}</small>
                        ${conteudo}
                    </div>`;
                }).join('');
                container.scrollTop = container.scrollHeight;
            }
        };
        const fileInput = document.getElementById('chat-file-input');
        const filePreview = document.getElementById('chat-file-preview');
        const fileNomeEl = document.getElementById('chat-file-nome');

        document.getElementById('btn-clip-chat').onclick = () => fileInput.click();
        fileInput.onchange = () => {
            if (fileInput.files && fileInput.files[0]) {
                fileNomeEl.textContent = fileInput.files[0].name;
                filePreview.style.display = 'flex';
            } else {
                filePreview.style.display = 'none';
            }
        };

        const designerInfo = JSON.parse(localStorage.getItem('designerInfo') || '{}');
        const designerNome = designerInfo.name || 'Designer';

        document.getElementById('btn-enviar-chat').onclick = async () => {
            const temArquivo = fileInput.files && fileInput.files[0];
            if (!input.value && !temArquivo) return;
            const fd = new FormData();
            fd.append('action', 'send');
            fd.append('pedidoId', pedidoId);
            fd.append('tipoChat', tipoChat);
            fd.append('designerNome', designerNome);
            if (input.value) fd.append('texto', input.value);
            if (temArquivo) fd.append('file', fileInput.files[0]);
            await fetch('/api/designer/chat', { method: 'POST', body: fd });
            input.value = '';
            fileInput.value = '';
            filePreview.style.display = 'none';
            carregar();
        };
        carregar(); window.chatInterval = setInterval(carregar, 5000);
    };

    function iniciarVerificacaoNotificacoes(ids) {
        console.log('[CHAT_POOL] -> Iniciando monitoramento de mensagens.');
        setInterval(async () => {
            const fd = new FormData(); fd.append('action', 'check_all'); fd.append('pedidos', JSON.stringify(ids));
            const res = await fetch('/api/designer/chat', { method: 'POST', body: fd });
            const data = await res.json();
            if (res.ok && data.latestMessages) {
                Object.entries(data.latestMessages).forEach(([pId, msgs]) => {
                    if (msgs.cliente && msgs.cliente.side === 'in') document.getElementById(`badge-cliente-${pId}`).style.display = 'flex';
                    if (msgs.interno && msgs.interno.side === 'in') document.getElementById(`badge-interno-${pId}`).style.display = 'flex';
                });
            }
        }, 30000);
    }

    function formatarMoeda(valor) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0); }
    window.b64EncodeUnicode = (str) => { return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (m, p1) => String.fromCharCode('0x' + p1))); };

    document.addEventListener('DOMContentLoaded', () => {
        if (document.querySelector('main.main-painel')) carregarDashboardDesigner();
        const logoutBtn = document.getElementById('logout-button');
        if (logoutBtn) logoutBtn.onclick = () => { localStorage.clear(); window.location.href = 'login.html'; };

        // Lógica de Login
        const loginForm = document.getElementById('designer-login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = loginForm.querySelector('.btn-submit');
                const feedback = document.getElementById('form-error-feedback');
                feedback.classList.add('hidden');
                const originalText = btn.innerHTML;
                btn.innerHTML = 'Aguarde...';
                btn.disabled = true;


                try {
                    const res = await fetch('/api/designer/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            email: document.getElementById('email').value,
                            senha: document.getElementById('senha').value
                        })
                    });
                    const data = await res.json();

                    if (res.ok) {
                        localStorage.setItem('designerToken', data.token);
                        localStorage.setItem('designerInfo', JSON.stringify({ name: data.nome, id: data.id }));
                        window.location.href = 'painel.html';
                    } else {
                        feedback.textContent = data.message || 'Erro ao realizar login.';
                        feedback.classList.remove('hidden');
                    }
                } catch (e) {
                    feedback.textContent = 'Erro de conexão. Tente novamente.';
                    feedback.classList.remove('hidden');
                } finally {
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                }
            });
        }

        // Lógica de Cadastro
        const cadastroForm = document.getElementById('designer-cadastro-form');
        if (cadastroForm) {
            cadastroForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const senha = document.getElementById('senha').value;
                const confirm = document.getElementById('confirmar-senha').value;
                const feedback = document.getElementById('form-error-feedback');

                if (senha !== confirm) {
                    feedback.textContent = 'As senhas não coincidem.';
                    feedback.classList.remove('hidden');
                    return;
                }

                const btn = cadastroForm.querySelector('.btn-submit');
                feedback.classList.add('hidden');
                const originalText = btn.innerHTML;
                btn.innerHTML = 'Aguarde...';
                btn.disabled = true;

                try {
                    const payload = {
                        nome: document.getElementById('nome').value,
                        email: document.getElementById('email').value,
                        senha: senha
                    };
                    const pix = document.getElementById('chave_pix')?.value;
                    if (pix) { payload.chave_pix = pix; }

                    const res = await fetch('/api/designer/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const data = await res.json();

                    if (res.ok) {
                        localStorage.setItem('designerToken', data.token);
                        localStorage.setItem('designerInfo', JSON.stringify({ name: data.nome, id: data.id }));
                        window.location.href = 'painel.html';
                    } else {
                        feedback.textContent = data.message || 'Erro no cadastro.';
                        feedback.classList.remove('hidden');
                    }
                } catch (e) {
                    feedback.textContent = 'Erro de rede. Tente novamente.';
                    feedback.classList.remove('hidden');
                } finally {
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                }
            });
        }
    });

})();