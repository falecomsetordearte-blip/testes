// /designer/designer-script.js - VERSÃO C/ BRIEFING E CORREÇÃO DE VALORES

(function() {
    const sessionToken = localStorage.getItem('designerToken');
    const path = window.location.pathname;

    // --- CONTROLE DE ACESSO ---
    const paginasPublicas = ['login.html', 'cadastro.html', 'esqueci-senha.html', 'redefinir-senha.html'];
    const ehPaginaPublica = paginasPublicas.some(pg => path.includes(pg));

    if (!sessionToken && !ehPaginaPublica) { window.location.href = 'login.html'; return; }
    if (sessionToken && (path.includes('login.html') || path.includes('cadastro.html'))) { window.location.href = 'painel.html'; return; }

    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('designer-login-form')) configurarLogin();
        else if (document.getElementById('designer-cadastro-form')) configurarCadastro();
        else if (document.getElementById('designer-esqueci-senha-form')) configurarEsqueciSenha();
        else if (document.getElementById('designer-redefinir-senha-form')) configurarRedefinirSenha();
        else if (document.querySelector('main.main-painel')) carregarDashboardDesigner();
    });

    // --- DASHBOARD ---
    async function carregarDashboardDesigner() {
        const designerInfo = JSON.parse(localStorage.getItem('designerInfo'));
        if (designerInfo) {
            const greetingEl = document.getElementById('designer-greeting');
            if (greetingEl) greetingEl.textContent = `Olá, ${designerInfo.name}!`;
        }

        const logoutBtn = document.getElementById('logout-button');
        if (logoutBtn) logoutBtn.addEventListener('click', () => { localStorage.clear(); window.location.href = 'login.html'; });

        try {
            const res = await fetch('/api/designer/getDashboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: sessionToken })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            document.getElementById('designer-saldo-disponivel').textContent = formatarMoeda(data.designer.saldo);
            document.getElementById('designer-saldo-pendente').textContent = formatarMoeda(data.designer.pendente);
            document.getElementById('designer-pedidos-ativos').textContent = data.meusPedidos.length;

            renderizarMeusTrabalhos(data.meusPedidos);
            renderizarMercado(data.mercado);

        } catch (error) { console.error(error); alert("Erro ao carregar painel: " + error.message); }
    }

    // --- RENDERIZAR ATENDIMENTOS (MEUS PEDIDOS) ---
    function renderizarMeusTrabalhos(pedidos) {
        const container = document.getElementById('atendimentos-list');
        if (pedidos.length === 0) {
            container.innerHTML = `<div class="loading-pedidos">Você não tem trabalhos ativos.</div>`;
            return;
        }

        container.innerHTML = pedidos.map(p => `
            <div class="list-item" style="grid-template-columns: 0.5fr 3fr 1fr 1fr 1fr;">
                <div class="col-id">#${p.id}</div>
                <div class="col-titulo">
                    ${p.titulo}<br>
                    <button onclick="verBriefing('${b64EncodeUnicode(p.briefing_completo || 'Sem briefing')}')" 
                    style="background:#f1f5f9; border:1px solid #cbd5e1; color:#475569; padding:2px 8px; border-radius:4px; font-size:0.75rem; cursor:pointer; margin-top:5px;">
                    📄 Ver Briefing
                    </button>
                </div>
                <div><span class="status-badge status-pendente">Em Produção</span></div>
                <div class="col-valor" style="color:#10b981;">${formatarMoeda(p.valor_designer || 0)}</div>
                <div style="text-align: right; display: flex; gap: 5px; justify-content: flex-end; flex-wrap: wrap;">
                    <a href="${p.link_acompanhar}" target="_blank" class="btn-action" style="background:#25D366;"><i class="fab fa-whatsapp"></i> Chat</a>
                    <button onclick="prepararFinalizacao(${p.id})" class="btn-action"><i class="fas fa-check"></i> Finalizar</button>
                </div>
            </div>
        `).join('');
    }

    // --- RENDERIZAR MERCADO (DISPONÍVEIS) ---
    function renderizarMercado(pedidos) {
        const container = document.getElementById('mercado-list'); 
        if (pedidos.length === 0) {
            container.innerHTML = `<div class="loading-pedidos">Nenhum pedido disponível.</div>`;
            return;
        }

        container.innerHTML = pedidos.map(p => `
            <div class="list-item" style="grid-template-columns: 0.5fr 3fr 1fr 1fr;">
                <div class="col-id">#${p.id}</div>
                <div class="col-titulo">
                    <span style="font-size: 1.05rem;">${p.titulo}</span><br>
                    <small style="color: var(--secondary-color);"><i class="fas fa-tag"></i> ${p.servico || 'Arte'}</small><br>
                    <button onclick="verBriefing('${b64EncodeUnicode(p.briefing_completo || 'Sem briefing descrito.')}')" 
                        style="background:#f1f5f9; border:1px solid #cbd5e1; color:#475569; padding:4px 8px; border-radius:4px; font-size:0.75rem; cursor:pointer; margin-top:5px;">
                        📄 Ler Briefing Completo
                    </button>
                </div>
                <div class="col-valor" style="color:#10b981; font-size: 1.1rem;">${formatarMoeda(p.valor_designer || 0)}</div>
                <div style="text-align: right;">
                    <button onclick="assumirPedido(${p.id})" style="background:#2ecc71; color:white; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-weight:600;">
                        ATENDER
                    </button>
                </div>
            </div>
        `).join('');
    }

    // --- HELPERS (Base64 para passar string no onclick sem quebrar as aspas) ---
    window.b64EncodeUnicode = (str) => {
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(match, p1) {
            return String.fromCharCode('0x' + p1);
        }));
    }
    
    window.verBriefing = (b64) => {
        const texto = decodeURIComponent(Array.prototype.map.call(atob(b64), function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        alert("📝 BRIEFING DO PEDIDO:\n\n" + texto);
    }

    window.assumirPedido = async (id) => {
        if (!confirm("Deseja assumir este pedido?")) return;
        try {
            const res = await fetch('/api/designer/assumirPedido', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: sessionToken, pedidoId: id })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            alert("Sucesso! Pedido assumido.");
            if (data.chatLink) window.open(data.chatLink, '_blank');
            carregarDashboardDesigner();
        } catch (e) { alert(e.message); }
    };

    window.prepararFinalizacao = async (id) => {
        const linkLayout = prompt("Cole o link do LAYOUT (ex: Drive/Imgur):");
        if (!linkLayout) return;
        const linkImpressao = prompt("Cole o link do ARQUIVO DE IMPRESSÃO:");
        if (!linkImpressao) return;
        try {
            const res = await fetch('/api/designer/finalizarPedido', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: sessionToken, pedidoId: id, linkLayout, linkImpressao })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            alert("Pedido finalizado e valor creditado!");
            carregarDashboardDesigner();
        } catch (e) { alert(e.message); }
    };

    function formatarMoeda(valor) {
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);
    }

    // --- LOGIN/CADASTRO ---
    function configurarLogin() {
        const form = document.getElementById('designer-login-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = form.querySelector('button');
            btn.disabled = true; btn.textContent = 'Entrando...';
            try {
                const res = await fetch('/api/designerLogin', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: document.getElementById('email').value, senha: document.getElementById('senha').value })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message);
                localStorage.setItem('designerToken', data.token);
                localStorage.setItem('designerInfo', JSON.stringify(data.designer));
                window.location.href = 'painel.html';
            } catch (err) {
                document.getElementById('form-error-feedback').textContent = err.message;
                document.getElementById('form-error-feedback').classList.remove('hidden');
                btn.disabled = false; btn.textContent = 'Entrar';
            }
        });
    }

    function configurarCadastro() {
        const form = document.getElementById('designer-cadastro-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = form.querySelector('button');
            const senha = document.getElementById('senha').value;
            if (senha !== document.getElementById('confirmar-senha').value) {
                alert('As senhas não coincidem!'); return;
            }
            btn.disabled = true; btn.textContent = 'Criando conta...';
            try {
                const res = await fetch('/api/designerRegister', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nome: document.getElementById('nome').value, email: document.getElementById('email').value, senha: senha })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message);
                localStorage.setItem('designerToken', data.token);
                localStorage.setItem('designerInfo', JSON.stringify(data.designer));
                window.location.href = 'painel.html';
            } catch (err) {
                document.getElementById('form-error-feedback').textContent = err.message;
                document.getElementById('form-error-feedback').classList.remove('hidden');
                btn.disabled = false; btn.textContent = 'Cadastrar';
            }
        });
    }

    function configurarEsqueciSenha() {
        document.getElementById('designer-esqueci-senha-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const res = await fetch('/api/designer/forgotPassword', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: document.getElementById('email').value })
                });
                const data = await res.json();
                document.getElementById('form-wrapper').innerHTML = `<h1>Enviado!</h1><p>${data.message}</p><a href="login.html">Voltar</a>`;
            } catch (err) { alert("Erro ao enviar."); }
        });
    }

    function configurarRedefinirSenha() {
        const token = new URLSearchParams(window.location.search).get('token');
        if (!token) { window.location.href = 'login.html'; return; }
        document.getElementById('designer-redefinir-senha-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const senha = document.getElementById('nova-senha').value;
            if (senha !== document.getElementById('confirmar-senha').value) { alert("Senhas não batem"); return; }
            try {
                const res = await fetch('/api/designer/resetPassword', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, novaSenha: senha })
                });
                if (res.ok) { alert("Senha alterada!"); window.location.href = 'login.html'; }
            } catch (err) { alert("Erro ao alterar."); }
        });
    }
})();