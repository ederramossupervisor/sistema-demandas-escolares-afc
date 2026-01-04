/**
 * MIDDLEWARE DE VERIFICAÇÃO DE PRIMEIRO ACESSO (ATUALIZADO)
 * 
 * Este middleware verifica se o usuário precisa alterar a senha
 * Trabalha COM sessions (para redirecionamento web)
 */

const { User } = require('../models/User');

module.exports = async function checkFirstAccess(req, res, next) {
    try {
        console.log('🔍 [Primeiro Acesso] Verificando usuário...');
        
        // 1. Só verificar se usuário está autenticado via sessão
        if (!req.user || !req.user._id) {
            console.log('⚠️ [Primeiro Acesso] Usuário não autenticado na sessão');
            return next();
        }
        
        // 2. Buscar usuário atualizado no banco
        const usuario = await User.findById(req.user._id);
        
        if (!usuario) {
            console.log('❌ [Primeiro Acesso] Usuário não encontrado no banco');
            return next();
        }
        
        // 3. Verificar se está na página de alteração de senha
        const isAlterarSenhaPage = req.path === '/alterar-senha' || 
                                   req.path === '/auth/alterar-senha';
        
        // 4. Verificar se precisa alterar senha
        const precisaAlterar = usuario.obrigarAlteracaoSenha === true || 
                               usuario.primeiroAcesso === true;
        
        console.log('📊 [Primeiro Acesso] Status:', {
            email: usuario.email,
            primeiroAcesso: usuario.primeiroAcesso,
            obrigarAlteracaoSenha: usuario.obrigarAlteracaoSenha,
            precisaAlterar: precisaAlterar,
            paginaAtual: req.path
        });
        
        // 5. Se precisa alterar E NÃO está na página certa → REDIRECIONAR
        if (precisaAlterar && !isAlterarSenhaPage) {
            console.log('🔄 [Primeiro Acesso] Redirecionando para /alterar-senha');
            
            req.session.mensagem = {
                tipo: 'warning',
                texto: 'Você precisa alterar sua senha antes de acessar o sistema.'
            };
            
            return res.redirect('/alterar-senha');
        }
        
        // 6. Se não precisa alterar mas ainda tem flags ativas, corrigir
        if (!precisaAlterar && (usuario.primeiroAcesso === true || usuario.obrigarAlteracaoSenha === true)) {
            console.log('🔄 [Primeiro Acesso] Corrigindo flags do usuário');
            usuario.primeiroAcesso = false;
            usuario.obrigarAlteracaoSenha = false;
            await usuario.save();
        }
        
        // 7. Tudo OK, continuar
        console.log('✅ [Primeiro Acesso] Acesso permitido');
        next();
        
    } catch (error) {
        console.error('❌ [Primeiro Acesso] Erro:', error.message);
        next();
    }
};