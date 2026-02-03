// produtos.js

let produtoAtual = {}; // Armazena estado temporário

document.addEventListener('DOMContentLoaded', () => {
    const sessionToken = localStorage.getItem('sessionToken');
    if (!sessionToken) { window.location.href = '/login.html'; return; }
    
    injectCleanStyles(); // Mesma função do CRM para toasts
    listarProdutos();
    selectPriceMode('UNIDADE'); // Default
});

// --- LISTAGEM ---
async function listarProdutos() {
    const container = document.getElementById('products-container');
    container.innerHTML = '';
    
    try {
        const res = await fetch('/api/products/listProducts', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ sessionToken: localStorage.getItem('sessionToken') })
        });
        const produtos = await res.json();
        
        document.getElementById('loading-list').style.display = 'none';
        
        if(produtos.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:40px; color:#aaa;">Nenhum produto cadastrado.</div>';
            return;
        }

        produtos.forEach(p => {
            const div = document.createElement('div');
            div.className = 'product-list-item';
            
            let precoDisplay = '';
            if(p.tipo_calculo === 'FAIXA') precoDisplay = '<span style="color:#e67e22; font-size:0.8rem; font-weight:600;">TABELA DE ATACADO</span>';
            else precoDisplay = `R$ ${parseFloat(p.preco_base).toFixed(2)} <span style="font-size:0.8rem; color:#aaa;">/${p.tipo_calculo.toLowerCase()}</span>`;

            div.innerHTML = `
                <div>
                    <div style="font-weight:700; color:#2c3e50; font-size:1.1rem;">${p.nome}</div>
                    <div style="font-size:0.85rem; color:#888;"><i class="far fa-clock"></i> ${p.prazo_producao || 'Sem prazo'}</div>
                </div>
                <div style="text-align:right;">
                    <div style="margin-bottom:5px;">${precoDisplay}</div>
                    <button onclick="editarProduto(${p.id})" style="border:1px solid #ddd; background:white; cursor:pointer; padding:5px 10px; border-radius:4px;"><i class="fas fa-edit"></i></button>
                    <button onclick="deletarProduto(${p.id})" style="border:1px solid #fee2e2; background:#fee2e2; color:#e74c3c; cursor:pointer; padding:5px 10px; border-radius:4px;"><i class="fas fa-trash"></i></button>
                </div>
            `;
            container.appendChild(div);
        });

    } catch(err) {
        console.error(err);
        showToast('Erro ao listar produtos.', 'error');
    }
}

// --- NAVEGAÇÃO UI ---
window.novoProduto = function() {
    document.getElementById('lista-produtos-view').classList.add('hidden');
    document.getElementById('cadastro-produto-view').classList.remove('hidden');
    document.getElementById('form-produto').reset();
    document.getElementById('prod-id').value = '';
    document.getElementById('variacoes-container').innerHTML = '';
    document.getElementById('faixas-container').innerHTML = '';
    selectPriceMode('UNIDADE');
}

window.cancelarEdicao = function() {
    document.getElementById('cadastro-produto-view').classList.add('hidden');
    document.getElementById('lista-produtos-view').classList.remove('hidden');
}

window.switchTab = function(tabName) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById(`tab-${tabName}`).classList.add('active');
    // Encontrar botão e ativar (logica simples baseada no onclick)
    event.currentTarget.classList.add('active');
}

window.selectPriceMode = function(mode) {
    document.querySelectorAll('.price-mode-card').forEach(c => c.classList.remove('selected'));
    document.getElementById(`mode-${mode.toLowerCase()}`).classList.add('selected');
    document.getElementById('prod-tipo-calculo').value = mode;

    const inputBase = document.getElementById('input-preco-base');
    const inputFaixa = document.getElementById('input-tabela-faixas');
    const labelBase = document.getElementById('label-preco-base');

    if(mode === 'FAIXA') {
        inputBase.classList.add('hidden');
        inputFaixa.classList.remove('hidden');
    } else {
        inputBase.classList.remove('hidden');
        inputFaixa.classList.add('hidden');
        if(mode === 'METRO') labelBase.innerText = 'Preço por m² (R$)';
        else labelBase.innerText = 'Preço Unitário (R$)';
    }
}

// --- LÓGICA DE VARIAÇÕES (DINÂMICA) ---
window.addVariacao = function(nome = '', opcoes = []) {
    const container = document.getElementById('variacoes-container');
    const idUnico = Date.now();
    
    const div = document.createElement('div');
    div.className = 'card-variacao';
    div.dataset.id = idUnico;
    
    let htmlOpcoes = '';
    
    div.innerHTML = `
        <div class="card-variacao-header">
            <input type="text" class="form-control var-nome" placeholder="Nome da Variação (Ex: Acabamento)" value="${nome}" style="font-weight:bold; border:none; background:transparent; border-bottom:1px solid #ccc; width:70%;">
            <button type="button" onclick="this.parentElement.parentElement.remove()" style="color:#e74c3c; background:none; border:none; cursor:pointer;"><i class="fas fa-trash"></i></button>
        </div>
        <div class="opcoes-list"></div>
        <button type="button" onclick="addOpcao(this)" style="font-size:0.8rem; color:#3498db; background:none; border:none; cursor:pointer; margin-top:10px;">+ Adicionar Opção</button>
    `;
    container.appendChild(div);

    // Se vier com dados (Edição), popula as opções
    if(opcoes.length > 0) {
        opcoes.forEach(op => addOpcao(div.querySelector('button[onclick*="addOpcao"]'), op.nome, op.preco_adicional));
    } else {
        // Adiciona uma vazia por padrão
        addOpcao(div.querySelector('button[onclick*="addOpcao"]'));
    }
}

