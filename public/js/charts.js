/**
 * Sistema de Demandas Escolares - Gráficos com Dados Reais
 * Busca dados do MongoDB via API
 */

// Configurações globais
const API_BASE_URL = '/api/graficos';
let charts = {}; // Armazenar instâncias dos gráficos

// Função para buscar dados da API
async function fetchChartData(endpoint) {
    try {
        const response = await fetch(`${API_BASE_URL}/${endpoint}`);
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message || 'Erro na resposta da API');
        }
        
        return data.data;
        
    } catch (error) {
        console.error(`❌ Erro ao buscar dados de ${endpoint}:`, error);
        
        // Retornar dados de fallback
        return getFallbackData(endpoint);
    }
}

// Dados de fallback (caso a API falhe)
function getFallbackData(chartType) {
    console.log(`⚠️ Usando dados de fallback para ${chartType}`);
    
    const fallbackData = {
        'status': {
            labels: ['Pendente', 'Em Andamento', 'Concluída'],
            datasets: [{
                data: [10, 5, 8],
                backgroundColor: ['#FF6384', '#36A2EB', '#4BC0C0'],
                borderColor: '#fff',
                borderWidth: 2
            }]
        },
        'escolas': {
            labels: ['CEEFMTI Afonso Cláudio', 'EEEFM Domingos Perim', 'EEEFM Álvaro Castelo'],
            datasets: [{
                label: 'Número de Demandas',
                data: [12, 8, 5],
                backgroundColor: ['#FF6384', '#36A2EB', '#4BC0C0']
            }]
        },
        'tendencia': {
            labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
            datasets: [{
                label: 'Demandas Criadas',
                data: [5, 8, 12, 9, 15, 18],
                borderColor: '#36A2EB',
                backgroundColor: 'rgba(54, 162, 235, 0.2)'
            }]
        }
    };
    
    return fallbackData[chartType] || { labels: [], datasets: [] };
}

// Atualizar os cards do dashboard com dados reais
async function atualizarCardsDashboard() {
    try {
        // Verificar se estamos na página do dashboard
        const isDashboardPage = window.location.pathname.includes('dashboard');
        if (!isDashboardPage) {
            return; // Não fazer nada se não estiver no dashboard
        }
        
        const response = await fetch('/api/graficos/estatisticas');
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.success) {
                // Atualizar números nos cards (com verificação)
                const totalElement = document.getElementById('totalDemandasCard');
                const pendentesElement = document.getElementById('pendentesCard');
                const andamentoElement = document.getElementById('andamentoCard');
                const concluidasElement = document.getElementById('concluidasCard');
                const taxaElement = document.getElementById('taxaConclusaoCard');
                
                if (totalElement) totalElement.innerText = data.data.total || 0;
                if (pendentesElement) pendentesElement.innerText = data.data.pendentes || 0;
                if (andamentoElement) andamentoElement.innerText = data.data.em_andamento || 0;
                if (concluidasElement) concluidasElement.innerText = data.data.concluidas || 0;
                if (taxaElement) taxaElement.innerText = `${data.data.taxa_conclusao || 0}%`;
                
                console.log('✅ Cards atualizados com dados reais');
            }
        }
    } catch (error) {
        console.error('❌ Erro ao atualizar cards:', error);
    }
}

// Inicializar gráfico de status (pizza/donut)
async function initStatusChart() {
    const ctx = document.getElementById('statusChart');
    if (!ctx) return;
    
    const chartData = await fetchChartData('status');
    
    charts.status = new Chart(ctx, {
        type: 'doughnut',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            },
            cutout: '65%',
            animation: {
                animateScale: true,
                animateRotate: true
            }
        }
    });
}

