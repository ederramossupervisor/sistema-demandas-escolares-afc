const mongoose = require('mongoose');
require('dotenv').config();

// Conexão com MongoDB
async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sistema-demandas', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Conectado ao MongoDB');
    } catch (error) {
        console.error('❌ Erro ao conectar ao MongoDB:', error.message);
        process.exit(1);
    }
}

// Limpar todos os usuários exceto admin
async function cleanupUsers() {
    try {
        const { User } = require('./src/models/User');
        
        // Deletar TODOS os usuários
        const deleteResult = await User.deleteMany({});
        console.log(`🗑️  Deletados ${deleteResult.deletedCount} usuários`);
        
        // Criar apenas o admin
        const adminUser = new User({
            nome: 'Administrador Master',
            email: 'admin@escola.com',
            senha: 'SenhaAdmin123', // Será hasheada automaticamente
            tipo: 'administrador',
            departamento: 'Supervisão',
            escolas: ['CEEFMTI Afonso Cláudio'],
            ativo: true,
            primeiroAcesso: false,
            obrigarAlteracaoSenha: false,
            contaAtiva: true
        });
        
        await adminUser.save();
        console.log('✅ Admin criado com sucesso!');
        console.log('📧 Email: admin@escola.com');
        console.log('🔑 Senha: SenhaAdmin123');
        
        // Verificar
        const usersCount = await User.countDocuments({});
        console.log(`📊 Total de usuários no banco: ${usersCount}`);
        
    } catch (error) {
        console.error('❌ Erro ao limpar usuários:', error.message);
    }
}

// Executar
async function main() {
    console.log('🚀 Iniciando limpeza do banco de dados...');
    await connectDB();
    await cleanupUsers();
    
    console.log('\n🎯 PROCESSO CONCLUÍDO!');
    console.log('✅ Banco limpo com sucesso');
    console.log('✅ Admin principal criado');
    console.log('\n📋 Agora você pode:');
    console.log('1. Acessar https://sistema-demandas-escolares-afc.onrender.com');
    console.log('2. Login com: admin@escola.com / SenhaAdmin123');
    console.log('3. Alterar a senha imediatamente');
    
    mongoose.disconnect();
}

main();