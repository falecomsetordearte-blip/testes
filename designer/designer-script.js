// /designer/designer-script.js - VERSÃO COMPLETA E ATUALIZADA COM SISTEMA DE TRIAL
(function () {
    const sessionToken = localStorage.getItem('designerToken');
    const path = window.location.pathname;

    const paginasPublicas = ['login.html', 'cadastro.html', 'esqueci-senha.html', 'redefinir-senha.html'];
    const ehPaginaPublica = paginasPublicas.some(pg => path.includes(pg));

    if (!sessionToken && !ehPaginaPublica) {
        window.location.href = 'login.html';
        return;
    }

    document.addEventListener('DOMContentLoaded', () => {
        // Inicializa o Dashboard se estiver na página do painel
        if (document.querySelector('main.main-painel')) {
            carregarDashboardDesigner();
        }

        // Configura o botão de logout padrão do painel
        const logoutBtn = document.getElementById('logout-button');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                localStorage.clear();
                window.location.href = 'login.html';
            });
        }

        // --- LÓGICA DE LOGIN ---
        const loginForm = document.getElementById('designer-login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('email').value;
                const senha = document.getElementById('senha').value;
                const btnSubmit = loginForm.querySelector('button[type="submit"]');
                const feedback = document.getElementById('form-error-feedback');

                btnSubmit.disabled = true;
                btnSubmit.textContent = 'Entrando...';
                feedback.classList.add('hidden');

                try {
                    const res = await fetch('/api/designer/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, senha })
                    });

                    const data = await res.json();
                    if (!res.ok) throw new Error(data.message || 'Erro ao fazer login.');

                    // Salva a sessão e redireciona
                    localStorage.setItem('designerToken', data.token);
                    localStorage.setItem('designerInfo', JSON.stringify({ name: data.nome, nivel: data.nivel }));
                    window.location.href = 'painel.html';
                } catch (error) {
                    feedback.textContent = error.message;
                    feedback.classList.remove('hidden');
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = 'Entrar';
                }
            });
        }

        // --- LÓGICA DE CADASTRO ---
        const cadastroForm = document.getElementById('designer-cadastro-form');
        if (cadastroForm) {
            cadastroForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const nome = document.getElementById('nome').value;
                const email = document.getElementById('email').value;
                const senha = document.getElementById('senha').value;
                const confirmarSenha = document.getElementById('confirmar-senha').value;

                const btnSubmit = cadastroForm.querySelector('button[type="submit"]');
                const feedback = document.getElementById('form-error-feedback');

                feedback.classList.add('hidden');

                if (senha !== confirmarSenha) {
                    feedback.textContent = "As senhas não coincidem.";
                    feedback.classList.remove('hidden');
                    return;
                }

                btnSubmit.disabled = true;
                btnSubmit.textContent = 'Cadastrando...';

                try {
                    const res = await fetch('/api/designer/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ nome, email, senha })
                    });

                    const data = await res.json();
                    if (!res.ok) throw new Error(data.message || 'Erro ao criar conta.');

                    if (data.token) {
                        localStorage.setItem('designerToken', data.token);
                        localStorage.setItem('designerInfo', JSON.stringify({ name: data.nome, nivel: data.nivel }));
                        window.location.href = 'painel.html';
                    } else {
                        const corpo = `<p style="color:var(--success); font-weight:600; text-align:center;">Conta criada com sucesso!</p>`;
                        window.abrirGaveta("Sucesso!", corpo, `<button onclick="window.location.href='login.html'" class="btn-full btn-primary">Fazer Login</button>`);
                    }
                } catch (error) {
                    feedback.textContent = error.message;
                    feedback.classList.remove('hidden');
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = 'Cadastrar e Entrar';
                }
            });
        }
    });

    // =========================================================
    // FUNÇÕES DA GAVETA E UTILS
    // =========================================================
    window.fecharGaveta = () => {
        const overlay = document.getElementById('drawer-overlay');
        const panel = document.getElementById('drawer-panel');
        if (overlay) overlay.classList.remove('active');
        if (panel) panel.classList.remove('active');
        if (window.chatInterval) clearInterval(window.chatInterval);
    };

    window.abrirGaveta = (titulo, htmlCorpo, htmlRodape = '') => {
        document.getElementById('drawer-title').innerText = titulo;
        document.getElementById('drawer-content').innerHTML = htmlCorpo;
        document.getElementById('drawer-footer').innerHTML = htmlRodape;
        document.getElementById('drawer-overlay').classList.add('active');
        document.getElementById('drawer-panel').classList.add('active');
    };

    window.mostrarErro = (mensagem) => {
        const corpo = `<div style="color: #e11d48; background: #fff1f2; padding: 15px; border-radius: 8px; border: 1px solid #fda4af;"><strong>Erro:</strong> ${mensagem}</div>`;
        window.abrirGaveta("Ops!", corpo, `<button onclick="fecharGaveta()" class="btn-full btn-secondary">Entendi</button>`);
    };

    function formatarMoeda(v) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0); }

    // =========================================================
    // DASHBOARD E ACERTOS
    // =========================================================
    async function carregarDashboardDesigner() {
        const info = JSON.parse(localStorage.getItem('designerInfo'));
        if (info) document.getElementById('designer-greeting').textContent = `Olá, ${info.name}!`;

        try {
            const res = await fetch('/api/designer/getDashboard', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: sessionToken })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            document.getElementById('designer-faturamento-mes').textContent = formatarMoeda(data.designer.faturamento_mes);
            document.getElementById('designer-acertos-pendentes').textContent = formatarMoeda(data.designer.acertos_pendentes);
            document.getElementById('count-meus').textContent = data.meusPedidos.length;
            document.getElementById('count-mercado').textContent = data.mercado.length;
            
            renderizarMeusTrabalhos(data.meusPedidos);
            renderizarMercado(data.mercado);
            carregarHistoricoAcertos();
        } catch (e) { console.error(e); }
    }

    async function carregarHistoricoAcertos() {
        try {
            const res = await fetch('/api/designer/getAcertos', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: sessionToken })
            });
            const data = await res.json();
            if (res.ok) {
                window.acertosCache = data.acertos;
                renderizarHistoricoFiltrado('TODOS');
            }
        } catch (e) { console.error(e); }
    }

    window.renderizarHistoricoFiltrado = (status) => {
        const container = document.getElementById('saques-list');
        if (!container) return;
        const acertos = window.acertosCache || [];
        const filtrados = status === 'TODOS' ? acertos : acertos.filter(a => a.status === status);
        
        container.innerHTML = `
            <div style="display:flex; gap:10px; margin-bottom:15px;">
                <select onchange="renderizarHistoricoFiltrado(this.value)" style="padding:8px; border-radius:8px; border:1px solid #ddd;">
                    <option value="TODOS" ${status==='TODOS'?'selected':''}>Todos</option>
                    <option value="PENDENTE" ${status==='PENDENTE'?'selected':''}>Pendentes</option>
                    <option value="PAGO" ${status==='PAGO'?'selected':''}>Recebidos</option>
                </select>
            </div>
            ${filtrados.length === 0 ? '<p>Nenhum registro.</p>' : filtrados.map(a => `
                <div style="display:grid; grid-template-columns: 2fr 1fr 1fr; padding:10px; border-bottom:1px solid #eee; font-size:0.9rem;">
                    <div>${a.empresa}</div>
                    <div style="font-weight:700; color:var(--success); text-align:right;">${formatarMoeda(a.valor)}</div>
                    <div style="text-align:right;">${a.status}</div>
                </div>
            `).join('')}
        `;
    };

    function renderizarMeusTrabalhos(pedidos) {
        const container = document.getElementById('atendimentos-list');
        if (!container) return;
        container.innerHTML = pedidos.map(p => `
            <div class="list-item" style="grid-template-columns: 0.5fr 3fr 1fr 1.2fr;">
                <div>#${p.id}</div>
                <div><strong>${p.titulo}</strong></div>
                <div style="color:var(--success); font-weight:700;">${formatarMoeda(p.valor_designer)}</div>
                <div style="text-align:right;">
                    <button onclick="abrirChatEmbutido(${p.id}, '${p.titulo}')" class="btn-action" style="background:#25D366;"><i class="fab fa-whatsapp"></i> Chat</button>
                </div>
            </div>
        `).join('');
    }

    function renderizarMercado(pedidos) {
        const container = document.getElementById('mercado-list');
        if (!container) return;
        container.innerHTML = pedidos.map(p => `
            <div class="list-item" style="grid-template-columns: 0.5fr 3fr 1fr 1fr;">
                <div>#${p.id}</div>
                <div><strong>${p.titulo}</strong></div>
                <div style="color:var(--success); font-weight:700;">${formatarMoeda(p.valor_designer)}</div>
                <div style="text-align:right;">
                    <button onclick="confirmarAssumir(${p.id})" class="btn-action">Pegar</button>
                </div>
            </div>
        `).join('');
    }

    window.confirmarAssumir = async (id) => {
        if (!confirm("Deseja assumir este pedido?")) return;
        try {
            const res = await fetch('/api/designer/assumirPedido', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: sessionToken, pedidoId: id })
            });
            if (res.ok) carregarDashboardDesigner();
            else alert("Erro ao assumir.");
        } catch (e) { console.error(e); }
    };

    // =========================================================
    // MINI CHAT
    // =========================================================
    window.abrirChatEmbutido = async (pedidoId, titulo) => {
        const corpo = `
            <div id="chat-msgs-container" style="height:60vh; overflow-y:auto; padding:15px; background:#f0f2f5; border-radius:10px; display:flex; flex-direction:column; gap:10px;"></div>
            <div style="display:flex; gap:10px; margin-top:15px;">
                <input type="text" id="chat-txt" class="drawer-input" style="margin:0; flex:1;" placeholder="Mensagem...">
                <button id="chat-send" class="btn-action"><i class="fas fa-paper-plane"></i></button>
            </div>
        `;
        window.abrirGaveta(`Chat: ${titulo}`, corpo, "");

        const carregar = async () => {
            const fd = new FormData(); fd.append('action', 'get'); fd.append('pedidoId', pedidoId);
            const res = await fetch('/api/designer/chat', { method: 'POST', body: fd });
            const data = await res.json();
            if (res.ok) {
                const container = document.getElementById('chat-msgs-container');
                if (!container) return;
                container.innerHTML = data.mensagens.map(m => `
                    <div style="align-self: ${m.lado==='in'?'flex-start':'flex-end'}; background:${m.lado==='in'?'#fff':'#dcf8c6'}; padding:10px; border-radius:8px; max-width:80%; font-size:0.85rem; box-shadow:0 1px 1px #0002;">
                        ${m.texto}
                    </div>
                `).join('');
                container.scrollTop = container.scrollHeight;
            }
        };

        const enviar = async () => {
            const txt = document.getElementById('chat-txt').value;
            if (!txt.trim()) return;
            const fd = new FormData(); fd.append('action', 'send'); fd.append('pedidoId', pedidoId); fd.append('texto', txt);
            await fetch('/api/designer/chat', { method: 'POST', body: fd });
            document.getElementById('chat-txt').value = '';
            carregar();
        };

        document.getElementById('chat-send').onclick = enviar;
        carregar();
        window.chatInterval = setInterval(carregar, 5000);
    };

    // =========================================================
    // SISTEMA DE TRIAL E ACEITE
    // =========================================================
    async function checkAceiteTermos(type, token) {
        if (!token) return;
        try {
            const res = await fetch('/api/auth/aceite-termos', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, type, action: 'check' })
            });
            const data = await res.json();
            if (res.ok && !data.ja_aceitou) mostrarModalTermos(type, token);
        } catch (e) { console.error(e); }
    }

    function mostrarModalTermos(type, token) {
        const modal = `
            <div id="modal-termos-lgpd" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:100000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(5px);">
                <div style="background:white; width:90%; max-width:500px; padding:35px; border-radius:16px; text-align:center;">
                    <h2 style="margin-bottom:15px; font-family:'Poppins', sans-serif;">Novos Termos de Uso</h2>
                    <p style="color:#64748b; margin-bottom:20px;">Você precisa aceitar os termos (LGPD) para continuar.</p>
                    <div style="background:#fff7ed; border-left:4px solid #f97316; padding:15px; margin-bottom:20px; text-align:left; font-size:0.9rem;">
                        <strong>Aviso:</strong> O Setor de Arte é apenas um facilitador tecnológico.
                    </div>
                    <button id="btn-aceitar" style="background:#4f46e5; color:white; border:none; padding:15px; border-radius:10px; font-weight:700; cursor:pointer; width:100%;">Concordo e Aceito</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modal);
        document.getElementById('btn-aceitar').onclick = async () => {
            const res = await fetch('/api/auth/aceite-termos', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, type, action: 'save' })
            });
            if (res.ok) document.getElementById('modal-termos-lgpd').remove();
        };
    }

    async function checkTrialStatus(type, token) {
        if (!token) return;
        try {
            const res = await fetch('/api/auth/trial-status', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, type })
            });
            const data = await res.json();
            if (res.ok && data.is_trial) {
                if (data.expirado) mostrarBloqueioTrial();
                else mostrarBannerTrial(data.dias_restantes);
            }
        } catch (e) { console.error(e); }
    }

    function mostrarBannerTrial(dias) {
        const cor = dias <= 3 ? 'linear-gradient(90deg, #ef4444, #f87171)' : 'linear-gradient(90deg, #4f46e5, #6366f1)';
        const banner = `
            <div id="trial-banner" style="background:${cor}; color:white; padding:12px; text-align:center; font-size:0.85rem; font-weight:600; font-family:'Poppins', sans-serif; position:relative; z-index:9999; display:flex; align-items:center; justify-content:center; gap:15px;">
                <span>Você tem ${dias} dias de teste grátis. Aproveite!</span>
                <button onclick="window.location.href='/assinatura.html'" style="background:white; color:#4f46e5; border:none; padding:5px 12px; border-radius:6px; font-weight:700; cursor:pointer; font-size:0.75rem;">ASSINAR R$ 29,90</button>
            </div>
        `;
        document.body.insertAdjacentHTML('afterbegin', banner);
    }

    function mostrarBloqueioTrial() {
        const modal = `
            <div style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.95); z-index:200000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(10px);">
                <div style="background:white; width:90%; max-width:480px; padding:40px; border-radius:24px; text-align:center;">
                    <h2 style="font-family:'Poppins', sans-serif; font-weight:800;">Teste Expirado</h2>
                    <p style="color:#64748b; margin-bottom:30px;">Seu período de teste acabou. Assine para continuar!</p>
                    <button onclick="window.location.href='/assinatura.html'" style="background:#4f46e5; color:white; border:none; padding:18px; border-radius:12px; font-weight:700; cursor:pointer; width:100%;">ASSINAR AGORA - R$ 29,90</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modal);
    }

    if (sessionToken) {
        checkAceiteTermos('DESIGNER', sessionToken);
        checkTrialStatus('DESIGNER', sessionToken);
    }
})();