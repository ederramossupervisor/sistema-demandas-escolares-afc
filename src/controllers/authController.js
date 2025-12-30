// src/controllers/authController.js
const { User } = require('../models/User');

// Registrar novo usuário (apenas admin)
exports.registrar = async (req, res) => {
    try {
        const { nome, email, senha, tipo, departamento, escolas } = req.body;
        
        // Verificar se email já existe
        const existeUsuario = await User.findOne({ email });
        if (existeUsuario) {
            return res.status(400).json({
                success: false,
                message: 'Email já está em uso'
            });
        }
        
        // Criar usuário
        const usuario = new User({
            nome,
            email,
            senha,
            tipo,
            departamento: tipo === 'comum' ? departamento : null,
            escolas: escolas || [],
            ativo: tipo === 'administrador' ? true : false, // Admin já ativo
            primeiroAcesso: true
        });
        
        await usuario.save();
        
        res.status(201).json({
            success: true,
            message: 'Usuário criado com sucesso',
            usuario: usuario.toJSON()
        });
        
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Erro ao criar usuário',
            error: error.message
        });
    }
};

// Login
exports.login = async (req, res) => {
    try {
        const { email, senha } = req.body;
        
        // Buscar usuário
        const usuario = await User.findOne({ email });
        if (!usuario) {
            return res.status(401).json({
                success: false,
                message: 'Credenciais inválidas'
            });
        }
        
        // Verificar senha
        const senhaValida = await usuario.compararSenha(senha);
        if (!senhaValida) {
            return res.status(401).json({
                success: false,
                message: 'Credenciais inválidas'
            });
        }
        
        // Verificar se usuário está ativo
        if (!usuario.ativo && usuario.tipo !== 'administrador') {
            return res.status(403).json({
                success: false,
                message: 'Usuário aguardando aprovação do administrador'
            });
        }
        
        // Gerar token
        const token = await usuario.gerarAuthToken();
        
        // Se for primeiro acesso, marcar como não é mais
        if (usuario.primeiroAcesso) {
            usuario.primeiroAcesso = false;
            await usuario.save();
        }
        
        res.json({
            success: true,
            message: 'Login realizado com sucesso',
            token,
            usuario: usuario.toJSON(),
            primeiroAcesso: usuario.primeiroAcesso
        });
        
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Erro no login',
            error: error.message
        });
    }
};

// Logout
exports.logout = async (req, res) => {
    try {
        // Remover o token atual
        req.user.tokens = req.user.tokens.filter(tokenObj => {
            return tokenObj.token !== req.token;
        });
        
        await req.user.save();
        
        res.json({
            success: true,
            message: 'Logout realizado com sucesso'
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Erro ao fazer logout',
            error: error.message
        });
    }
};

// Logout de todos os dispositivos
exports.logoutTodos = async (req, res) => {
    try {
        req.user.tokens = [];
        await req.user.save();
        
        res.json({
            success: true,
            message: 'Logout de todos os dispositivos realizado'
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Erro ao fazer logout',
            error: error.message
        });
    }
};

// Obter perfil do usuário logado
exports.getPerfil = async (req, res) => {
    res.json({
        success: true,
        usuario: req.user.toJSON()
    });
};

// Atualizar perfil
exports.atualizarPerfil = async (req, res) => {
    try {
        const updates = req.body;
        
        // Não permitir atualizar campos sensíveis
        const camposPermitidos = ['nome', 'escolas'];
        const camposAtualizar = {};
        
        Object.keys(updates).forEach(update => {
            if (camposPermitidos.includes(update)) {
                camposAtualizar[update] = updates[update];
            }
        });
        
        // Atualizar usuário
        Object.assign(req.user, camposAtualizar);
        await req.user.save();
        
        res.json({
            success: true,
            message: 'Perfil atualizado com sucesso',
            usuario: req.user.toJSON()
        });
        
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Erro ao atualizar perfil',
            error: error.message
        });
    }
};

// Alterar senha
exports.alterarSenha = async (req, res) => {
    try {
        const { senhaAtual, novaSenha } = req.body;
        
        // Verificar senha atual
        const senhaValida = await req.user.compararSenha(senhaAtual);
        if (!senhaValida) {
            return res.status(401).json({
                success: false,
                message: 'Senha atual incorreta'
            });
        }
        
        // Atualizar senha
        req.user.senha = novaSenha;
        req.user.primeiroAcesso = false;
        await req.user.save();
        
        res.json({
            success: true,
            message: 'Senha alterada com sucesso'
        });
        
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Erro ao alterar senha',
            error: error.message
        });
    }
};