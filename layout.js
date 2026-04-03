// /layout.js
document.addEventListener("DOMContentLoaded", async () => {
    console.log("[Layout] Iniciando carregamento do layout...");

    // Função genérica para carregar um componente HTML
    async function loadComponent(componentPath) {
        try {
            console.log(`[Layout] Carregando componente: ${componentPath}`);
            const response = await fetch(componentPath);
            if (!response.ok) {
                throw new Error(`Componente não encontrado: ${componentPath}`);
            }
            return await response.text();
        } catch (error) {
            console.error(`[Layout] Erro ao carregar ${componentPath}:`, error);
            return `<p style="color:red; font-family: monospace; padding: 10px;">Erro ao carregar componente: ${componentPath}</p>`;
        }
    }

    // Função principal que monta o layout
    async function buildLayout() {
        const headerPlaceholder = document.getElementById("header-placeholder");
        const sidebarPlaceholder = document.getElementById("sidebar-placeholder");
        const footerPlaceholder = document.getElementById("footer-placeholder");

        // ===== CORREÇÃO DEFINITIVA =====
        const [headerHtml, sidebarHtml, footerHtml] = await Promise.all([
            headerPlaceholder ? loadComponent("/components/header.html") : Promise.resolve(null),
            sidebarPlaceholder ? loadComponent("/components/sidebar.html") : Promise.resolve(null),
            footerPlaceholder ? loadComponent("/components/footer.html") : Promise.resolve(null),
        ]);

        if (headerPlaceholder && headerHtml) {
            headerPlaceholder.innerHTML = headerHtml;
            console.log("[Layout] Header montado.");
        }
        if (sidebarPlaceholder && sidebarHtml) {
            sidebarPlaceholder.innerHTML = sidebarHtml;
            console.log("[Layout] Sidebar montada.");
        }
        if (footerPlaceholder && footerHtml) {
            footerPlaceholder.innerHTML = footerHtml;
            console.log("[Layout] Footer montado.");
        }
        
        initializeGlobalScripts();
    }

    function initializeGlobalScripts() {
        console.log("[Layout] Inicializando scripts globais...");
        const currentPage = window.location.pathname;
        const pagePath = currentPage.replace(/\/$/, "");
        
        const sessionToken = localStorage.getItem("sessionToken");
        const userName = localStorage.getItem("userName") || 'Usuário';

        if (!sessionToken) {
            console.warn("[Layout] Sessão não encontrada. Redirecionando para login se for área restrita.");
            if (document.querySelector(".app-layout-grid")) {
                window.location.href = "/login.html";
            }
            return;
        }

        // ==========================================
        // SISTEMA DE CONTROLE DE ACESSO (PERMISSÕES)
        // ==========================================
        const rawPerms = localStorage.getItem("userPermissoes");
        const permissoesArr = rawPerms ? JSON.parse(rawPerms) : []; 
        const isLegacyUser = !rawPerms; 
        
        const roteamentoPermissoes = {
            "/carteira.html": "carteira",
            "/crm.html": "crm",
            "/painel.html": "arte",
            "/impressao/painel.html": "impressao",
            "/acabamento/acabamento.html": "acabamento",
            "/instalacao-loja/painel.html": "instalacao_loja",
            "/instalacao/painel.html": "instalacao_ext",
            "/expedicao/index.html": "expedicao",
            "/admin-equipe.html": "admin",
            "/admin-configuracoes.html": "admin"
        };
        
        const permissaoNecessaria = roteamentoPermissoes[pagePath];
        if (!isLegacyUser && permissaoNecessaria) {
            if (!permissoesArr.includes("admin") && !permissoesArr.includes(permissaoNecessaria)) {
                console.error(`[Layout] Acesso Negado: Permissão exigida: ${permissaoNecessaria}`);
                alert("Acesso Negado: Você não possui permissão para acessar este módulo.");
                window.location.href = "/dashboard.html"; 
                return; 
            }
        }

        // OCULTANDO LINKS DO MENU (SIDEBAR)
        const sidebarLinks = document.querySelectorAll(".sidebar-nav a");

        sidebarLinks.forEach(link => {
            const linkPathUrl = new URL(link.href).pathname.replace(/\/$/, ""); 
            const linkPermRequired = roteamentoPermissoes[linkPathUrl];

            if (linkPathUrl === pagePath || (pagePath.endsWith('index.html') && linkPathUrl === '/dashboard.html') || (pagePath === '/' && linkPathUrl === '/dashboard.html')) {
                link.classList.add("active");
            }

            if (!isLegacyUser && linkPermRequired) {
                if (!permissoesArr.includes("admin") && !permissoesArr.includes(linkPermRequired)) {
                    link.parentElement.style.display = "none";
                }
            }
        });
        
        const greetingEl = document.getElementById('user-greeting');
        if (greetingEl) greetingEl.textContent = `Olá, ${userName}!`;
    
        const logoutButton = document.getElementById('logout-button');
        if(logoutButton) logoutButton.addEventListener('click', () => {
            console.log("[Layout] Realizando logout...");
            localStorage.clear();
            window.location.href = '/login.html';
        });

        // checkAceiteTermos('EMPRESA', sessionToken); // DESATIVADO - modal de termos removido
        checkTrialStatus('EMPRESA', sessionToken); // ATIVO - banner e bloqueio do trial

        // ==========================================
        // CARREGAMENTO DINÂMICO DA BUSCA GLOBAL
        // ==========================================
        // Isso garante que a busca global funcione em qualquer página que tenha o layout
        if (!document.getElementById("script-busca-global")) {
            console.log("[Layout] Injetando sistema de Busca Global...");
            const searchScript = document.createElement("script");
            searchScript.id = "script-busca-global";
            searchScript.src = "/globalSearch.js"; // Caminho do seu arquivo globalSearch.js na pasta public
            
            searchScript.onload = () => {
                if(typeof window.inicializarBuscaGlobal === 'function') {
                    window.inicializarBuscaGlobal();
                }
            };
            
            document.body.appendChild(searchScript);
        } else {
            if(typeof window.inicializarBuscaGlobal === 'function') {
                window.inicializarBuscaGlobal();
            }
        }

        // ==========================================
        // SISTEMA MASTER / ADMIN GLOBAL EM CARDS
        // ==========================================
        if (permissoesArr.includes("admin")) {
            console.log("[Layout] Permissão Admin detectada. Habilitando engrenagens nos cards...");
            
            const styleAdmin = document.createElement('style');
            styleAdmin.innerHTML = `
                .btn-master-icon { position:absolute; top:8px; right:8px; background:#e74c3c; color:white; width:22px; height:22px; display:flex; align-items:center; justify-content:center; border-radius:50%; font-size:0.75rem; cursor:pointer; z-index:100; opacity:0.6; transition:0.2s; box-shadow:0 2px 5px rgba(0,0,0,0.2); }
                .btn-master-icon:hover { opacity:1; transform:scale(1.1); }
            `;
            document.head.appendChild(styleAdmin);

            const mstrModalHtml = `
            <div id="master-global-modal" class="hidden" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:999999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(3px);">
                <div style="background:#fff; width:90%; max-width:400px; padding:25px; border-radius:12px; border:2px solid #e74c3c; box-shadow:0 15px 30px rgba(0,0,0,0.2);">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #eee; padding-bottom:10px; margin-bottom:15px;">
                        <h3 style="color:#c0392b; margin:0; font-size:1.1rem;"><i class="fas fa-tools"></i> Mestre: Pedido #<span id="master-global-display-id"></span></h3>
                        <button onclick="document.getElementById('master-global-modal').classList.add('hidden')" style="background:none;border:none;font-size:1.5rem;cursor:pointer;color:#777;">&times;</button>
                    </div>
                    <input type="hidden" id="master-global-deal-id">
                    
                    <label style="font-weight:600; font-size:0.85rem; color:#444; margin-bottom:5px; display:block;">Forçar nova etapa:</label>
                    <select id="master-global-stage-select" style="width:100%; padding:9px; margin-bottom:15px; border-radius:6px; border:1px solid #ccc; font-size:0.95rem;">
                        <option value="">Selecione a fase exata...</option>
                        <option value="ARTE">Arte / Design</option>
                        <option value="IMPRESSÃO">Impressão</option>
                        <option value="ACABAMENTO">Acabamento</option>
                        <option value="INSTALAÇÃO LOJA">Instalação Loja</option>
                        <option value="INSTALAÇÃO EXTERNA">Instalação Ext.</option>
                        <option value="EXPEDIÇÃO">Expedição</option>
                        <option value="CONCLUÍDO">Concluído</option>
                        <option value="CANCELADO">Cancelado</option>
                    </select>
                    <button id="master-global-btn-mover" style="width:100%; background:#f39c12; color:white; border:none; padding:10px; border-radius:6px; margin-bottom:15px; font-weight:bold; cursor:pointer;">Mover Fase</button>

                    <hr style="border:none; border-top:1px dashed #ddd; margin-bottom:15px;" />
                    <button id="master-global-btn-excluir" style="width:100%; background:#e74c3c; color:white; border:none; padding:10px; border-radius:6px; font-weight:bold; cursor:pointer;">Deletar permanentemente</button>
                </div>
            </div>
            `;
            document.body.insertAdjacentHTML('beforeend', mstrModalHtml);

            window.adminCustomDialog = function(opts) {
                const id = 'admin-dlg-' + Date.now();
                let inputHtml = opts.type === 'prompt' ? '<input type="text" id="dlg-input-'+id+'" style="width:100%; padding:10px; margin-top:10px; border-radius:6px; border:1px solid #ccc; font-family:inherit;">' : '';
                const html = `
                <div id="${id}" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:9999999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(3px);">
                    <div style="background:#fff; padding:25px; border-radius:12px; width:90%; max-width:400px; text-align:center; box-shadow:0 15px 30px rgba(0,0,0,0.2); font-family:'Poppins', sans-serif;">
                        <h3 style="margin:0 0 10px 0; color:#333; font-size:1.2rem;">${opts.title || 'Atenção'}</h3>
                        <p style="color:#666; font-size:0.95rem; margin-bottom:15px;">${opts.message}</p>
                        ${inputHtml}
                        <div style="display:flex; gap:10px; margin-top:20px;">
                            ${opts.type !== 'alert' ? `<button id="dlg-cancel-${id}" style="flex:1; padding:10px; border:none; border-radius:6px; background:#f1f5f9; color:#475569; cursor:pointer; font-weight:bold; font-family:inherit;">Cancelar</button>` : ''}
                            <button id="dlg-ok-${id}" style="flex:1; padding:10px; border:none; border-radius:6px; background:#e74c3c; color:#fff; cursor:pointer; font-weight:bold; font-family:inherit;">${opts.okText || 'OK'}</button>
                        </div>
                    </div>
                </div>
                `;
                document.body.insertAdjacentHTML('beforeend', html);
                if (opts.type !== 'alert') {
                    document.getElementById('dlg-cancel-'+id).onclick = () => { document.getElementById(id).remove(); if(opts.onCancel) opts.onCancel(); };
                }
                document.getElementById('dlg-ok-'+id).onclick = () => { 
                    const val = opts.type === 'prompt' ? document.getElementById('dlg-input-'+id).value : true; 
                    document.getElementById(id).remove(); 
                    if(opts.onConfirm) opts.onConfirm(val); 
                };
            };

            document.getElementById('master-global-btn-mover').addEventListener('click', () => {
                const dealId = document.getElementById('master-global-deal-id').value;
                const stage = document.getElementById('master-global-stage-select').value;
                if (!stage) return window.adminCustomDialog({ type: 'alert', title: 'Erro', message: 'Selecione a etapa para mover.' });
                
                window.adminCustomDialog({
                    type: 'confirm',
                    title: 'Confirmar Ação',
                    message: `Esta ação forçará uma nova etapa. Mover o pedido #${dealId} para ${stage}?`,
                    onConfirm: async () => {
                        const btn = document.getElementById('master-global-btn-mover');
                        btn.disabled = true;
                        btn.innerText = "Processando...";
                        try {
                            const res = await fetch('/api/admin/forceUpdateStage', {
                                method:'POST', headers:{'Content-Type':'application/json'},
                                body:JSON.stringify({sessionToken, dealId, newStageId:stage})
                            });
                            if (!res.ok) throw new Error((await res.json()).message || 'Falha no endpoint');
                            document.getElementById('master-global-modal').classList.add('hidden');
                            window.adminCustomDialog({ type: 'alert', title: 'Sucesso', message: 'Fase movida com sucesso!', onConfirm: () => window.location.reload() });
                        } catch(e) { 
                            window.adminCustomDialog({ type: 'alert', title: 'Erro', message: e.message });
                            btn.disabled = false;
                            btn.innerText = "Mover Fase";
                        }
                    }
                });
            });

            document.getElementById('master-global-btn-excluir').addEventListener('click', () => {
                const dealId = document.getElementById('master-global-deal-id').value;
                window.adminCustomDialog({
                    type: 'prompt',
                    title: 'Zona de Perigo',
                    message: `EXCLUSÃO PERMANENTE!<br><br>Para deletar o pedido permanentemente, digite o ID: <b>${dealId}</b>`,
                    okText: 'Deletar',
                    onConfirm: async (val) => {
                        if (val === dealId) {
                            const btn = document.getElementById('master-global-btn-excluir');
                            btn.disabled = true;
                            btn.innerText = "Deletando...";
                            try {
                                const res = await fetch('/api/admin/deleteDeal', {
                                    method:'POST', headers:{'Content-Type':'application/json'},
                                    body:JSON.stringify({sessionToken, dealId})
                                });
                                if (!res.ok) throw new Error((await res.json()).message || 'Falha no endpoint');
                                document.getElementById('master-global-modal').classList.add('hidden');
                                window.adminCustomDialog({ type: 'alert', title: 'Sucesso', message: 'Pedido deletado permanentemente.', onConfirm: () => window.location.reload() });
                            } catch(e) { 
                                window.adminCustomDialog({ type: 'alert', title: 'Erro', message: e.message });
                                btn.disabled = false;
                                btn.innerText = "Deletar permanentemente";
                            }
                        } else if(val !== null) {
                            window.adminCustomDialog({ type: 'alert', title: 'Cancelado', message: 'O ID digitado não confere.' });
                        }
                    }
                });
            });

            window.abrirAdminModal = function(dealId) {
                document.getElementById('master-global-deal-id').value = dealId;
                document.getElementById('master-global-display-id').innerText = dealId;
                document.getElementById('master-global-modal').classList.remove('hidden');
            };
        }
    }

    // --- SISTEMA DE TRIAL (PERÍODO DE TESTE) ---
    async function checkTrialStatus(type, token) {
        if (!token) return;
        try {
            console.log("[Layout] Verificando status de trial...");
            const res = await fetch('/api/auth/trial-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, type })
            });
            const data = await res.json();
            
            if (res.ok) {
                if (data.is_trial) {
                    if (data.expirado) {
                        mostrarBloqueioTrial(type);
                    } else {
                        mostrarBannerTrial(data.dias_restantes);
                    }
                }
            }
        } catch (e) { console.error("[Layout] Erro trial check:", e); }
    }

    function mostrarBannerTrial(dias) {
        const cor = dias <= 3 ? 'linear-gradient(90deg, #ef4444, #f87171)' : 'linear-gradient(90deg, #4f46e5, #6366f1)';
        const msg = dias === 0 ? "Último dia de acesso completo gratuito!" : (dias === 1 ? `Falta apenas 1 dia do seu período de teste grátis!` : `Você tem ${dias} dias restantes de acesso completo grátis.`);
        const existingBanner = document.getElementById('trial-banner');
        if (existingBanner) return; // Não duplicar
        
        const bannerHtml = `
            <div id="trial-banner" style="background:${cor}; color:white; padding:12px; text-align:center; font-size:0.9rem; font-weight:600; font-family:'Poppins', sans-serif; position:relative; z-index:9999; display:flex; align-items:center; justify-content:center; gap:20px; box-shadow: 0 4px 15px rgba(0,0,0,0.15);">
                <span style="display:flex; align-items:center; gap:8px;"><i class="fas fa-rocket"></i> ${msg}</span>
                <button onclick="window.location.href='/assinatura.html'" style="background:white; color:#1e293b; border:none; padding:6px 18px; border-radius:8px; font-weight:800; cursor:pointer; font-size:0.8rem; transition:0.3s; box-shadow:0 4px 6px rgba(0,0,0,0.1);">ASSINAR AGORA</button>
            </div>
        `;
        document.body.insertAdjacentHTML('afterbegin', bannerHtml);
    }

    function mostrarBloqueioTrial(type) {
        // Evita duplicar
        if (document.getElementById('modal-bloqueio-trial')) return;
        
        const redirectUrl = type === 'EMPRESA' ? '/assinatura.html' : '/designer/assinatura.html';
        const modalHtml = `
            <div id="modal-bloqueio-trial" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.97); z-index:200000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(10px);">
                <div style="background:white; width:90%; max-width:520px; padding:45px; border-radius:30px; text-align:center; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1);">
                    <div style="font-size:4.5rem; background: linear-gradient(135deg, #f43f5e, #fb7185); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom:20px;"><i class="fas fa-lock"></i></div>
                    <h2 style="color:#1e293b; margin-bottom:12px; font-family:'Poppins', sans-serif; font-weight:800; font-size:1.6rem;">Seu período de teste terminou</h2>
                    <p style="color:#64748b; margin-bottom:10px; line-height:1.7; font-family:'Poppins', sans-serif; font-size:1rem;">
                        Você utilizou os <strong>10 dias de acesso completo gratuito</strong> ao <strong>Setor de Arte</strong>.
                    </p>
                    <p style="color:#64748b; margin-bottom:30px; line-height:1.7; font-family:'Poppins', sans-serif; font-size:0.95rem;">
                        Para continuar usando o sistema, assine agora. É rápido e você retoma o acesso na hora!
                    </p>
                    <button onclick="window.location.href='${redirectUrl}'" style="background:linear-gradient(135deg, #4f46e5, #6366f1); color:white; border:none; padding:18px 30px; border-radius:16px; font-weight:800; cursor:pointer; font-size:1.1rem; width:100%; font-family:'Poppins', sans-serif; transition:0.4s; box-shadow:0 12px 20px -5px rgba(79,70,229,0.4); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:15px;"><i class="fas fa-crown" style="margin-right:8px;"></i>Ver Planos e Assinar</button>
                    <p style="font-size:0.85rem; color:#94a3b8; font-family:'Poppins', sans-serif;">A partir de <strong>R$ 49,90/mês</strong> · Cancele quando quiser</p>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    async function checkAceiteTermos(type, token) {
        try {
            console.log("[Layout] Verificando aceite de termos...");
            const checkRes = await fetch('/api/auth/aceite-termos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, type, action: 'check' })
            });
            const data = await checkRes.json();
            
            if (checkRes.ok && !data.ja_aceitou) {
                mostrarModalTermos(type, token);
            }
        } catch (e) { console.error("[Layout] Erro check termos:", e); }
    }

    function mostrarModalTermos(type, token) {
        const modalHtml = `
            <div id="modal-termos-lgpd" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:100000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(5px);">
                <div style="background:white; width:90%; max-width:550px; padding:35px; border-radius:16px; box-shadow:0 20px 25px rgba(0,0,0,0.2); text-align:center;">
                    <div style="font-size:3rem; color:#4f46e5; margin-bottom:20px;"><i class="fas fa-file-signature"></i></div>
                    <h2 style="margin-bottom:15px; color:#1e293b;">Atualização dos Termos de Uso</h2>
                    <p style="color:#64748b; font-size:0.95rem; margin-bottom:20px;">
                        Para continuar utilizando o <strong>Setor de Arte</strong>, você precisa ler e aceitar nossos novos termos de uso e política de privacidade (LGPD).
                    </p>
                    <div style="background:#fff7ed; border-left:4px solid #f97316; padding:15px; margin-bottom:25px; text-align:left; font-size:0.9rem; color:#9a3412;">
                        <strong>Aviso Importante:</strong> O Setor de Arte é apenas um facilitador tecnológico. Não nos responsabilizamos por negociações, prazos ou pagamentos entre Designers e Gráficas.
                    </div>
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        <button id="btn-aceitar-termos" style="background:#4f46e5; color:white; border:none; padding:16px; border-radius:10px; font-weight:700; cursor:pointer; font-size:1rem;">Li e Concordo com os Termos</button>
                        <a href="/termos-uso.html" target="_blank" style="color:#4f46e5; text-decoration:none; font-size:0.85rem; font-weight:600;">Ver Termos Completos</a>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('btn-aceitar-termos').onclick = async function() {
            this.disabled = true;
            this.innerText = 'Processando...';
            try {
                const res = await fetch('/api/auth/aceite-termos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, type, action: 'save' })
                });
                if (res.ok) {
                    document.getElementById('modal-termos-lgpd').remove();
                    console.log("[Layout] Termos aceitos com sucesso.");
                } else {
                    alert("Erro ao gravar aceite. Tente novamente.");
                    this.disabled = false;
                    this.innerText = 'Li e Concordo com os Termos';
                }
            } catch (e) { alert("Erro de conexão."); this.disabled = false; }
        };
    }

    await buildLayout();
});