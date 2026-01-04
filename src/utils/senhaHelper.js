// src/utils/senhaHelper.js

/**
 * Gera uma senha temporária segura
 * @param {number} length - Comprimento da senha (padrão: 10)
 * @returns {string} Senha temporária
 */
const gerarSenhaTemporaria = (length = 10) => {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';
    let senha = '';
    
    for (let i = 0; i < length; i++) {
        senha += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    
    return senha;
};

/**
 * Valida força da senha
 * @param {string} senha - Senha a ser validada
 * @returns {object} {valida: boolean, erros: string[]}
 */
const validarForcaSenha = (senha) => {
    const erros = [];
    
    if (senha.length < 8) {
        erros.push('A senha deve ter pelo menos 8 caracteres');
    }
    
    if (!/[A-Z]/.test(senha)) {
        erros.push('A senha deve conter pelo menos uma letra maiúscula');
    }
    
    if (!/[a-z]/.test(senha)) {
        erros.push('A senha deve conter pelo menos uma letra minúscula');
    }
    
    if (!/\d/.test(senha)) {
        erros.push('A senha deve conter pelo menos um número');
    }
    
    if (!/[!@#$%&*]/.test(senha)) {
        erros.push('A senha deve conter pelo menos um caractere especial (!@#$%&*)');
    }
    
    return {
        valida: erros.length === 0,
        erros: erros
    };
};

/**
 * Verifica se a senha é muito comum
 * @param {string} senha - Senha a ser verificada
 * @returns {boolean} true se for comum
 */
const senhaMuitoComum = (senha) => {
    const senhasComuns = [
        '12345678', 'password', '123456789', '1234567', '123456',
        'qwerty123', 'admin123', 'welcome1', 'senha123', 'brasil123',
        'escola123', 'secretaria', 'pedagogico', 'gestao123'
    ];
    
    return senhasComuns.includes(senha.toLowerCase());
};

/**
 * Calcula pontuação da senha (0-100)
 * @param {string} senha - Senha a ser avaliada
 * @returns {number} Pontuação de 0 a 100
 */
const calcularPontuacaoSenha = (senha) => {
    let pontuacao = 0;
    
    // Comprimento
    if (senha.length >= 8) pontuacao += 20;
    if (senha.length >= 12) pontuacao += 10;
    
    // Diversidade de caracteres
    if (/[A-Z]/.test(senha)) pontuacao += 15;
    if (/[a-z]/.test(senha)) pontuacao += 15;
    if (/\d/.test(senha)) pontuacao += 15;
    if (/[!@#$%&*]/.test(senha)) pontuacao += 15;
    
    // Penalidade por padrões simples
    if (/(.)\1{2,}/.test(senha)) pontuacao -= 10; // Caracteres repetidos
    if (/^[0-9]+$/.test(senha)) pontuacao -= 20; // Apenas números
    if (/^[a-zA-Z]+$/.test(senha)) pontuacao -= 20; // Apenas letras
    
    // Penalidade por senhas comuns
    if (senhaMuitoComum(senha)) pontuacao = 0;
    
    return Math.max(0, Math.min(100, pontuacao));
};

/**
 * Gera sugestões para melhorar a senha
 * @param {string} senha - Senha atual
 * @returns {string[]} Array de sugestões
 */
const gerarSugestoesSenha = (senha) => {
    const sugestoes = [];
    
    if (senha.length < 8) {
        sugestoes.push(`Adicione mais ${8 - senha.length} caracteres`);
    }
    
    if (!/[A-Z]/.test(senha)) {
        sugestoes.push('Adicione pelo menos uma letra MAIÚSCULA');
    }
    
    if (!/[a-z]/.test(senha)) {
        sugestoes.push('Adicione pelo menos uma letra minúscula');
    }
    
    if (!/\d/.test(senha)) {
        sugestoes.push('Adicione pelo menos um número');
    }
    
    if (!/[!@#$%&*]/.test(senha)) {
        sugestoes.push('Adicione pelo menos um caractere especial (! @ # $ % & *)');
    }
    
    // Sugestões gerais
    if (sugestoes.length === 0 && senha.length < 12) {
        sugestoes.push('Tente usar uma senha com 12 ou mais caracteres para maior segurança');
    }
    
    if (/(.)\1{2,}/.test(senha)) {
        sugestoes.push('Evite repetir o mesmo caractere muitas vezes seguidas');
    }
    
    return sugestoes;
};

module.exports = {
    gerarSenhaTemporaria,
    validarForcaSenha,
    senhaMuitoComum,
    calcularPontuacaoSenha,
    gerarSugestoesSenha
};