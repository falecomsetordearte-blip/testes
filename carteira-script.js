// carteira-script.js

document.addEventListener('DOMContentLoaded', () => {
    console.log(">>> Carteira Script Iniciado");
    carregarDadosCarteira();
    configurarBotoes();
});

async function carregarDadosCarteira() {
    // Tenta pegar o token EXATAMENTE como o CRM faz, com fallback
    const token = localStorage.getItem('sessionToken') || localStorage.getItem('user_session_token');
    
    if(!token) {
        console.warn("Token não encontrado. Redirecionando para login.");
        return window.location.href = '/login.html';
    }

    const boxCredito = document.getElementById('credit-status-box');
    const btnCredito = document.getElementById('btn-solicitar-credito');

    try {
        const res = await fetch('/api/carteira/dados', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ sessionToken: token })
        });

        if(!res.ok) {
            if(res.status === 403) {
                 alert('Sessão expirada. Faça login novamente.');
                 return window.location.href = '/login.html';
            }
            throw new Error('Falha ao buscar dados da API');
        }
        
        const data = await res.json();
        console.log("Dados recebidos:", data);

        // Formatar Moeda
        const fmt = (v) => parseFloat(v||0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});

        // Preencher Cards
        document.getElementById('val-andamento').innerText = fmt(data.em_andamento);
        document.getElementById('val-pagar').innerText = fmt(data.a_pagar);

        // Lógica de Crédito
        if (data.credito_aprovado) {
            boxCredito.classList.remove('status-prepaid');
            boxCredito.classList.add('status-postpaid');
            document.getElementById('lbl-tipo-conta').innerText = 'Pós-paga (Crédito Aprovado)';
            document.getElementById('msg-credito').innerText = 'Você possui linha de crédito ativa. Faturamento mensal.';
            if(btnCredito) btnCredito.style.display = 'none'; 
        } else {
            if (data.solicitacao_pendente && btnCredito) {
                btnCredito.innerText = 'Solicitação em Análise';
                btnCredito.disabled = true;
            }
        }

        // Preencher Lista
        const lista = document.getElementById('lista-historico');
        lista.innerHTML = '';
        
        if (data.historico_recente && data.historico_recente.length === 0) {
            lista.innerHTML = '<li style="text-align:center; padding:20px; color:#94a3b8;">Nenhum pedido aprovado nos últimos 7 dias.</li>';
        } else if (data.historico_recente) {
            data.historico_recente.forEach(item => {
                const li = document.createElement('li');
                li.className = 'history-item';
                
                const dataFmt = new Date(item.data).toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'});
                
                li.innerHTML = `
                    <div>
                        <span class="h-title">${item.titulo || 'Pedido #' + item.deal_id}</span>
                        <span class="h-date">${dataFmt}</span>
                    </div>
                    <div class="h-value" style="color: #27ae60;">+ ${fmt(item.valor)}</div>
                `;
                lista.appendChild(li);
            });
        }

    } catch (err) {
        console.error("Erro Carteira:", err);
        const lista = document.getElementById('lista-historico');
        if(lista) lista.innerHTML = '<li style="color:red; text-align:center;">Erro de conexão. Tente recarregar.</li>';
    }
}

function configurarBotoes() {
    const btnCredito = document.getElementById('btn-solicitar-credito');
    if(btnCredito) {
        btnCredito.addEventListener('click', async () => {
            if(!confirm('Deseja solicitar análise de crédito para pagamento faturado?')) return;
            // Aqui futuramente você pode chamar a API real de solicitação
            alert('Solicitação recebida! Em breve nosso financeiro entrará em contato.');
            btnCredito.innerText = "Enviado";
            btnCredito.disabled = true;
        });
    }
}