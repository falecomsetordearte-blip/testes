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
            return `<p style="color:red;">Erro ao carregar componente: ${componentPath}</p>`;
        }
    }

    // Função principal que monta o layout
    async function buildLayout() {
        const headerPlaceholder = document.querySelector("body > #header-placeholder");
        const sidebarPlaceholder = document.querySelector(".app-wrapper > #sidebar-placeholder");
        const footerPlaceholder = document.querySelector("body > #footer-placeholder");

        // Carrega e injeta os componentes em paralelo
        const [headerHtml, sidebarHtml, footerHtml] = await Promise.all([
            headerPlaceholder ? loadComponent("/components/header.html") : Promise.resolve(null),
            sidebarPlaceholder ? loadComponent("/components/sidebar.html") : Promise.resolve(null),
            footerPlaceholder ? loadComponent("/components/footer.html") : Promise.resolve(null),
        ]);

        if (headerPlaceholder && headerHtml) {
            headerPlaceholder.outerHTML = headerHtml;
        }
        if (sidebarPlaceholder && sidebarHtml) {
            sidebarPlaceholder.outerHTML = sidebarHtml;
        }
        if (footerPlaceholder && footerHtml) {
            footerPlaceholder.outerHTML = footerHtml;
        }
        
        // Após carregar os componentes, podemos inicializar funcionalidades globais
        initializeGlobalScripts();
    }

    function initializeGlobalScripts() {
        // Encontra o link da página atual e adiciona a classe 'active'
        const currentPage = window.location.pathname;
        const sidebarLinks = document.querySelectorAll(".sidebar-nav a");
        sidebarLinks.forEach(link => {
            const linkPath = new URL(link.href).pathname;
            if (linkPath === currentPage) {
                link.classList.add("active");
            }
        });
        
        // Re-inicializa a lógica de saudação e logout que agora está no header
        const sessionToken = localStorage.getItem("sessionToken");
        const userName = localStorage.getItem("userName");

        if (!sessionToken || !userName) {
            // Se estiver em uma página protegida e não houver token, redireciona
            if (document.querySelector(".app-wrapper")) {
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