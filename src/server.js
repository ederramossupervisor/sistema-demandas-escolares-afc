// src/server.js - VERSÃO COMPLETA E FUNCIONAL
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
// ============================================
// NOVAS IMPORTAÇÕES PARA NOTIFICAÇÕES PUSH
// ============================================
const http = require('http');
const socketIo = require('socket.io');
// 🔔 Sistema de Regras de Notificação
const NotificationSystem = require('./models/notification-rules');
// 🔔 Sistema de Agendamento Automático
const AgendadorNotificacoes = require('./models/scheduler');
const bcrypt = require('bcrypt');
// Adicione esta linha junto com os outros requires no topo:
const SolicitacaoCadastro = require('./models/SolicitacaoCadastro');

// ========== IMPORTAR SISTEMA DE BACKUP ==========
const backupRoutes = require('./backup/backup-routes');
const BackupScheduler = require('./backup/backup-scheduler');

// ============================================
// 1. CARREGAR .env
// ============================================
require('dotenv').config();
//const expressLayouts = require('express-ejs-layouts');

// ============================================
// 2. CONFIGURAÇÃO DO EXPRESS + SOCKET.IO
// ============================================
const app = express();
const server = http.createServer(app);  // SERVIDOR HTTP PARA SOCKET.IO
const io = socketIo(server);            // INSTÂNCIA DO SOCKET.IO
const PORT = process.env.PORT || 3000;
// Importar o módulo User (evita erro "Cannot overwrite model")
const UserModule = require('./models/User');
const Demanda = require('./models/Demanda');
// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
// Middleware de autenticação via sessão (WEB)
const sessionAuth = require('./middleware/sessionAuth');

// Middleware de verificação de primeiro acesso
const checkFirstAccess = require('./middleware/checkFirstAccess');

// Middleware de autenticação JWT (API - já deve existir)
const { auth } = require('./middleware/auth');
// Configurar sessões
app.use(session({
    secret: process.env.SESSION_SECRET || 'sistema-demandas-escolares-secret-2024',
    resave: false,
    saveUninitialized: false,
    store: new MongoStore({
    mongoUrl: process.env.MONGODB_URI,
    ttl: 24 * 60 * 60, // 1 dia em segundos
    autoRemove: 'native'
}),
    cookie: {
        maxAge: 24 * 60 * 60 * 1000, // 1 dia
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    }
}));
// ============================================
// MIDDLEWARES PERSONALIZADOS
// ============================================

// Middleware para passar mensagens da sessão para todas as views
app.use((req, res, next) => {
    // Passar mensagem da sessão para a view
    res.locals.mensagem = req.session.mensagem || null;
    
    // Limpar mensagem da sessão após usar
    if (req.session.mensagem) {
        delete req.session.mensagem;
    }
    
    // Passar usuário da sessão para a view (se existir)
    if (req.session.userId) {
        res.locals.usuario = {
            id: req.session.userId,
            email: req.session.userEmail,
            nome: req.session.userName,
            tipo: req.session.userType
        };
    } else {
        res.locals.usuario = null;
    }
    
    next();
});

// Middleware de arquivos estáticos (SEM autenticação)
app.use(express.static(path.join(__dirname, '../public')));

// Middleware de autenticação via sessão (APLICA EM TODAS AS ROTAS)
app.use(sessionAuth);

// Middleware de verificação de primeiro acesso (APLICA EM TODAS AS ROTAS)
app.use(checkFirstAccess);

// ============================================
// CONFIGURAÇÃO DO SOCKET.IO (NOTIFICAÇÕES PUSH)
// ============================================

// 🔔 Variável global para sistema de regras de notificação
let notificationRules = null;

// Objeto para armazenar conexões de usuários
const userConnections = {};

// Eventos do Socket.io
io.on('connection', (socket) => {
    console.log('✅ Novo cliente conectado via Socket.io:', socket.id);

    // 🔔 INICIALIZAR SISTEMA DE REGRAS (ADICIONE ESTAS LINHAS)
    if (!notificationRules) {
        notificationRules = new NotificationSystem(io);
        console.log('🎯 Sistema de regras de notificação inicializado');
    }
    
    // Quando usuário faz login e envia seu ID
    socket.on('user-login', (userId) => {
        console.log(`👤 Usuário ${userId} conectado (Socket: ${socket.id})`);
        
        // Armazenar conexão do usuário
        userConnections[userId] = socket.id;
        
        // Entrar em sala privada do usuário
        socket.join(`user-${userId}`);
        
        // Confirmar conexão
        socket.emit('connection-established', { 
            message: 'Conexão de notificações estabelecida',
            userId: userId 
        });
    });
    
    // Enviar notificação em tempo real
    socket.on('send-notification', (data) => {
        const { userId, notification } = data;
        
        if (userId && userConnections[userId]) {
            // Enviar para usuário específico
            io.to(`user-${userId}`).emit('new-notification', notification);
            console.log(`🔔 Notificação enviada para usuário ${userId}`);
        } else {
            // Broadcast geral (se não encontrar usuário específico)
            socket.broadcast.emit('new-notification', notification);
            console.log('🔔 Notificação broadcast enviada');
        }
    });
    
    // Desconexão
    socket.on('disconnect', () => {
        console.log('❌ Cliente desconectado:', socket.id);
        
        // Remover das conexões ativas
        for (const [userId, socketId] of Object.entries(userConnections)) {
            if (socketId === socket.id) {
                delete userConnections[userId];
                console.log(`👤 Usuário ${userId} removido das conexões ativas`);
                break;
            }
        }
    });
    // Desconexão
    socket.on('disconnect', () => {
        console.log('❌ Cliente desconectado:', socket.id);
        
        // Remover das conexões ativas
        for (const [userId, socketId] of Object.entries(userConnections)) {
            if (socketId === socket.id) {
                delete userConnections[userId];
                console.log(`👤 Usuário ${userId} removido das conexões ativas`);
                break;
            }
        }
    });
    
    // ============================================
    // 🆕 ADICIONE ESTE BLOCO AQUI (DEPOIS DO DISCONNECT)
    // ============================================
    
    // Eventos para solicitações de cadastro
    socket.on('nova-solicitacao-cadastro', (data) => {
        console.log('🆕 Nova solicitação de cadastro recebida:', data.email);
        
        // Emitir para todos os admins conectados
        io.emit('nova-solicitacao', {
            email: data.email,
            nome: data.nome,
            timestamp: new Date()
        });
        
        // Criar notificação para todos os admins
        UserModule.User.find({ tipo: 'administrador' }).then(admins => {
            admins.forEach(admin => {
                const notificacao = new Notificacao({
                    usuario: admin._id,
                    titulo: 'Nova Solicitação de Cadastro',
                    mensagem: `${data.nome} solicitou cadastro no sistema`,
                    tipo: 'info',
                    lida: false,
                    link: '/admin/solicitacoes'
                });
                notificacao.save();
            });
            
            // Notificar admins em tempo real
            io.emit('nova-notificacao', {
                titulo: 'Nova Solicitação',
                mensagem: 'Há uma nova solicitação de cadastro para revisão'
            });
        });
    });
    
    // Quando uma solicitação é atualizada
    socket.on('atualizar-solicitacoes', () => {
        io.emit('solicitacao-atualizada');
    });
});

console.log('🚀 Sistema de notificações push Socket.io configurado');

// 🔔 INICIALIZAR SISTEMA DE AGENDAMENTO (ADICIONE ESTAS LINHAS)
//let agendador = null;
//if (!agendador) {
//    agendador = new AgendadorNotificacoes(io);
//    agendador.iniciarAgendadorPrazos();
//    console.log('⏰ Sistema de agendamento automático inicializado');
//}

// Middleware

// EJS COM EXPRESS-LAYOUTS - CONFIGURAÇÃO CORRETA E COMPLETA
//app.use(expressLayouts);                     // 1. Middleware de layouts
app.set('view engine', 'ejs');               // 2. Motor de templates
app.set('views', path.join(__dirname, '../views'));  // 3. Pasta das views
//app.set('layout', 'layout');                 // 4. Layout padrão (layout.ejs)
//app.set('layout extractScripts', true);      // 5. Extrair scripts para layout
//app.set('layout extractStyles', true);       // 6. Extrair styles para layout

// LOG PARA DEBUG (opcional, remove depois)
//console.log('✅ Express-EJS-Layouts configurado corretamente');
//console.log(`📁 Layout: ${app.get('layout')}`);
//console.log(`📁 Views: ${app.get('views')}`);
// ============================================
// 3. CONEXÃO COM MONGODB
// ============================================
async function conectarMongoDB() {
    try {
        console.log('🔄 Conectando ao MongoDB Atlas...');
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ MongoDB Atlas conectado!');
    } catch (error) {
        console.log('❌ Erro MongoDB:', error.message);
    }
}

//const Demanda = mongoose.model('Demanda', DemandaSchema);

// ============================================
// 5. MIDDLEWARE DE AUTENTICAÇÃO REAL
// ============================================
const authMiddleware = async (req, res, next) => {
    try {
        // Verificar se tem sessão ativa
        if (req.session && req.session.userId) {
            // Buscar usuário no banco
            const usuario = await UserModule.User.findById(req.session.userId).select('-senha');
            
            if (usuario && usuario.ativo) {
                req.user = usuario;
                console.log(`🔐 Usuário autenticado: ${usuario.nome} (${usuario.tipo})`);
                
                // Atualizar último acesso
                usuario.ultimoAcesso = new Date();
                await usuario.save();
                
                return next();
            }
        }
        
        // Se não tem sessão, verificar cookie (para compatibilidade)
        if (req.cookies.userSession) {
            console.log('🔐 Usuário via cookie (modo simulação)');
            req.user = {
                _id: 'admin123',
                nome: 'Eder Ramos Supervisor',
                email: 'supervisor@escola.gov.br',
                tipo: 'administrador',
                escolas: escolasLista.slice(0, 5),
                departamento: 'Pedagogico',
                permissoes: {
                    criarDemandas: true,
                    editarDemandas: true,
                    excluirDemandas: true,
                    verTodasDemandas: true,
                    atribuirDemandas: true,
                    gerarRelatorios: true
                }
            };
            return next();
        }
        
        // Redirecionar para login se não autenticado
        console.log('🔐 Usuário não autenticado, redirecionando...');
        if (req.originalUrl.startsWith('/api/')) {
            return res.status(401).json({
                success: false,
                message: 'Não autenticado. Faça login primeiro.'
            });
        }
        res.redirect('/');
        
    } catch (error) {
        console.error('❌ Erro no middleware auth:', error);
        res.status(500).send('Erro de autenticação');
    }
};

// Middleware de permissões
const permissoesMiddleware = (permissaoNecessaria) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Usuário não autenticado'
            });
        }
        
        // Admin tem todas as permissões
        if (req.user.tipo === 'administrador') {
            return next();
        }
        
        // Verificar permissão específica
        if (req.user.permissoes && req.user.permissoes[permissaoNecessaria]) {
            return next();
        }
        
        // Usuário sem permissão
        console.log(`❌ Usuário ${req.user.email} sem permissão: ${permissaoNecessaria}`);
        
        if (req.originalUrl.startsWith('/api/')) {
            return res.status(403).json({
                success: false,
                message: 'Acesso negado. Permissão insuficiente.'
            });
        }
        
        res.status(403).render('error', {
            title: 'Acesso Negado',
            message: 'Você não tem permissão para acessar esta página.',
            user: req.user
        });
    };
};

// ============================================
// 6. LISTA DE ESCOLAS
// ============================================
const escolasLista = [
    'CEEFMTI Afonso Cláudio', 'CEEFMTI Elisa Paiva', 'EEEFM Domingos Perim',
    'EEEFM Fazenda Emílio Schroeder', 'EEEFM Álvaro Castelo', 'EEEFM Alto Rio Possmoser',
    'EEEFM Elvira Barros', 'EEEFM Fazenda Camporês', 'EEEFM Fioravante Caliman',
    'EEEFM Frederico Boldt', 'EEEFM Gisela Salloker Fayet', 'EEEFM Graça Aranha',
    'EEEFM Joaquim Caetano de Paiva', 'EEEFM José Cupertino', 'EEEFM José Giestas',
    'EEEFM José Roberto Christo', 'EEEFM Leogildo Severiano de Souza',
    'EEEFM Luiz Jouffroy', 'EEEFM Marlene Brandão', 'EEEFM Maria de Abreu Alvim',
    'EEEFM Pedra Azul', 'EEEFM Ponto do Alto', 'EEEFM Prof. Hermann Berger',
    'EEEFM Profª Aldy Soares Merçon Vargas', 'EEEFM São Jorge', 'EEEFM São Luís',
    'EEEFM Teófilo Paulino', 'EEEM Francisco Guilherme', 'EEEM Mata Fria', 'EEEM Sobreiro'
];

// ============================================
// 7. ROTAS DE DEMANDAS (API) - SIMPLIFICADO PARA TESTE
// ============================================

// ROTA: Teste das rotas de demandas
app.get('/api/demandas/teste', authMiddleware, (req, res) => {
    res.status(200).json({
        success: true,
        message: '✅ API de Demandas funcionando!',
        usuario: req.user,
        rotas_disponiveis: [
            'GET  /api/demandas/teste         - Esta rota de teste',
            'GET  /api/demandas               - Listar todas as demandas',
            'GET  /api/demandas/:id           - Obter uma demanda específica',
            'POST /api/demandas               - Criar nova demanda',
            'PUT  /api/demandas/:id           - Atualizar demanda',
            'DELETE /api/demandas/:id         - Deletar demanda'
        ]
    });
});
// ============================================
// ROTAS DE API PARA GRÁFICOS (NOVAS!)
// ============================================

// ROTA 1: Estatísticas por status
app.get('/api/graficos/status', authMiddleware, async (req, res) => {
    try {
        const statusStats = await Demanda.aggregate([
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    status: "$_id",
                    count: 1,
                    _id: 0
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);

        // Formatar dados para o gráfico
        const labels = statusStats.map(item => {
            // Traduzir status para português
            const statusMap = {
                'pendente': 'Pendente',
                'em_andamento': 'Em Andamento', 
                'concluida': 'Concluída',
                'cancelada': 'Cancelada'
            };
            return statusMap[item.status] || item.status;
        });
        
        const data = statusStats.map(item => item.count);
        
        res.json({
            success: true,
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        '#FF6384', // Vermelho para Pendente
                        '#36A2EB', // Azul para Em Andamento
                        '#4BC0C0', // Verde-água para Concluída  
                        '#FFCE56'  // Amarelo para Cancelada
                    ],
                    borderColor: '#fff',
                    borderWidth: 2
                }]
            },
            raw: statusStats
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar status:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar estatísticas por status'
        });
    }
});

// ROTA 2: Demandas por escola (top 10)
app.get('/api/graficos/escolas', authMiddleware, async (req, res) => {
    try {
        const escolaStats = await Demanda.aggregate([
            {
                $group: {
                    _id: "$escola",
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    escola: "$_id",
                    count: 1,
                    _id: 0
                }
            },
            {
                $sort: { count: -1 }
            },
            {
                $limit: 10
            }
        ]);

        // Formatar para o gráfico de barras
        const labels = escolaStats.map(item => {
            // Abreviar nomes longos
            return item.escola.length > 20 
                ? item.escola.substring(0, 20) + '...' 
                : item.escola;
        });
        
        const data = escolaStats.map(item => item.count);
        
        // Gerar cores dinamicamente
        const backgroundColors = labels.map((_, index) => 
            `hsl(${index * 36}, 70%, 60%)`
        );
        
        res.json({
            success: true,
            data: {
                labels: labels,
                datasets: [{
                    label: 'Número de Demandas',
                    data: data,
                    backgroundColor: backgroundColors,
                    borderColor: backgroundColors.map(color => color.replace('60%)', '40%)')),
                    borderWidth: 1
                }]
            },
            raw: escolaStats
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar por escola:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar estatísticas por escola'
        });
    }
});

// ROTA 3: Tendência mensal (últimos 6 meses)
app.get('/api/graficos/tendencia', authMiddleware, async (req, res) => {
    try {
        const seisMesesAtras = new Date();
        seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);
        
        const tendenciaStats = await Demanda.aggregate([
            {
                $match: {
                    criadoEm: { $gte: seisMesesAtras }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: "$criadoEm" },
                        month: { $month: "$criadoEm" }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    ano: "$_id.year",
                    mes: "$_id.month",
                    count: 1,
                    _id: 0
                }
            },
            {
                $sort: { "ano": 1, "mes": 1 }
            }
        ]);

        // Formatar labels (ex: "Jan/24")
        const labels = tendenciaStats.map(item => {
            const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 
                          'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            return `${meses[item.mes - 1]}/${item.ano.toString().substring(2)}`;
        });
        
        const data = tendenciaStats.map(item => item.count);
        
        res.json({
            success: true,
            data: {
                labels: labels,
                datasets: [{
                    label: 'Demandas Criadas',
                    data: data,
                    borderColor: '#36A2EB',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    tension: 0.4,
                    fill: true
                }]
            },
            raw: tendenciaStats
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar tendência:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar tendência mensal'
        });
    }
});