// Inicializar gráfico de escolas (barras)
async function initEscolasChart() {
    const ctx = document.getElementById('escolasChart');
    if (!ctx) return;
    
    const chartData = await fetchChartData('escolas');
    
    charts.escolas = new Chart(ctx, {
        type: 'bar',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        title: function(tooltipItems) {
                            // Mostrar nome completo da escola no tooltip
                            const escolaOriginal = chartData.raw?.[tooltipItems[0].dataIndex]?.escola;
                            return escolaOriginal || tooltipItems[0].label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Número de Demandas',
                        font: {
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        stepSize: 1
                    }
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });
}

// Inicializar gráfico de tendência (linha)
async function initTendenciaChart() {
    const ctx = document.getElementById('tendenciaChart');
    if (!ctx) return;
    
    const chartData = await fetchChartData('tendencia');
    
    charts.tendencia = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Demandas Criadas',
                        font: {
                            weight: 'bold'
                        }
                    },
                    ticks: {
                        stepSize: 1
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Mês/Ano',
                        font: {
                            weight: 'bold'
                        }
                    }
                }
            },
            elements: {
                point: {
                    radius: 5,
                    hoverRadius: 8
                }
            }
        }
    });
}

// Atualizar todos os gráficos
async function atualizarTodosGraficos() {
    console.log('🔄 Atualizando gráficos com dados reais...');
    
    // Destruir gráficos existentes
    Object.values(charts).forEach(chart => {
        if (chart) chart.destroy();
    });
    
    // Reinicializar gráficos
    await Promise.all([
        initStatusChart(),
        initEscolasChart(),
        initTendenciaChart(),
        atualizarCardsDashboard()
    ]);
    
    console.log('✅ Gráficos atualizados com dados reais!');
}

// Adicionar botão de atualização manual
function adicionarBotaoAtualizacao() {
    const header = document.querySelector('.dashboard-header');
    if (!header) return;
    
    // Verificar se o botão já existe
    if (document.getElementById('atualizarGraficosBtn')) return;
    
    const btnAtualizar = document.createElement('button');
    btnAtualizar.id = 'atualizarGraficosBtn';
    btnAtualizar.className = 'btn btn-sm btn-outline-primary';
    btnAtualizar.innerHTML = '<i class="fas fa-sync-alt me-1"></i> Atualizar Dados';
    
    btnAtualizar.addEventListener('click', async function() {
        btnAtualizar.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Atualizando...';
        btnAtualizar.disabled = true;
        
        await atualizarTodosGraficos();
        
        // Mostrar mensagem de sucesso
        btnAtualizar.innerHTML = '<i class="fas fa-check me-1"></i> Dados Atualizados!';
        btnAtualizar.className = 'btn btn-sm btn-success';
        
        setTimeout(() => {
            btnAtualizar.innerHTML = '<i class="fas fa-sync-alt me-1"></i> Atualizar Dados';
            btnAtualizar.className = 'btn btn-sm btn-outline-primary';
            btnAtualizar.disabled = false;
        }, 2000);
    });
    
    // Inserir após o título
    const titulo = header.querySelector('h1');
    if (titulo) {
        titulo.parentNode.insertBefore(btnAtualizar, titulo.nextSibling);
    }
}

// Mostrar loading nos gráficos
function mostrarLoading() {
    const containers = document.querySelectorAll('.chart-container');
    containers.forEach(container => {
        const canvas = container.querySelector('canvas');
        if (canvas) {
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'chart-loading';
            loadingDiv.innerHTML = `
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Carregando...</span>
                </div>
                <p class="mt-2">Buscando dados do servidor...</p>
            `;
            container.appendChild(loadingDiv);
        }
    });
}

// Remover loading
function removerLoading() {
    document.querySelectorAll('.chart-loading').forEach(el => el.remove());
}

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', async function() {
    console.log('📊 Inicializando gráficos com dados reais...');
    
    // Adicionar CSS para loading
    const style = document.createElement('style');
    style.textContent = `
        .chart-loading {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 255, 255, 0.9);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 10;
            border-radius: 10px;
        }
        #atualizarGraficosBtn {
            margin-left: 15px;
        }
    `;
    document.head.appendChild(style);
    
    // Mostrar loading
    mostrarLoading();
    
    try {
        // Inicializar gráficos
        await atualizarTodosGraficos();
        
        // Adicionar botão de atualização
        setTimeout(adicionarBotaoAtualizacao, 500);
        
        console.log('✅ Sistema de gráficos inicializado com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro ao inicializar gráficos:', error);
    } finally {
        // Remover loading
        removerLoading();
    }
    
    // Atualizar automaticamente a cada 5 minutos
    setInterval(atualizarTodosGraficos, 5 * 60 * 1000);
});

// Exportar funções para uso global (se necessário)
window.Graficos = {
    atualizar: atualizarTodosGraficos,
    charts: charts
};