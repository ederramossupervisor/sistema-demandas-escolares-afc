// src/config/database.js - VERSÃO CORRIGIDA
const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        console.log('🔍 Verificando variáveis de ambiente...');
        console.log('MONGODB_URI configurada:', process.env.MONGODB_URI ? 'SIM' : 'NÃO');
        
        if (!process.env.MONGODB_URI) {
            console.log('⚠️  AVISO: MONGODB_URI não encontrada no .env');
            console.log('📁 Usando banco de dados local para desenvolvimento...');
        }
        
        // Usar a string do .env ou mostrar erro
        const DB_URI = process.env.MONGODB_URI;
        
        if (!DB_URI) {
            console.log('❌ ERRO: Variável MONGODB_URI não definida no arquivo .env');
            console.log('🔧 Por favor, configure:');
            console.log('   1. Abra o arquivo .env');
            console.log('   2. Adicione: MONGODB_URI=sua_string_aqui');
            console.log('   3. Reinicie o servidor');
            throw new Error('MONGODB_URI não definida');
        }
        
        console.log('🔄 Conectando ao MongoDB Atlas...');
        console.log('📡 String (oculta por segurança):', DB_URI.substring(0, 50) + '...');
        
        await mongoose.connect(DB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
        });
        
        console.log('✅ CONEXÃO BEM-SUCEDIDA com MongoDB Atlas!');
        console.log('📊 Banco:', mongoose.connection.name);
        console.log('📍 Host:', mongoose.connection.host);
        console.log('👤 Usuário:', mongoose.connection.user || 'Não disponível');
        console.log('☁️  Tipo: MongoDB Atlas (Nuvem)');
        
    } catch (error) {
        console.error('\n❌ ERRO na conexão com MongoDB Atlas:');
        console.error('   Mensagem:', error.message);
        
        if (error.message.includes('Authentication failed')) {
            console.error('\n🔧 PROBLEMA: Autenticação falhou');
            console.error('   SOLUÇÃO: Verifique:');
            console.error('   1. Senha no arquivo .env está correta?');
            console.error('   2. Usuário existe no MongoDB Atlas?');
            console.error('   3. IP está permitido (Network Access)?');
        } else if (error.message.includes('getaddrinfo')) {
            console.error('\n🔧 PROBLEMA: Não conseguiu encontrar o servidor');
            console.error('   SOLUÇÃO: Verifique:');
            console.error('   1. String de conexão está correta?');
            console.error('   2. Você tem conexão com internet?');
        }
        
        console.error('\n📝 SUA STRING DE CONEXÃO deve ser:');
        console.error('   mongodb+srv://sistema_escolar_admin:juliaanitaannaclara@cluster0.xejrej5.mongodb.net/?appName=Cluster0');
        
        // Encerrar o processo para forçar correção
        process.exit(1);
    }
};

module.exports = connectDB;