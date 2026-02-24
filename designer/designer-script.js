// /designer/designer-script.js - VERSÃO INTEGRADA 100% NEON

(function() {
    const sessionToken = localStorage.getItem('designerToken');
    const path = window.location.pathname;

    // --- 1. CONTROLE DE ACESSO (REDIRECIONAMENTO) ---
    const paginasPublicas = [
        'login.html',
        'esqueci-senha.html',
        'redefinir-senha.html'
    ];

    const ehPaginaPublica = paginasPublicas.some(pg => path.includes(pg));

    // Se não está logado e tenta acessar área restrita, vai para login
    if (!sessionToken && !ehPaginaPublica) {
        window.location.href = 'login.html';
        return;
    }

    // Se já está logado e tenta acessar login, vai para o painel
    if (sessionToken && path.includes('login.html')) {
        window.location.href = 'painel.html';
        return;
    }

    document.addEventListener('DOMContentLoaded', () => {
        // Identifica qual página o script está rodando e ativa a lógica correspondente
        if (document.getElementById('designer-login-form')) {
            configurarLogin();
        } else if (document.getElementById('designer-esqueci-senha-form')) {
            configurarEsqueciSenha();
        } else if (document.getElementById('designer-redefinir-senha-form')) {
            configurarRedefinirSenha();
        } else if (document.querySelector('main.main-painel')) {
            carregarDashboardDesigner();
        }
    });

    // --- 2. LÓGICA DE DASHBOARD (ÁREA DO TRABALHO) ---
    async function carregarDashboardDesigner() {
        const designerInfoString = localStorage.getItem('designerInfo');
        if (!designerInfoString) return;

        const designerInfo = JSON.parse(designerInfoString);
        
        // Saudação e Logout
        const greetingEl = document.getElementById('designer-greeting');
        if (greetingEl) greetingEl.textContent = `Olá, ${designerInfo.name}!`;

        const logoutBtn = document.getElementById('logout-button');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                localStorage.clear();
                window.location.href = 'login.html';
            });
        }

        try {
            const res = await fetch('/api/designer/getDashboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: sessionToken })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            // Atualizar Cards de Saldo
            document.getElementById('designer-saldo-disponivel').textContent = formatarMoeda(data.designer.saldo);
            document.getElementById('designer-saldo-pendente').textContent = formatarMoeda(data.designer.pendente);
            document.getElementById('designer-pedidos-ativos').textContent = data.meusPedidos.length;

            // Renderizar Listas
            renderizarMeusTrabalhos(data.meusPedidos);
            renderizarMercado(data.mercado);

        } catch (error) {
            console.error(error);
            alert("Erro ao carregar dados do painel: " + error.message);
        }
    }

    function renderizarMeusTrabalhos(pedidos) {
        const container = document.getElementById('atendimentos-list');
        if (pedidos.length === 0) {
            container.innerHTML = `<div class="loading-pedidos">Você não tem trabalhos ativos. Pegue um pedido na aba ao lado!</div>`;
            return;
        }

        container.innerHTML = pedidos.map(p => `
            <div class="list-item" style="grid-template-columns: 0.5fr 2fr 1fr 1fr 1fr; display: grid; padding: 15px; border-bottom: 1px solid #eee; align-items: center;">
                <div class="col-id">#${p.id}</div>
                <div class="col-titulo" style="font-weight:600">${p.titulo}</div>
                <div><span class="status-badge status-andamento" style="background:#e0e7ff; color:#4338ca; padding:5px 10px; border-radius:15px; font-size:0.8rem;">Em Produção</span></div>
                <div class="col-valor" style="color:#10b981; font-weight:700">${formatarMoeda(p.valor_designer)}</div>
                <div style="text-align: right; display: flex; gap: 8px; justify-content: flex-end;">
                    <a href="${p.link_acompanhar}" target="_blank" class="btn-action" style="background:#25D366; color:white; padding:8px 12px; border-radius:8px; display:inline-flex; align-items:center; gap:5px;"><i class="fab fa-whatsapp"></i> Chat</a>
                    <button onclick="prepararFinalizacao(${p.id})" class="btn-action" style="background:#4f46e5; color:white; padding:8px 12px; border-radius:8px; border:none; cursor:pointer;"><i class="fas fa-check"></i> Finalizar</button>
                </div>
            </div>
        `).join('');
    }

    function renderizarMercado(pedidos) {
        const container = document.getElementById('saques-list'); // Usando a aba de saques para "Pedidos Disponíveis"
        if (pedidos.length === 0) {
            container.innerHTML = `<div class="loading-pedidos">Nenhum pedido disponível no momento para o seu nível.</div>`;
            return;
        }

        container.innerHTML = pedidos.map(p => `
            <div class="list-item" style="grid-template-columns: 0.5fr 3fr 1fr 1fr; display: grid; padding: 15px; border-bottom: 1px solid #eee; align-items: center;">
                <div class="col-id">#${p.id}</div>
                <div class="col-titulo">
                    <strong>${p.titulo}</strong><br>
                    <small style="color:#94a3b8">${p.servico}</small>
                </div>
                <div class="col-valor" style="color:#10b981; font-weight:700">${formatarMoeda(p.valor_designer)}</div>
                <div style="text-align: right;">
                    <button onclick="assumirPedido(${p.id})" style="background:#2ecc71; color:white; border:none; padding:10px 20px; border-radius:8px; cursor:pointer; font-weight:600;">ATENDER</button>
                </div>
            </div>
        `).join('');
    }

    // --- 3. AÇÕES DO DESIGNER ---
    window.assumirPedido = async (id) => {
        if (!confirm("Deseja assumir este pedido para produção?")) return;

        try {
            const res = await fetch('/api/designer/assumirPedido', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: sessionToken, pedidoId: id })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            alert("Sucesso! O chat do pedido será aberto.");
            if (data.chatLink) window.open(data.chatLink, '_blank');
            carregarDashboardDesigner();
        } catch (e) { alert(e.message); }
    };

    window.prepararFinalizacao = async (id) => {
        const linkLayout = prompt("Cole o link da imagem do LAYOUT (ex: Google Drive, Imgur):");
        if (!linkLayout) return;

        const linkImpressao = prompt("Cole o link do ARQUIVO FINAL pronto para impressão:");
        if (!linkImpressao) return;

        try {
            const res = await fetch('/api/designer/finalizarPedido', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: sessionToken, pedidoId: id, linkLayout, linkImpressao })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            alert("Excelente trabalho! Pedido enviado para impressão e comissão creditada em seu saldo.");
            carregarDashboardDesigner();
        } catch (e) { alert(e.message); }
    };

    // --- 4. LÓGICA DE AUTENTICAÇÃO ---
    function configurarLogin() {
        const form = document.getElementById('designer-login-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = form.querySelector('button');
            btn.disabled = true; btn.textContent = 'Entrando...';

            try {
                const res = await fetch('/api/designerLogin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: document.getElementById('email').value,
                        senha: document.getElementById('senha').value
                    })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message);

                localStorage.setItem('designerToken', data.token);
                localStorage.setItem('designerInfo', JSON.stringify(data.designer));
                window.location.href = 'painel.html';
            } catch (err) {
                showFeedback('form-error-feedback', err.message);
                btn.disabled = false; btn.textContent = 'Entrar';
            }
        });
    }

    function configurarEsqueciSenha() {
        const form = document.getElementById('designer-esqueci-senha-form');
        const wrapper = document.getElementById('form-wrapper');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = form.querySelector('button');
            btn.disabled = true; btn.textContent = 'Enviando...';

            try {
                const res = await fetch('/api/designer/forgotPassword', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: document.getElementById('email').value })
                });
                const data = await res.json();
                wrapper.innerHTML = `<h1>Link Enviado!</h1><p>${data.message}</p><br><a href="login.html" style="color:#4f46e5">Voltar ao Login</a>`;
            } catch (err) {
                alert("Erro ao processar. Tente novamente.");
                btn.disabled = false; btn.textContent = 'Enviar Link';
            }
        });
    }

    function configurarRedefinirSenha() {
        const form = document.getElementById('designer-redefinir-senha-form');
        const token = new URLSearchParams(window.location.search).get('token');
        if (!token) { alert("Token de recuperação ausente."); window.location.href = 'login.html'; return; }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const novaSenha = document.getElementById('nova-senha').value;
            const confirmar = document.getElementById('confirmar-senha').value;

            if (novaSenha !== confirmar) { alert("As senhas não coincidem!"); return; }

            try {
                const res = await fetch('/api/designer/resetPassword', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, novaSenha })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message);
                alert("Senha alterada com sucesso! Faça login agora.");
                window.location.href = 'login.html';
            } catch (err) { alert(err.message); }
        });
    }

    // --- HELPERS ---
    function formatarMoeda(valor) {
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);
    }

    function showFeedback(id, msg) {
        const el = document.getElementById(id);
        if (el) { el.textContent = msg; el.classList.remove('hidden'); }
    }

})();