// ROTA 4: Estatísticas gerais para cards do dashboard
app.get('/api/graficos/estatisticas', authMiddleware, async (req, res) => {
    try {
        const [
            totalDemandas,
            pendentes,
            emAndamento,
            concluidas,
            porPrioridade
        ] = await Promise.all([
            Demanda.countDocuments(),
            Demanda.countDocuments({ status: 'pendente' }),
            Demanda.countDocuments({ status: 'em_andamento' }),
            Demanda.countDocuments({ status: 'concluida' }),
            Demanda.aggregate([
                {
                    $group: {
                        _id: "$prioridade",
                        count: { $sum: 1 }
                    }
                }
            ])
        ]);

        res.json({
            success: true,
            data: {
                total: totalDemandas,
                pendentes: pendentes,
                em_andamento: emAndamento,
                concluidas: concluidas,
                por_prioridade: porPrioridade,
                taxa_conclusao: totalDemandas > 0 
                    ? Math.round((concluidas / totalDemandas) * 100) 
                    : 0
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar estatísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar estatísticas gerais'
        });
    }
});
// ROTA: Listar demandas COM FILTROS POR USUÁRIO
app.get('/api/demandas', authMiddleware, async (req, res) => {
    try {
        const { 
            status, 
            escola, 
            prioridade, 
            departamento,
            minhas,
            atribuidas,
            responsavel 
        } = req.query;
        
        // Construir query baseada no usuário logado
        let query = {};
        
        // ============================================
        // FILTRO POR TIPO DE USUÁRIO (NOVA LÓGICA)
        // ============================================

        // 1. ADMINISTRADOR: vê tudo (não aplica filtro)
        if (req.user.tipo === 'administrador') {
            // Não filtra nada - vê todas as demandas
            console.log('🔍 Admin vê todas as demandas');
        }

        // 2. SUPERVISOR: vê apenas as escolas que ele gerencia
        else if (req.user.tipo === 'supervisor') {
            console.log('🔍 Supervisor: filtrando por suas escolas');
            
            // Verificar se o supervisor tem escolas atribuídas
            if (req.user.escolas && req.user.escolas.length > 0) {
                query.escola = { $in: req.user.escolas };
                console.log('🏫 Escolas do supervisor:', req.user.escolas);
            } else {
                console.log('⚠️ Supervisor sem escolas atribuídas!');
                // Se não tiver escolas, não vê nada
                query.escola = { $in: [] };
            }
        }

        // 3. DIRETOR: vê apenas demandas da SUA escola (todos departamentos)
        else if (req.user.tipo === 'diretor') {
            console.log('🔍 Diretor: filtrando por sua escola');
            
            // Diretor tem apenas UMA escola
            if (req.user.escolas && req.user.escolas.length > 0) {
                // Pega a primeira (e única) escola do diretor
                const escolaDiretor = req.user.escolas[0];
                query.escola = escolaDiretor;
                console.log(`🏫 Escola do diretor: ${escolaDiretor}`);
            } else {
                console.log('⚠️ Diretor sem escola atribuída!');
                query.escola = { $in: [] };
            }
        }

        // 4. USUÁRIO COMUM: vê apenas sua escola + seu departamento
        else if (req.user.tipo === 'usuario') {
            console.log('🔍 Usuário: filtrando por escola + departamento');
            
            // Filtra por escola E departamento
            if (req.user.escolas && req.user.escolas.length > 0 && req.user.departamento) {
                query.escola = req.user.escolas[0]; // Usa a primeira escola
                query.departamento = req.user.departamento;
                console.log(`🏫 Escola do usuário: ${req.user.escolas[0]}`);
                console.log(`📁 Departamento do usuário: ${req.user.departamento}`);
            } else {
                console.log('⚠️ Usuário sem escola/departamento definidos!');
                query.escola = { $in: [] };
            }
        }

        // 5. TIPO DESCONHECIDO (fallback): vê apenas suas próprias demandas
        else {
            console.log(`⚠️ Tipo de usuário desconhecido: ${req.user.tipo}`);
            query = {
                $or: [
                    { 'criadoPor.id': req.user._id },
                    { 'responsavel.id': req.user._id }
                ]
            };
        }
        
        // Filtro: Minhas Demandas (criadas por mim)
        if (minhas === 'true') {
            query['criadoPor.id'] = req.user._id;
        }
        
        // Filtro: Demandas atribuídas a mim
        if (atribuidas === 'true') {
            query['responsavel.id'] = req.user._id;
        }
        
        // Filtro por responsável específico
        if (responsavel) {
            query['responsavel.id'] = responsavel;
        }
        
        // Filtro por status
        if (status) {
            query.status = status;
        }
        
        // Filtro por escola
        if (escola) {
            query.escola = escola;
        }
        
        // Filtro por prioridade
        if (prioridade) {
            query.prioridade = prioridade;
        }
        
        // Filtro por departamento
        if (departamento) {
            query.departamento = departamento;
        }
        
        console.log('🔍 Query de demandas:', {
            usuario: req.user.email,
            tipo: req.user.tipo,
            query: query
        });
        
        const demandas = await Demanda.find(query)
            .sort({ criadoEm: -1 })
            .limit(100);
        
        res.json({
            success: true,
            count: demandas.length,
            data: demandas,
            filtros: {
                status,
                escola,
                prioridade,
                departamento,
                minhas,
                atribuidas,
                responsavel
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao listar demandas:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar demandas'
        });
    }
});
// ============================================
// ROTA: Obter uma demanda específica por ID
// ============================================
app.get('/api/demandas/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Validar ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'ID inválido'
            });
        }
        
        const demanda = await Demanda.findById(id);
        
        if (!demanda) {
            return res.status(404).json({
                success: false,
                message: 'Demanda não encontrada'
            });
        }
        
        res.json({
            success: true,
            data: demanda
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar demanda:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar demanda específica'
        });
    }
});
// ============================================
// ROTA: Criar nova demanda (COMPLETA)
// ============================================
app.post('/api/demandas', authMiddleware, async (req, res) => {
    try {
        // ============================================
        // VERIFICAR PERMISSÃO PARA CRIAR DEMANDA
        // ============================================
        console.log(`👤 Tipo de usuário tentando criar: ${req.user.tipo}`);

        // 1. ADMINISTRADOR: Sempre pode criar
        // 2. SUPERVISOR: Sempre pode criar (em suas escolas)
        // 3. DIRETOR: NÃO PODE CRIAR demandas
        // 4. USUÁRIO: Pode criar (em sua escola + departamento)

        if (req.user.tipo === 'diretor') {
            return res.status(403).json({
                success: false,
                message: '❌ Diretores não podem criar demandas. Entre em contato com a supervisão.',
                tipo_usuario: req.user.tipo
            });
        }

        // Verificar se usuário tem escola atribuída (exceto admin)
        if (req.user.tipo !== 'administrador') {
            if (!req.user.escolas || req.user.escolas.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: '❌ Você não tem escola atribuída. Contate o administrador.',
                    tipo_usuario: req.user.tipo
                });
            }
        }
        
        console.log('📝 Recebendo nova demanda:', req.body);
        
        // 1. Receber todos os campos do formulário
        const { 
            titulo, 
            descricao, 
            escola, 
            departamento, 
            prioridade, 
            prazo 
        } = req.body;
        
        // 2. Validar campos obrigatórios
        if (!titulo || !descricao || !escola || !departamento || !prazo) {
            console.log('❌ Campos obrigatórios faltando:', {
                titulo: !!titulo,
                descricao: !!descricao,
                escola: !!escola,
                departamento: !!departamento,
                prazo: !!prazo
            });
            
            return res.status(400).json({
                success: false,
                message: 'Preencha todos os campos obrigatórios: Título, Descrição, Escola, Departamento e Prazo',
                campos_faltando: {
                    titulo: !titulo,
                    descricao: !descricao,
                    escola: !escola,
                    departamento: !departamento,
                    prazo: !prazo
                }
            });
        }
        
        // ============================================
        // VALIDAR ESCOLA BASEADA NO PERFIL DO USUÁRIO (AGORA AQUI!)
        // ============================================

        // Se for ADMIN, pode criar em qualquer escola
        if (req.user.tipo === 'administrador') {
            console.log('✅ Admin pode criar em qualquer escola');
        }
        // Se for SUPERVISOR, verificar se a escola está em suas escolas
        else if (req.user.tipo === 'supervisor') {
            if (!req.user.escolas.includes(escola)) {
                return res.status(403).json({
                    success: false,
                    message: `❌ Você não gerencia a escola "${escola}". Escolha uma de suas escolas atribuídas.`,
                    suas_escolas: req.user.escolas,
                    escola_tentada: escola
                });
            }
            console.log(`✅ Supervisor criando na escola: ${escola}`);
        }
        // Se for USUÁRIO COMUM, verificar escola E departamento
        else if (req.user.tipo === 'usuario') {
            // Verificar escola
            if (req.user.escolas[0] !== escola) {
                return res.status(403).json({
                    success: false,
                    message: `❌ Você só pode criar demandas para sua escola: ${req.user.escolas[0]}`,
                    sua_escola: req.user.escolas[0],
                    escola_tentada: escola
                });
            }
            
            // Verificar departamento
            if (req.user.departamento !== departamento) {
                return res.status(403).json({
                    success: false,
                    message: `❌ Você só pode criar demandas para seu departamento: ${req.user.departamento}`,
                    seu_departamento: req.user.departamento,
                    departamento_tentado: departamento
                });
            }
            
            console.log(`✅ Usuário criando na escola ${escola}, departamento ${departamento}`);
        }
                
        // 3. Validar data do prazo
        const dataPrazo = new Date(prazo);
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0); // Zerar horas para comparar apenas a data
        
        if (dataPrazo <= hoje) {
            return res.status(400).json({
                success: false,
                message: 'O prazo deve ser uma data futura (a partir de amanhã)',
                prazo_enviado: prazo,
                hoje: hoje.toISOString().split('T')[0]
            });
        }
        
        // 4. Validar se a escola existe na lista
        if (!escolasLista.includes(escola)) {
            return res.status(400).json({
                success: false,
                message: 'Escola inválida. Selecione uma escola da lista.',
                escola_enviada: escola
            });
        }
        
        // 5. Validar departamento
        const departamentosValidos = ['Gestão', 'Pedagogico', 'Secretaria', 'Supervisão'];
        
        if (!departamentosValidos.includes(departamento)) {
            return res.status(400).json({
                success: false,
                message: 'Departamento inválido. Selecione um departamento da lista.',
                departamento_enviado: departamento,
                departamentos_validos: departamentosValidos
            });
        }
        
        // 6. Validar prioridade (se fornecida)
        const prioridadesValidas = ['Baixa', 'Média', 'Alta', 'Urgente'];
        const prioridadeFinal = prioridade || 'Média';
        
        if (!prioridadesValidas.includes(prioridadeFinal)) {
            return res.status(400).json({
                success: false,
                message: 'Prioridade inválida.',
                prioridade_enviada: prioridade,
                prioridades_validas: prioridadesValidas
            });
        }
        
        // 7. Criar a demanda com todos os campos
const novaDemanda = new Demanda({
    titulo: titulo.trim(),
    descricao: descricao.trim(),
    escola,
    departamento,
    prioridade: prioridadeFinal,
    status: 'pendente',
    criadoPor: {
        id: req.user._id,
        nome: req.user.nome,
        email: req.user.email
    },
    responsavel: null, // Inicialmente sem responsável
    criadoEm: new Date(),
    atualizadoEm: new Date(),
    prazo: dataPrazo,
    historico: [{
        data: new Date(),
        usuario: {
            id: req.user._id,
            nome: req.user.nome,
            email: req.user.email
        },
        acao: 'Criação',
        detalhes: 'Demanda criada no sistema',
        alteracoes: {
            titulo: titulo.trim(),
            escola,
            departamento,
            prioridade: prioridadeFinal,
            status: 'pendente'
        }
    }]
});



// ============================================
// ROTA: Listar usuários disponíveis para atribuição
// ============================================
app.get('/api/usuarios/atribuicao', authMiddleware, permissoesMiddleware('atribuirDemandas'), async (req, res) => {
    try {
        // Buscar usuários ativos que podem ser responsáveis
        const usuarios = await UserModule.User.find({
            ativo: true,
            $or: [
                { tipo: 'supervisor' },
                { tipo: 'gestor' },
                { 'permissoes.editarDemandas': true }
            ]
        }).select('_id nome email tipo departamento telefone')
          .sort({ nome: 1 });
        
        res.json({
            success: true,
            count: usuarios.length,
            data: usuarios
        });
        
    } catch (error) {
        console.error('❌ Erro ao listar usuários para atribuição:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar usuários'
        });
    }
});
// ============================================
// ROTA PÚBLICA DE TESTE (VERSÃO CORRIGIDA)
// ============================================
app.get('/api/teste/usuarios-publico', (req, res) => {
    console.log('✅ ROTA /api/teste/usuarios-publico ACESSADA!');
    
    // Dados de teste SIMPLES
    const usuarios = [
        {
            _id: '1',
            nome: 'João Silva',
            email: 'joao@escola.com',
            tipo: 'professor'
        },
        {
            _id: '2', 
            nome: 'Maria Santos',
            email: 'maria@escola.com',
            tipo: 'coordenadora'
        },
        {
            _id: '3',
            nome: 'Carlos Oliveira',
            email: 'carlos@escola.com',
            tipo: 'diretor'
        }
    ];
    
    // Retornar resposta SIMPLES
    res.json({
        success: true,
        count: usuarios.length,
        message: '✅ API funcionando!',
        data: usuarios
    });
});
// ROTA 5: Estatísticas por usuário
app.get('/api/graficos/usuario', authMiddleware, async (req, res) => {
    try {
        const userId = req.user._id;
        
        const [
            totalCriadas,
            totalAtribuidas,
            pendentes,
            emAndamento,
            concluidas,
            porPrioridade
        ] = await Promise.all([
            // Total criadas por mim
            Demanda.countDocuments({ 'criadoPor.id': userId }),
            
            // Total atribuídas a mim
            Demanda.countDocuments({ 'responsavel.id': userId }),
            
            // Pendentes atribuídas a mim
            Demanda.countDocuments({ 
                'responsavel.id': userId,
                status: 'pendente'
            }),
            
            // Em andamento atribuídas a mim
            Demanda.countDocuments({ 
                'responsavel.id': userId,
                status: 'em_andamento'
            }),
            
            // Concluídas atribuídas a mim
            Demanda.countDocuments({ 
                'responsavel.id': userId,
                status: 'concluida'
            }),
            
            // Por prioridade (atribuídas a mim)
            Demanda.aggregate([
                {
                    $match: { 'responsavel.id': userId }
                },
                {
                    $group: {
                        _id: "$prioridade",
                        count: { $sum: 1 }
                    }
                }
            ])
        ]);
        
        res.json({
            success: true,
            data: {
                usuario: {
                    id: req.user._id,
                    nome: req.user.nome,
                    email: req.user.email,
                    tipo: req.user.tipo
                },
                criadas: totalCriadas,
                atribuidas: totalAtribuidas,
                pendentes: pendentes,
                em_andamento: emAndamento,
                concluidas: concluidas,
                por_prioridade: porPrioridade,
                produtividade: totalAtribuidas > 0 
                    ? Math.round((concluidas / totalAtribuidas) * 100) 
                    : 0
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao buscar estatísticas do usuário:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar estatísticas pessoais'
        });
    }
});     
        // 8. Salvar no banco de dados
        await novaDemanda.save();
    
        console.log('✅ Nova demanda criada com sucesso:', {
            id: novaDemanda._id,
            titulo: novaDemanda.titulo,
            escola: novaDemanda.escola,
            departamento: novaDemanda.departamento,
            prioridade: novaDemanda.prioridade,
            prazo: novaDemanda.prazo.toLocaleDateString('pt-BR'),
            criadoPor: req.user.nome
        });
        
        // 9. Retornar sucesso com todos os dados
        res.status(201).json({
            success: true,
            message: '✅ Demanda criada com sucesso!',
            data: {
                _id: novaDemanda._id,
                titulo: novaDemanda.titulo,
                descricao: novaDemanda.descricao,
                escola: novaDemanda.escola,
                departamento: novaDemanda.departamento,
                prioridade: novaDemanda.prioridade,
                status: novaDemanda.status,
                criadoPor: novaDemanda.criadoPor,
                criadoEm: novaDemanda.criadoEm,
                prazo: novaDemanda.prazo
            },
            links: {
                ver_demanda: `/api/demandas/${novaDemanda._id}`,
                listar_demandas: '/api/demandas',
                dashboard: '/demandas'
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao criar demanda:', error);
        
        // Tratar erros específicos
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Erro de validação: ' + error.message,
                detalhes: error.errors
            });
        }
        
        // Erro de duplicação (se houver campos únicos)
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Já existe uma demanda com estes dados.'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Erro interno ao criar demanda',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});
// ============================================
// ROTAS DE NOTIFICAÇÕES - API
// ============================================

