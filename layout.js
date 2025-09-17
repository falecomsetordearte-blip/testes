// /layout.js
document.addEventListener("DOMContentLoaded", async () => {
    // Função genérica para carregar um componente HTML
    async function loadComponent(componentPath) {
        try {
            const response = await fetch(componentPath);
            if (!response.ok) {
                // Se a resposta falhar, o erro será capturado pelo .catch()
                throw new Error(`Componente não encontrado: ${componentPath}`);
            }
            return await response.text();
        } catch (error) {
            console.error(error);
            // Esta é a linha que está mostrando a mensagem vermelha na sua tela
            return `<p style="color:red; font-family: monospace; padding: 10px;">Erro ao carregar componente: ${componentPath}</p>`;
        }
    }

    // Função principal que monta o layout
    async function buildLayout() {
        const headerPlaceholder = document.getElementById("header-placeholder");
        const sidebarPlaceholder = document.getElementById("sidebar-placeholder");
        const footerPlaceholder = document.getElementById("footer-placeholder");

        // ===== A ÚNICA MUDANÇA É AQUI =====
        // Trocamos os caminhos de "/arquivo.html" para "./arquivo.html"
        const [headerHtml, sidebarHtml, footerHtml] = await Promise.all([
            headerPlaceholder ? loadComponent("./header.html") : Promise.resolve(null),
            sidebarPlaceholder ? loadComponent("./sidebar.html") : Promise.resolve(null),
            footerPlaceholder ? loadComponent("./footer.html") : Promise.resolve(null),
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

            if (linkPath === pagePath || (pagePath === "" && linkPath === "/dashboard.html")) {
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