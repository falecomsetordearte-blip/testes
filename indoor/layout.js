// /indoor/layout.js — Layout engine do sistema Indoor v2
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Indoor-Layout] Iniciando...');

    // Dark mode
    (function() {
        const tema = localStorage.getItem('tema') || 'light';
        if (tema === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
        else document.documentElement.removeAttribute('data-theme');
    })();

    const sessionToken = localStorage.getItem('sessionToken');
    const userName = localStorage.getItem('userName') || 'Usuário';

    if (!sessionToken && document.querySelector('.indoor-layout')) {
        window.location.href = '/indoor/login.html';
        return;
    }

    // Carregar sidebar
    const sidebarEl = document.getElementById('indoor-sidebar-placeholder');
    if (sidebarEl) {
        try {
            const res = await fetch('/indoor/components/sidebar.html');
            if (res.ok) sidebarEl.innerHTML = await res.text();
        } catch(e) { console.error('[Indoor-Layout] Erro sidebar:', e); }
    }

    // Carregar header
    const headerEl = document.getElementById('indoor-header-placeholder');
    if (headerEl) {
        try {
            const res = await fetch('/indoor/components/header.html');
            if (res.ok) headerEl.innerHTML = await res.text();
        } catch(e) { console.error('[Indoor-Layout] Erro header:', e); }
    }

    // Injetar drawer de Novo Pedido
    if (!document.getElementById('np-overlay')) {
        const drawerHTML = `
        <div class="in-drawer-overlay" id="np-overlay" onclick="window.fecharDrawerNovoPedido&&window.fecharDrawerNovoPedido()"></div>
        <div class="in-drawer-panel in-drawer-wide" id="np-panel">
            <div class="in-drawer-head">
                <h3><i class="fas fa-plus-circle" style="color:#14b8a6;margin-right:8px;"></i>Novo Pedido Indoor</h3>
                <button class="in-drawer-close" onclick="window.fecharDrawerNovoPedido&&window.fecharDrawerNovoPedido()">×</button>
            </div>
            <div class="in-drawer-body">
                <div id="np-feedback" class="in-feedback"></div>
                <input type="hidden" id="np-formato-val" value="">
                <input type="hidden" id="np-duracao-val" value="">
                <input type="hidden" id="np-preco-val" value="">
                <input type="hidden" id="np-link-blob" value="">

                <div class="in-form-group">
                    <label for="np-titulo">Nome do Pedido <span style="color:#ef4444">*</span></label>
                    <input type="text" id="np-titulo" placeholder="Ex: Vídeo Academia">
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
                    <label>Formato do Vídeo <span style="color:#ef4444">*</span></label>
                    <div class="in-format-grid">
                        <div class="in-format-opt" onclick="window._npFormato('deitado',this)">
                            <div class="in-format-shape landscape"></div>
                            <span>Deitado</span><small>16:9</small>
                        </div>
                        <div class="in-format-opt" onclick="window._npFormato('empo',this)">
                            <div class="in-format-shape portrait"></div>
                            <span>Em Pé</span><small>9:16</small>
                        </div>
                        <div class="in-format-opt" onclick="window._npFormato('quadrado',this)">
                            <div class="in-format-shape square"></div>
                            <span>Quadrado</span><small>1:1</small>
                        </div>
                    </div>
                </div>

                <div class="in-form-group">
                    <label>Duração <span style="color:#ef4444">*</span></label>
                    <div class="in-duracao-grid">
                        <div class="in-duracao-opt" onclick="window._npDuracao('15','65',this)">
                            <span class="in-dur-time">15<small>seg</small></span>
                            <span class="in-dur-price">R$ 65</span>
                        </div>
                        <div class="in-duracao-opt" onclick="window._npDuracao('20','75',this)">
                            <span class="in-dur-time">20<small>seg</small></span>
                            <span class="in-dur-price">R$ 75</span>
                        </div>
                        <div class="in-duracao-opt" onclick="window._npDuracao('30','89',this)">
                            <span class="in-dur-time">30<small>seg</small></span>
                            <span class="in-dur-price">R$ 89</span>
                        </div>
                        <div class="in-duracao-opt" onclick="window._npDuracao('45','119',this)">
                            <span class="in-dur-time">45<small>seg</small></span>
                            <span class="in-dur-price">R$ 119</span>
                        </div>
                        <div class="in-duracao-opt" onclick="window._npDuracao('50','169',this)">
                            <span class="in-dur-time">50<small>seg</small></span>
                            <span class="in-dur-price">R$ 169</span>
                        </div>
                        <div class="in-duracao-opt" onclick="window._npDuracao('60','199',this)">
                            <span class="in-dur-time">60<small>seg</small></span>
                            <span class="in-dur-price">R$ 199</span>
                        </div>
                    </div>
                </div>

                <div class="in-form-group">
                    <label>Arquivo de Referência</label>
                    <div class="in-upload-area">
                        <input type="file" id="np-file" style="display:none" accept="*/*">
                        <label for="np-file" class="in-upload-label" id="np-upload-label">
                            <i class="fas fa-cloud-upload-alt"></i>
                            <span>Clique para enviar arquivo</span>
                            <small>Máx. 500MB</small>
                        </label>
                        <div id="np-upload-result" style="display:none;padding:8px 12px;background:#f0fdf4;font-size:0.8rem;color:#15803d;word-break:break-all;"></div>
                    </div>
                </div>

                <div class="in-form-group">
                    <label for="np-drive">Link do Drive</label>
                    <input type="url" id="np-drive" placeholder="https://drive.google.com/...">
                </div>

                <div class="in-form-group">
                    <label for="np-briefing">Briefing / Detalhes</label>
                    <textarea id="np-briefing" placeholder="Tema, cores, texto, referências, estilo..." style="min-height:90px;"></textarea>
                </div>
            </div>
            <div class="in-drawer-footer">
                <div id="np-preco-preview" style="text-align:center;font-size:0.85rem;color:#64748b;margin-bottom:10px;display:none;">
                    Valor do pedido: <strong id="np-preco-text" style="color:#14b8a6;font-size:1.05rem;">R$ 0</strong>
                </div>
                <button id="np-btn-submit" class="in-btn-primary">
                    <i class="fas fa-paper-plane"></i> Criar Pedido
                </button>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', drawerHTML);

        // Seleção de formato
        window._npFormato = function(val, el) {
            document.getElementById('np-formato-val').value = val;
            el.closest('.in-format-grid').querySelectorAll('.in-format-opt').forEach(e => e.classList.remove('selected'));
            el.classList.add('selected');
        };

        // Seleção de duração
        window._npDuracao = function(seg, preco, el) {
            document.getElementById('np-duracao-val').value = seg;
            document.getElementById('np-preco-val').value = preco;
            el.closest('.in-duracao-grid').querySelectorAll('.in-duracao-opt').forEach(e => e.classList.remove('selected'));
            el.classList.add('selected');
            document.getElementById('np-preco-text').textContent = `R$ ${preco}`;
            document.getElementById('np-preco-preview').style.display = 'block';
        };

        // Upload Blob
        document.getElementById('np-file').addEventListener('change', async function() {
            const file = this.files[0];
            if (!file) return;
            const label = document.getElementById('np-upload-label');
            const result = document.getElementById('np-upload-result');
            label.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Enviando...</span>';

            try {
                const { upload } = await import('https://esm.sh/@vercel/blob@2.3.1/client');
                const token = localStorage.getItem('sessionToken');
                const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
                const blob = await upload(`indoor/${Date.now()}_${safeName}`, file, {
                    access: 'public',
                    handleUploadUrl: '/api/upload/blob',
                    clientPayload: JSON.stringify({ sessionToken: token })
                });
                document.getElementById('np-link-blob').value = blob.url;
                result.textContent = '✅ ' + file.name;
                result.style.display = 'block';
                label.innerHTML = '<i class="fas fa-check-circle" style="color:#15803d;"></i> <span>Arquivo enviado</span>';
                console.log('[Indoor-Layout] Blob upload OK:', blob.url);
            } catch (err) {
                console.error('[Indoor-Layout] Erro upload:', err);
                label.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> <span>Tentar novamente</span>';
                result.textContent = '❌ Erro: ' + err.message;
                result.style.color = '#dc2626';
                result.style.background = '#fef2f2';
                result.style.display = 'block';
            }
        });

        // Abrir drawer
        window.abrirDrawerNovoPedido = function() {
            console.log('[Indoor-Layout] Abrindo drawer de novo pedido.');
            // Reset
            document.getElementById('np-titulo').value = '';
            document.getElementById('np-cliente').value = '';
            document.getElementById('np-wpp').value = '';
            document.getElementById('np-drive').value = '';
            document.getElementById('np-briefing').value = '';
            document.getElementById('np-formato-val').value = '';
            document.getElementById('np-duracao-val').value = '';
            document.getElementById('np-preco-val').value = '';
            document.getElementById('np-link-blob').value = '';
            document.getElementById('np-upload-result').style.display = 'none';
            document.getElementById('np-upload-label').innerHTML = '<i class="fas fa-cloud-upload-alt"></i><span>Clique para enviar arquivo</span><small>Máx. 500MB</small>';
            document.getElementById('np-preco-preview').style.display = 'none';
            document.querySelectorAll('.in-format-opt').forEach(e => e.classList.remove('selected'));
            document.querySelectorAll('.in-duracao-opt').forEach(e => e.classList.remove('selected'));
            const fb = document.getElementById('np-feedback');
            fb.className = 'in-feedback'; fb.textContent = '';
            const btn = document.getElementById('np-btn-submit');
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-paper-plane"></i> Criar Pedido';
            document.getElementById('np-overlay').classList.add('active');
            document.getElementById('np-panel').classList.add('active');
            setTimeout(() => document.getElementById('np-titulo').focus(), 300);
        };

        // Fechar drawer
        window.fecharDrawerNovoPedido = function() {
            document.getElementById('np-overlay').classList.remove('active');
            document.getElementById('np-panel').classList.remove('active');
        };

        // Submit
        document.getElementById('np-btn-submit').addEventListener('click', async () => {
            const titulo   = document.getElementById('np-titulo').value.trim();
            const cliente  = document.getElementById('np-cliente').value.trim();
            const wpp      = document.getElementById('np-wpp').value.trim();
            const formato  = document.getElementById('np-formato-val').value;
            const duracao  = document.getElementById('np-duracao-val').value;
            const valor    = document.getElementById('np-preco-val').value;
            const linkBlob = document.getElementById('np-link-blob').value;
            const linkDrive= document.getElementById('np-drive').value.trim();
            const briefing = document.getElementById('np-briefing').value.trim();
            const fb       = document.getElementById('np-feedback');
            const btn      = document.getElementById('np-btn-submit');

            fb.className = 'in-feedback'; fb.textContent = '';

            if (!titulo) { fb.textContent = 'Informe o nome do pedido.'; fb.className = 'in-feedback error'; return; }
            if (!formato) { fb.textContent = 'Selecione o formato do vídeo.'; fb.className = 'in-feedback error'; return; }
            if (!duracao) { fb.textContent = 'Selecione a duração do vídeo.'; fb.className = 'in-feedback error'; return; }

            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Criando...';

            try {
                const res = await fetch('/api/indoor/criar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionToken: localStorage.getItem('sessionToken'),
                        titulo, nomeCliente: cliente, wppCliente: wpp,
                        formato, duracao, valor,
                        linkBlob, linkDrive, briefing
                    })
                });
                const data = await res.json();

                if (res.ok && data.success) {
                    console.log(`[Indoor-Layout] Pedido #${data.dealId} criado.`);
                    fb.textContent = `✅ Pedido #${data.dealId} criado! Clique em PRODUZIR para gerar a cobrança.`;
                    fb.className = 'in-feedback success';
                    btn.innerHTML = '<i class="fas fa-check"></i> Criado!';
                    setTimeout(() => {
                        window.fecharDrawerNovoPedido();
                        if (typeof window.carregarDashboard === 'function') window.carregarDashboard();
                        else if (typeof window.carregarPedidos === 'function') window.carregarPedidos();
                    }, 1800);
                } else {
                    throw new Error(data.message || 'Erro ao criar pedido.');
                }
            } catch (err) {
                fb.textContent = err.message;
                fb.className = 'in-feedback error';
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-paper-plane"></i> Criar Pedido';
            }
        });

        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') window.fecharDrawerNovoPedido && window.fecharDrawerNovoPedido();
        });

        console.log('[Indoor-Layout] Drawer injetado com sucesso.');
    }

    // Preencher saudação
    const greetingEl = document.getElementById('in-user-greeting');
    if (greetingEl) greetingEl.textContent = `Olá, ${userName}!`;

    // Marcar link ativo na sidebar
    const currentPath = window.location.pathname;
    document.querySelectorAll('.in-sidebar-nav a').forEach(link => {
        try {
            const linkPath = new URL(link.href, window.location.origin).pathname;
            if (linkPath === currentPath) link.classList.add('active');
        } catch(e) {}
    });

    // Logout
    document.addEventListener('click', e => {
        if (e.target.closest('#in-logout-btn')) {
            localStorage.clear();
            window.location.href = '/indoor/login.html';
        }
    });

    console.log('[Indoor-Layout] Layout montado.');
});

