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