const Notificacao = require('./models/Notificacao');

// MIDDLEWARE: Verificar se usuário está logado para notificações
function requireAuth(req, res, next) {
    // Verifica se tem usuário na sessão OU no middleware de autenticação
    if (!req.session.userId && !req.user) {
        return res.status(401).json({ 
            success: false,
            error: 'Não autorizado. Faça login primeiro.' 
        });
    }
    
    // Se tem req.user do middleware authMiddleware, usa ele
    if (req.user) {
        req.session.userId = req.user._id; // Sincroniza com a sessão
    }
    
    next();
}

// 1️⃣ GET /api/notificacoes - Listar notificações do usuário (mais recentes primeiro)
app.get('/api/notificacoes', requireAuth, async (req, res) => {
    try {
        const notificacoes = await Notificacao.find({ 
            usuarioId: req.session.userId 
        })
        .sort({ dataCriacao: -1 }) // Mais recentes primeiro
        .limit(50); // Limitar a 50 notificações
        
        res.json({
            success: true,
            count: notificacoes.length,
            data: notificacoes
        });
    } catch (error) {
        console.error('Erro ao buscar notificações:', error);
        res.status(500).json({ 
            success: false,
            error: 'Erro interno do servidor' 
        });
    }
});

// 2️⃣ GET /api/notificacoes/nao-lidas - Contador de não lidas
app.get('/api/notificacoes/nao-lidas', requireAuth, async (req, res) => {
    try {
        const count = await Notificacao.countDocuments({ 
            usuarioId: req.session.userId,
            lida: false 
        });
        
        res.json({ 
            success: true,
            count: count 
        });
    } catch (error) {
        console.error('Erro ao contar notificações:', error);
        res.status(500).json({ 
            success: false,
            error: 'Erro interno do servidor' 
        });
    }
});

// 3️⃣ GET /api/notificacoes/ultimas - Últimas 10 notificações (para dropdown)
app.get('/api/notificacoes/ultimas', requireAuth, async (req, res) => {
    try {
        const notificacoes = await Notificacao.find({ 
            usuarioId: req.session.userId 
        })
        .sort({ dataCriacao: -1 })
        .limit(10); // Apenas 10 mais recentes
        
        res.json({
            success: true,
            count: notificacoes.length,
            data: notificacoes
        });
    } catch (error) {
        console.error('Erro ao buscar últimas notificações:', error);
        res.status(500).json({ 
            success: false,
            error: 'Erro interno do servidor' 
        });
    }
});

// 4️⃣ PUT /api/notificacoes/:id/ler - Marcar uma como lida
app.put('/api/notificacoes/:id/ler', requireAuth, async (req, res) => {
    try {
        const notificacao = await Notificacao.findOneAndUpdate(
            { 
                _id: req.params.id,
                usuarioId: req.session.userId  // Segurança: só o dono pode marcar
            },
            { 
                lida: true,
                dataLeitura: new Date()
            },
            { new: true }  // Retorna o documento atualizado
        );
        
        if (!notificacao) {
            return res.status(404).json({ 
                success: false,
                error: 'Notificação não encontrada' 
            });
        }
        
        res.json({ 
            success: true, 
            message: 'Notificação marcada como lida',
            data: notificacao 
        });
    } catch (error) {
        console.error('Erro ao marcar notificação como lida:', error);
        res.status(500).json({ 
            success: false,
            error: 'Erro interno do servidor' 
        });
    }
});