// Dialog global Indoor
window.indoorDialog = function(opts) {
    const id = 'in-dlg-' + Date.now();
    const inputHtml = opts.type === 'prompt' ? `<input type="text" id="dlg-i-${id}" style="width:100%;padding:10px;margin-top:10px;border-radius:7px;border:1.5px solid #e2e8f0;font-family:'Poppins',sans-serif;">` : '';
    const cancelBtn = opts.type !== 'alert' ? `<button id="dlg-c-${id}" style="flex:1;padding:10px;border:none;border-radius:7px;background:#f1f5f9;color:#475569;cursor:pointer;font-weight:600;font-family:'Poppins',sans-serif;">Cancelar</button>` : '';
    document.body.insertAdjacentHTML('beforeend', `
    <div id="${id}" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.55);z-index:9999999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px);">
        <div style="background:#fff;padding:28px;border-radius:14px;width:90%;max-width:380px;text-align:center;box-shadow:0 20px 40px rgba(0,0,0,0.2);font-family:'Poppins',sans-serif;">
            <h3 style="margin:0 0 10px;color:#1e293b;font-size:1.1rem;">${opts.title||'Atenção'}</h3>
            <p style="color:#64748b;font-size:0.9rem;margin-bottom:14px;">${opts.message}</p>
            ${inputHtml}
            <div style="display:flex;gap:10px;margin-top:18px;">
                ${cancelBtn}
                <button id="dlg-o-${id}" style="flex:1;padding:10px;border:none;border-radius:7px;background:#14b8a6;color:#fff;cursor:pointer;font-weight:700;font-family:'Poppins',sans-serif;">${opts.okText||'OK'}</button>
            </div>
        </div>
    </div>`);
    if (opts.type !== 'alert') {
        document.getElementById(`dlg-c-${id}`).onclick = () => { document.getElementById(id).remove(); if(opts.onCancel) opts.onCancel(); };
    }
    document.getElementById(`dlg-o-${id}`).onclick = () => {
        const val = opts.type==='prompt' ? document.getElementById(`dlg-i-${id}`).value : true;
        document.getElementById(id).remove();
        if(opts.onConfirm) opts.onConfirm(val);
    };
};
