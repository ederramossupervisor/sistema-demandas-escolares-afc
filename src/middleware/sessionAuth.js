/**
 * MIDDLEWARE DE AUTENTICAÇÃO VIA SESSÃO (PARA WEB)
 * VERSÃO CORRIGIDA - SEM LOOP DE REDIRECIONAMENTO
 */

const { User } = require('../models/User');

module.exports = async function sessionAuth(req, res, next) {
    console.log('🔐 [Session Auth] Verificando sessão para:', req.path);
    
    // 1. Lista de rotas públicas (não precisam de autenticação)
    const publicRoutes = [
        '/',
        '/login',
        '/auth/login',
        '/auth/logout',
        '/solicitar-cadastro',
        '/auth/solicitar-cadastro',
        '/esqueci-senha',
        '/auth/esqueci-senha',
        '/alterar-senha',
        '/auth/alterar-senha',
        '/logout'
    ];
    
    // Verificar se é rota pública
    const isPublicRoute = publicRoutes.some(route => req.path === route || req.path.startsWith(route + '/'));
    
    if (isPublicRoute) {
        console.log('✅ [Session Auth] Rota pública, permitindo acesso');
        
        // SE ESTIVER NA PÁGINA DE LOGIN E JÁ ESTIVER LOGADO, REDIRECIONA PARA DASHBOARD
        if ((req.path === '/' || req.path === '/login') && req.session.userId) {
            console.log('🔄 [Session Auth] Usuário já logado, redirecionando para dashboard');
            return res.redirect('/dashboard');
        }
        
        return next();
    }
    
    // 2. Verificar se usuário está na sessão (para rotas PRIVADAS)
    if (!req.session.userId) {
        console.log('❌ [Session Auth] Sessão não encontrada, redirecionando para login');
        
        req.session.mensagem = {
            tipo: 'warning',
            texto: 'Faça login para acessar o sistema.'
        };
        
        return res.redirect('/login');
    }
    
    try {
        // 3. Buscar usuário no banco
        const user = await User.findById(req.session.userId).select('-senha -senhaTemporaria -tokens');
        
        if (!user) {
            console.log('❌ [Session Auth] Usuário não encontrado no banco');
            req.session.destroy();
            return res.redirect('/login');
        }
        
        // 4. Verificar se usuário está ativo
        if (!user.ativo && user.tipo !== 'administrador') {
            console.log('❌ [Session Auth] Usuário inativo:', user.email);
            
            req.session.mensagem = {
                tipo: 'error',
                texto: 'Sua conta está aguardando aprovação do administrador.'
            };
            
            req.session.destroy();
            return res.redirect('/login');
        }
        
        // 5. Adicionar usuário à requisição
        req.user = user;
        req.userId = user._id;
        req.userType = user.tipo;
        req.userEmail = user.email;
        
        console.log('✅ [Session Auth] Usuário autenticado:', user.email, 'Tipo:', user.tipo);
        next();
        
    } catch (error) {
        console.error('❌ [Session Auth] Erro:', error.message);
        req.session.destroy();
        res.redirect('/login');
    }
};