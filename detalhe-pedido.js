// /detalhe-pedido.js - VERSÃO SIMPLIFICADA

(function() {
    document.addEventListener('DOMContentLoaded', () => {
        
        try {
            const sessionToken = localStorage.getItem('sessionToken');
            const userName = localStorage.getItem('userName');
            const urlParams = new URLSearchParams(window.location.search);
            const pedidoId = urlParams.get('id');

            // --- ELEMENTOS DO DOM ---
            const tituloEl = document.getElementById('pedido-titulo-detalhe');
            const valorEl = document.getElementById('info-valor');
            const clienteEl = document.getElementById('info-cliente');
            const idEl = document.getElementById('info-id');
            const statusEl = document.getElementById('pedido-status-detalhe');
            const btnVerAtendimento = document.getElementById('btn-ver-atendimento');
            const arquivosBox = document.getElementById('arquivos-box');

            // --- VERIFICAÇÃO DE LOGIN E ID DO PEDIDO ---
            if (!sessionToken) {
                window.location.href = 'login';
                return;
            }
            if (!pedidoId) {
                tituloEl.textContent = 'Erro: ID do pedido não fornecido.';
                return;
            }
            
            // --- INICIALIZAÇÃO DA PÁGINA ---
            document.getElementById('user-greeting').textContent = `Olá, ${userName}!`;
            document.getElementById('logout-button').addEventListener('click', () => {
                localStorage.clear();
                window.location.href = 'login';
            });

            // --- FUNÇÃO PRINCIPAL PARA BUSCAR E EXIBIR OS DADOS ---
            async function carregarDetalhesPedido() {
                try {
                    const response = await fetch('/api/getDealDetails', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sessionToken: sessionToken, dealId: pedidoId })
                    });

                    const data = await response.json();
                    if (!response.ok) {
                        throw new Error(data.message || 'Erro ao buscar dados.');
                    }
                    
                    const pedido = data.pedido;

                    // Preenche os elementos do HTML com os dados recebidos
                    tituloEl.textContent = `Pedido #${pedido.ID}: ${pedido.TITLE}`;
                    idEl.textContent = `#${pedido.ID}`;
                    valorEl.textContent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pedido.OPPORTUNITY);
                    clienteEl.textContent = pedido.NOME_CLIENTE_FINAL || 'Não informado';

                    // Define o link do botão "Ver Atendimento"
                    if (btnVerAtendimento && pedido.LINK_ATENDIMENTO) {
                        btnVerAtendimento.href = pedido.LINK_ATENDIMENTO;
                        btnVerAtendimento.target = '_blank';
                        btnVerAtendimento.classList.remove('disabled');
                    }

                   // Define o status visual (Lógica completa e unificada)
                    let statusInfo = { texto: 'Desconhecido', classe: '' };
                    const stageId = pedido.STAGE_ID || "";

                    if (stageId.includes("NEW")) {
                        statusInfo = { texto: 'Aguardando Pagamento', classe: 'status-pagamento' };
                    } else if (stageId.includes("LOSE")) {
                        statusInfo = { texto: 'Cancelado', classe: 'status-cancelado' };
                    } else if (stageId === "C17:UC_2OEE24") {
                        statusInfo = { texto: 'Em Análise', classe: 'status-analise' };
                    } else if ((stageId.includes("WON") && stageId !== "C17:WON") || stageId === "C17:1") {
                        statusInfo = { texto: "Aprovado", classe: "status-aprovado" };
                    } else if (stageId === "C17:WON" || stageId.includes("C19")) {
                        statusInfo = { texto: "Verificado", classe: "status-verificado" };
                    } else {
                        statusInfo = { texto: 'Em Andamento', classe: 'status-andamento' };
                    }
                    
                    statusEl.innerHTML = `<span class="status-badge ${statusInfo.classe}">${statusInfo.texto}</span>`;
                    // Lógica para exibir o botão de download
                    const stageId = pedido.STAGE_ID || "";
                    const linkDownload = pedido.LINK_ARQUIVO_FINAL;
                    const isFinalizado = (stageId.includes("WON") || stageId === "C17:1" || stageId.includes("C19"));

                    if (isFinalizado) {
                        if (linkDownload) {
                            arquivosBox.innerHTML = `<a href="${linkDownload}" target="_blank" class="btn-acao btn-download">Baixar Arquivo Final</a>`;
                        } else {
                            arquivosBox.innerHTML = `<p class="info-text">O arquivo final ainda não foi disponibilizado.</p>`;
                        }
                    } else {
                        arquivosBox.innerHTML = `<p class="info-text">O arquivo para download estará disponível aqui quando o pedido for finalizado.</p>`;
                    }

                } catch (error) {
                    console.error("Falha ao carregar detalhes do pedido:", error);
                    document.getElementById("detalhes-wrapper").innerHTML = `<h1>Erro ao carregar dados</h1><p>${error.message}</p>`;
                }
            }

            // Executa a função principal para carregar os dados
            carregarDetalhesPedido();

        } catch (e) {
            console.error("Ocorreu um erro inesperado no script de detalhe do pedido:", e);
        }
    });
})();





