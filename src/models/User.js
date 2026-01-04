// src/models/User.js - VERSÃO COMPLETA ATUALIZADA PARA SISTEMA PROFISSIONAL
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
        match: [
            /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 
            'Email inválido. Use um email corporativo válido (ex: usuario@escola.gov.br)'
        ]
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
        enum: ['Supervisão', 'Gestão', 'Pedagógico', 'Secretaria', null],
        default: null
    },
    escolas: [{
        type: String,
        enum: escolasLista
    }],
    
    // === NOVOS CAMPOS PARA SISTEMA PROFISSIONAL ===
    
    // Link com a solicitação de cadastro (se veio de uma solicitação)
    solicitacaoOrigem: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SolicitacaoCadastro',
        default: null
    },
    
    // Senha temporária em texto claro (apenas para envio por email)
    senhaTemporaria: {
        type: String,
        default: null
    },
    
    // Histórico de senhas (hashes) para prevenir reuso
    senhasAnteriores: [{
        hash: String,
        alteradaEm: {
            type: Date,
            default: Date.now
        }
    }],
    
    // Data de aprovação pelo admin
    dataAprovacao: {
        type: Date,
        default: null
    },
    
    // Admin que aprovou o cadastro
    aprovadoPor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    
    // === CAMPOS EXISTENTES ===
    
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
    },
    dataCadastro: {
        type: Date,
        default: Date.now
    },
    
    dataUltimaAlteracaoSenha: {
        type: Date,
        default: Date.now
    },
    
    // Status da conta
    contaAtiva: {
        type: Boolean,
        default: true
    },
    
    // === NOVO CAMPO ADICIONADO PARA PRIMEIRO ACESSO ===
    obrigarAlteracaoSenha: {
        type: Boolean,
        default: true  // True = usuário precisa alterar senha no próximo login
    }
});

// Middleware: Atualizar data de modificação
UserSchema.pre('save', function(next) {
    this.atualizadoEm = Date.now();
    next();
});

// Criptografar senha antes de salvar (CORRIGIDO)
UserSchema.pre('save', async function(next) {
    try {
        // Só criptografar se a senha foi modificada
        if (this.isModified('senha')) {
            console.log('🔐 Criptografando senha para:', this.email);
            
            // Se NÃO for um novo documento (usuário está alterando senha)
            if (!this.isNew) {
                console.log('🔄 Usuário está alterando senha, adicionando ao histórico...');
                
                // Adicionar senha atual ao histórico ANTES de criptografar a nova
                if (this.senha && this.senha.startsWith('$2b$')) {
                    // A senha atual já está hasheada
                    await this.adicionarSenhaAoHistorico(this.senha);
                }
                
                // Usuário já não tem primeiro acesso
                this.primeiroAcesso = false;
                this.obrigarAlteracaoSenha = false;
                this.dataUltimaAlteracaoSenha = Date.now();
            }
            
            // Criptografar a nova senha (ou senha inicial)
            const salt = await bcrypt.genSalt(10);
            this.senha = await bcrypt.hash(this.senha, salt);
            
            console.log('✅ Senha criptografada para:', this.email);
        }
        
        next();
    } catch (error) {
        console.error('❌ Erro ao criptografar senha:', error.message);
        next(error);
    }
});

// Método para gerar token JWT
UserSchema.methods.gerarAuthToken = async function() {
    const user = this;
    const token = jwt.sign(
        { userId: user._id.toString(), email: user.email },
        process.env.JWT_SECRET || 'segredo_dev_fallback',
        { expiresIn: process.env.JWT_EXPIRE || '30d' }
    );
    
    user.tokens = user.tokens.concat({ token });
    await user.save();
    
    return token;
};

// Método para gerar senha temporária
UserSchema.methods.gerarSenhaTemporaria = function() {
    // Gera uma senha de 10 caracteres com números e letras
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let senhaTemporaria = '';
    
    for (let i = 0; i < 10; i++) {
        senhaTemporaria += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    
    // Armazena a senha em texto claro (apenas para envio por email)
    this.senhaTemporaria = senhaTemporaria;
    
    return senhaTemporaria;
};

// Método para comparar senhas
UserSchema.methods.compararSenha = async function(senhaDigitada) {
    return await bcrypt.compare(senhaDigitada, this.senha);
};

// Método para verificar se senha já foi usada anteriormente (ATUALIZADO)
UserSchema.methods.senhaJaUsada = async function(senha) {
    if (!this.senhasAnteriores || this.senhasAnteriores.length === 0) {
        return false;
    }
    
    // Verifica cada senha anterior no histórico
    for (const senhaAnterior of this.senhasAnteriores) {
        const corresponde = await bcrypt.compare(senha, senhaAnterior.hash);
        if (corresponde) {
            return true; // Senha já foi usada
        }
    }
    
    return false; // Senha nunca foi usada
};

// Método para adicionar senha ao histórico (ATUALIZADO)
UserSchema.methods.adicionarSenhaAoHistorico = async function(senhaHash) {
    if (!this.senhasAnteriores) {
        this.senhasAnteriores = [];
    }
    
    this.senhasAnteriores.push({
        hash: senhaHash,
        alteradaEm: Date.now()
    });
    
    // Mantém apenas as últimas 5 senhas
    if (this.senhasAnteriores.length > 5) {
        this.senhasAnteriores = this.senhasAnteriores.slice(-5);
    }
    
    await this.save();
};

// Método para verificar se usuário precisa alterar senha (NOVO)
UserSchema.methods.precisaAlterarSenha = function() {
    return this.obrigarAlteracaoSenha === true || this.primeiroAcesso === true;
};

// Método para forçar alteração de senha (NOVO)
UserSchema.methods.forcarAlteracaoSenha = async function() {
    this.obrigarAlteracaoSenha = true;
    await this.save();
};

// Método para completar alteração de senha (NOVO)
UserSchema.methods.completarAlteracaoSenha = async function(novaSenhaHash) {
    // Adiciona a senha ANTIGA ao histórico antes de trocar
    if (this.senha) {
        await this.adicionarSenhaAoHistorico(this.senha);
    }
    
    // Atualiza campos
    this.obrigarAlteracaoSenha = false;
    this.primeiroAcesso = false;
    this.dataUltimaAlteracaoSenha = Date.now();
    
    await this.save();
};

// Remover dados sensíveis antes de retornar
UserSchema.methods.toJSON = function() {
    const user = this.toObject();
    delete user.senha;
    delete user.senhaTemporaria;
    delete user.tokens;
    delete user.resetToken;
    delete user.resetTokenExpira;
    delete user.senhasAnteriores;
    return user;
};

// Índices para melhor performance
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ ativo: 1 });
UserSchema.index({ primeiroAcesso: 1 });
UserSchema.index({ obrigarAlteracaoSenha: 1 });
UserSchema.index({ 'tokens.token': 1 });

// CORREÇÃO: PREVENIR ERRO DE MODELO DUPLICADO
// Não crie o modelo diretamente, verifique se já existe primeiro
let User;

try {
    // Tenta obter o modelo já registrado
    User = mongoose.model('User');
} catch (error) {
    // Se não existir, cria o modelo
    User = mongoose.model('User', UserSchema);
}

// Exportação que previne o erro "Cannot overwrite model once compiled"
module.exports = {
    User,
    escolasLista
};