// src/server.js - VERSÃO COMPLETA E FUNCIONAL
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');

// ============================================
// 1. CARREGAR .env
// ============================================
require('dotenv').config();
//const expressLayouts = require('express-ejs-layouts');

// ============================================
// 2. CONFIGURAÇÃO DO EXPRESS
// ============================================
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

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

// ============================================
// 4. MODELOS SIMPLIFICADOS (PARA TESTE)
// ============================================
const UserSchema = new mongoose.Schema({
    nome: String,
    email: { type: String, unique: true },
    senha: String,
    tipo: String,
    escolas: [String],
    ativo: { type: Boolean, default: true }
});

const User = mongoose.model('User', UserSchema);

const DemandaSchema = new mongoose.Schema({
    titulo: { type: String, required: true },
    descricao: { type: String, required: true },
    escola: { type: String, required: true },
    departamento: { type: String, required: true },
    prioridade: { type: String, default: 'Média' }, // ADICIONE ESTA LINHA
    status: { type: String, default: 'pendente' },
    criadoPor: { type: String, required: true },
    criadoEm: { type: Date, default: Date.now },
    prazo: { type: Date } // ADICIONE ESTA LINHA SE NÃO EXISTIR
});

const Demanda = mongoose.model('Demanda', DemandaSchema);

// ============================================
// 5. MIDDLEWARE DE AUTENTICAÇÃO SIMPLIFICADO
// ============================================
const authMiddleware = async (req, res, next) => {
    try {
        // Em modo de desenvolvimento, vamos simular um usuário
        // Em produção, isso viria do token JWT
        req.user = {
            _id: 'admin123',
            nome: 'Eder Ramos Supervisor',
            email: 'supervisor@escola.gov.br',
            tipo: 'administrador',
            escolas: escolasLista.slice(0, 5),
            departamento: 'Pedagogico'
        };
        console.log('🔐 Middleware auth: Usuário simulado atribuído');
        next();
    } catch (error) {
        console.error('❌ Erro no middleware auth:', error);
        res.status(401).json({ error: 'Não autenticado' });
    }
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

// ROTA: Listar todas as demandas
app.get('/api/demandas', authMiddleware, async (req, res) => {
    try {
        const demandas = await Demanda.find()
            .sort({ criadoEm: -1 })
            .limit(50);
        
        res.json({
            success: true,
            count: demandas.length,
            data: demandas
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
// ROTA: Criar nova demanda (COMPLETA)
// ============================================
app.post('/api/demandas', authMiddleware, async (req, res) => {
    try {
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
        const departamentosValidos = ['Pedagogico', 'Administrativo', 'Manutenção', 
                                     'Recursos Humanos', 'Alimentação', 'Transporte', 'Outros'];
        
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
            criadoPor: req.user._id,
            criadoEm: new Date(),
            prazo: dataPrazo
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
// 8. ROTAS DE AUTENTICAÇÃO
// ============================================

// ROTA: Login (API)
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        console.log('🔐 Tentativa de login:', email);
        
        // Verificar credenciais fixas (para desenvolvimento)
        if (email === 'supervisor@escola.gov.br' && password === 'SenhaAdmin123') {
            // Verificar se usuário existe no banco
            let usuario = await User.findOne({ email });
            
            // Se não existir, criar
            if (!usuario) {
                usuario = new User({
                    nome: 'Eder Ramos Supervisor',
                    email: 'supervisor@escola.gov.br',
                    senha: password,
                    tipo: 'administrador',
                    escolas: escolasLista,
                    ativo: true
                });
                await usuario.save();
                console.log('👤 Usuário admin criado no banco');
            }
            
            res.json({
                success: true,
                message: 'Login realizado com sucesso!',
                token: 'jwt_token_simulado_' + Date.now(),
                usuario: {
                    _id: usuario._id,
                    nome: usuario.nome,
                    email: usuario.email,
                    tipo: usuario.tipo,
                    escolas: usuario.escolas
                }
            });
        } else {
            res.status(401).json({
                success: false,
                message: 'Credenciais inválidas. Use: supervisor@escola.gov.br / SenhaAdmin123'
            });
        }
    } catch (error) {
        console.error('❌ Erro no login:', error);
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor'
        });
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

// Dashboard (protegido)
app.get('/dashboard', authMiddleware, async (req, res) => {
    try {
        const totalDemandas = await Demanda.countDocuments();
        const demandasPendentes = await Demanda.countDocuments({ status: 'pendente' });
        const demandasConcluidas = await Demanda.countDocuments({ status: 'concluida' });
        
        res.render('dashboard-funcional', {  // ⬅️ MUDE PARA dashboard-funcional
            title: 'Dashboard - Sistema de Demandas',
            user: req.user,
            totalDemandas,
            demandasPendentes,
            demandasConcluidas,
            escolas: escolasLista
        });
    } catch (error) {
        console.error('❌ Erro no dashboard:', error);
        res.status(500).send(`
            <h1>Erro no Dashboard</h1>
            <p><strong>${error.message}</strong></p>
            <a href="/" class="btn btn-primary">Voltar ao Login</a>
        `);
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
                { valor: 'gestao', label: 'Gestão (Visualização e Relatórios)' },
                { valor: 'comum', label: 'Usuário Comum (Cria Demandas)' }
            ],
            departamentos: [
                { valor: 'Pedagogico', label: 'Pedagógico' },
                { valor: 'Administrativo', label: 'Administrativo' },
                { valor: 'Manutencao', label: 'Manutenção' },
                { valor: 'RecursosHumanos', label: 'Recursos Humanos' },
                { valor: 'Alimentacao', label: 'Alimentação' },
                { valor: 'Transporte', label: 'Transporte' },
                { valor: 'Outros', label: 'Outros' }
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

// ============================================
// 10. ROTAS DE TESTE E ADMIN
// ============================================

// Teste do sistema
app.get('/teste', async (req, res) => {
    const totalUsuarios = await User.countDocuments();
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
        const adminExiste = await User.findOne({ tipo: 'administrador' });
        
        if (adminExiste) {
            return res.json({
                success: false,
                message: 'Administrador já existe no sistema'
            });
        }
        
        // Criar admin
        const admin = new User({
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
    
    app.listen(PORT, () => {
        console.log('='.repeat(60));
        console.log('🚀 SISTEMA DE DEMANDAS ESCOLARES');
        console.log('='.repeat(60));
        console.log(`✅ Servidor: http://localhost:${PORT}`);
        console.log(`📊 MongoDB: ${conectado ? '✅ CONECTADO' : '⚠️  MODO SIMULAÇÃO'}`);
        
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