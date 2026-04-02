// /layout.js
document.addEventListener("DOMContentLoaded", async () => {
    console.log("[Layout] Iniciando carregamento do layout...");

    // Função global para controle do Submenu da Sidebar
    window.toggleSidebarSubmenu = function(event, submenuId) {
        event.preventDefault();
        const submenu = document.getElementById(submenuId);
        if (!submenu) return;
        const parentLi = submenu.parentElement;
        
        if (submenu.style.display === 'block') {
            submenu.style.display = 'none';
            parentLi.classList.remove('open');
        } else {
            submenu.style.display = 'block';
            parentLi.classList.add('open');
        }
    };

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

        checkAceiteTermos('EMPRESA', sessionToken);
        checkTrialStatus('EMPRESA', sessionToken);

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
        const msg = dias === 0 ? "Último dia de teste grátis!" : `Você tem ${dias} dias de teste grátis. Aproveite!`;
        
        const bannerHtml = `
            <div id="trial-banner" style="background:${cor}; color:white; padding:12px; text-align:center; font-size:0.9rem; font-weight:600; font-family:'Poppins', sans-serif; position:relative; z-index:9999; display:flex; align-items:center; justify-content:center; gap:20px; box-shadow: 0 4px 15px rgba(0,0,0,0.15);">
                <span style="display:flex; align-items:center; gap:8px;"><i class="fas fa-rocket"></i> ${msg}</span>
                <button onclick="window.location.href='/assinatura-empresa.html'" style="background:white; color:#1e293b; border:none; padding:6px 18px; border-radius:8px; font-weight:800; cursor:pointer; font-size:0.8rem; transition:0.3s; box-shadow:0 4px 6px rgba(0,0,0,0.1);">ASSINAR AGORA</button>
            </div>
        `;
        document.body.insertAdjacentHTML('afterbegin', bannerHtml);
    }

    function mostrarBloqueioTrial(type) {
        const modalHtml = `
            <div id="modal-bloqueio-trial" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15, 23, 42, 0.95); z-index:200000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(10px);">
                <div style="background:white; width:90%; max-width:500px; padding:45px; border-radius:30px; text-align:center; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1);">
                    <div style="font-size:4.5rem; background: linear-gradient(135deg, #f43f5e, #fb7185); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom:25px;"><i class="fas fa-hourglass-end"></i></div>
                    <h2 style="color:#1e293b; margin-bottom:15px; font-family:'Poppins', sans-serif; font-weight:800;">O tempo de teste acabou!</h2>
                    <p style="color:#64748b; margin-bottom:35px; line-height:1.7; font-family:'Poppins', sans-serif; font-size:1.05rem;">
                        Seu período de 13 dias de experiência gratuita chegou ao fim. Para continuar usando todas as ferramentas do <strong>Setor de Arte</strong>, escolha seu plano agora.
                    </p>
                    <button onclick="window.location.href='/assinatura-empresa.html'" style="background:#4f46e5; color:white; border:none; padding:18px 30px; border-radius:16px; font-weight:800; cursor:pointer; font-size:1.15rem; width:100%; font-family:'Poppins', sans-serif; transition:0.4s; box-shadow:0 12px 20px -5px rgba(79,70,229,0.4); text-transform:uppercase; letter-spacing:0.5px;">Ativar Minha Conta</button>
                    <p style="margin-top:25px; font-size:0.9rem; color:#94a3b8; font-family:'Poppins', sans-serif;">Planos flexíveis a partir de <strong>R$ 49,90/mês</strong>.</p>
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
                <div style="background:white; width:90%; max-width:550px; padding:35px; border-radius:16px; box-shadow:0 20px-25px rgba(0,0,0,0.2); text-align:center;">
                    <div style="font-size:3rem; color:var(--primary-color); margin-bottom:20px;"><i class="fas fa-file-signature"></i></div>
                    <h2 style="margin-bottom:15px; color:var(--text-main);">Atualização dos Termos de Uso</h2>
                    <p style="color:var(--text-muted); font-size:0.95rem; margin-bottom:20px;">
                        Para continuar utilizando o <strong>Setor de Arte</strong>, você precisa ler e aceitar nossos novos termos de uso e política de privacidade (LGPD).
                    </p>
                    <div style="background:#fff7ed; border-left:4px solid #f97316; padding:15px; margin-bottom:25px; text-align:left; font-size:0.9rem; color:#9a3412;">
                        <strong>Aviso Importante:</strong> O Setor de Arte é apenas um facilitador tecnológico. Não nos responsabilizamos por negociações, prazos ou pagamentos entre Designers e Gráficas.
                    </div>
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        <button id="btn-aceitar-termos" style="background:var(--primary-color); color:white; border:none; padding:16px; border-radius:10px; font-weight:700; cursor:pointer; font-size:1rem;">Li e Concordo com os Termos</button>
                        <a href="/termos-uso.html" target="_blank" style="color:var(--primary-color); text-decoration:none; font-size:0.85rem; font-weight:600;">Ver Termos Completos</a>
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