// 5️⃣ PUT /api/notificacoes/ler-todas - Marcar TODAS como lidas
app.put('/api/notificacoes/ler-todas', requireAuth, async (req, res) => {
    try {
        const result = await Notificacao.updateMany(
            { 
                usuarioId: req.session.userId,
                lida: false 
            },
            { 
                lida: true,
                dataLeitura: new Date()
            }
        );
        
        res.json({ 
            success: true, 
            message: `${result.modifiedCount} notificações marcadas como lidas`,
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        console.error('Erro ao marcar todas notificações:', error);
        res.status(500).json({ 
            success: false,
            error: 'Erro interno do servidor' 
        });
    }
});
// 7️⃣ DELETE /api/notificacoes/todas - Limpar TODAS notificações do usuário atual
app.delete('/api/notificacoes/todas', requireAuth, async (req, res) => {
    try {
        console.log('🗑️ [DELETE] /api/notificacoes/todas - Usuário:', req.session.userId);
        
        // VALIDAÇÃO 1: Usuário autenticado
        if (!req.session.userId) {
            console.log('❌ Usuário não autenticado');
            return res.status(401).json({ 
                success: false, 
                error: 'Não autorizado. Faça login primeiro.' 
            });
        }
        
        // VALIDAÇÃO 2: Modelo Notificacao disponível
        if (!Notificacao) {
            console.log('❌ Modelo Notificacao não disponível');
            return res.status(500).json({ 
                success: false, 
                error: 'Modelo de notificações não carregado' 
            });
        }
        
        // Opção: limpar apenas as lidas?
        const { apenasLidas } = req.query;
        let query = { usuarioId: req.session.userId };
        
        console.log('🔍 Parâmetro apenasLidas:', apenasLidas);
        
        if (apenasLidas === 'true') {
            query.lida = true;
            console.log('📋 Limpando apenas notificações LIDAS');
        } else {
            console.log('📋 Limpando TODAS as notificações');
        }
        
        // Executar exclusão com timeout
        const result = await Notificacao.deleteMany(query).maxTimeMS(5000);
        
        console.log('✅ Notificações excluídas:', result.deletedCount);
        
        res.json({ 
            success: true, 
            message: `${result.deletedCount} notificação(ões) excluída(s)`,
            deletedCount: result.deletedCount,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('💥 ERRO CRÍTICO em DELETE /api/notificacoes/todas:');
        console.error('Mensagem:', error.message);
        console.error('Nome:', error.name);
        console.error('Stack:', error.stack);
        
        // Diagnóstico do erro
        let errorMessage = 'Erro interno do servidor';
        
        if (error.name === 'MongoNetworkError') {
            errorMessage = 'Erro de conexão com o banco de dados';
        } else if (error.name === 'MongoTimeoutError') {
            errorMessage = 'Timeout na operação do banco de dados';
        } else if (error.message.includes('Notificacao is not defined')) {
            errorMessage = 'Modelo de notificações não definido';
        }
        
        res.status(500).json({ 
            success: false,
            error: errorMessage,
            tipo: error.name,
            desenvolvimento: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// 6️⃣ DELETE /api/notificacoes/:id - Excluir uma notificação
app.delete('/api/notificacoes/:id', requireAuth, async (req, res) => {
    try {
        const notificacao = await Notificacao.findOneAndDelete({
            _id: req.params.id,
            usuarioId: req.session.userId  // Segurança: só o dono pode excluir
        });
        
        if (!notificacao) {
            return res.status(404).json({ 
                success: false,
                error: 'Notificação não encontrada' 
            });
        }
        
        res.json({ 
            success: true, 
            message: 'Notificação excluída',
            data: notificacao
        });
    } catch (error) {
        console.error('Erro ao excluir notificação:', error);
        res.status(500).json({ 
            success: false,
            error: 'Erro interno do servidor' 
        });
    }
});


// 8️⃣ POST /api/notificacoes - Criar nova notificação
app.post('/api/notificacoes', requireAuth, async (req, res) => {
    try {
        const { titulo, mensagem, tipo, link, usuarioIdDestino } = req.body;
        
        // Validação básica
        if (!titulo || !mensagem) {
            return res.status(400).json({ 
                success: false,
                error: 'Título e mensagem são obrigatórios' 
            });
        }
        
        // Determinar para quem enviar (próprio usuário ou outro)
        const userIdDestino = usuarioIdDestino || req.session.userId;
        
        const novaNotificacao = new Notificacao({
            usuarioId: userIdDestino,
            titulo: titulo.trim(),
            mensagem: mensagem.trim(),
            tipo: tipo || 'info',
            link: link || '',
            lida: false
        });
        
        await novaNotificacao.save();
        
        res.status(201).json({ 
            success: true, 
            message: 'Notificação criada com sucesso',
            data: novaNotificacao 
        });
    } catch (error) {
        console.error('Erro ao criar notificação:', error);
        res.status(500).json({ 
            success: false,
            error: 'Erro interno do servidor' 
        });
    }
});
// 📊 API para contador de solicitações pendentes
app.get('/admin/solicitacoes/contador', async (req, res) => {
    try {
        // Verificar autenticação básica (não precisa ser admin para o contador)
        if (!req.session.userId) {
            return res.json({ success: false, contador: 0 });
        }
        
        // Contar apenas solicitações pendentes
        const contador = await SolicitacaoCadastro.countDocuments({ 
            status: 'pendente' 
        });
        
        res.json({
            success: true,
            contador: contador
        });
        
    } catch (error) {
        console.error('❌ Erro ao contar solicitações:', error);
        res.json({ success: false, contador: 0 });
    }
});
// 9️⃣ POST /api/notificacoes/para-usuario - Criar notificação para outro usuário (admin/supervisor)
app.post('/api/notificacoes/para-usuario', requireAuth, async (req, res) => {
    try {
        const { usuarioId, titulo, mensagem, tipo, link } = req.body;
        
        // Verificar permissão: apenas admin/supervisor pode enviar para outros
        const usuario = await UserModule.User.findById(req.session.userId);
        if (usuario.tipo !== 'administrador' && usuario.tipo !== 'supervisor') {
            return res.status(403).json({ 
                success: false,
                error: 'Apenas administradores e supervisores podem enviar notificações para outros usuários' 
            });
        }
        
        // Validação básica
        if (!usuarioId || !titulo || !mensagem) {
            return res.status(400).json({ 
                success: false,
                error: 'ID do usuário, título e mensagem são obrigatórios' 
            });
        }
        
        // Verificar se usuário destino existe
        const usuarioDestino = await UserModule.User.findById(usuarioId);
        if (!usuarioDestino) {
            return res.status(404).json({ 
                success: false,
                error: 'Usuário destino não encontrado' 
            });
        }
        
        const novaNotificacao = new Notificacao({
            usuarioId: usuarioId,
            titulo: titulo.trim(),
            mensagem: mensagem.trim(),
            tipo: tipo || 'info',
            link: link || '',
            lida: false
        });
        
        await novaNotificacao.save();
        
        res.status(201).json({ 
            success: true, 
            message: `Notificação enviada para ${usuarioDestino.nome}`,
            data: novaNotificacao 
        });
    } catch (error) {
        console.error('Erro ao criar notificação para usuário:', error);
        res.status(500).json({ 
            success: false,
            error: 'Erro interno do servidor' 
        });
    }
});

// 🔟 POST /api/notificacoes/teste - Rota para testar o sistema
app.post('/api/notificacoes/teste', requireAuth, async (req, res) => {
    try {
        console.log('🧪 Criando notificação de teste para usuário:', req.session.userId);
        
        // Verificar se usuário está autenticado
        if (!req.session.userId) {
            return res.status(401).json({ 
                success: false, 
                error: 'Não autorizado. Faça login primeiro.' 
            });
        }
        
        // Criar notificação de teste para o usuário atual
        const notificacaoTeste = new Notificacao({
            usuarioId: req.session.userId,
            titulo: '🔔 Sistema de Notificações Ativo!',
            mensagem: 'Parabéns! O sistema de notificações está funcionando perfeitamente. Esta é uma notificação de teste.',
            tipo: 'success', // ⭐ CORREÇÃO: 'success' em vez de 'sucesso'
            link: '/dashboard',
            lida: false
        });
        
        await notificacaoTeste.save();
        
        console.log('✅ Notificação de teste criada:', notificacaoTeste._id);
        
        res.json({ 
            success: true, 
            message: 'Notificação de teste criada com sucesso!',
            data: notificacaoTeste
        });
    } catch (error) {
        console.error('❌ Erro no teste de notificações:', error);
        console.error('Stack:', error.stack);
        
        res.status(500).json({ 
            success: false,
            error: 'Erro interno do servidor',
            detalhes: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ============================================
// 🔧 ROTAS PARA TESTE DO AGENDADOR
// ============================================

// 1. TESTAR AGENDADOR MANUALMENTE
app.post('/api/teste/agendador', authMiddleware, async (req, res) => {
    try {
        // Verificar se usuário é admin/supervisor
        if (req.user.tipo !== 'administrador' && req.user.tipo !== 'supervisor') {
            return res.status(403).json({
                success: false,
                message: 'Apenas administradores e supervisores podem testar o agendador'
            });
        }

        if (!agendador) {
            return res.status(500).json({
                success: false,
                message: 'Agendador não inicializado'
            });
        }

        console.log('🧪 Executando teste manual do agendador...');
        const notificacoesCriadas = await agendador.executarTeste();

        res.json({
            success: true,
            message: `Teste executado com sucesso! ${notificacoesCriadas} notificações criadas.`,
            notificacoesCriadas: notificacoesCriadas,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Erro no teste do agendador:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao executar teste',
            error: error.message
        });
    }
});

// 2. VERIFICAR STATUS DO AGENDADOR
app.get('/api/agendador/status', authMiddleware, async (req, res) => {
    try {
        if (!agendador) {
            return res.json({
                success: false,
                message: 'Agendador não inicializado',
                ativo: false
            });
        }

        const status = agendador.obterStatus();
        
        res.json({
            success: true,
            ativo: status.ativo,
            agendamentos: status.agendamentos,
            totalAgendamentos: status.totalAgendamentos,
            proximaExecucao: 'Todos os dias às 10h BRT',
            timezone: 'America/Sao_Paulo'
        });

    } catch (error) {
        console.error('❌ Erro ao verificar status do agendador:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao verificar status',
            error: error.message
        });
    }
});

// 🔍 ROTA DE DIAGNÓSTICO DO AGENDADOR
app.get('/api/debug/agendador', authMiddleware, async (req, res) => {
    try {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        
        const daqui3Dias = new Date();
        daqui3Dias.setDate(hoje.getDate() + 3);
        daqui3Dias.setHours(23, 59, 59, 999);
        
        // Buscar demandas manualmente
        const demandas = await Demanda.find({
            prazo: {
                $gte: hoje,
                $lte: daqui3Dias
            },
            status: { $nin: ['concluida', 'cancelada'] }
        }).select('titulo prazo status criadoPor responsavel escola');
        
        // Formatar resposta
        const demandasFormatadas = demandas.map(d => {
            const prazo = new Date(d.prazo);
            const dias = Math.ceil((prazo - hoje) / (1000 * 60 * 60 * 24));
            
            return {
                titulo: d.titulo,
                prazo: prazo.toISOString(),
                prazo_legivel: prazo.toLocaleDateString('pt-BR'),
                dias_restantes: dias,
                status: d.status,
                escola: d.escola,
                tem_criador: !!d.criadoPor,
                tem_responsavel: !!d.responsavel
            };
        });
        
        res.json({
            success: true,
            diagnostico: {
                data_atual: new Date().toISOString(),
                periodo: {
                    inicio: hoje.toISOString(),
                    fim: daqui3Dias.toISOString(),
                    inicio_legivel: hoje.toLocaleDateString('pt-BR'),
                    fim_legivel: daqui3Dias.toLocaleDateString('pt-BR')
                },
                total_demandas: demandas.length,
                demandas: demandasFormatadas
            }
        });
        
    } catch (error) {
        console.error('❌ Erro no diagnóstico:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================
// ROTA: Atualizar demanda existente (PUT) - COM NOTIFICAÇÕES POR AÇÃO
// ============================================
app.put('/api/demandas/:id', authMiddleware, async (req, res) => {
    try {
        console.log('✏️ Recebendo atualização de demanda:', req.params.id);
        
        // 1. Pegar o ID da URL
        const { id } = req.params;
        
        // 2. Verificar se o ID é válido
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'ID inválido!',
                id_enviado: id
            });
        }
        
        // ============================================
        // 🔍 BUSCAR DEMANDA ANTES DA ATUALIZAÇÃO
        // ============================================
        const demandaAntiga = await Demanda.findById(id);
        if (!demandaAntiga) {
            return res.status(404).json({
                success: false,
                message: 'Demanda não encontrada'
            });
        }

        console.log(`👤 Usuário ${req.user.email} (${req.user.tipo}) tentando editar demanda ${id}`);
        console.log(`🔍 Status anterior: ${demandaAntiga.status}`);
        console.log(`🔍 Responsável anterior: ${demandaAntiga.responsavel?.nome || 'Ninguém'}`);
        
        // ============================================
        // VERIFICAR PERMISSÃO PARA EDITAR DEMANDA
        // ============================================

        // 1. ADMINISTRADOR: Sempre pode editar
        if (req.user.tipo === 'administrador') {
            console.log('✅ Admin pode editar qualquer demanda');
        }
        // 2. SUPERVISOR: Só pode editar demandas de suas escolas
        else if (req.user.tipo === 'supervisor') {
            if (!req.user.escolas.includes(demandaAntiga.escola)) {
                return res.status(403).json({
                    success: false,
                    message: `❌ Você não gerencia a escola "${demandaAntiga.escola}".`,
                    suas_escolas: req.user.escolas,
                    escola_demanda: demandaAntiga.escola
                });
            }
            console.log(`✅ Supervisor pode editar demanda da escola ${demandaAntiga.escola}`);
        }
        // 3. DIRETOR: Pode editar (mas não criar/excluir)
        else if (req.user.tipo === 'diretor') {
            // Verificar se a demanda é da escola do diretor
            if (req.user.escolas[0] !== demandaAntiga.escola) {
                return res.status(403).json({
                    success: false,
                    message: `❌ Você só pode editar demandas da sua escola: ${req.user.escolas[0]}`,
                    sua_escola: req.user.escolas[0],
                    escola_demanda: demandaAntiga.escola
                });
            }
            console.log(`✅ Diretor pode editar demanda da sua escola`);
        }
        // 4. USUÁRIO COMUM: Só pode editar se criou a demanda
        else if (req.user.tipo === 'usuario') {
            // Verificar se o usuário criou esta demanda
            if (demandaAntiga.criadoPor.id.toString() !== req.user._id.toString()) {
                return res.status(403).json({
                    success: false,
                    message: '❌ Você só pode editar demandas que você criou.',
                    criador_demanda: demandaAntiga.criadoPor.nome
                });
            }
            
            // Verificar escola e departamento
            if (req.user.escolas[0] !== demandaAntiga.escola || req.user.departamento !== demandaAntiga.departamento) {
                return res.status(403).json({
                    success: false,
                    message: `❌ Você não tem permissão para esta demanda.`
                });
            }
            
            console.log(`✅ Usuário pode editar sua própria demanda`);
        }
        // 5. TIPO DESCONHECIDO
        else {
            return res.status(403).json({
                success: false,
                message: '❌ Tipo de usuário não reconhecido.'
            });
        }
        
        // 3. Pegar os dados do formulário
        const { 
            titulo, 
            descricao, 
            escola, 
            departamento, 
            prioridade, 
            prazo,
            status,
            usuarioAtribuido  // 👈 NOVO: ID do usuário a ser atribuído
        } = req.body;
        
        // 4. Validar campos obrigatórios
        if (!titulo || !descricao || !escola || !departamento) {
            return res.status(400).json({
                success: false,
                message: 'Preencha todos os campos obrigatórios: Título, Descrição, Escola e Departamento',
                campos_faltando: {
                    titulo: !titulo,
                    descricao: !descricao,
                    escola: !escola,
                    departamento: !departamento
                }
            });
        }
        
        // 5. Validar data do prazo (se foi enviada)
        if (prazo) {
            const dataPrazo = new Date(prazo);
            const hoje = new Date();
            
            if (dataPrazo <= hoje) {
                return res.status(400).json({
                    success: false,
                    message: 'O prazo deve ser uma data futura',
                    prazo_enviado: prazo,
                    hoje: hoje.toISOString().split('T')[0]
                });
            }
        }
        
        // ============================================
        // 🔔 DETECTAR AÇÕES PARA NOTIFICAÇÕES
        // ============================================
        
        // AÇÃO 1: Mudança de status?
        const mudancaStatus = status && status !== demandaAntiga.status;
        
        // AÇÃO 2: Atribuição de demanda?
        let foiAtribuicao = false;
        let usuarioAtribuidoInfo = null;
        
        if (usuarioAtribuido && usuarioAtribuido !== 'null' && usuarioAtribuido !== 'undefined') {
            const usuarioAtribuidoAntigo = demandaAntiga.responsavel?.id?.toString() || null;
            const usuarioAtribuidoNovo = usuarioAtribuido.toString();
            
            foiAtribuicao = usuarioAtribuidoAntigo !== usuarioAtribuidoNovo;
            
            if (foiAtribuicao) {
                console.log(`🔔 DETECTADA ATRIBUIÇÃO: De ${usuarioAtribuidoAntigo || 'Ninguém'} para ${usuarioAtribuidoNovo}`);
                
                // Buscar informações do usuário atribuído
                usuarioAtribuidoInfo = await UserModule.User.findById(usuarioAtribuidoNovo).select('nome email tipo');
                
                if (!usuarioAtribuidoInfo) {
                    console.log('⚠️ Usuário atribuído não encontrado');
                }
            }
        }
        
        // 6. Preparar dados para atualização
        const dadosAtualizados = {
            titulo: titulo.trim(),
            descricao: descricao.trim(),
            escola,
            departamento,
            atualizadoEm: new Date()
        };
        
        // 7. Adicionar campos opcionais se existirem
        if (prioridade) dadosAtualizados.prioridade = prioridade;
        if (prazo) dadosAtualizados.prazo = new Date(prazo);
        if (status) dadosAtualizados.status = status;
        
        // 8. Se houve atribuição, atualizar responsável
        if (foiAtribuicao && usuarioAtribuidoInfo) {
            dadosAtualizados.responsavel = {
                id: usuarioAtribuidoInfo._id,
                nome: usuarioAtribuidoInfo.nome,
                email: usuarioAtribuidoInfo.email
            };
            dadosAtualizados.dataAtribuicao = new Date();
            dadosAtualizados.atribuidoPor = {
                id: req.user._id,
                nome: req.user.nome,
                email: req.user.email
            };
            
            console.log(`👤 Demanda atribuída para: ${usuarioAtribuidoInfo.nome}`);
        }
        
        // 9. Procurar e atualizar a demanda
        const demandaAtualizada = await Demanda.findByIdAndUpdate(
            id,                    // ID para buscar
            dadosAtualizados,      // Novos dados
            { new: true }          // Retornar o documento atualizado
        );
        
        // 10. Verificar se encontrou a demanda
        if (!demandaAtualizada) {
            return res.status(404).json({
                success: false,
                message: 'Demanda não encontrada!',
                id_procurado: id
            });
        }
        
        // ============================================
        // 🔔 EXECUTAR SISTEMA DE REGRAS DE NOTIFICAÇÃO
        // ============================================

        if (notificationRules) {
            // Criar objeto de ação para o sistema de regras
            const acaoDados = {
                acao: 'editar',
                demandaId: demandaAtualizada._id,
                usuarioId: req.user._id,
                status: status || demandaAtualizada.status,
                statusAlterado: mudancaStatus,
                editado: true,
                foiAtribuicao: foiAtribuicao,
                usuarioAtribuidoId: usuarioAtribuidoInfo ? usuarioAtribuidoInfo._id : null
            };
            
            console.log('🔔 Processando ação no sistema de regras:', acaoDados);
            
            // Processar ação (o sistema de regras fará todas as notificações automaticamente)
            await notificationRules.processarAcao(acaoDados);
        }
        
        // 11. Retornar sucesso
        console.log('✅ Demanda atualizada com sucesso:', demandaAtualizada._id);
        
        res.json({
            success: true,
            message: '✅ Demanda atualizada com sucesso!',
            data: demandaAtualizada,
            acoes_detectadas: {
                atribuicao: foiAtribuicao,
                mudanca_status: mudancaStatus
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao atualizar demanda:', error);
        
        res.status(500).json({
            success: false,
            message: 'Erro interno ao atualizar demanda',
            error: error.message
        });
    }
});

// ============================================
// ROTA: Excluir demanda (DELETE) - VERSÃO CORRIGIDA
// ============================================
app.delete('/api/demandas/:id', authMiddleware, async (req, res) => {
    try {
        console.log('🗑️ Recebendo pedido de exclusão:', req.params.id);
        
        // 1. Pegar o ID da URL
        const { id } = req.params;
        
        // 2. Verificar se o ID é válido
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'ID inválido!',
                id_enviado: id
            });
        }
        
        // ============================================
        // VERIFICAR PERMISSÃO PARA EXCLUIR DEMANDA
        // ============================================

        // 1. Buscar a demanda
        const demanda = await Demanda.findById(id);
        if (!demanda) {
            return res.status(404).json({
                success: false,
                message: 'Demanda não encontrada'
            });
        }

        console.log(`👤 Usuário ${req.user.email} (${req.user.tipo}) tentando excluir demanda ${id}`);

        // 2. ADMINISTRADOR: Sempre pode excluir
        if (req.user.tipo === 'administrador') {
            console.log('✅ Admin pode excluir qualquer demanda');
        }
        // 3. SUPERVISOR: Só pode excluir demandas de suas escolas
        else if (req.user.tipo === 'supervisor') {
            if (!req.user.escolas.includes(demanda.escola)) {
                return res.status(403).json({
                    success: false,
                    message: `❌ Você não pode excluir demandas de escolas que não gerencia.`,
                    suas_escolas: req.user.escolas,
                    escola_demanda: demanda.escola
                });
            }
            console.log(`✅ Supervisor pode excluir demanda da escola ${demanda.escola}`);
        }
        // 4. DIRETOR: NÃO PODE EXCLUIR
        else if (req.user.tipo === 'diretor') {
            return res.status(403).json({
                success: false,
                message: '❌ Diretores não podem excluir demandas.',
                tipo_usuario: req.user.tipo
            });
        }
        // 5. USUÁRIO COMUM: NÃO PODE EXCLUIR
        else if (req.user.tipo === 'usuario') {
            return res.status(403).json({
                success: false,
                message: '❌ Usuários comuns não podem excluir demandas.',
                tipo_usuario: req.user.tipo
            });
        }
        // 6. TIPO DESCONHECIDO
        else {
            return res.status(403).json({
                success: false,
                message: '❌ Tipo de usuário não reconhecido.'
            });
        }
        
        // 3. Excluir a demanda
        await Demanda.findByIdAndDelete(id);
        
        // 4. Retornar sucesso
        console.log('✅ Demanda excluída com sucesso:', id);
        
        res.json({
            success: true,
            message: '✅ Demanda excluída com sucesso!',
            dados_excluidos: {
                id: demanda._id,
                titulo: demanda.titulo,
                escola: demanda.escola,
                status: demanda.status
            }
        });
        
    } catch (error) {
        console.error('❌ Erro ao excluir demanda:', error);
        
        res.status(500).json({
            success: false,
            message: 'Erro interno ao excluir demanda',
            error: error.message
        });
    }
});
// ============================================
// 8. ROTAS DE AUTENTICAÇÃO
// ============================================

// ============================================
// ROTA: Login (API) - VERSÃO MULTI-USUÁRIO
// ============================================
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        console.log('🔐 Tentativa de login API:', email);
        
        // Buscar usuário no banco
        const User = UserModule.User;
        const escolasLista = UserModule.escolasLista;
        const usuario = await User.findOne({ email, ativo: true });
        
        if (!usuario) {
            return res.status(401).json({
                success: false,
                message: 'Usuário não encontrado ou inativo'
            });
        }
        
        // Verificar senha
        const senhaCorreta = await usuario.compararSenha(password);
        
        if (!senhaCorreta) {
            return res.status(401).json({
                success: false,
                message: 'Senha incorreta'
            });
        }
        
        // Criar sessão (também para API, se necessário)
        req.session.userId = usuario._id;
        req.session.userType = usuario.tipo;
        req.session.primeiroAcesso = usuario.primeiroAcesso;
        req.session.obrigarAlteracaoSenha = usuario.obrigarAlteracaoSenha;
        
        // Atualizar último acesso
        usuario.ultimoAcesso = new Date();
        await usuario.save();
        
        // Remover senha da resposta
        const usuarioSemSenha = usuario.toObject();
        delete usuarioSemSenha.senha;
        
        // Verificar se precisa alterar senha
        const precisaAlterarSenha = usuario.primeiroAcesso === true || 
                                   usuario.obrigarAlteracaoSenha === true;
        
        res.json({
            success: true,
            message: 'Login realizado com sucesso!',
            usuario: usuarioSemSenha,
            permissoes: usuario.permissoes,
            precisaAlterarSenha: precisaAlterarSenha
        });
        
    } catch (error) {
        console.error('❌ Erro no login API:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
    }
});
// ============================================
// ROTA: Login com redirecionamento (PÁGINA) - VERSÃO MULTI-USUÁRIO
// ============================================
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        console.log('🔐 Login via formulário:', email);
        
        // Buscar usuário no banco
        const User = UserModule.User;
        const escolasLista = UserModule.escolasLista;
        const usuario = await User.findOne({ email, ativo: true });
        
        if (!usuario) {
            console.log('❌ Usuário não encontrado:', email);
            return res.render('login-bonito', {
                title: 'Login - Sistema de Demandas',
                error: 'Usuário não encontrado ou inativo',
                success: null,
                email: email,
                password: '',
                escolas: escolasLista,
                user: null
            });
        }
        
        // Verificar senha
        const senhaCorreta = await usuario.compararSenha(password);
        
        if (!senhaCorreta) {
            console.log('❌ Senha incorreta para:', email);
            return res.render('login-bonito', {
                title: 'Login - Sistema de Demandas',
                error: 'Senha incorreta',
                success: null,
                email: email,
                password: '',
                escolas: escolasLista,
                user: null
            });
        }
        
        // Configurar sessão do usuário
        req.session.userId = usuario._id;
        req.session.userEmail = usuario.email;
        req.session.userName = usuario.nome;
        req.session.userType = usuario.tipo;
        req.session.primeiroAcesso = usuario.primeiroAcesso;
        req.session.obrigarAlteracaoSenha = usuario.obrigarAlteracaoSenha;
        
        console.log('✅ Login bem-sucedido:', {
            email: usuario.email,
            primeiroAcesso: usuario.primeiroAcesso,
            obrigarAlteracaoSenha: usuario.obrigarAlteracaoSenha
        });
        
        // Atualizar último acesso
        usuario.ultimoAcesso = new Date();
        await usuario.save();
        
        // Verificar se precisa alterar senha
        if (usuario.primeiroAcesso === true || usuario.obrigarAlteracaoSenha === true) {
            console.log('🔄 Usuário precisa alterar senha, redirecionando...');
            
            req.session.mensagem = {
                tipo: 'warning',
                texto: 'É seu primeiro acesso. Você precisa alterar sua senha antes de continuar.'
            };
            
            return res.redirect('/alterar-senha');
        }
        
        // Se não precisar alterar senha, redirecionar para dashboard
        console.log(`✅ Login completo: ${usuario.nome} (${usuario.tipo})`);
        
        req.session.mensagem = {
            tipo: 'success',
            texto: `Bem-vindo, ${usuario.nome}!`
        };
        
        res.redirect('/dashboard');
        
    } catch (error) {
        console.error('❌ Erro no login:', error);
        res.status(500).render('login-bonito', {
            title: 'Erro no Login',
            error: 'Erro interno do servidor. Tente novamente.',
            success: null,
            email: '',
            password: '',
            escolas: escolasLista,
            user: null
        });
    }
});

// ============================================
// ROTA: Página de Login (GET)
// ============================================

app.get('/login', (req, res) => {
    // Se usuário já estiver logado, redirecionar para dashboard
    if (req.session.userId) {
        return res.redirect('/dashboard');
    }
    
    // Renderizar página de login
    res.render('login-bonito', {
        title: 'Login - Sistema de Demandas Escolares',
        error: null,
        success: null,
        email: '',
        password: '',
        escolas: escolasLista,
        user: null
    });
});

// ============================================
// ROTA: LOGOUT
// ============================================

app.get('/logout', (req, res) => {
    console.log('👋 Usuário fazendo logout:', req.session.userEmail);
    
    // Destruir sessão
    req.session.destroy((err) => {
        if (err) {
            console.error('❌ Erro ao fazer logout:', err);
            return res.redirect('/dashboard');
        }
        
        // Limpar cookie
        res.clearCookie('connect.sid');
        
        // Redirecionar para login
        res.redirect('/login');
    });
});

// ============================================
// ROTA: ALTERAR SENHA (PRIMEIRO ACESSO) - COMPLETA
// ============================================

// Página de alteração de senha (GET)
app.get('/alterar-senha', async (req, res) => {
    try {
        console.log('📄 Acessando página de alteração de senha');
        
        // Verificar se usuário está logado
        if (!req.session.userId) {
            console.log('❌ Usuário não logado, redirecionando para login');
            req.session.mensagem = {
                tipo: 'error',
                texto: 'Faça login para alterar sua senha.'
            };
            return res.redirect('/login');
        }
        
        // Buscar usuário no banco
        const User = UserModule.User;
        const escolasLista = UserModule.escolasLista;
        const usuario = await UserModule.User.findById(req.session.userId);
        
        if (!usuario) {
            console.log('❌ Usuário não encontrado no banco');
            req.session.destroy();
            return res.redirect('/login');
        }
        
        // Verificar se realmente precisa alterar senha
        const precisaAlterar = usuario.primeiroAcesso === true || 
                              usuario.obrigarAlteracaoSenha === true;
        
        if (!precisaAlterar) {
            console.log('ℹ️ Usuário já alterou senha anteriormente');
            req.session.mensagem = {
                tipo: 'info',
                texto: 'Sua senha já foi alterada anteriormente.'
            };
            return res.redirect('/dashboard');
        }
        
        console.log('✅ Renderizando página para:', usuario.email);
        
        // Renderizar página de alteração de senha
        // ⭐⭐ CORREÇÃO CRÍTICA ⭐⭐ - Passar user em vez de usuario
        res.render('alterar-senha', {
            title: 'Alterar Senha - Primeiro Acesso',
            user: {  // ⭐ MUDE "usuario" PARA "user" ⭐
                _id: usuario._id,
                email: usuario.email,
                nome: usuario.nome,
                tipo: usuario.tipo
            },
            mensagem: req.session.mensagem || null
        });
        
    } catch (error) {
        console.error('❌ Erro na página de alteração de senha:', error);
        req.session.mensagem = {
            tipo: 'error',
            texto: 'Erro ao carregar página de alteração de senha.'
        };
        res.redirect('/login');
    }
});

// Processar alteração de senha (POST)
app.post('/alterar-senha', async (req, res) => {
    try {
        console.log('🔄 Processando alteração de senha...');
        
        // 1. Verificar se usuário está logado
        if (!req.session.userId) {
            console.log('❌ Usuário não logado');
            return res.status(401).json({
                success: false,
                message: 'Sessão expirada. Faça login novamente.'
            });
        }
        
        // 2. Obter dados do formulário
        const { senhaAtual, novaSenha, confirmarSenha } = req.body;
        
        console.log('📦 Dados recebidos:', {
            userId: req.session.userId,
            temSenhaAtual: !!senhaAtual,
            temNovaSenha: !!novaSenha,
            temConfirmarSenha: !!confirmarSenha
        });
        
        // 3. Validações básicas
        if (!senhaAtual || !novaSenha || !confirmarSenha) {
            console.log('❌ Campos obrigatórios faltando');
            return res.status(400).json({
                success: false,
                message: 'Todos os campos são obrigatórios.'
            });
        }
        
        // 4. Verificar se senhas coincidem
        if (novaSenha !== confirmarSenha) {
            console.log('❌ Senhas não coincidem');
            return res.status(400).json({
                success: false,
                message: 'As senhas não coincidem.'
            });
        }
        
        // 5. Verificar se nova senha é diferente da atual
        if (senhaAtual === novaSenha) {
            console.log('❌ Nova senha igual à atual');
            return res.status(400).json({
                success: false,
                message: 'A nova senha não pode ser igual à senha atual.'
            });
        }
        
        // 6. Buscar usuário
        const User = UserModule.User;
        const escolasLista = UserModule.escolasLista;
        const usuario = await UserModule.User.findById(req.session.userId);
        
        if (!usuario) {
            console.log('❌ Usuário não encontrado');
            return res.status(404).json({
                success: false,
                message: 'Usuário não encontrado.'
            });
        }
        
        // 7. Verificar senha atual (temporária)
        const senhaAtualCorreta = await usuario.compararSenha(senhaAtual);
        
        if (!senhaAtualCorreta) {
            console.log('❌ Senha atual incorreta');
            return res.status(400).json({
                success: false,
                message: 'Senha atual incorreta.'
            });
        }
        
        // 8. Verificar requisitos da nova senha
        const requisitos = validarSenha(novaSenha);
        
        if (!requisitos.valida) {
            console.log('❌ Senha não atende aos requisitos');
            return res.status(400).json({
                success: false,
                message: requisitos.mensagem
            });
        }
        
        // 9. Verificar se senha já foi usada anteriormente
        const senhaJaUsada = await usuario.senhaJaUsada(novaSenha);
        
        if (senhaJaUsada) {
            console.log('❌ Senha já foi usada anteriormente');
            return res.status(400).json({
                success: false,
                message: 'Esta senha já foi usada anteriormente. Escolha uma senha diferente.'
            });
        }
        
        // 10. Atualizar senha
        console.log('✅ Todos os requisitos atendidos, atualizando senha...');
        
        // Salvar a senha antiga no histórico ANTES de mudar
        await usuario.adicionarSenhaAoHistorico(usuario.senha);
        
        // Atualizar senha do usuário
        usuario.senha = novaSenha; // O middleware pre('save') vai criptografar
        usuario.primeiroAcesso = false;
        usuario.obrigarAlteracaoSenha = false;
        usuario.dataUltimaAlteracaoSenha = Date.now();
        
        // Limpar senha temporária (se existir)
        if (usuario.senhaTemporaria) {
            usuario.senhaTemporaria = null;
        }
        
        // Salvar alterações
        await usuario.save();
        
        console.log('✅ Senha alterada com sucesso para:', usuario.email);
        
        // 11. Atualizar sessão
        req.session.primeiroAcesso = false;
        req.session.obrigarAlteracaoSenha = false;
        
        // 12. Retornar sucesso
        return res.json({
            success: true,
            message: 'Senha alterada com sucesso! Redirecionando para o sistema...',
            redirect: '/dashboard'
        });
        
    } catch (error) {
        console.error('❌ Erro ao alterar senha:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro interno ao alterar senha. Tente novamente.'
        });
    }
});

// Função para validar senha
function validarSenha(senha) {
    const requisitos = {
        valida: true,
        mensagem: ''
    };
    
    // Verificar comprimento
    if (senha.length < 8) {
        requisitos.valida = false;
        requisitos.mensagem = 'A senha deve ter pelo menos 8 caracteres.';
        return requisitos;
    }
    
    // Verificar letra maiúscula
    if (!/[A-Z]/.test(senha)) {
        requisitos.valida = false;
        requisitos.mensagem = 'A senha deve conter pelo menos uma letra maiúscula.';
        return requisitos;
    }
    
    // Verificar letra minúscula
    if (!/[a-z]/.test(senha)) {
        requisitos.valida = false;
        requisitos.mensagem = 'A senha deve conter pelo menos uma letra minúscula.';
        return requisitos;
    }
    
    // Verificar número
    if (!/[0-9]/.test(senha)) {
        requisitos.valida = false;
        requisitos.mensagem = 'A senha deve conter pelo menos um número.';
        return requisitos;
    }
    
    return requisitos;
}

// ============================================
// ROTA API: VERIFICAR STATUS DE ALTERAÇÃO DE SENHA
// ============================================

app.get('/api/auth/precisa-alterar-senha', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.json({ precisaAlterar: false });
        }
        
        const User = UserModule.User;
        const escolasLista = UserModule.escolasLista;
        const usuario = await UserModule.User.findById(req.session.userId);
        
        if (!usuario) {
            return res.json({ precisaAlterar: false });
        }
        
        const precisaAlterar = usuario.primeiroAcesso === true || 
                              usuario.obrigarAlteracaoSenha === true;
        
        return res.json({ 
            precisaAlterar: precisaAlterar,
            primeiroAcesso: usuario.primeiroAcesso,
            obrigarAlteracaoSenha: usuario.obrigarAlteracaoSenha,
            email: usuario.email
        });
        
    } catch (error) {
        console.error('❌ Erro ao verificar status:', error);
        return res.json({ precisaAlterar: false });
    }
});

// ============================================
// 📝 ROTAS PARA SOLICITAÇÃO DE CADASTRO
// ============================================

// ROTA: Página para solicitar cadastro (pública)
app.get('/solicitar-cadastro', (req, res) => {
    res.render('solicitar-cadastro', {
        title: 'Solicitar Cadastro - Sistema de Demandas Escolares',
        user: null,  // Página pública
        escolas: escolasLista,
        mensagemSucesso: null,      // ← ADICIONADO
        mensagemErro: null,         // ← ADICIONADO
        dadosForm: null             // ← ADICIONADO
    });
});

// ROTA: Processar solicitação de cadastro
app.post('/solicitar-cadastro', async (req, res) => {
    try {
        console.log('📝 Recebendo solicitação de cadastro...');
        
        const {
            nomeCompleto,
            email,
            funcao,
            departamento,
            escola
        } = req.body;
        
        console.log('📋 Dados recebidos:', { nomeCompleto, email, funcao, departamento, escola });
        
        // Validações básicas
        if (!nomeCompleto || !email || !funcao || !departamento || !escola) {
            return res.render('solicitar-cadastro', {
                title: 'Solicitar Cadastro - Sistema de Demandas Escolares',
                user: null,
                escolas: escolasLista,
                mensagemSucesso: null,
                mensagemErro: 'Preencha todos os campos obrigatórios (*)',
                dadosForm: req.body
            });
        }
        
        // Validar formato do email
        const emailRegex = /^\S+@\S+\.\S+$/;
        if (!emailRegex.test(email)) {
            return res.render('solicitar-cadastro', {
                title: 'Solicitar Cadastro - Sistema de Demandas Escolares',
                user: null,
                escolas: escolasLista,
                mensagemSucesso: null,
                mensagemErro: 'Por favor, insira um e-mail válido',
                dadosForm: req.body
            });
        }
        
        // Verificar se já existe solicitação com este email (pendente)
        const solicitacaoExistente = await SolicitacaoCadastro.findOne({
            email: email.toLowerCase(),
            status: 'pendente'
        });
        
        if (solicitacaoExistente) {
            return res.render('solicitar-cadastro', {
                title: 'Solicitar Cadastro - Sistema de Demandas Escolares',
                user: null,
                escolas: escolasLista,
                mensagemSucesso: null,
                mensagemErro: 'Já existe uma solicitação pendente com este e-mail. Aguarde a análise.',
                dadosForm: req.body
            });
        }
        
        // Verificar se já existe usuário com este email
        const usuarioExistente = await UserModule.User.findOne({
            email: email.toLowerCase()
        });
        
        if (usuarioExistente) {
            return res.render('solicitar-cadastro', {
                title: 'Solicitar Cadastro - Sistema de Demandas Escolares',
                user: null,
                escolas: escolasLista,
                mensagemSucesso: null,
                mensagemErro: 'Este e-mail já está cadastrado no sistema. <a href="/login" class="alert-link">Faça login aqui</a>.',
                dadosForm: req.body
            });
        }
        
        // Criar nova solicitação (usando o formato do seu modelo)
        const novaSolicitacao = new SolicitacaoCadastro({
            nome: nomeCompleto.trim(),
            email: email.toLowerCase().trim(),
            cargo: funcao,
            escola: escola,
            departamento: departamento,
            status: 'pendente',
            dataSolicitacao: new Date()
        });
        
        // Salvar no banco
        await novaSolicitacao.save();
        
        console.log('✅ Nova solicitação salva:', {
            id: novaSolicitacao._id,
            nome: novaSolicitacao.nome,
            email: novaSolicitacao.email,
            escola: novaSolicitacao.escola
        });
        
        // 🔔 EMITIR EVENTO SOCKET.IO PARA NOTIFICAR ADMINS
        if (io) {
            io.emit('nova-solicitacao-cadastro', {
                email: novaSolicitacao.email,
                nome: novaSolicitacao.nome,
                timestamp: new Date()
            });
            
            console.log('🔔 Evento Socket.io emitido para admins');
        }
        
        // SIMULAÇÃO DE E-MAIL PARA O ADMIN
        console.log('\n══════════════════════════════════════════════════════════════════');
        console.log('📧 [SIMULAÇÃO] NOTIFICAÇÃO PARA ADMIN');
        console.log('══════════════════════════════════════════════════════════════════');
        console.log(`📨 Para: ecramos@sedu.es.gov.br`);
        console.log(`📨 De: sistema-escolar@sedu.es.gov.br`);
        console.log(`🏷️ Assunto: Nova Solicitação de Cadastro - ${novaSolicitacao.nome}`);
        console.log('══════════════════════════════════════════════════════════════════');
        console.log(`👤 Nova solicitação recebida:`);
        console.log(`   Nome: ${novaSolicitacao.nome}`);
        console.log(`   E-mail: ${novaSolicitacao.email}`);
        console.log(`   Escola: ${novaSolicitacao.escola}`);
        console.log(`   Cargo: ${novaSolicitacao.cargo || 'Não informado'}`);
        console.log('');
        console.log('🔗 Para revisar: http://localhost:3000/admin/solicitacoes');
        console.log('══════════════════════════════════════════════════════════════════\n');
        
        // Redirecionar com mensagem de sucesso
        res.render('solicitar-cadastro', {
            title: 'Solicitar Cadastro - Sistema de Demandas Escolares',
            user: null,
            escolas: escolasLista,
            mensagemSucesso: `✅ Solicitação enviada com sucesso! Seu pedido foi registrado e será analisado pela administração. Você receberá um e-mail quando sua conta for aprovada.`,
            mensagemErro: null,
            dadosForm: null
        });
        
    } catch (error) {
        console.error('❌ Erro ao processar solicitação:', error);
        res.render('solicitar-cadastro', {
            title: 'Solicitar Cadastro - Sistema de Demandas Escolares',
            user: null,
            escolas: escolasLista,
            mensagemSucesso: null,
            mensagemErro: 'Erro interno do servidor. Por favor, tente novamente.',
            dadosForm: req.body
        });
    }
});
// ============================================
// ROTA DE EMERGÊNCIA: Cadastrar usuário
// ============================================
app.post('/api/emergency-register', async (req, res) => {
    try {
        console.log('🚨 CADASTRO DE EMERGÊNCIA ACIONADO!');
        
        const { nome, email, senha, tipo, escolas, departamento } = req.body;
        
        console.log('📝 Dados recebidos:', {
            nome, email, tipo, departamento,
            temSenha: !!senha,
            escolas: escolas ? escolas.length : 0
        });
        
        // Validações básicas
        if (!nome || !email || !senha || !tipo || !departamento) {
            return res.status(400).json({
                success: false,
                message: 'Preencha: nome, email, senha, tipo, departamento'
            });
        }
        
        // Verificar se email já existe
        const existe = await UserModule.User.findOne({ email });
        if (existe) {
            return res.status(400).json({
                success: false,
                message: 'Email já cadastrado',
                email: email
            });
        }
        
        // Validar departamento
        const departamentosValidos = ['Supervisão', 'Gestão', 'Pedagógico', 'Secretaria'];
        if (!departamentosValidos.includes(departamento)) {
            return res.status(400).json({
                success: false,
                message: `Departamento inválido. Use: ${departamentosValidos.join(', ')}`,
                departamentos_validos: departamentosValidos
            });
        }
        
        // Validar tipo
        const tiposValidos = ['administrador', 'supervisor', 'diretor', 'usuario'];
        if (!tiposValidos.includes(tipo)) {
            return res.status(400).json({
                success: false,
                message: `Tipo inválido. Use: ${tiposValidos.join(', ')}`,
                tipos_validos: tiposValidos
            });
        }

        // Criar usuário
        const novoUsuario = UserModule.User({
            nome: nome.trim(),
            email: email.trim().toLowerCase(),
            senha: senha, // Senha em texto puro (apenas para emergência)
            tipo: tipo,
            departamento: departamento,
            escolas: escolas || [],
            ativo: true,
            permissoes: {
                criarDemandas: tipo !== 'diretor',
                editarDemandas: ['administrador', 'supervisor', 'diretor'].includes(tipo),
                excluirDemandas: ['administrador', 'supervisor'].includes(tipo),
                verTodasDemandas: ['administrador', 'supervisor', 'diretor'].includes(tipo),
                atribuirDemandas: ['administrador', 'supervisor'].includes(tipo),
                gerarRelatorios: ['administrador', 'supervisor'].includes(tipo)
            }
        });
        
        await novoUsuario.save();
        
        console.log('✅ USUÁRIO CRIADO COM SUCESSO:', {
            id: novoUsuario._id,
            nome: novoUsuario.nome,
            email: novoUsuario.email,
            tipo: novoUsuario.tipo
        });
        
        res.status(201).json({
            success: true,
            message: '✅ Usuário criado com sucesso!',
            usuario: {
                _id: novoUsuario._id,
                nome: novoUsuario.nome,
                email: novoUsuario.email,
                tipo: novoUsuario.tipo,
                departamento: novoUsuario.departamento,
                escolas: novoUsuario.escolas
            }
        });
        
    } catch (error) {
        console.error('💥 ERRO NO CADASTRO:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao criar usuário',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});
/**
 * GET /esqueci-senha - Página para recuperar senha
 */
app.get('/esqueci-senha', (req, res) => {
    res.render('esqueci-senha', {
        title: 'Recuperar Senha',
        success: req.flash('success') || null,
        error: req.flash('error') || null
    });
});

/**
 * POST /esqueci-senha - Processar recuperação de senha
 */
app.post('/esqueci-senha', async (req, res) => {
    try {
        const { email } = req.body;
        
        console.log('🔑 Solicitação de recuperação de senha para:', email);
        
        // Buscar usuário pelo email
        const usuario = await UserModule.User.findOne({ email: email.toLowerCase() });
        
        if (!usuario) {
            console.log('❌ Usuário não encontrado:', email);
            req.flash('error', 'E-mail não encontrado no sistema. Verifique o endereço informado.');
            return res.redirect('/esqueci-senha');
        }
        
        // Gerar senha temporária (6 dígitos aleatórios)
        const senhaTemporaria = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Hash da nova senha
        const salt = await bcrypt.genSalt(10);
        const senhaHash = await bcrypt.hash(senhaTemporaria, salt);
        
        // Atualizar usuário
        usuario.senha = senhaHash;
        usuario.primeiroAcesso = true;
        usuario.dataUltimaAlteracaoSenha = new Date();
        
        // Adicionar ao histórico de senhas
        usuario.senhasAnteriores.push({
            senha: senhaHash,
            dataAlteracao: new Date()
        });
        
        await usuario.save();
        
        console.log('✅ Senha temporária gerada para:', email);
        
        // ============================================
        // 📧 ENVIO DE E-MAIL COM SENHA TEMPORÁRIA
        // ============================================
        
        const assunto = `🔑 Senha Temporária - Sistema de Demandas Escolares`;
        const corpoEmail = `
RECUPERAÇÃO DE SENHA - SISTEMA DE DEMANDAS ESCOLARES

Olá ${usuario.nome},

Você solicitou uma nova senha para acesso ao sistema.

🔐 SUA SENHA TEMPORÁRIA: ${senhaTemporaria}

⚠️ IMPORTANTE:
1. Esta senha é válida por 24 horas
2. No primeiro acesso, você será obrigado a criar uma nova senha
3. Após criar sua nova senha, esta senha temporária será invalidada

🔗 ACESSO AO SISTEMA:
http://localhost:3000/login

📱 OU USE O QR CODE ABAIXO PARA ACESSAR RAPIDAMENTE:
[QR Code seria gerado aqui]

⏰ SENHA VÁLIDA ATÉ: ${new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleString('pt-BR')}

🔒 DICAS DE SEGURANÇA:
• Nunca compartilhe sua senha
• Crie uma senha forte com letras, números e símbolos
• Altere sua senha regularmente

Se você não solicitou esta recuperação, por favor ignore este e-mail
ou entre em contato com o suporte imediatamente.

--
Sistema de Demandas Escolares
Secretaria de Educação do Estado
Suporte: suporte@escola.gov.br
`;
        
        // Verificar se o email está configurado
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            // Modo real - enviar email
            console.log('📧 Enviando email real para:', email);
            // Código para enviar email real
        } else {
            // Modo simulação - mostrar no console
            console.log('\n============================================');
            console.log('📧 [MODO SIMULAÇÃO] EMAIL COM SENHA TEMPORÁRIA');
            console.log('============================================');
            console.log(`Para: ${email}`);
            console.log(`Assunto: ${assunto}`);
            console.log('--------------------------------------------');
            console.log(corpoEmail);
            console.log('============================================\n');
            
            // Em modo simulação, mostramos a senha no console também
            console.log(`👁️ SENHA TEMPORÁRIA PARA TESTE: ${senhaTemporaria}`);
        }
        
        console.log('✅ Processo de recuperação concluído para:', email);
        
        req.flash('success', `Uma senha temporária foi enviada para ${email}. Verifique sua caixa de entrada.`);
        res.redirect('/esqueci-senha');
        
    } catch (error) {
        console.error('❌ Erro ao processar recuperação de senha:', error);
        req.flash('error', 'Erro ao processar solicitação. Por favor, tente novamente.');
        res.redirect('/esqueci-senha');
    }
});
// ROTA: Perfil (protegida)
app.get('/api/auth/perfil', authMiddleware, (req, res) => {
    res.json({
        success: true,
        usuario: req.user
    });
});

// ============================================
// 9. ROTAS DAS PÁGINAS
// ============================================

app.get('/', (req, res) => {
    res.render('login-bonito', {
        title: 'Sistema de Demandas Escolares',
        message: 'Bem-vindo! Faça login para continuar.',
        escolas: escolasLista,
        user: null,
        error: null,
        success: null,
        email: '',
        password: ''
    });
});

// 📄 Rota para página admin de solicitações (APENAS ADMIN)
app.get('/admin/solicitacoes', async (req, res) => {
    try {
        // Verificar se o usuário está logado e é admin
        if (!req.session.userId) {
            return res.redirect('/login');
        }
        
        const user = await UserModule.User.findById(req.session.userId);
        if (!user || user.tipo !== 'administrador') {
            return res.status(403).send('Acesso negado. Apenas administradores.');
        }
        
        res.render('admin-solicitacoes', {
            user: user,
            title: 'Solicitações de Cadastro', // ← ADICIONE ESTA LINHA
            pageTitle: 'Solicitações de Cadastro',
            currentPage: 'admin-solicitacoes'
        });
        
    } catch (error) {
        console.error('❌ Erro ao carregar página admin:', error);
        res.status(500).send('Erro interno do servidor');
    }
});

// 📊 API para carregar dados das solicitações (APENAS ADMIN)
app.get('/admin/solicitacoes/dados', async (req, res) => {
    try {
        // Verificar se o usuário está logado e é admin
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Não autorizado' });
        }
        
        const user = await UserModule.User.findById(req.session.userId);
        if (!user || user.tipo !== 'administrador') {
            return res.status(403).json({ error: 'Acesso negado' });
        }
        
        // Carregar todas as solicitações ordenadas por data (mais recentes primeiro)
        const solicitacoes = await SolicitacaoCadastro.find()
            .sort({ dataSolicitacao: -1 })
            .lean();
        
        res.json({
            success: true,
            solicitacoes: solicitacoes
        });
        
    } catch (error) {
        console.error('❌ Erro ao carregar dados das solicitações:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// ✅ API para aprovar uma solicitação (APENAS ADMIN)
app.post('/admin/solicitacoes/aprovar', async (req, res) => {
    try {
        // Verificar se o usuário está logado e é admin
        if (!req.session.userId) {
            return res.status(401).json({ success: false, message: 'Não autorizado' });
        }
        
        const user = await UserModule.User.findById(req.session.userId);
        if (!user || user.tipo !== 'administrador') {
            return res.status(403).json({ success: false, message: 'Acesso negado' });
        }
        
        const { solicitacaoId, tipoUsuario, senhaTemporaria } = req.body;
        // MAPEAR TIPOS DO FORMULÁRIO PARA O SEU SISTEMA
        const tipoMapeado = {
            'admin': 'administrador',
            'supervisor': 'supervisao',
            'diretor': 'gestao',
            'usuario': 'comum'
        }[tipoUsuario];
        
        if (!tipoMapeado) {
            return res.status(400).json({ 
                success: false, 
                message: 'Tipo de usuário inválido' 
            });
        }
        if (!solicitacaoId || !tipoUsuario || !senhaTemporaria) {
            return res.status(400).json({ 
                success: false, 
                message: 'Dados incompletos' 
            });
        }
        
        // Buscar a solicitação
        const solicitacao = await SolicitacaoCadastro.findById(solicitacaoId);
        if (!solicitacao) {
            return res.status(404).json({ 
                success: false, 
                message: 'Solicitação não encontrada' 
            });
        }
        
        // Verificar se o e-mail já está cadastrado
        const usuarioExistente = await UserModule.User.findOne({ email: solicitacao.email });
        if (usuarioExistente) {
            return res.status(400).json({ 
                success: false, 
                message: 'Já existe um usuário com este e-mail' 
            });
        }
        
        // Criar hash da senha temporária
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(senhaTemporaria, saltRounds);
        
        // Criar novo usuário (AGORA COM TIPO MAPEADO)
        const novoUsuario = UserModule.User({
            nome: solicitacao.nome,
            email: solicitacao.email,
            telefone: solicitacao.telefone,
            cpf: solicitacao.cpf,
            escola: solicitacao.escola,
            cargo: solicitacao.cargo,
            matricula: solicitacao.matricula,
            tipo: tipoMapeado, 
            senha: hashedPassword,
            primeiroAcesso: true,
            dataCadastro: new Date(),
            aprovadoPor: user._id,
            senhasAnteriores: [{
                hash: hashedPassword,
                alteradaEm: new Date()
            }]
        });
        
        // Salvar o usuário
        await novoUsuario.save();
        
        // Atualizar status da solicitação
        solicitacao.status = 'aprovada';
        solicitacao.dataProcessamento = new Date();
        solicitacao.processadoPor = user._id;
        solicitacao.usuarioCriado = novoUsuario._id;
        await solicitacao.save();
        
        // SIMULAÇÃO DE ENVIO DE E-MAIL
        console.log('══════════════════════════════════════════════════════════════════');
        console.log('📧 E-MAIL DE BOAS-VINDAS SIMULADO');
        console.log('══════════════════════════════════════════════════════════════════');
        console.log(`📨 Para: ${solicitacao.email}`);
        console.log(`📨 De: sistema-escolar@sedu.es.gov.br`);
        console.log(`🏷️ Assunto: Sua conta foi criada - Sistema Escolar`);
        console.log('══════════════════════════════════════════════════════════════════');
        console.log(`Olá ${solicitacao.nome},`);
        console.log('');
        console.log('Sua solicitação de cadastro foi APROVADA!');
        console.log('');
        console.log('📋 SEUS DADOS DE ACESSO:');
        console.log(`🔗 Sistema: http://localhost:3000/login`);
        console.log(`📧 E-mail: ${solicitacao.email}`);
        console.log(`🔑 Senha temporária: ${senhaTemporaria}`);
        console.log('');
        console.log('⚠️ IMPORTANTE:');
        console.log('1. Esta senha é TEMPORÁRIA');
        console.log('2. No primeiro acesso, você será obrigado a alterá-la');
        console.log('3. Não compartilhe suas credenciais');
        console.log('');
        console.log('👤 Tipo de usuário: ' + tipoUsuario.toUpperCase());
        console.log('');
        console.log('Atenciosamente,');
        console.log('Equipe do Sistema Escolar');
        console.log('══════════════════════════════════════════════════════════════════');
        
        // Criar notificação para o administrador
        const notificacao = new Notificacao({
            usuario: user._id,
            titulo: 'Solicitação Aprovada',
            mensagem: `Você aprovou a solicitação de ${solicitacao.nome}`,
            tipo: 'info',
            lida: false,
            link: '/admin/solicitacoes'
        });
        await notificacao.save();
        
        // Emitir evento Socket.io para atualizar em tempo real
        io.emit('solicitacao-atualizada');
        io.emit('nova-notificacao', {
            titulo: 'Solicitação Aprovada',
            mensagem: `Solicitação de ${solicitacao.nome} aprovada com sucesso`
        });
        
        res.json({
            success: true,
            message: 'Solicitação aprovada e usuário criado com sucesso',
            usuarioId: novoUsuario._id
        });
        
    } catch (error) {
        console.error('❌ Erro ao aprovar solicitação:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor',
            error: error.message 
        });
    }
});

// ❌ API para rejeitar uma solicitação (APENAS ADMIN)
app.post('/admin/solicitacoes/rejeitar', async (req, res) => {
    try {
        // Verificar se o usuário está logado e é admin
        if (!req.session.userId) {
            return res.status(401).json({ success: false, message: 'Não autorizado' });
        }
        
        const user = await UserModule.User.findById(req.session.userId);
        if (!user || user.tipo !== 'administrador') {
            return res.status(403).json({ success: false, message: 'Acesso negado' });
        }
        
        const { solicitacaoId } = req.body;
        
        if (!solicitacaoId) {
            return res.status(400).json({ 
                success: false, 
                message: 'ID da solicitação não fornecido' 
            });
        }
        
        // Buscar e atualizar a solicitação
        const solicitacao = await SolicitacaoCadastro.findById(solicitacaoId);
        if (!solicitacao) {
            return res.status(404).json({ 
                success: false, 
                message: 'Solicitação não encontrada' 
            });
        }
        
        // Atualizar status
        solicitacao.status = 'rejeitada';
        solicitacao.dataProcessamento = new Date();
        solicitacao.processadoPor = user._id;
        solicitacao.mensagemRejeicao = 'Solicitação rejeitada pelo administrador';
        await solicitacao.save();
        
        // SIMULAÇÃO DE E-MAIL DE REJEIÇÃO
        console.log('══════════════════════════════════════════════════════════════════');
        console.log('📧 E-MAIL DE REJEIÇÃO SIMULADO');
        console.log('══════════════════════════════════════════════════════════════════');
        console.log(`📨 Para: ${solicitacao.email}`);
        console.log(`📨 De: sistema-escolar@sedu.es.gov.br`);
        console.log(`🏷️ Assunto: Atualização sobre sua solicitação de cadastro`);
        console.log('══════════════════════════════════════════════════════════════════');
        console.log(`Prezado(a) ${solicitacao.nome},`);
        console.log('');
        console.log('Informamos que sua solicitação de cadastro foi REJEITADA.');
        console.log('');
        console.log('📝 Motivo: Não atende aos critérios necessários.');
        console.log('');
        console.log('Se acredita que houve um engano, entre em contato com a administração.');
        console.log('');
        console.log('Atenciosamente,');
        console.log('Equipe do Sistema Escolar');
        console.log('══════════════════════════════════════════════════════════════════');
        
        // Criar notificação para o administrador
        const notificacao = new Notificacao({
            usuario: user._id,
            titulo: 'Solicitação Rejeitada',
            mensagem: `Você rejeitou a solicitação de ${solicitacao.nome}`,
            tipo: 'warning',
            lida: false,
            link: '/admin/solicitacoes'
        });
        await notificacao.save();
        
        // Emitir evento Socket.io
        io.emit('solicitacao-atualizada');
        io.emit('nova-notificacao', {
            titulo: 'Solicitação Rejeitada',
            mensagem: `Solicitação de ${solicitacao.nome} rejeitada`
        });
        
        res.json({
            success: true,
            message: 'Solicitação rejeitada com sucesso'
        });
        
    } catch (error) {
        console.error('❌ Erro ao rejeitar solicitação:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro interno do servidor',
            error: error.message 
        });
    }
});
// ============================================
// FUNÇÕES AUXILIARES PARA GRÁFICOS
// ============================================

async function getGraficosPorStatus(filter = {}) {
    try {
        const statusStats = await Demanda.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    status: "$_id",
                    count: 1,
                    _id: 0
                }
            },
            { $sort: { count: -1 } }
        ]);

        // Mapear status para português
        const statusMap = {
            'pendente': 'Pendente',
            'em_andamento': 'Em Andamento', 
            'concluida': 'Concluída',
            'cancelada': 'Cancelada'
        };

        const labels = statusStats.map(item => statusMap[item.status] || item.status);
        const data = statusStats.map(item => item.count);

        return {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#FF6384', // Vermelho
                    '#36A2EB', // Azul  
                    '#4BC0C0', // Verde-água
                    '#FFCE56'  // Amarelo
                ],
                borderColor: '#fff',
                borderWidth: 2
            }]
        };
        
    } catch (error) {
        console.error('Erro ao gerar gráfico de status:', error);
        return null;
    }
}

