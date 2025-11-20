// layout.js - Gerencia o carregamento de componentes e a lógica global (Busca, Logout, User)
document.addEventListener("DOMContentLoaded", async () => {
// 1. Carregar a Sidebar
await loadComponent("sidebar-placeholder", "/components/sidebar.html");
code
Code
// 2. Carregar o Header
await loadComponent("header-placeholder", "/components/header.html");

// 3. Após carregar o Header, inicializa as funções de usuário
initializeUserHeader();
});
// Função genérica para carregar HTML externo
async function loadComponent(placeholderId, filePath) {
const placeholder = document.getElementById(placeholderId);
if (!placeholder) return;
code
Code
try {
    const response = await fetch(filePath);
    if (response.ok) {
        const html = await response.text();
        placeholder.innerHTML = html;
    } else {
        console.error(`Erro ao carregar ${filePath}: ${response.status}`);
    }
} catch (error) {
    console.error(`Erro na requisição de ${filePath}:`, error);
}
}
// Inicializa dados do usuário e botão de sair
function initializeUserHeader() {
// Exibir nome do usuário
const userName = localStorage.getItem("userName"); // ou onde você guarda o nome
const greetingElement = document.getElementById("user-greeting");
code
Code
if (greetingElement && userName) {
    // Pega apenas o primeiro nome
    const firstName = userName.split(' ')[0];
    greetingElement.textContent = `Olá, ${firstName}!`;
}

// Configurar Logout
const logoutBtn = document.getElementById("logout-button");
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        localStorage.clear();
        window.location.href = "/login.html"; // Ajuste para sua página de login
    });
}
}
// ============================================================
// LÓGICA DA BUSCA NO HEADER (GLOBAL)
// ============================================================
// Função para fechar o modal
window.fecharModalBusca = function() {
const modal = document.getElementById('search-results-modal');
if (modal) {
modal.style.display = 'none';
}
};
// Função principal da busca
window.executarBuscaHeader = async function() {
const input = document.getElementById('header-search-input');
code
Code
// Se o header ainda não carregou ou input não existe
if (!input) return;

const query = input.value.trim();

// Não busca se estiver vazio
if (!query) return;

const modal = document.getElementById('search-results-modal');
const list = document.getElementById('results-list');

// Recupera o token de sessão
const sessionToken = localStorage.getItem('sessionToken') || localStorage.getItem('token');

if (!sessionToken) {
    alert("Sessão expirada. Por favor, faça login novamente.");
    window.location.href = "/login.html";
    return;
}

// Mostra o modal e o status de carregando
if (modal) modal.style.display = 'flex';
if (list) list.innerHTML = '<p style="text-align:center; padding: 20px; color:#666;">Buscando no sistema...</p>';

try {
    // Chamada à API Serverless
    const response = await fetch('/api/searchDeal', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ 
            sessionToken: sessionToken, 
            query: query 
        })
    });

    if (!response.ok) {
        throw new Error(`Erro API: ${response.status}`);
    }

    const data = await response.json();

    if (list) {
        list.innerHTML = ''; // Limpa o 'Buscando...'

        if (data.results && data.results.length > 0) {
            // Itera sobre os resultados encontrados
            data.results.forEach(deal => {
                // Formatação da data (se existir)
                const dataCriacao = deal.data ? new Date(deal.data).toLocaleDateString('pt-BR') : '-';
                
                const item = document.createElement('div');
                item.className = 'result-item';
                
                // AÇÃO AO CLICAR NO RESULTADO
                item.onclick = () => {
                    // ---> ATENÇÃO: Ajuste este link para onde você quer ir <---
                    // Exemplo: Vai para painel.html passando o ID na URL
                    window.location.href = `/painel.html?dealId=${deal.id}`; 
                    
                    // Fecha o modal
                    window.fecharModalBusca();
                };

                // HTML do item da lista
                item.innerHTML = `
                    <div class="result-info">
                        <h4>#${deal.id} - ${deal.titulo}</h4>
                        <p>Criado em: ${dataCriacao}</p>
                    </div>
                    <div class="stage-badge">
                        ${deal.fase}
                    </div>
                `;
                list.appendChild(item);
            });
        } else {
            list.innerHTML = '<p style="text-align:center; padding: 30px; color:#888;">Nenhum pedido encontrado.</p>';
        }
    }

} catch (error) {
    console.error("Erro na busca:", error);
    if (list) {
        list.innerHTML = '<p style="text-align:center; padding: 20px; color:#d9534f;">Ocorreu um erro ao buscar. Tente novamente.</p>';
    }
}
};
// Fecha o modal se clicar fora da área branca (no fundo escuro)
window.addEventListener('click', function(event) {
const modal = document.getElementById('search-results-modal');
if (modal && event.target === modal) {
window.fecharModalBusca();
}
});