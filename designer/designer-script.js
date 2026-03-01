// /designer/designer-script.js - VERSÃO 100% SEM ALERTAS

(function() {
    const sessionToken = localStorage.getItem('designerToken');
    const path = window.location.pathname;

    const paginasPublicas = ['login.html', 'cadastro.html', 'esqueci-senha.html', 'redefinir-senha.html'];
    const ehPaginaPublica = paginasPublicas.some(pg => path.includes(pg));

    if (!sessionToken && !ehPaginaPublica) { window.location.href = 'login.html'; return; }

    document.addEventListener('DOMContentLoaded', () => {
        if (document.querySelector('main.main-painel')) carregarDashboardDesigner();
        
        const logoutBtn = document.getElementById('logout-button');
        if (logoutBtn) logoutBtn.addEventListener('click', () => { localStorage.clear(); window.location.href = 'login.html'; });
    });

    // --- FUNÇÕES DA GAVETA ---
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

    // FUNÇÃO PARA SUBSTITUIR O ALERT EM CASOS DE ERRO
    window.mostrarErro = (mensagem) => {
        const corpo = `<div style="color: #e11d48; background: #fff1f2; padding: 15px; border-radius: 8px; border: 1px solid #fda4af;">
            <i class="fas fa-exclamation-circle"></i> <strong>Erro:</strong> ${mensagem}
        </div>`;
        const rodape = `<button onclick="fecharGaveta()" class="btn-full btn-secondary">Entendi</button>`;
        window.abrirGaveta("Ops! Algo deu errado", corpo, rodape);
    };

    async function carregarDashboardDesigner() {
        const designerInfo = JSON.parse(localStorage.getItem('designerInfo'));
        if (designerInfo) document.getElementById('designer-greeting').textContent = `Olá, ${designerInfo.name}!`;

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
            document.getElementById('count-meus').textContent = data.meusPedidos.length;
            document.getElementById('count-mercado').textContent = data.mercado.length;

            const badgeNivel = document.getElementById('badge-nivel');
            const niveis = { 1: { t: 'Ouro', c: 'lvl-1' }, 2: { t: 'Prata', c: 'lvl-2' }, 3: { t: 'Bronze', c: 'lvl-3' } };
            const n = niveis[data.designer.nivel] || niveis[3];
            badgeNivel.innerHTML = `<i class="fas fa-medal"></i> Nível ${n.t}`;
            badgeNivel.className = `stat-badge ${n.c}`;
            document.getElementById('val-pontos').textContent = data.designer.pontuacao;

            renderizarMeusTrabalhos(data.meusPedidos);
            renderizarMercado(data.mercado);

        } catch (error) { console.error(error); }
    }

    function renderizarMeusTrabalhos(pedidos) {
        const container = document.getElementById('atendimentos-list');
        if (pedidos.length === 0) {
            container.innerHTML = `<p style="text-align:center; padding:40px; color:var(--text-muted);">Nenhum atendimento ativo.</p>`;
            return;
        }
        container.innerHTML = pedidos.map(p => `
            <div class="list-item" style="grid-template-columns: 0.5fr 3fr 1fr 1fr 1.2fr;">
                <div style="color:var(--secondary-color);">#${p.id}</div>
                <div>
                    <div style="font-weight:600;">${p.titulo}</div>
                    <button onclick="verBriefing('${b64EncodeUnicode(p.briefing_completo || 'Sem detalhes.')}')" class="btn-outline-sm">LER BRIEFING</button>
                </div>
                <div><span style="background:#fef3c7; color:#b45309; padding:4px 10px; border-radius:12px; font-size:0.7rem; font-weight:700;">PRODUÇÃO</span></div>
                <div style="font-weight:700; color:var(--success);">${formatarMoeda(p.valor_designer)}</div>
                <div style="text-align: right; display: flex; gap: 8px; justify-content: flex-end;">
                    <a href="${p.link_acompanhar}" target="_blank" class="btn-action" style="background:#25D366;"><i class="fab fa-whatsapp"></i> Chat</a>
                    <button onclick="prepararFinalizacao(${p.id})" class="btn-action">Finalizar</button>
                </div>
            </div>
        `).join('');
    }

    function renderizarMercado(pedidos) {
        const container = document.getElementById('mercado-list'); 
        if (pedidos.length === 0) {
            container.innerHTML = `<p style="text-align:center; padding:40px; color:var(--text-muted);">Nenhum pedido disponível.</p>`;
            return;
        }
        container.innerHTML = pedidos.map(p => `
            <div class="list-item" style="grid-template-columns: 0.5fr 3fr 1fr 1fr;">
                <div style="color:var(--secondary-color);">#${p.id}</div>
                <div>
                    <div style="font-weight:600;">${p.titulo}</div>
                    <button onclick="verBriefing('${b64EncodeUnicode(p.briefing_completo || 'Sem detalhes.')}')" class="btn-outline-sm">LER BRIEFING</button>
                </div>
                <div style="font-weight:700; color:var(--success); font-size:1.1rem;">${formatarMoeda(p.valor_designer)}</div>
                <div style="text-align: right;">
                    <button onclick="confirmarAssumir(${p.id})" class="btn-action" style="padding:10px 20px;">ATENDER</button>
                </div>
            </div>
        `).join('');
    }

    window.verBriefing = (b64) => {
        const texto = decodeURIComponent(Array.prototype.map.call(atob(b64), c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        const corpo = `
            <span class="drawer-label">Instruções e Detalhes</span>
            <div class="briefing-box">${texto}</div>
        `;
        const rodape = `<button onclick="fecharGaveta()" class="btn-full btn-secondary">Fechar</button>`;
        window.abrirGaveta("Briefing do Pedido", corpo, rodape);
    };

    window.confirmarAssumir = (id) => {
        const corpo = `<p style="font-size:1rem; color:var(--secondary-color);">Deseja assumir o atendimento deste pedido agora?</p>`;
        const rodape = `
            <button id="btn-exec-assumir" class="btn-full btn-primary">SIM, ATENDER PEDIDO</button>
            <button onclick="fecharGaveta()" class="btn-full btn-secondary">Cancelar</button>
        `;
        window.abrirGaveta("Confirmar Atendimento", corpo, rodape);
        
        document.getElementById('btn-exec-assumir').onclick = async () => {
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
            } catch (e) { mostrarErro(e.message); }
        };
    };

    window.prepararFinalizacao = (id) => {
        const corpo = `
            <span class="drawer-label">Link do Layout (JPG/PNG)</span>
            <input type="url" id="f-layout" class="drawer-input" placeholder="Cole o link do layout aqui...">
            <span class="drawer-label">Link para Impressão (PDF/AI/CDR)</span>
            <input type="url" id="f-impressao" class="drawer-input" placeholder="Cole o link do arquivo final aqui...">
        `;
        const rodape = `
            <button id="btn-exec-finalizar" class="btn-full btn-primary">FINALIZAR E RECEBER</button>
            <button onclick="fecharGaveta()" class="btn-full btn-secondary">Voltar</button>
        `;
        window.abrirGaveta("Entregar Trabalho", corpo, rodape);

        document.getElementById('btn-exec-finalizar').onclick = async () => {
            const linkLayout = document.getElementById('f-layout').value;
            const linkImpressao = document.getElementById('f-impressao').value;
            if(!linkLayout || !linkImpressao) return;

            try {
                const res = await fetch('/api/designer/finalizarPedido', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: sessionToken, pedidoId: id, linkLayout, linkImpressao })
                });
                if (!res.ok) throw new Error("Não foi possível finalizar.");
                fecharGaveta();
                carregarDashboardDesigner();
            } catch (e) { mostrarErro(e.message); }
        };
    };

    function formatarMoeda(valor) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor || 0); }
    window.b64EncodeUnicode = (str) => btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (m, p1) => String.fromCharCode('0x' + p1)));

})();