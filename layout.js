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
        const sidebarLinks = document.querySelectorAll(".sidebar-nav a");

        sidebarLinks.forEach(link => {
            const linkPath = new URL(link.href).pathname.replace(/\/$/, ""); 
            const pagePath = currentPage.replace(/\/$/, "");

            if (linkPath === pagePath || (pagePath.endsWith('index.html') && linkPath === '/dashboard.html') || (pagePath === '/' && linkPath === '/dashboard.html')) {
                link.classList.add("active");
            }
        });
        
        const sessionToken = localStorage.getItem("sessionToken");
        const userName = localStorage.getItem("userName");

        if (!sessionToken || !userName) {
            if (document.querySelector(".app-layout-grid")) {
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

    await buildLayout();
});