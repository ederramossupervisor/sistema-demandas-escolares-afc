// corrigir-senha-admin-v2.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function corrigirSenhaAdmin() {
    try {
        console.log('🔧 CORREÇÃO DIRETA DA SENHA DO ADMIN...');
        
        // Conectar ao banco
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ CONECTADO AO BANCO');
        
        // Usar o modelo diretamente do mongoose para evitar hooks
        const User = mongoose.model('User');
        
        if (!User) {
            console.log('❌ Modelo User não registrado no mongoose');
            
            // Registrar manualmente
            const userSchema = new mongoose.Schema({
                nome: String,
                email: { type: String, unique: true },
                senha: String,
                departamento: String,
                primeiroAcesso: Boolean,
                obrigarAlteracaoSenha: Boolean,
                historicoSenhas: [String]
            });
            
            mongoose.model('User', userSchema);
            console.log('✅ Modelo User registrado manualmente');
        }
        
        // Buscar e atualizar diretamente com updateOne (evita hooks de save)
        console.log('\n🔄 ATUALIZANDO SENHA DIRETAMENTE NO BANCO...');
        
        // Gerar hash
        const saltRounds = 10;
        const senhaHash = await bcrypt.hash('Admin123', saltRounds);
        
        console.log(`🔐 Hash gerado (BCrypt): ${senhaHash.substring(0, 30)}...`);
        
        // Atualização direta no banco (bypass hooks)
        const result = await mongoose.connection.collection('users').updateOne(
            { email: 'admin@escola.gov.br' },
            { 
                $set: { 
                    senha: senhaHash,
                    primeiroAcesso: true,
                    obrigarAlteracaoSenha: true
                }
            }
        );
        
        console.log(`✅ Documentos modificados: ${result.modifiedCount}`);
        
        if (result.modifiedCount === 0) {
            console.log('⚠️ Nenhum documento modificado. Tentando abordagem alternativa...');
            
            // Tentar com o modelo normal
            const userModule = require('./src/models/User');
            const UserModel = userModule.User;
            
            const admin = await UserModel.findOne({ email: 'admin@escola.gov.br' });
            if (admin) {
                admin.senha = senhaHash;
                admin.primeiroAcesso = true;
                admin.obrigarAlteracaoSenha = true;
                
                // Desabilitar temporariamente qualquer middleware
                admin.$__schema.options.saveErrorIfNotFound = false;
                
                await admin.save({ validateBeforeSave: false });
                console.log('✅ Admin atualizado com save() alternativo');
            }
        }
        
        // Verificar a correção
        console.log('\n🔍 VERIFICANDO CORREÇÃO...');
        const adminAtualizado = await mongoose.connection.collection('users').findOne(
            { email: 'admin@escola.gov.br' },
            { projection: { senha: 1, primeiroAcesso: 1, email: 1 } }
        );
        
        if (adminAtualizado) {
            console.log('📊 ADMIN ATUALIZADO:');
            console.log(`📧 Email: ${adminAtualizado.email}`);
            console.log(`🔑 Senha (hash): ${adminAtualizado.senha.substring(0, 30)}...`);
            console.log(`📏 Tamanho hash: ${adminAtualizado.senha.length} chars`);
            console.log(`🎯 Primeiro acesso: ${adminAtualizado.primeiroAcesso}`);
            
            // Testar o hash
            const match = await bcrypt.compare('Admin123', adminAtualizado.senha);
            console.log(`✅ Teste de login: ${match ? 'SUCESSO! ✅' : 'FALHA! ❌'}`);
            
            if (match) {
                console.log('\n🎉 CORREÇÃO CONCLUÍDA COM SUCESSO!');
                console.log('\n📋 AGORA TESTE O LOGIN:');
                console.log('1. Inicie o servidor: npm start');
                console.log('2. Acesse: http://localhost:3000/login');
                console.log('3. Use: admin@escola.gov.br / Admin123');
                console.log('4. Deve redirecionar para /alterar-senha');
                console.log('5. Altere para uma nova senha');
            }
        } else {
            console.log('❌ Não foi possível verificar a atualização');
        }
        
    } catch (error) {
        console.error('❌ ERRO:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        // Fechar conexão
        setTimeout(async () => {
            await mongoose.disconnect();
            console.log('\n🔒 CONEXÃO FECHADA');
        }, 1000);
    }
}

// Executar
corrigirSenhaAdmin();