async function getGraficoTendencia(filter = {}) {
    try {
        const seisMesesAtras = new Date();
        seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);
        
        const tendenciaStats = await Demanda.aggregate([
            {
                $match: {
                    ...filter,
                    criadoEm: { $gte: seisMesesAtras }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: "$criadoEm" },
                        month: { $month: "$criadoEm" }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    ano: "$_id.year",
                    mes: "$_id.month",
                    count: 1,
                    _id: 0
                }
            },
            { $sort: { "ano": 1, "mes": 1 } }
        ]);

        // Formatar labels (ex: "Jan/24")
        const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 
                      'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        
        const labels = tendenciaStats.map(item => 
            `${meses[item.mes - 1]}/${item.ano.toString().substring(2)}`
        );
        
        const data = tendenciaStats.map(item => item.count);
        
        return {
            labels: labels,
            datasets: [{
                label: 'Demandas Criadas',
                data: data,
                borderColor: '#36A2EB',
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                tension: 0.4,
                fill: true
            }]
        };
        
    } catch (error) {
        console.error('Erro ao gerar gráfico de tendência:', error);
        return null;
    }
}
// ============================================
// FUNÇÕES DE DASHBOARD PERSONALIZADO
// ============================================

// Função fallback caso ocorra erro
function getDashboardFallback() {
    return {
        visao: { texto: 'Visão Geral', icone: 'fas fa-eye', cor: 'primary' },
        cards: [
            { titulo: 'Carregando...', valor: '...', icone: 'fas fa-sync fa-spin', cor: 'secondary' }
        ],
        minhasTarefas: [],
        graficos: {
            status: null,
            tendencia: null
        },
        quickActions: [],
        alertas: []
    };
}

