// /indoor/layout.js — Layout engine do sistema Indoor
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Indoor-Layout] Iniciando...');

    // Dark mode inicial
    (function() {
        const tema = localStorage.getItem('tema') || 'light';
        if (tema === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
        else document.documentElement.removeAttribute('data-theme');
    })();

    const sessionToken = localStorage.getItem('sessionToken');
    const userName = localStorage.getItem('userName') || 'Usuário';

    // Se não tiver sessão e for área protegida → redireciona para login indoor
    if (!sessionToken && document.querySelector('.indoor-layout')) {
        console.warn('[Indoor-Layout] Sem sessão. Redirecionando para login...');
        window.location.href = '/indoor/login.html';
        return;
    }

    // Carregar sidebar
    const sidebarEl = document.getElementById('indoor-sidebar-placeholder');
    if (sidebarEl) {
        try {
            const res = await fetch('/indoor/components/sidebar.html');
            if (res.ok) sidebarEl.innerHTML = await res.text();
        } catch(e) { console.error('[Indoor-Layout] Erro ao carregar sidebar:', e); }
    }

    // Carregar header
    const headerEl = document.getElementById('indoor-header-placeholder');
    if (headerEl) {
        try {
            const res = await fetch('/indoor/components/header.html');
            if (res.ok) headerEl.innerHTML = await res.text();
        } catch(e) { console.error('[Indoor-Layout] Erro ao carregar header:', e); }
    }

    // Injetar drawer de Novo Pedido em todas as páginas
    if (!document.getElementById('np-overlay')) {
        document.body.insertAdjacentHTML('beforeend', `
            <div class="in-drawer-overlay" id="np-overlay" onclick="window.fecharDrawerNovoPedido && window.fecharDrawerNovoPedido()"></div>
            <div class="in-drawer-panel" id="np-panel">
                <div class="in-drawer-head">
                    <h3><i class="fas fa-plus-circle" style="color:#14b8a6; margin-right:8px;"></i> Novo Pedido Indoor</h3>
                    <button class="in-drawer-close" onclick="window.fecharDrawerNovoPedido && window.fecharDrawerNovoPedido()">×</button>
                </div>
                <div class="in-drawer-body">
                    <p style="font-size:0.83rem;color:#94a3b8;margin-bottom:18px;">
                        Após criar, o pedido entra automaticamente em <strong style="color:#f59e0b;">Em Edição</strong>.
                    </p>
                    <div id="np-feedback" class="in-feedback"></div>
                    <form id="form-novo-pedido" autocomplete="off">
                        <div class="in-form-group">
                            <label for="np-titulo">Título do Pedido <span style="color:#ef4444;">*</span></label>
                            <input type="text" id="np-titulo" placeholder="Ex: Banner Loja Centro — Maio/2025" required>
                        </div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
                            <div class="in-form-group">
                                <label for="np-cliente">Nome do Cliente</label>
                                <input type="text" id="np-cliente" placeholder="Ex: João Silva">
                            </div>
                            <div class="in-form-group">
                                <label for="np-wpp">WhatsApp</label>
                                <input type="text" id="np-wpp" placeholder="Ex: 11999998888">
                            </div>
                        </div>
                        <div class="in-form-group">
                            <label for="np-briefing">Briefing / Observações</label>
                            <textarea id="np-briefing" placeholder="Tamanho, cores, texto, referências..."></textarea>
                        </div>
                    </form>
                </div>
                <div class="in-drawer-footer">
                    <button id="np-btn-submit" class="in-btn-primary">
                        <i class="fas fa-paper-plane"></i> Criar Pedido
                    </button>
                </div>
            </div>
        `);

        // Abrir drawer
        window.abrirDrawerNovoPedido = function() {
            console.log('[Indoor-Layout] Abrindo drawer de novo pedido.');
            document.getElementById('form-novo-pedido').reset();
            const fb = document.getElementById('np-feedback');
            fb.className = 'in-feedback';
            fb.textContent = '';
            const btn = document.getElementById('np-btn-submit');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Criar Pedido';
            document.getElementById('np-overlay').classList.add('active');
            document.getElementById('np-panel').classList.add('active');
            document.getElementById('np-titulo').focus();
        };

        // Fechar drawer
        window.fecharDrawerNovoPedido = function() {
            document.getElementById('np-overlay').classList.remove('active');
            document.getElementById('np-panel').classList.remove('active');
        };

        // Submit do formulário
        document.getElementById('np-btn-submit').addEventListener('click', async () => {
            const titulo   = document.getElementById('np-titulo').value.trim();
            const cliente  = document.getElementById('np-cliente').value.trim();
            const wpp      = document.getElementById('np-wpp').value.trim();
            const briefing = document.getElementById('np-briefing').value.trim();
            const feedback = document.getElementById('np-feedback');
            const btn      = document.getElementById('np-btn-submit');

            feedback.className = 'in-feedback';
            feedback.textContent = '';

            if (!titulo) {
                feedback.textContent = 'O título do pedido é obrigatório.';
                feedback.className = 'in-feedback error';
                return;
            }

            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Criando...';

            console.log(`[Indoor-Layout] Criando pedido: "${titulo}" | ${cliente}`);

            try {
                const res = await fetch('/api/indoor/criar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionToken: localStorage.getItem('sessionToken'),
                        titulo, nomeCliente: cliente, wppCliente: wpp, briefing
                    })
                });
                const data = await res.json();

                if (res.ok && data.success) {
                    console.log(`[Indoor-Layout] Pedido #${data.dealId} criado com sucesso.`);
                    feedback.textContent = `✅ Pedido #${data.dealId} criado! ${wpp ? 'Grupo WhatsApp sendo criado...' : ''}`;
                    feedback.className = 'in-feedback success';
                    btn.innerHTML = '<i class="fas fa-check"></i> Criado!';

                    // Atualizar a lista da página se a função existir (painel-edicao)
                    setTimeout(() => {
                        window.fecharDrawerNovoPedido();
                        if (typeof window.carregarPedidos === 'function') {
                            window.carregarPedidos();
                        } else if (typeof window.carregarDashboard === 'function') {
                            window.carregarDashboard();
                        }
                    }, 1600);
                } else {
                    throw new Error(data.message || 'Erro ao criar pedido.');
                }
            } catch (err) {
                console.error('[Indoor-Layout] Erro ao criar pedido:', err);
                feedback.textContent = err.message;
                feedback.className = 'in-feedback error';
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-paper-plane"></i> Criar Pedido';
            }
        });

        // Fechar com ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') window.fecharDrawerNovoPedido && window.fecharDrawerNovoPedido();
        });

        console.log('[Indoor-Layout] Drawer de novo pedido injetado.');
    }

    // Preencher nome do usuário
    const greetingEl = document.getElementById('in-user-greeting');
    if (greetingEl) greetingEl.textContent = `Olá, ${userName}!`;

    // Marcar link ativo na sidebar
    const currentPath = window.location.pathname;
    document.querySelectorAll('.in-sidebar-nav a').forEach(link => {
        const linkPath = new URL(link.href, window.location.origin).pathname;
        if (linkPath === currentPath) link.classList.add('active');
    });

    // Logout
    document.addEventListener('click', (e) => {
        if (e.target.closest('#in-logout-btn')) {
            console.log('[Indoor-Layout] Logout realizado.');
            localStorage.clear();
            window.location.href = '/indoor/login.html';
        }
    });

    console.log('[Indoor-Layout] Layout montado com sucesso.');
});

