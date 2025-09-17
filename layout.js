// /layout.js
document.addEventListener("DOMContentLoaded", async () => {
    // Função genérica para carregar um componente HTML (sem alterações, já estava boa)
    async function loadComponent(componentPath) {
        try {
            const response = await fetch(componentPath);
            if (!response.ok) {
                throw new Error(`Componente não encontrado: ${componentPath}`);
            }
            return await response.text();
        } catch (error) {
            console.error(error);
            return `<p style="color:red;">Erro ao carregar componente: ${componentPath}</p>`;
        }
    }

    // Função principal que monta o layout
    async function buildLayout() {
        // CORREÇÃO 1: Simplificamos os seletores para buscar apenas pelo ID, 
        // que é único e não depende da estrutura em volta.
        const headerPlaceholder = document.getElementById("header-placeholder");
        const sidebarPlaceholder = document.getElementById("sidebar-placeholder");
        const footerPlaceholder = document.getElementById("footer-placeholder");

        // CORREÇÃO 2: Removemos a pasta "/components" do caminho, 
        // já que seus arquivos estão na raiz.
        const [headerHtml, sidebarHtml, footerHtml] = await Promise.all([
            headerPlaceholder ? loadComponent("/header.html") : Promise.resolve(null),
            sidebarPlaceholder ? loadComponent("/sidebar.html") : Promise.resolve(null),
            footerPlaceholder ? loadComponent("/footer.html") : Promise.resolve(null),
        ]);

        // Aqui usamos 'innerHTML' para substituir o conteúdo DENTRO do placeholder.
        // O div placeholder continuará existindo, o que é mais consistente.
        if (headerPlaceholder && headerHtml) {
            headerPlaceholder.innerHTML = headerHtml;
        }
        if (sidebarPlaceholder && sidebarHtml) {
            sidebarPlaceholder.innerHTML = sidebarHtml;
        }
        if (footerPlaceholder && footerHtml) {
            footerPlaceholder.innerHTML = footerHtml;
        }
        
        // Após carregar os componentes, podemos inicializar funcionalidades globais
        initializeGlobalScripts();
    }

    function initializeGlobalScripts() {
        // Encontra o link da página atual e adiciona a classe 'active'
        const currentPage = window.location.pathname;
        const sidebarLinks = document.querySelectorAll(".sidebar-nav a");

        sidebarLinks.forEach(link => {
            // Garante que a comparação funcione mesmo com ou sem a barra final
            const linkPath = new URL(link.href).pathname.replace(/\/$/, ""); 
            const pagePath = currentPage.replace(/\/$/, "");

            if (linkPath === pagePath || (pagePath === "" && linkPath === "/dashboard.html")) {
                link.classList.add("active");
            }
        });
        
        // O restante do script de inicialização para login/logout parece correto.
        const sessionToken = localStorage.getItem("sessionToken");
        const userName = localStorage.getItem("userName");

        // Este if de redirecionamento estava com um seletor errado também
        if (!sessionToken || !userName) {
            if (document.querySelector(".app-layout-grid")) { // Usar uma classe que existe
                window.location.href = "/login.html";
            }
            return;
        }

        const greetingEl = document.getElementById('user-greeting');
        if (greetingEl) greetingEl.textContent = `Olá, ${userName}!`;
    
        const logoutButton = document.getElementById('logout-button');
        if(logoutButton) logoutButton.addEventListener('click', () => {
            localStorage.clear();
            window.location.href = '/login.html';
        });
    }

    // Executa a montagem do layout
    await buildLayout();
});