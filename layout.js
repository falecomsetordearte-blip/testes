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
    }

    await buildLayout();
});