// Função global de dialog (igual ao sistema principal)
window.indoorDialog = function(opts) {
    const id = 'in-dlg-' + Date.now();
    const inputHtml = opts.type === 'prompt'
        ? `<input type="text" id="dlg-input-${id}" style="width:100%;padding:10px;margin-top:10px;border-radius:7px;border:1.5px solid #e2e8f0;font-family:'Poppins',sans-serif;">`
        : '';
    const cancelBtn = opts.type !== 'alert'
        ? `<button id="dlg-cancel-${id}" style="flex:1;padding:10px;border:none;border-radius:7px;background:#f1f5f9;color:#475569;cursor:pointer;font-weight:600;font-family:'Poppins',sans-serif;">Cancelar</button>`
        : '';
    const html = `
    <div id="${id}" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.55);z-index:9999999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px);">
        <div style="background:#fff;padding:28px;border-radius:14px;width:90%;max-width:380px;text-align:center;box-shadow:0 20px 40px rgba(0,0,0,0.2);font-family:'Poppins',sans-serif;">
            <h3 style="margin:0 0 10px;color:#1e293b;font-size:1.1rem;">${opts.title || 'Atenção'}</h3>
            <p style="color:#64748b;font-size:0.9rem;margin-bottom:14px;">${opts.message}</p>
            ${inputHtml}
            <div style="display:flex;gap:10px;margin-top:18px;">
                ${cancelBtn}
                <button id="dlg-ok-${id}" style="flex:1;padding:10px;border:none;border-radius:7px;background:#14b8a6;color:#fff;cursor:pointer;font-weight:700;font-family:'Poppins',sans-serif;">${opts.okText || 'OK'}</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    if (opts.type !== 'alert') {
        document.getElementById(`dlg-cancel-${id}`).onclick = () => {
            document.getElementById(id).remove();
            if (opts.onCancel) opts.onCancel();
        };
    }
    document.getElementById(`dlg-ok-${id}`).onclick = () => {
        const val = opts.type === 'prompt' ? document.getElementById(`dlg-input-${id}`).value : true;
        document.getElementById(id).remove();
        if (opts.onConfirm) opts.onConfirm(val);
    };
};
