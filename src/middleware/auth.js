// src/middleware/auth.js - PARA API/REST (MANTIDO)
const jwt = require('jsonwebtoken');
const { User } = require('../models/User');

// Middleware para verificar token JWT (API)
const auth = async (req, res, next) => {
    try {
        // Obter token do header
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            // Também verificar em cookies (para web)
            const cookieToken = req.cookies?.token;
            if (!cookieToken) {
                throw new Error();
            }
            req.token = cookieToken;
        } else {
            req.token = token;
        }

        // Verificar token
        const decoded = jwt.verify(req.token, process.env.JWT_SECRET);
        
        // Buscar usuário
        const user = await User.findOne({
            _id: decoded.userId,
            'tokens.token': req.token
        });

        if (!user) {
            throw new Error();
        }

        // Verificar se usuário está ativo
        if (!user.ativo && user.tipo !== 'administrador') {
            throw new Error('Usuário não está ativo. Aguarde aprovação do administrador.');
        }

        // Adicionar usuário e token à requisição
        req.user = user;
        req.userId = user._id;
        req.userType = user.tipo;
        
        next();
    } catch (error) {
        res.status(401).json({
            success: false,
            message: 'Por favor, faça autenticação.',
            error: error.message
        });
    }
};

// Middleware para verificar tipo de usuário
const requireAdmin = (req, res, next) => {
    if (req.userType !== 'administrador') {
        return res.status(403).json({
            success: false,
            message: 'Acesso negado. Apenas administradores.'
        });
    }
    next();
};

const requireSupervisao = (req, res, next) => {
    const allowed = ['administrador', 'supervisao'];
    if (!allowed.includes(req.userType)) {
        return res.status(403).json({
            success: false,
            message: 'Acesso negado. Apenas supervisão ou administrador.'
        });
    }
    next();
};

module.exports = { auth, requireAdmin, requireSupervisao };