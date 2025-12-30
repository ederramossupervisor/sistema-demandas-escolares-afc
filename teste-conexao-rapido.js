// teste-conexao-rapido.js
require('dotenv').config();
const mongoose = require('mongoose');

console.log('=== TESTE RÁPIDO DE CONEXÃO ===');
console.log('1. .env carregado?', process.env.MONGODB_URI ? 'SIM' : 'NÃO');

if (!process.env.MONGODB_URI) {
    console.log('❌ ERRO: MONGODB_URI não definida no .env');
    console.log('💡 Verifique se o arquivo .env existe e tem:');
    console.log('   MONGODB_URI=mongodb+srv://usuario:senha@cluster...');
    process.exit(1);
}

console.log('2. String (início):', process.env.MONGODB_URI.substring(0, 40) + '...');

async function testar() {
    try {
        console.log('3. Tentando conectar...');
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000
        });
        console.log('✅ CONECTADO! Banco:', mongoose.connection.name);
        process.exit(0);
    } catch (error) {
        console.log('❌ FALHA:', error.message);
        console.log('\n🔧 Verifique:');
        console.log('   • Senha está correta?');
        console.log('   • IP permitido no MongoDB Atlas?');
        console.log('   • String completa no .env?');
        process.exit(1);
    }
}

testar();