// 1. DASHBOARD PARA ADMINISTRADOR (VERSÃO COM GRÁFICOS)
async function getDashboardAdmin() {
    try {
        const totalDemandas = await Demanda.countDocuments();
        const demandasPendentes = await Demanda.countDocuments({ status: 'pendente' });
        const demandasConcluidas = await Demanda.countDocuments({ status: 'concluida' });
        const totalUsuarios = await UserModule.User.countDocuments({ ativo: true });
        
        const minhasTarefas = await Demanda.find({ 
            'responsavel.id': null,
            status: 'pendente'
        })
        .sort({ criadoEm: -1 })
        .limit(5);
        
        // Gráficos para admin (sem filtro - vê tudo)
        const graficosStatus = await getGraficosPorStatus({});
        const graficoTendencia = await getGraficoTendencia({});
        
        return {
            visao: {
                texto: 'Visão Geral do Sistema',
                icone: 'fas fa-globe',
                cor: 'danger'
            },
            cards: [
                {
                    titulo: 'Total de Demandas',
                    valor: totalDemandas,
                    icone: 'fas fa-clipboard-list',
                    cor: 'primary',
                    descricao: 'Sistema completo'
                },
                {
                    titulo: 'Pendentes',
                    valor: demandasPendentes,
                    icone: 'fas fa-clock',
                    cor: 'warning',
                    descricao: 'Aguardando ação'
                },
                {
                    titulo: 'Concluídas',
                    valor: demandasConcluidas,
                    icone: 'fas fa-check-circle',
                    cor: 'success',
                    descricao: 'Finalizadas'
                },
                {
                    titulo: 'Usuários Ativos',
                    valor: totalUsuarios,
                    icone: 'fas fa-users',
                    cor: 'info',
                    descricao: 'No sistema'
                }
            ],
            minhasTarefas: minhasTarefas,
            graficos: {
                status: graficosStatus,
                tendencia: graficoTendencia
            },
            quickActions: [
                {
                    texto: 'Criar Demanda',
                    icone: 'fas fa-plus',
                    url: '/demandas?action=create',
                    cor: 'primary'
                },
                {
                    texto: 'Gerenciar Usuários',
                    icone: 'fas fa-user-cog',
                    url: '/usuarios',
                    cor: 'info'
                },
                {
                    texto: 'Relatórios',
                    icone: 'fas fa-chart-bar',
                    url: '#',
                    cor: 'success'
                },
                {
                    texto: 'Configurações',
                    icone: 'fas fa-cog',
                    url: '/perfil',
                    cor: 'secondary'
                }
            ],
            alertas: totalDemandas === 0 ? [{
                titulo: 'Sistema Vazio',
                mensagem: 'Não há demandas cadastradas ainda. Crie a primeira!',
                tipo: 'info'
            }] : []
        };
        
    } catch (error) {
        console.error('Erro no dashboard admin:', error);
        return getDashboardFallback();
    }
}
// 2. DASHBOARD PARA SUPERVISOR (VERSÃO COM GRÁFICOS)
async function getDashboardSupervisor(usuario) {
    try {
        let escolaFilter = {};
        if (usuario.escolas && usuario.escolas.length > 0) {
            escolaFilter = { escola: { $in: usuario.escolas } };
        }
        
        const totalDemandas = await Demanda.countDocuments(escolaFilter);
        const demandasPendentes = await Demanda.countDocuments({ 
            ...escolaFilter, 
            status: 'pendente' 
        });
        const demandasConcluidas = await Demanda.countDocuments({ 
            ...escolaFilter, 
            status: 'concluida' 
        });
        
        const minhasTarefas = await Demanda.find({
            'responsavel.id': usuario._id,
            status: { $in: ['pendente', 'em_andamento'] }
        })
        .sort({ prioridade: -1, prazo: 1 })
        .limit(5);
        
        const demandasSemResponsavel = await Demanda.countDocuments({
            ...escolaFilter,
            'responsavel.id': null,
            status: 'pendente'
        });
        
        // Gráficos apenas para as escolas do supervisor
        const graficosStatus = await getGraficosPorStatus(escolaFilter);
        const graficoTendencia = await getGraficoTendencia(escolaFilter);
        
        return {
            visao: {
                texto: `Gerencia ${usuario.escolas?.length || 0} escola(s)`,
                icone: 'fas fa-user-tie',
                cor: 'primary'
            },
            cards: [
                {
                    titulo: 'Minhas Escolas',
                    valor: usuario.escolas?.length || 0,
                    icone: 'fas fa-school',
                    cor: 'primary',
                    descricao: 'Escolas sob gestão'
                },
                {
                    titulo: 'Demandas Totais',
                    valor: totalDemandas,
                    icone: 'fas fa-clipboard-list',
                    cor: 'info',
                    descricao: 'Nas minhas escolas'
                },
                {
                    titulo: 'Pendentes',
                    valor: demandasPendentes,
                    icone: 'fas fa-exclamation-circle',
                    cor: 'warning',
                    descricao: 'Precisam de atenção'
                },
                {
                    titulo: 'Sem Responsável',
                    valor: demandasSemResponsavel,
                    icone: 'fas fa-user-slash',
                    cor: 'danger',
                    descricao: 'Necessitam atribuição'
                }
            ],
            minhasTarefas: minhasTarefas,
            graficos: {
                status: graficosStatus,
                tendencia: graficoTendencia
            },
            quickActions: [
                {
                    texto: 'Atribuir Demanda',
                    icone: 'fas fa-user-check',
                    url: '/demandas',
                    cor: 'primary'
                },
                {
                    texto: 'Criar Demanda',
                    icone: 'fas fa-plus',
                    url: '/demandas?action=create',
                    cor: 'success'
                },
                {
                    texto: 'Minhas Escolas',
                    icone: 'fas fa-list',
                    url: '#',
                    cor: 'info'
                }
            ],
            alertas: demandasSemResponsavel > 0 ? [{
                titulo: 'Demandas sem Responsável',
                mensagem: `Existem ${demandasSemResponsavel} demandas sem responsável atribuído.`,
                tipo: 'warning'
            }] : []
        };
        
    } catch (error) {
        console.error('Erro no dashboard supervisor:', error);
        return getDashboardFallback();
    }
}
// 3. DASHBOARD PARA DIRETOR (VERSÃO COM GRÁFICOS)
async function getDashboardDiretor(usuario) {
    try {
        const escolaDiretor = usuario.escolas && usuario.escolas.length > 0 ? usuario.escolas[0] : null;
        
        if (!escolaDiretor) {
            return {
                visao: { texto: 'Sem Escola Atribuída', icone: 'fas fa-exclamation-triangle', cor: 'warning' },
                cards: [
                    { titulo: 'Atenção', valor: '0', icone: 'fas fa-school', cor: 'warning', descricao: 'Sem escola atribuída' }
                ],
                minhasTarefas: [],
                graficos: { status: null, tendencia: null },
                quickActions: [],
                alertas: [{
                    titulo: 'Configuração Pendente',
                    mensagem: 'Você não tem uma escola atribuída. Contate o supervisor.',
                    tipo: 'danger'
                }]
            };
        }
        
        const escolaFilter = { escola: escolaDiretor };
        
        const totalDemandas = await Demanda.countDocuments(escolaFilter);
        const demandasPendentes = await Demanda.countDocuments({ 
            ...escolaFilter,
            status: 'pendente' 
        });
        const demandasConcluidas = await Demanda.countDocuments({ 
            ...escolaFilter,
            status: 'concluida' 
        });
        
        const minhasTarefas = await Demanda.find({
            ...escolaFilter,
            status: { $in: ['pendente', 'em_andamento'] }
        })
        .sort({ prioridade: -1, prazo: 1 })
        .limit(5);
        
        // Gráficos apenas para a escola do diretor
        const graficosStatus = await getGraficosPorStatus(escolaFilter);
        const graficoTendencia = await getGraficoTendencia(escolaFilter);
        
        return {
            visao: {
                texto: `Diretor(a) da ${escolaDiretor}`,
                icone: 'fas fa-user-graduate',
                cor: 'info'
            },
            cards: [
                {
                    titulo: 'Minha Escola',
                    valor: escolaDiretor.substring(0, 20) + (escolaDiretor.length > 20 ? '...' : ''),
                    icone: 'fas fa-school',
                    cor: 'info',
                    descricao: 'Escola atribuída'
                },
                {
                    titulo: 'Demandas Totais',
                    valor: totalDemandas,
                    icone: 'fas fa-clipboard-list',
                    cor: 'primary',
                    descricao: 'Na minha escola'
                },
                {
                    titulo: 'Pendentes',
                    valor: demandasPendentes,
                    icone: 'fas fa-clock',
                    cor: 'warning',
                    descricao: 'Aguardando solução'
                },
                {
                    titulo: 'Concluídas',
                    valor: demandasConcluidas,
                    icone: 'fas fa-check',
                    cor: 'success',
                    descricao: 'Resolvidas'
                }
            ],
            minhasTarefas: minhasTarefas,
            graficos: {
                status: graficosStatus,
                tendencia: graficoTendencia
            },
            quickActions: [
                {
                    texto: 'Ver Demandas',
                    icone: 'fas fa-list',
                    url: '/demandas',
                    cor: 'primary'
                },
                {
                    texto: 'Meu Perfil',
                    icone: 'fas fa-user',
                    url: '/perfil',
                    cor: 'info'
                }
            ],
            alertas: demandasPendentes > 10 ? [{
                titulo: 'Muitas Pendências',
                mensagem: `Existem ${demandasPendentes} demandas pendentes na sua escola.`,
                tipo: 'warning'
            }] : []
        };
        
    } catch (error) {
        console.error('Erro no dashboard diretor:', error);
        return getDashboardFallback();
    }
}

