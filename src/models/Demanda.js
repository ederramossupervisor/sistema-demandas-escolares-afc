// src/models/Demanda.js - VERSÃO À PROVA DE ERROS
const mongoose = require('mongoose');

// VERIFICAR SE MODELO JÁ EXISTE
if (mongoose.models && mongoose.models.Demanda) {
    // Se já existe, usar o existente
    console.log('✅ Modelo Demanda já está carregado (usando cache)');
    module.exports = mongoose.models.Demanda;
} else {
    // Se não existe, criar novo
    console.log('📝 Criando novo modelo Demanda...');
    
    const demandaSchema = new mongoose.Schema({
        titulo: { type: String, required: true },
        descricao: { type: String, required: true },
        escola: { type: String, required: true },
        departamento: { type: String, required: true },
        prioridade: { type: String, default: 'Média' },
        status: { type: String, default: 'pendente' },
        criadoPor: { 
            id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            nome: String,
            email: String
        },
        responsavel: {
            id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            nome: String,
            email: String
        },
        prazo: { type: Date },
        criadoEm: { type: Date, default: Date.now },
        atualizadoEm: { type: Date, default: Date.now }
    });

    // Criar modelo UMA VEZ
    const Demanda = mongoose.model('Demanda', demandaSchema);
    module.exports = Demanda;
}