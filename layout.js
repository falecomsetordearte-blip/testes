// /layout.js
document.addEventListener("DOMContentLoaded", async () => {
    // Função genérica para carregar um componente HTML
    async function loadComponent(componentPath) {
        try {
            const response = await fetch(componentPath);
            if (!response.ok) {
                throw new Error(`Componente não encontrado: ${componentPath}`);
            }
            return await response.text();
        } catch (error) {
            console.error(error);
            return `<p style="color:red; font-family: monospace; padding: 10px;">Erro ao carregar componente: ${componentPath}</p>`;
        }
    }

    // Função principal que monta o layout
    async function buildLayout() {
        const headerPlaceholder = document.getElementById("header-placeholder");
        const sidebarPlaceholder = document.getElementById("sidebar-placeholder");
        const footerPlaceholder = document.getElementById("footer-placeholder");

        // ===== CORREÇÃO DEFINITIVA =====
        // Trocamos o caminho relativo "./" pelo caminho absoluto "/"
        // Isso garante que o script encontre os componentes a partir da raiz do site,
        // não importa em qual subpasta a página atual esteja.
        const [headerHtml, sidebarHtml, footerHtml] = await Promise.all([
            headerPlaceholder ? loadComponent("/components/header.html") : Promise.resolve(null),
            sidebarPlaceholder ? loadComponent("/components/sidebar.html") : Promise.resolve(null),
            footerPlaceholder ? loadComponent("/components/footer.html") : Promise.resolve(null),
        ]);

        if (headerPlaceholder && headerHtml) {
            headerPlaceholder.innerHTML = headerHtml;
        }
        if (sidebarPlaceholder && sidebarHtml) {
            sidebarPlaceholder.innerHTML = sidebarHtml;
        }
        if (footerPlaceholder && footerHtml) {
            footerPlaceholder.innerHTML = footerHtml;
        }
        
        initializeGlobalScripts();
    }

    function initializeGlobalScripts() {
        const currentPage = window.location.pathname;
        const pagePath = currentPage.replace(/\/$/, "");
        
        const sessionToken = localStorage.getItem("sessionToken");
        const userName = localStorage.getItem("userName");

        if (!sessionToken || !userName) {
            if (document.querySelector(".app-layout-grid")) {
                window.location.href = "/login.html";
            }
            return;
        }

        // ==========================================
        // SISTEMA DE CONTROLE DE ACESSO (PERMISSÕES)
        // ==========================================
        const rawPerms = localStorage.getItem("userPermissoes");
        // Se a pessoa não tem permissões ainda (legado), array vazio:
        const permissoesArr = rawPerms ? JSON.parse(rawPerms) : []; 
        const isLegacyUser = !rawPerms; // Usuários velhos antes dessa feature terão passe livre por enquanto?
        
        // Mapeamento: "Caminho da URL/Módulo" => "Nome da Permissão no banco"
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
        
        // BLOQUEIO DE PÁGINA:
        // Verifica se a página atual requer permissão
        const permissaoNecessaria = roteamentoPermissoes[pagePath];
        if (!isLegacyUser && permissaoNecessaria) {
            if (!permissoesArr.includes("admin") && !permissoesArr.includes(permissaoNecessaria)) {
                // Usuário não tem o cargo/permissão para essa tela
                alert("Acesso Negado: Você não possui permissão para acessar este módulo.");
                window.location.href = "/dashboard.html"; // Redireciona para o início seguro
                return; // Para a execução do script
            }
        }

        // OCULTANDO LINKS DO MENU (SIDEBAR)
        const sidebarLinks = document.querySelectorAll(".sidebar-nav a");

        sidebarLinks.forEach(link => {
            const linkPathUrl = new URL(link.href).pathname.replace(/\/$/, ""); 
            const linkPermRequired = roteamentoPermissoes[linkPathUrl];

            // 1. Marca Ativo se for a página atual
            if (linkPathUrl === pagePath || (pagePath.endsWith('index.html') && linkPathUrl === '/dashboard.html') || (pagePath === '/' && linkPathUrl === '/dashboard.html')) {
                link.classList.add("active");
            }

            // 2. Esconde o link se o usuário não tem permissão para vê-lo
            if (!isLegacyUser && linkPermRequired) {
                if (!permissoesArr.includes("admin") && !permissoesArr.includes(linkPermRequired)) {
                    // Esconde o <li> inteiro, que é o pai do <a>
                    link.parentElement.style.display = "none";
                }
            }
        });
        
        const greetingEl = document.getElementById('user-greeting');
        if (greetingEl) greetingEl.textContent = `Olá, ${userName}!`;
    
        const logoutButton = document.getElementById('logout-button');
        if(logoutButton) logoutButton.addEventListener('click', () => {
            localStorage.clear();
            window.location.href = '/login.html';
        });

        checkAceiteTermos('EMPRESA', sessionToken);
    }

    async function checkAceiteTermos(type, token) {
        try {
            const checkRes = await fetch('/api/auth/aceite-termos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, type, action: 'check' })
            });
            const data = await checkRes.json();
            
            if (checkRes.ok && !data.ja_aceitou) {
                mostrarModalTermos(type, token);
            }
        } catch (e) { console.error("Erro check termos:", e); }
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