// 4. DASHBOARD PARA USUÁRIO COMUM
async function getDashboardFuncionario(usuario) {
    try {
        const escolaUsuario = usuario.escolas && usuario.escolas.length > 0 ? usuario.escolas[0] : null;
        const departamentoUsuario = usuario.departamento || 'Secretaria';
        
        if (!escolaUsuario) {
            return {
                visao: { texto: 'Configuração Pendente', icone: 'fas fa-cog', cor: 'secondary' },
                cards: [
                    { titulo: 'Atenção', valor: '0', icone: 'fas fa-exclamation', cor: 'warning', descricao: 'Aguardando configuração' }
                ],
                minhasTarefas: [],
                quickActions: [],
                alertas: [{
                    titulo: 'Configuração Incompleta',
                    mensagem: 'Seu perfil não está completamente configurado.',
                    tipo: 'warning'
                }]
            };
        }
        
        const totalDemandas = await Demanda.countDocuments({ 
            escola: escolaUsuario,
            departamento: departamentoUsuario 
        });
        
        const minhasDemandasCriadas = await Demanda.countDocuments({ 
            escola: escolaUsuario,
            departamento: departamentoUsuario,
            'criadoPor.id': usuario._id
        });
        
        const minhasTarefas = await Demanda.find({
            'responsavel.id': usuario._id,
            status: { $in: ['pendente', 'em_andamento'] }
        })
        .sort({ prazo: 1 })
        .limit(5);
        
        const tarefasPendentes = await Demanda.countDocuments({
            'responsavel.id': usuario._id,
            status: 'pendente'
        });
        
        return {
            visao: {
                texto: `${departamentoUsuario} - ${escolaUsuario.substring(0, 15)}...`,
                icone: 'fas fa-user',
                cor: 'success'
            },
            cards: [
                {
                    titulo: 'Minha Escola',
                    valor: escolaUsuario.substring(0, 15) + (escolaUsuario.length > 15 ? '...' : ''),
                    icone: 'fas fa-school',
                    cor: 'info',
                    descricao: 'Escola atribuída'
                },
                {
                    titulo: 'Meu Departamento',
                    valor: departamentoUsuario,
                    icone: 'fas fa-building',
                    cor: 'primary',
                    descricao: 'Setor de atuação'
                },
                {
                    titulo: 'Demandas Criadas',
                    valor: minhasDemandasCriadas,
                    icone: 'fas fa-plus-circle',
                    cor: 'success',
                    descricao: 'Por mim'
                },
                {
                    titulo: 'Tarefas Pendentes',
                    valor: tarefasPendentes,
                    icone: 'fas fa-tasks',
                    cor: 'warning',
                    descricao: 'Atribuídas a mim'
                }
            ],
            minhasTarefas: minhasTarefas,
            quickActions: [
                {
                    texto: 'Criar Demanda',
                    icone: 'fas fa-plus',
                    url: '/demandas?action=create',
                    cor: 'primary'
                },
                {
                    texto: 'Minhas Tarefas',
                    icone: 'fas fa-tasks',
                    url: '/demandas?atribuidas=true',
                    cor: 'warning'
                },
                {
                    texto: 'Minhas Demandas',
                    icone: 'fas fa-list',
                    url: '/demandas?minhas=true',
                    cor: 'info'
                }
            ],
            alertas: tarefasPendentes > 0 ? [{
                titulo: 'Tarefas Pendentes',
                mensagem: `Você tem ${tarefasPendentes} tarefa(s) pendente(s).`,
                tipo: 'info'
            }] : []
        };
        
    } catch (error) {
        console.error('Erro no dashboard funcionário:', error);
        return getDashboardFallback();
    }
}

// 5. DASHBOARD PARA SECRETÁRIO/COORDENADOR (mesmo do funcionário)
async function getDashboardSecretarioCoordenador(usuario) {
    return await getDashboardFuncionario(usuario);
}
// Dashboard PERSONALIZADO por tipo de usuário
app.get('/dashboard', authMiddleware, async (req, res) => {
    try {
        const usuario = req.user;
        
        console.log(`📊 Carregando dashboard personalizado para: ${usuario.nome} (${usuario.tipo})`);
        
        // Dados base que todos os usuários recebem
        const dadosBase = {
            title: 'Dashboard Personalizado - Sistema de Demandas',
            user: usuario,
            escolas: escolasLista,
            anoAtual: new Date().getFullYear()
        };
        
        // Dados personalizados baseados no tipo de usuário
        let dadosPersonalizados = {};
        
        switch(usuario.tipo) {
            case 'administrador':
                dadosPersonalizados = await getDashboardAdmin();
                break;
            case 'supervisor':
                dadosPersonalizados = await getDashboardSupervisor(usuario);
                break;
            case 'diretor':
                dadosPersonalizados = await getDashboardDiretor(usuario);
                break;
            case 'secretario':
            case 'coordenador':
                dadosPersonalizados = await getDashboardSecretarioCoordenador(usuario);
                break;
            case 'funcionario':
            case 'usuario':
            default:
                dadosPersonalizados = await getDashboardFuncionario(usuario);
                break;
        }
        
                // Buscar totalDemandas para o footer
        const totalDemandas = await Demanda.countDocuments();
        
        // Combinar dados base com dados personalizados
        const dadosDashboard = {
            ...dadosBase,
            ...dadosPersonalizados,
            totalDemandas: totalDemandas  // ⭐ LINHA ADICIONADA ⭐
        };
        
        console.log(`✅ Dashboard pronto para ${usuario.tipo}:`, {
            visao: dadosDashboard.visao,
            cards: dadosDashboard.cards ? dadosDashboard.cards.length : 0,
            temTarefas: dadosDashboard.minhasTarefas ? dadosDashboard.minhasTarefas.length : 0
        });
        
        // Renderizar o dashboard PERSONALIZADO (nova view)
        res.render('dashboard-personalizado', dadosDashboard);
        
    } catch (error) {
        console.error('❌ Erro ao carregar dashboard personalizado:', error);
        
        // Fallback para dashboard simples
        try {
            const totalDemandas = await Demanda.countDocuments();
            const demandasPendentes = await Demanda.countDocuments({ status: 'pendente' });
            const demandasConcluidas = await Demanda.countDocuments({ status: 'concluida' });
            
            res.render('dashboard-funcional', {
                title: 'Dashboard - Sistema de Demandas',
                user: req.user,
                totalDemandas,
                demandasPendentes,
                demandasConcluidas,
                escolas: escolasLista
            });
        } catch (fallbackError) {
            res.status(500).render('error', {
                title: 'Erro no Dashboard',
                message: 'Não foi possível carregar o dashboard.',
                user: req.user
            });
        }
    }
});
// ROTA: Página de gerenciamento de demandas (COM INCLUDES)
app.get('/demandas', authMiddleware, async (req, res) => {
    try {
        // Contar demandas para o footer
        const totalDemandas = await Demanda.countDocuments();
        
        res.render('demandas-com-includes', {  // ← MUDE AQUI
            title: 'Gerenciar Demandas',
            user: req.user,
            escolas: escolasLista,
            totalDemandas: totalDemandas
        });
    } catch (error) {
        console.error('❌ Erro na página de demandas:', error);
        res.status(500).render('error', {
            title: 'Erro',
            message: 'Erro ao carregar página de demandas',
            user: req.user
        });
    }
});