window.addOpcao = function(btnElement, nome = '', preco = 0) {
    const container = btnElement.previousElementSibling; // .opcoes-list
    const row = document.createElement('div');
    row.className = 'grid-opcoes';
    row.innerHTML = `
        <input type="text" class="form-control op-nome" placeholder="Opção (Ex: Fosco)" value="${nome}">
        <input type="number" class="form-control op-preco" placeholder="+ R$" step="0.01" value="${preco}">
        <button type="button" onclick="this.parentElement.remove()" style="color:#ccc; background:none; border:none; cursor:pointer;"><i class="fas fa-times"></i></button>
    `;
    container.appendChild(row);
}

// --- LÓGICA DE FAIXAS DE PREÇO ---
window.addFaixa = function(min = '', max = '', val = '') {
    const container = document.getElementById('faixas-container');
    const row = document.createElement('div');
    row.style.display = 'grid'; 
    row.style.gridTemplateColumns = '1fr 1fr 1fr 30px'; 
    row.style.gap = '10px';
    row.style.marginBottom = '5px';
    
    row.innerHTML = `
        <input type="number" class="form-control f-min" placeholder="De (Qtd)" value="${min}">
        <input type="number" class="form-control f-max" placeholder="Até (Qtd)" value="${max}">
        <input type="number" class="form-control f-val" placeholder="R$ Unit." value="${val}">
        <button type="button" onclick="this.parentElement.remove()" style="color:#e74c3c; border:none; background:none; cursor:pointer;">x</button>
    `;
    container.appendChild(row);
}

// --- SALVAR ---
document.getElementById('form-produto').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const txtOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    btn.disabled = true;

    try {
        // Montar Objeto
        const produto = {
            id: document.getElementById('prod-id').value,
            nome: document.getElementById('prod-nome').value,
            prazo: document.getElementById('prod-prazo').value,
            tipo_calculo: document.getElementById('prod-tipo-calculo').value,
            preco_base: document.getElementById('prod-preco-base').value || 0,
            
            // Coletar Variações
            variacoes: Array.from(document.querySelectorAll('.card-variacao')).map(card => ({
                nome: card.querySelector('.var-nome').value,
                opcoes: Array.from(card.querySelectorAll('.grid-opcoes')).map(row => ({
                    nome: row.querySelector('.op-nome').value,
                    preco_adicional: row.querySelector('.op-preco').value || 0
                })).filter(o => o.nome.trim() !== '') // Remove vazias
            })).filter(v => v.nome.trim() !== ''),

            // Coletar Faixas
            faixas: Array.from(document.querySelectorAll('#faixas-container > div')).map(row => ({
                minimo: row.querySelector('.f-min').value || 0,
                maximo: row.querySelector('.f-max').value || null,
                valor: row.querySelector('.f-val').value || 0
            }))
        };

        const res = await fetch('/api/products/saveProduct', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({
                sessionToken: localStorage.getItem('sessionToken'),
                product: produto
            })
        });
        
        const data = await res.json();
        if(data.success) {
            showToast('Produto salvo com sucesso!', 'success');
            listarProdutos();
            window.cancelarEdicao();
        } else {
            throw new Error(data.message);
        }

    } catch(err) {
        showToast('Erro ao salvar: ' + err.message, 'error');
    } finally {
        btn.innerHTML = txtOriginal;
        btn.disabled = false;
    }
});

// --- EDITAR E DELETAR ---
window.editarProduto = async function(id) {
    try {
        // Reutilizar listagem ou criar endpoint getProduct. Para simplificar, vou filtrar do DOM ou criar endpoint rapido getProductDetails.
        // O ideal é ter um endpoint /api/products/getProductDetails. Vou assumir que você criará um endpoint simples ou usar list e filtrar (mas list não traz tudo nested).
        // Vamos criar a lógica de fetch detalhes.
        const res = await fetch('/api/products/getProduct', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ sessionToken: localStorage.getItem('sessionToken'), id: id })
        });
        const prod = await res.json();
        if(!prod) return;

        window.novoProduto(); // Reseta form e mostra view
        
        document.getElementById('prod-id').value = prod.id;
        document.getElementById('prod-nome').value = prod.nome;
        document.getElementById('prod-prazo').value = prod.prazo_producao;
        selectPriceMode(prod.tipo_calculo);
        document.getElementById('prod-preco-base').value = prod.preco_base;

        // Popula Variações
        if(prod.variacoes) {
            prod.variacoes.forEach(v => addVariacao(v.nome, v.opcoes));
        }

        // Popula Faixas
        if(prod.faixas_preco) {
            prod.faixas_preco.forEach(f => addFaixa(f.minimo, f.maximo, f.valor_unitario));
        }

    } catch(err) {
        showToast('Erro ao carregar produto', 'error');
    }
}

window.deletarProduto = async function(id) {
    if(!confirm("Tem certeza que deseja excluir este produto?")) return;
    try {
        await fetch('/api/products/deleteProduct', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ sessionToken: localStorage.getItem('sessionToken'), id: id })
        });
        showToast('Excluído.', 'success');
        listarProdutos();
    } catch(e) { showToast('Erro ao excluir', 'error'); }
}

// Helpers Visuais
function showToast(msg, type) {
    const container = document.querySelector('.toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}
function injectCleanStyles() { const style = document.createElement('style'); style.textContent = `.toast-message a { color: #e74c3c; font-weight: bold; text-decoration: underline; cursor: pointer; }`; document.head.appendChild(style); }