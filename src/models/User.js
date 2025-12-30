// src/models/User.js - VERSÃO ATUALIZADA
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Lista de escolas pré-configuradas
const escolasLista = [
    'CEEFMTI Afonso Cláudio',
    'CEEFMTI Elisa Paiva',
    'EEEFM Domingos Perim',
    'EEEFM Fazenda Emílio Schroeder',
    'EEEFM Álvaro Castelo',
    'EEEFM Alto Rio Possmoser',
    'EEEFM Elvira Barros',
    'EEEFM Fazenda Camporês',
    'EEEFM Fioravante Caliman',
    'EEEFM Frederico Boldt',
    'EEEFM Gisela Salloker Fayet',
    'EEEFM Graça Aranha',
    'EEEFM Joaquim Caetano de Paiva',
    'EEEFM José Cupertino',
    'EEEFM José Giestas',
    'EEEFM José Roberto Christo',
    'EEEFM Leogildo Severiano de Souza',
    'EEEFM Luiz Jouffroy',
    'EEEFM Marlene Brandão',
    'EEEFM Maria de Abreu Alvim',
    'EEEFM Pedra Azul',
    'EEEFM Ponto do Alto',
    'EEEFM Prof. Hermann Berger',
    'EEEFM Profª Aldy Soares Merçon Vargas',
    'EEEFM São Jorge',
    'EEEFM São Luís',
    'EEEFM Teófilo Paulino',
    'EEEM Francisco Guilherme',
    'EEEM Mata Fria',
    'EEEM Sobreiro'
];

const UserSchema = new mongoose.Schema({
    nome: {
        type: String,
        required: [true, 'Nome é obrigatório'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'Email é obrigatório'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Email inválido']
    },
    senha: {
        type: String,
        required: [true, 'Senha é obrigatória'],
        minlength: 6
    },
    tipo: {
        type: String,
        enum: ['administrador', 'supervisao', 'gestao', 'comum'],
        default: 'comum',
        required: true
    },
    departamento: {
        type: String,
        enum: ['pedagogico', 'secretaria', null],
        default: null
    },
    escolas: [{
        type: String,
        enum: escolasLista
    }],
    ativo: {
        type: Boolean,
        default: false  // Só ativo depois de aprovação do admin
    },
    primeiroAcesso: {
        type: Boolean,
        default: true
    },
    tokens: [{
        token: {
            type: String,
            required: true
        }
    }],
    resetToken: String,
    resetTokenExpira: Date,
    criadoEm: {
        type: Date,
        default: Date.now
    },
    atualizadoEm: {
        type: Date,
        default: Date.now
    }
});

// Criptografar senha antes de salvar
UserSchema.pre('save', async function(next) {
    if (!this.isModified('senha')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.senha = await bcrypt.hash(this.senha, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Método para gerar token JWT
UserSchema.methods.gerarAuthToken = async function() {
    const user = this;
    const token = jwt.sign(
        { userId: user._id.toString(), email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '30d' }
    );
    
    user.tokens = user.tokens.concat({ token });
    await user.save();
    
    return token;
};

// Método para comparar senhas
UserSchema.methods.compararSenha = async function(senhaDigitada) {
    return await bcrypt.compare(senhaDigitada, this.senha);
};

// Remover dados sensíveis antes de retornar
UserSchema.methods.toJSON = function() {
    const user = this.toObject();
    delete user.senha;
    delete user.tokens;
    delete user.resetToken;
    delete user.resetTokenExpira;
    return user;
};

const User = mongoose.model('User', UserSchema);

module.exports = {
    User,
    escolasLista
};