// ============================================
// ROTA: Página de atribuição de demandas
// ============================================
app.get('/atribuir', authMiddleware, async (req, res) => {
    try {
        // Contar demandas para o footer
        const totalDemandas = await Demanda.countDocuments();
        
        // Buscar usuários ativos para a lista
        const usuarios = await UserModule.User.find({ ativo: true })
            .select('_id nome email tipo departamento')
            .sort({ nome: 1 })
            .limit(50); // Limitar para não sobrecarregar
        
        res.render('atribuir', {
            title: 'Atribuir Demandas - Sistema Escolar',
            user: req.user,
            escolas: escolasLista,
            usuarios: usuarios, // Passar usuários para a página
            totalDemandas: totalDemandas,
            currentPage: 'atribuir' // Para highlight no menu
        });
    } catch (error) {
        console.error('❌ Erro na página de atribuição:', error);
        res.status(500).render('error', {
            title: 'Erro',
            message: 'Erro ao carregar página de atribuição',
            user: req.user
        });
    }
});
// Página de cadastro (COM INCLUDES)
app.get('/cadastro', authMiddleware, (req, res) => {
    // Contar demandas para o footer
    Demanda.countDocuments().then(totalDemandas => {
        res.render('cadastro-com-includes', {
            title: 'Cadastro de Usuário',
            user: req.user,
            escolas: escolasLista,
            totalDemandas: totalDemandas,
            tiposUsuario: [
                { valor: 'administrador', label: 'Administrador (Acesso Total)' },
                { valor: 'supervisor', label: 'Supervisor (Gerencia Escolas)' },
                { valor: 'diretor', label: 'Diretor(a) - Acesso às demandas da sua escola' },
                { valor: 'usuario', label: 'Usuário(a) - Acesso às demandas da sua escola + departamento' }
            ],
            departamentos: [
                { valor: 'Supervisão', label: 'Supervisão' },
                { valor: 'Gestão', label: 'Gestão' },
                { valor: 'Pedagógico', label: 'Pedagógico' },
                { valor: 'Secretaria', label: 'Secretaria' }
                
            ]
        });
    }).catch(error => {
        console.error('Erro ao contar demandas:', error);
        res.render('cadastro-com-includes', {
            title: 'Cadastro de Usuário',
            user: req.user,
            escolas: escolasLista,
            totalDemandas: 0,
            tiposUsuario: [],
            departamentos: []
        });
    });
});

// Rota para página de listagem de usuários (apenas admin/supervisor)
app.get('/usuarios', authMiddleware, async (req, res) => {
    try {
        // Verificar se é admin ou supervisor
        if (req.user.tipo !== 'administrador' && req.user.tipo !== 'supervisor') {
            console.log(`❌ Usuário ${req.user.email} (${req.user.tipo}) tentou acessar /usuarios sem permissão`);
            return res.status(403).render('error', {
                title: 'Acesso Negado',
                message: 'Apenas administradores e supervisores podem acessar esta página.',
                user: req.user
            });
        }
        
        console.log(`✅ Usuário ${req.user.email} (${req.user.tipo}) acessando /usuarios`);
        
        // Contar demandas para o footer
        const totalDemandas = await Demanda.countDocuments();
        
        // Tipos de usuário disponíveis
        const tiposUsuario = [
            { valor: 'administrador', label: '👑 Administrador(a)' },
            { valor: 'supervisor', label: '👨‍🏫 Supervisor(a)' },
            { valor: 'diretor', label: '📋 Diretor(a)' },
            { valor: 'usuario', label: '👤 Usuário(a)' }
        ];
        
        // Departamentos disponíveis
        const departamentos = [
            { valor: 'Supervisão', label: 'Supervisão' },
            { valor: 'Gestão', label: 'Gestão' },
            { valor: 'Pedagógico', label: 'Pedagógico' },
            { valor: 'Secretaria', label: 'Secretaria' }
        ];
        
        res.render('usuarios', {
            title: 'Gestão de Usuários',  // ⭐ ADICIONE ESTA LINHA ⭐
            user: req.user,
            escolas: escolasLista,
            tiposUsuario: tiposUsuario,
            departamentos: departamentos,
            totalDemandas: totalDemandas
        });
    } catch (error) {
        console.error('Erro ao carregar página de usuários:', error);
        res.status(500).send('Erro interno do servidor');
    }
});
// ============================================
// PÁGINA DE PERFIL (NOVA ROTA)
// ============================================

app.get('/perfil', authMiddleware, async (req, res) => {
    try {
        // Buscar estatísticas para mostrar no perfil
        const totalDemandas = await Demanda.countDocuments();
        const demandasPendentes = await Demanda.countDocuments({ status: 'pendente' });
        const demandasConcluidas = await Demanda.countDocuments({ status: 'concluida' });
        
        res.render('perfil-com-includes', {
        title: 'Meu Perfil - Sistema de Demandas',
        user: req.user,
        escolas: escolasLista,
        currentPage: 'perfil',  // ⭐ ADICIONE ESTA LINHA ⭐
        totalDemandas: totalDemandas,
        demandasPendentes: demandasPendentes,
        demandasConcluidas: demandasConcluidas,
        success: null,
        error: null
    });
    } catch (error) {
        console.error('❌ Erro na página de perfil:', error);
        res.status(500).render('error', {
            title: 'Erro',
            message: 'Erro ao carregar página de perfil',
            user: req.user
        });
    }
});

// ============================================
// 10. ROTAS DE TESTE E ADMIN
// ============================================

// Teste do sistema
app.get('/teste', async (req, res) => {
    const totalUsuarios = await UserModule.User.countDocuments();
    const totalDemandas = await Demanda.countDocuments();
    
    res.json({
        status: 'online',
        sistema: 'Sistema de Demandas Escolares',
        versao: '1.0.0',
        servidor: `http://localhost:${PORT}`,
        bancoDados: 'conectado',
        totalUsuarios,
        totalDemandas,
        totalEscolas: escolasLista.length,
        mensagem: 'Sistema funcionando! 🚀'
    });
});

// Criar admin (se não existir)
app.post('/api/criar-admin', async (req, res) => {
    try {
        // Verificar se já existe admin
        const adminExiste = await UserModule.User.findOne({ tipo: 'administrador' });
        
        if (adminExiste) {
            return res.json({
                success: false,
                message: 'Administrador já existe no sistema'
            });
        }
        
        // Criar admin
        const admin = UserModule.User({
            nome: process.env.ADMIN_NAME || 'Administrador Sistema',
            email: process.env.ADMIN_EMAIL || 'admin@escola.gov.br',
            senha: process.env.ADMIN_INITIAL_PASSWORD || 'Admin123',
            tipo: 'administrador',
            escolas: escolasLista,
            ativo: true
        });
        
        await admin.save();
        
        res.json({
            success: true,
            message: 'Administrador criado com sucesso!',
            usuario: {
                nome: admin.nome,
                email: admin.email,
                tipo: admin.tipo
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Erro ao criar administrador',
            error: error.message
        });
    }
});
// ============================================
// ROTA DE TESTE ABSOLUTAMENTE SIMPLES
// ============================================
app.get('/teste-rota-simples', (req, res) => {
    console.log('🎯 ACESSOU /teste-rota-simples');
    res.json({ 
        success: true, 
        message: '✅ ROTA SIMPLES FUNCIONA!',
        data: ['Teste 1', 'Teste 2', 'Teste 3']
    });
});

app.get('/usuarios-teste', (req, res) => {
    console.log('🎯 ACESSOU /usuarios-teste');
    res.json({
        success: true,
        usuarios: [
            { id: 1, nome: 'João Teste Direto' },
            { id: 2, nome: 'Maria Teste Direto' },
            { id: 3, nome: 'Carlos Teste Direto' }
        ]
    });
});
// ============================================
// ROTAS DE BACKUP
// ============================================

// ============================================
// ROTAS DE BACKUP
// ============================================

// Montar todas as rotas de backup sob o prefixo /api/backup
app.use('/api/backup', backupRoutes);

// Rota de teste do sistema de backup
app.get('/api/teste-backup', (req, res) => {
    res.json({
        status: 'sistema-backup-integrado',
        message: 'Sistema de backup integrado ao servidor principal',
        rotas_disponiveis: {
            listar_backups: '/api/backup/listar (GET - admin)',
            estatisticas: '/api/backup/estatisticas (GET - admin)',
            executar_manual: '/api/backup/executar-manual (POST - admin)',
            status_publico: '/api/backup/status (GET - público)',
            excluir_backup: '/api/backup/excluir/:tipo/:arquivo (DELETE - admin)'
        },
        agendamento: 'Backups automáticos diários às 2h BRT',
        timestamp: new Date().toISOString()
    });
});

// Rota de saúde do sistema
app.get('/api/health', (req, res) => {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        sistema: 'Sistema de Demandas Escolares',
        versao: '2.0.0',
        backup: {
            integrado: true,
            rotas: true,
            agendador: 'pendente_inicializacao'
        },
        database: mongoose.connection.readyState === 1 ? 'conectado' : 'desconectado',
        socket_io: io ? 'ativo' : 'inativo'
    };
    
    res.json(health);
});
// Rota de teste do sistema de backup
app.get('/api/teste-backup', (req, res) => {
    res.json({
        status: 'sistema-backup-integrado',
        message: 'Sistema de backup integrado ao servidor principal',
        rotas_disponiveis: {
            listar_backups: '/api/backup/listar (GET - admin)',
            estatisticas: '/api/backup/estatisticas (GET - admin)',
            executar_manual: '/api/backup/executar-manual (POST - admin)',
            status_publico: '/api/backup/status (GET - público)',
            excluir_backup: '/api/backup/excluir/:tipo/:arquivo (DELETE - admin)'
        },
        agendamento: 'Backups automáticos diários às 2h BRT',
        timestamp: new Date().toISOString()
    });
});

// Rota de saúde do sistema
app.get('/api/health', (req, res) => {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        sistema: 'Sistema de Demandas Escolares',
        versao: '2.0.0',
        backup: {
            integrado: true,
            rotas: true,
            agendador: 'pendente_inicializacao'
        },
        database: mongoose.connection.readyState === 1 ? 'conectado' : 'desconectado',
        socket_io: io ? 'ativo' : 'inativo'
    };
    
    res.json(health);
});
// server.js - Adicione antes do app.listen()


// src/server.js - ADICIONAR ANTES DO app.listen:

// 🔍 IMPORTAR ROTAS DE DEBUG
const debugRoutes = require('./routes/debug');
app.use('/debug', debugRoutes);


// ✅ LOG DE INICIALIZAÇÃO DO DEBUG
console.log('🔍 Rotas de diagnóstico disponíveis em:');
console.log('   - /debug/agendador (página completa)');
console.log('   - /api/teste-agendador (teste manual)');
console.log('   - /api/debug/demandas (dados crus)');
console.log('   - /api/debug/cron (configuração do cron)');
// ============================================
// 11. INICIAR SERVIDOR
// ============================================
async function iniciar() {
    console.log('🔄 Iniciando sistema...');
    
    // Primeiro testar a conexão
    console.log('🧪 Testando conexão com MongoDB Atlas...');
    const conectado = await testarSuaConexao();
    
    if (conectado) {
        // Se conectou, usa a conexão normal
        await conectarMongoDB();
    } else {
        console.log('⚠️  MODO SIMULAÇÃO ATIVADO');
        console.log('💡 O sistema funcionará sem banco de dados por enquanto');
    }

    // ============================================
// INICIAR SISTEMA DE BACKUP
// ============================================
console.log('\n' + '='.repeat(60));
console.log('🔄 INICIANDO SISTEMA DE BACKUP INTEGRADO');
console.log('='.repeat(60));

// Iniciar o agendador de backups
try {
    const backupScheduler = new BackupScheduler();
    backupScheduler.start();
    console.log('✅ Agendador de backups iniciado com sucesso');
    console.log('📅 Backups programados: Diário às 2h, Limpeza: Domingos às 3h');
} catch (error) {
    console.error('❌ Erro ao iniciar agendador de backups:', error.message);
    console.log('⚠️ Sistema de backup funcionará apenas manualmente');
}

// Testar conexão com MongoDB
mongoose.connection.once('open', () => {
    console.log('✅ MongoDB conectado com sucesso');
    
    // Registrar no log do backup
    const logEntry = `[${new Date().toISOString()}] SERVIDOR INICIADO - Sistema de backup integrado\n`;
    const fs = require('fs');
    const path = require('path');
    const logPath = path.join(__dirname, '../backups/logs/server-start.log');
    
    // Criar diretório se não existir
    const logDir = path.dirname(logPath);
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
    
    fs.appendFileSync(logPath, logEntry);
});
        server.listen(PORT, () => {
        console.log('='.repeat(60));
        console.log('🚀 SISTEMA DE DEMANDAS ESCOLARES');
        console.log('='.repeat(60));
        console.log(`✅ Servidor: http://localhost:${PORT}`);
        console.log(`📊 MongoDB: ${conectado ? '✅ CONECTADO' : '⚠️  MODO SIMULAÇÃO'}`);
        console.log(`🔔 Notificações: ✅ PUSH ATIVADO (Socket.io)`);
        
        if (!conectado) {
            console.log('\n💡 PARA CONECTAR AO MONGODB:');
            console.log('   1. Verifique se seu IP foi adicionado no Atlas');
            console.log('   2. Aguarde 2-3 minutos após adicionar o IP');
            console.log('   3. Teste novamente reiniciando o servidor');
        }
        
        console.log('\n👑 CREDENCIAIS PARA TESTE:');
        console.log('   Email: supervisor@escola.gov.br');
        console.log('   Senha: SenhaAdmin123');
        console.log('='.repeat(60));
    });
}
// Teste específico para sua conexão
async function testarSuaConexao() {
    try {
        console.log('🔍 Testando SUA conexão MongoDB Atlas...');
        
        // SUA URI (a mesma do .env)
        const suaURI = 'mongodb+srv://sistema_escolar_admin:juliaanitaannaclara@cluster0.xejrej5.mongodb.net/sistema_escolar?retryWrites=true&w=majority';
        
        console.log('📡 URI:', suaURI.replace(/:[^:@]*@/, ':****@')); // Oculta senha no log
        
        const conn = await mongoose.createConnection(suaURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000 // 10 segundos
        }).asPromise();
        
        console.log('✅ CONEXÃO BEM-SUCEDIDA!');
        console.log('📁 Banco:', conn.name);
        console.log('📍 Host:', conn.host);
        
        return true;
    } catch (error) {
        console.log('❌ ERRO na conexão:', error.message);
        console.log('💡 Verifique:');
        console.log('   1. Se adicionou o IP há mais de 2 minutos');
        console.log('   2. Se a senha está correta');
        console.log('   3. Se o nome do banco está certo');
        return false;
    }
}
// ============================================
// 12. EXECUTAR O SISTEMA
// ============================================

// Tratamento de erros GLOBAL
process.on('uncaughtException', (error) => {
    console.error('💥 ERRO NÃO TRATADO (uncaughtException):');
    console.error('Mensagem:', error.message);
    console.error('Stack:', error.stack);
    console.error('Local do erro:', error.path || error.filename || 'desconhecido');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 PROMISE REJEITADA (unhandledRejection):');
    console.error('Reason:', reason);
});

// INICIAR O SISTEMA
iniciar();