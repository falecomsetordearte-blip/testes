// /designer/designer-script.js - VERSÃO COMPLETA COM GAVETA (SEM ALERTAS)

(function() {
    const sessionToken = localStorage.getItem('designerToken');
    const path = window.location.pathname;

    const paginasPublicas = ['login.html', 'cadastro.html', 'esqueci-senha.html', 'redefinir-senha.html'];
    const ehPaginaPublica = paginasPublicas.some(pg => path.includes(pg));

    if (!sessionToken && !ehPaginaPublica) { window.location.href = 'login.html'; return; }
    if (sessionToken && (path.includes('login.html') || path.includes('cadastro.html'))) { window.location.href = 'painel.html'; return; }

    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('designer-login-form')) configurarLogin();
        else if (document.querySelector('main.main-painel')) carregarDashboardDesigner();
        
        const logoutBtn = document.getElementById('logout-button');
        if (logoutBtn) logoutBtn.addEventListener('click', () => { localStorage.clear(); window.location.href = 'login.html'; });
    });

    // --- FUNÇÕES DA GAVETA (UI) ---
    window.fecharGaveta = () => {
        document.getElementById('drawer-overlay').classList.remove('active');
        document.getElementById('drawer-panel').classList.remove('active');
    };

    window.abrirGaveta = (titulo, htmlCorpo, htmlRodape = '') => {
        document.getElementById('drawer-title').innerText = titulo;
        document.getElementById('drawer-content').innerHTML = htmlCorpo;
        document.getElementById('drawer-footer').innerHTML = htmlRodape;
        document.getElementById('drawer-overlay').classList.add('active');
        document.getElementById('drawer-panel').classList.add('active');
    };

    // --- CARREGAMENTO DO PAINEL ---
    async function carregarDashboardDesigner() {
        const designerInfo = JSON.parse(localStorage.getItem('designerInfo'));
        if (designerInfo) {
            const greetingEl = document.getElementById('designer-greeting');
            if (greetingEl) greetingEl.textContent = `Olá, ${designerInfo.name}!`;
        }

        try {
            const res = await fetch('/api/designer/getDashboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: sessionToken })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            // Financeiro
            document.getElementById('designer-saldo-disponivel').textContent = formatarMoeda(data.designer.saldo);
            document.getElementById('designer-saldo-pendente').textContent = formatarMoeda(data.designer.pendente);
            document.getElementById('designer-pedidos-ativos').textContent = data.meusPedidos.length;

            // Contadores Abas
            document.getElementById('count-meus').textContent = data.meusPedidos.length;
            document.getElementById('count-mercado').textContent = data.mercado.length;

            // Nível e Pontos
            const badgeNivel = document.getElementById('badge-nivel');
            const valPontos = document.getElementById('val-pontos');
            if (badgeNivel) {
                const niveis = {
                    1: { t: 'Nível 1 (Ouro)', c: 'lvl-1' },
                    2: { t: 'Nível 2 (Prata)', c: 'lvl-2' },
                    3: { t: 'Nível 3 (Bronze)', c: 'lvl-3' }
                };
                const n = niveis[data.designer.nivel] || niveis[3];
                badgeNivel.innerHTML = `<i class="fas fa-medal"></i> ${n.t}`;
                badgeNivel.className = `stat-badge ${n.c}`;
            }
            if (valPontos) valPontos.textContent = data.designer.pontuacao;

            renderizarMeusTrabalhos(data.meusPedidos);
            renderizarMercado(data.mercado);

        } catch (error) { 
            console.error(error); 
        }
    }

    // --- RENDERIZAÇÃO DE LISTAS ---
    function renderizarMeusTrabalhos(pedidos) {
        const container = document.getElementById('atendimentos-list');
        if (pedidos.length === 0) {
            container.innerHTML = `<p style="text-align:center; padding:40px; color:var(--text-muted);">Você não tem atendimentos ativos.</p>`;
            return;
        }
        container.innerHTML = pedidos.map(p => `
            <div class="list-item" style="grid-template-columns: 0.5fr 3fr 1fr 1fr 1.2fr;">
                <div style="font-family:monospace; color:var(--secondary-color);">#${p.id}</div>
                <div>
                    <div style="font-weight:600;">${p.titulo}</div>
                    <button onclick="verBriefing('${b64EncodeUnicode(p.briefing_completo || 'Sem detalhes.')}')" class="btn-outline-sm">📄 Ver Briefing</button>
                </div>
                <div><span style="background:#fef3c7; color:#b45309; padding:4px 10px; border-radius:12px; font-size:0.7rem; font-weight:700;">PRODUÇÃO</span></div>
                <div style="font-weight:700; color:var(--success);">${formatarMoeda(p.valor_designer)}</div>
                <div style="text-align: right; display: flex; gap: 8px; justify-content: flex-end;">
                    <a href="${p.link_acompanhar}" target="_blank" class="btn-action" style="background:#25D366;"><i class="fab fa-whatsapp"></i> Chat</a>
                    <button onclick="prepararFinalizacao(${p.id})" class="btn-action"><i class="fas fa-check"></i> Finalizar</button>
                </div>
            </div>
        `).join('');
    }

    function renderizarMercado(pedidos) {
        const container = document.getElementById('mercado-list'); 
        if (pedidos.length === 0) {
            container.innerHTML = `<p style="text-align:center; padding:40px; color:var(--text-muted);">Nenhum pedido disponível no momento.</p>`;
            return;
        }
        container.innerHTML = pedidos.map(p => `
            <div class="list-item" style="grid-template-columns: 0.5fr 3fr 1fr 1fr;">
                <div style="font-family:monospace; color:var(--secondary-color);">#${p.id}</div>
                <div>
                    <div style="font-weight:600;">${p.titulo}</div>
                    <small style="color:var(--text-muted);">${p.servico || 'Arte Geral'}</small><br>
                    <button onclick="verBriefing('${b64EncodeUnicode(p.briefing_completo || 'Sem briefing.')}')" class="btn-outline-sm">📄 Detalhes</button>
                </div>
                <div style="font-weight:700; color:var(--success); font-size:1.1rem;">${formatarMoeda(p.valor_designer)}</div>
                <div style="text-align: right;">
                    <button onclick="confirmarAssumir(${p.id})" class="btn-action" style="padding:10px 20px;">PEGAR PEDIDO</button>
                </div>
            </div>
        `).join('');
    }

    // --- AÇÕES DO DESIGNER (VIA GAVETA) ---

    window.verBriefing = (b64) => {
        const texto = decodeURIComponent(Array.prototype.map.call(atob(b64), c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        const corpo = `
            <span class="drawer-label">Descrição do Pedido</span>
            <div class="briefing-box">${texto}</div>
        `;
        const rodape = `<button onclick="fecharGaveta()" class="btn-full btn-secondary">Fechar</button>`;
        window.abrirGaveta("Detalhes do Briefing", corpo, rodape);
    };

    window.confirmarAssumir = (id) => {
        const corpo = `
            <div style="text-align:center; padding:20px 0;">
                <i class="fas fa-question-circle" style="font-size:3rem; color:var(--primary-color); margin-bottom:15px;"></i>
                <p style="font-size:1.1rem; font-weight:500;">Deseja assumir o Pedido #${id}?</p>
                <p style="color:var(--secondary-color); font-size:0.9rem; margin-top:10px;">Ao aceitar, ele será movido para sua lista de atendimentos e você deverá iniciar a produção.</p>
            </div>
        `;
        const rodape = `
            <button id="btn-exec-assumir" class="btn-full btn-primary">SIM, QUERO ATENDER</button>
            <button onclick="fecharGaveta()" class="btn-full btn-secondary">Agora não</button>
        `;
        window.abrirGaveta("Confirmar Atendimento", corpo, rodape);
        
        document.getElementById('btn-exec-assumir').onclick = async () => {
            const btn = document.getElementById('btn-exec-assumir');
            btn.disabled = true; btn.innerText = "Processando...";
            try {
                const res = await fetch('/api/designer/assumirPedido', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: sessionToken, pedidoId: id })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message);
                fecharGaveta();
                if (data.chatLink) window.open(data.chatLink, '_blank');
                carregarDashboardDesigner();
            } catch (e) { fecharGaveta(); alert(e.message); }
        };
    };

    window.prepararFinalizacao = (id) => {
        const corpo = `
            <span class="drawer-label">Link do Layout (JPG/PNG)</span>
            <input type="url" id="f-layout" class="drawer-input" placeholder="Ex: Google Drive, Imgur, Canva...">
            
            <span class="drawer-label">Link para Impressão (PDF/Corel/Ai)</span>
            <input type="url" id="f-impressao" class="drawer-input" placeholder="Ex: WeTransfer, Drive, Dropbox...">
            
            <div style="background:#fff9eb; padding:12px; border-radius:8px; margin-top:15px; border:1px solid #ffeeba;">
                <p style="font-size:0.8rem; color:#856404;"><i class="fas fa-exclamation-triangle"></i> Certifique-se de que os links possuem permissão pública de visualização.</p>
            </div>
        `;
        const rodape = `
            <button id="btn-exec-finalizar" class="btn-full btn-primary">FINALIZAR PEDIDO</button>
            <button onclick="fecharGaveta()" class="btn-full btn-secondary">Cancelar</button>
        `;
        window.abrirGaveta("Entregar Trabalho #" + id, corpo, rodape);

        document.getElementById('btn-exec-finalizar').onclick = async () => {
            const linkLayout = document.getElementById('f-layout').value;
            const linkImpressao = document.getElementById('f-impressao').value;
            if(!linkLayout || !linkImpressao) { 
                document.getElementById('f-layout').style.borderColor = 'red';
                document.getElementById('f-impressao').style.borderColor = 'red';
                return; 
            }
            const btn = document.getElementById('btn-exec-finalizar');
            btn.disabled = true; btn.innerText = "Enviando arquivos...";
            try {
                const res = await fetch('/api/designer/finalizarPedido', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: sessionToken, pedidoId: id, linkLayout, linkImpressao })
                });
                if (!res.ok) throw new Error("Erro ao finalizar.");
                fecharGaveta();
                carregarDashboardDesigner();
            } catch (e) { fecharGaveta(); alert(e.message); }
        };
    };

    // --- UTILS ---
    function formatarMoeda(valor) {
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0);
    }

    window.b64EncodeUnicode = (str) => {
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (m, p1) => String.fromCharCode('0x' + p1)));
    };

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
                alert(err.message);
                btn.disabled = false; btn.textContent = 'Entrar';
            }
        });
    }

})();