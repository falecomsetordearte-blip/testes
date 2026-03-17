document.addEventListener("DOMContentLoaded", () => {
    // Verificar autenticação
    const sessionToken = localStorage.getItem("sessionToken");
    if (!sessionToken) {
        window.location.href = "login.html";
        return;
    }

    // Gerenciar Tabs
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active de todos
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Adiciona no clicado
            btn.classList.add('active');
            document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
            
            // Recarrega os dados correspondentes
            if(btn.dataset.tab === 'usuarios') carregarUsuarios();
            if(btn.dataset.tab === 'cargos') carregarCargos();
        });
    });

    // Inicialização
    carregarCargos(); // Necessário logo de cara para preencher o <select> do modal de usuários
    carregarUsuarios();
});

// ==============================
// GESTÃO DE CARGOS (FUNÇÕES)
// ==============================
async function carregarCargos() {
    try {
        const response = await fetch('/api/admin/roles/list', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: localStorage.getItem("sessionToken") })
        });
        const data = await response.json();
        if(!response.ok) throw new Error(data.message);

        const tbody = document.getElementById('cargos-tbody');
        const selectCargo = document.getElementById('user_cargo');
        tbody.innerHTML = '';
        selectCargo.innerHTML = '<option value="">Selecione um cargo...</option>';

        if(data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Nenhum cargo cadastrado.</td></tr>';
            return;
        }

        data.forEach(cargo => {
            // Preenche tabela
            const permissoesArr = typeof cargo.permissoes === 'string' ? JSON.parse(cargo.permissoes) : cargo.permissoes;
            const badges = permissoesArr.map(p => `<span class="badge">${p}</span>`).join(' ');
            
            tbody.innerHTML += `
                <tr>
                    <td><strong>${cargo.nome}</strong></td>
                    <td>${badges || '<span class="badge badge-legacy">Sem acessos</span>'}</td>
                    <td><button class="btn-outline" onclick='editarCargo(${JSON.stringify(cargo)})'><i class="fa-solid fa-pen"></i></button></td>
                </tr>
            `;

            // Preenche select do formulário de usuários
            selectCargo.innerHTML += `<option value="${cargo.id}">${cargo.nome}</option>`;
        });

    } catch(err) {
        console.error("Erro cargos:", err);
    }
}

function abrirModalCargo() {
    document.getElementById('form-cargo').reset();
    document.getElementById('role_id').value = '';
    document.getElementById('modal-role-title').innerText = 'Novo Cargo';
    document.getElementById('modal-cargo').classList.add('active');
}

function editarCargo(cargo) {
    document.getElementById('form-cargo').reset();
    document.getElementById('role_id').value = cargo.id;
    document.getElementById('role_nome').value = cargo.nome;
    document.getElementById('modal-role-title').innerText = 'Editar Cargo';
    
    const permissoesArr = typeof cargo.permissoes === 'string' ? JSON.parse(cargo.permissoes) : cargo.permissoes;
    const checkboxes = document.querySelectorAll('input[name="perm"]');
    checkboxes.forEach(cb => {
        if(permissoesArr.includes(cb.value)) cb.checked = true;
    });

    document.getElementById('modal-cargo').classList.add('active');
}

async function salvarCargo() {
    const btn = document.querySelector('#modal-cargo .btn-primary');
    btn.disabled = true; btn.innerText = "Salvando...";

    const id = document.getElementById('role_id').value;
    const nome = document.getElementById('role_nome').value;
    
    const checkboxes = document.querySelectorAll('input[name="perm"]:checked');
    const permissoes = Array.from(checkboxes).map(cb => cb.value);

    try {
        const res = await fetch('/api/admin/roles/save', {
            method: 'POST', headers:{'Content-Type': 'application/json'},
            body: JSON.stringify({ token: localStorage.getItem('sessionToken'), id, nome, permissoes })
        });
        const data = await res.json();
        if(!res.ok) throw new Error(data.message);
        
        fecharModal('modal-cargo');
        carregarCargos();
    } catch(err) {
        alert("Erro ao salvar cargo: " + err.message);
    } finally {
        btn.disabled = false; btn.innerText = "Salvar Cargo";
    }
}

// ==============================
// GESTÃO DE USUÁRIOS
// ==============================
async function carregarUsuarios() {
    try {
        const response = await fetch('/api/admin/users/list', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: localStorage.getItem("sessionToken") })
        });
        const data = await response.json();
        if(!response.ok) throw new Error(data.message);

        const tbody = document.getElementById('usuarios-tbody');
        tbody.innerHTML = '';

        if(data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Nenhum usuário encontrado.</td></tr>';
            return;
        }

        data.forEach(user => {
            const statusBadge = user.ativo ? '<span style="color:green;font-weight:bold;">Ativo</span>' : '<span style="color:red;font-weight:bold;">Inativo</span>';
            const roleName = user.funcao ? user.funcao.nome : '<i>Sem Cargo</i>';
            tbody.innerHTML += `
                <tr>
                    <td><strong>${user.nome}</strong></td>
                    <td>${user.email}</td>
                    <td><span class="badge badge-legacy">${roleName}</span></td>
                    <td>${statusBadge}</td>
                    <td><button class="btn-outline" onclick='editarUsuario(${JSON.stringify(user)})'><i class="fa-solid fa-pen"></i> Editar</button></td>
                </tr>
            `;
        });
    } catch(err) {
        console.error("Erro usuarios:", err);
    }
}

function abrirModalUsuario() {
    document.getElementById('form-usuario').reset();
    document.getElementById('user_id').value = '';
    document.getElementById('user_senha').placeholder = "Senha obrigatória para novos cadastros";
    document.getElementById('modal-user-title').innerText = 'Novo Usuário';
    document.getElementById('modal-usuario').classList.add('active');
}

function editarUsuario(user) {
    document.getElementById('form-usuario').reset();
    document.getElementById('user_id').value = user.id;
    document.getElementById('user_nome').value = user.nome;
    document.getElementById('user_email').value = user.email;
    document.getElementById('user_cargo').value = user.funcao_id;
    
    document.getElementById('user_senha').placeholder = "Deixe em branco para não alterar";
    document.getElementById('modal-user-title').innerText = 'Editar Usuário';
    
    document.getElementById('modal-usuario').classList.add('active');
}

async function salvarUsuario() {
    const btn = document.querySelector('#modal-usuario .btn-primary');
    btn.disabled = true; btn.innerText = "Salvando...";

    const id = document.getElementById('user_id').value;
    const nome = document.getElementById('user_nome').value;
    const email = document.getElementById('user_email').value;
    const senha = document.getElementById('user_senha').value;
    const funcao_id = document.getElementById('user_cargo').value;

    if(!id && !senha) {
        alert("A senha é obrigatória para criar um novo usuário.");
        btn.disabled = false; btn.innerText = "Salvar Usuário";
        return;
    }

    try {
        const res = await fetch('/api/admin/users/save', {
            method: 'POST', headers:{'Content-Type': 'application/json'},
            body: JSON.stringify({ token: localStorage.getItem('sessionToken'), id, nome, email, senha, funcao_id })
        });
        const data = await res.json();
        if(!res.ok) throw new Error(data.message);
        
        fecharModal('modal-usuario');
        carregarUsuarios();
    } catch(err) {
        alert("Erro ao salvar usuário: " + err.message);
    } finally {
        btn.disabled = false; btn.innerText = "Salvar Usuário";
    }
}

// Utilidade
function fecharModal(idModal) {
    document.getElementById(idModal).classList.remove('active');
}
