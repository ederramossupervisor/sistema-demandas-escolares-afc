// verificar-hash.js - VERSÃO CORRIGIDA
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const fs = require('fs');
require('dotenv').config();

async function verificarHash() {
    try {
        console.log('🔍 CONECTANDO AO BANCO DE DADOS...');
        await mongoose.connect(process.env.MONGODB_URI);
        
        console.log('✅ CONEXÃO ESTABELECIDA');
        
        // VERIFICAR O ARQUIVO User.js
        console.log('\n📄 ANALISANDO User.js...');
        const userFileContent = fs.readFileSync('./src/models/User.js', 'utf8');
        
        // Verificar se já há definição do modelo mongoose
        if (userFileContent.includes('mongoose.model')) {
            console.log('✅ Arquivo User.js já define um modelo mongoose');
            
            // IMPORTAR O ARQUIVO COMPLETO
            const userModule = require('./src/models/User');
            console.log('✅ Módulo importado:', Object.keys(userModule));
            
            // Verificar diferentes formas de acesso
            let User;
            
            // Tentativa 1: module.exports = mongoose.model(...)
            if (typeof userModule === 'function') {
                console.log('✅ User é uma função (modelo mongoose)');
                User = userModule;
            }
            // Tentativa 2: module.exports = { User: model }
            else if (userModule.User) {
                console.log('✅ User está em userModule.User');
                User = userModule.User;
            }
            // Tentativa 3: export default
            else if (userModule.default) {
                console.log('✅ User está em userModule.default');
                User = userModule.default;
            }
            else {
                console.log('⚠️ Estrutura não reconhecida, tentando criar manualmente...');
                
                // Ler o schema do arquivo
                const schemaMatch = userFileContent.match(/new mongoose\.Schema\(({[^}]+})\)/);
                if (schemaMatch) {
                    console.log('✅ Schema encontrado no arquivo');
                    const schemaDef = eval(`(${schemaMatch[1]})`);
                    const userSchema = new mongoose.Schema(schemaDef);
                    User = mongoose.model('User', userSchema);
                }
            }
            
            if (!User) {
                console.log('❌ Não consegui obter o modelo User');
                return;
            }
            
            // Buscar o admin
            console.log('\n🔍 BUSCANDO ADMIN NO BANCO...');
            const admin = await User.findOne({ email: 'admin@escola.gov.br' });
            
            if (!admin) {
                console.log('❌ ADMIN NÃO ENCONTRADO NO BANCO');
                
                // Listar todos os usuários
                console.log('\n👥 TODOS OS USUÁRIOS NO BANCO:');
                const allUsers = await User.find({}, 'email nome departamento').limit(10);
                console.log('Total encontrados:', allUsers.length);
                allUsers.forEach((u, i) => {
                    console.log(`${i+1}. ${u.email} - ${u.nome} (${u.departamento})`);
                });
                
                return;
            }
            
            console.log('\n✅ ADMIN ENCONTRADO!');
            console.log('📊 INFORMAÇÕES DO ADMIN:');
            console.log(`📧 Email: ${admin.email}`);
            console.log(`👤 Nome: ${admin.nome}`);
            console.log(`🏢 Departamento: ${admin.departamento}`);
            console.log(`🔐 Primeiro Acesso: ${admin.primeiroAcesso}`);
            console.log(`🔄 Forçar Alteração: ${admin.obrigarAlteracaoSenha}`);
            console.log(`🔑 Hash armazenado: ${admin.senha}`);
            console.log(`📏 Tamanho do hash: ${admin.senha.length} caracteres`);
            
            // Testar senha "Admin123"
            console.log('\n🔬 TESTANDO SENHA "Admin123":');
            const match = await bcrypt.compare('Admin123', admin.senha);
            console.log(`Resultado bcrypt.compare: ${match ? '✅ CORRESPONDE' : '❌ NÃO CORRESPONDE'}`);
            
            // Mostrar estrutura do hash
            console.log(`🔍 Hash (primeiros 30 chars): ${admin.senha.substring(0, 30)}...`);
            console.log(`🔍 Hash (últimos 30 chars): ...${admin.senha.substring(admin.senha.length - 30)}`);
            
            // Verificar formato
            if (admin.senha.startsWith('$2')) {
                console.log('✅ Hash está em formato BCrypt');
            } else if (admin.senha.length < 60) {
                console.log(`⚠️ Hash muito curto. Possível senha em texto: "${admin.senha}"`);
                
                // Se for senha em texto, testar diretamente
                if (admin.senha === 'Admin123') {
                    console.log('✅ SENHA EM TEXTO CORRESPONDE A "Admin123"');
                } else {
                    console.log(`❌ Senha em texto NÃO é "Admin123", é: "${admin.senha}"`);
                }
            }
            
        } else {
            console.log('❌ Arquivo User.js não define um modelo mongoose');
            console.log('📝 Conteúdo (primeiras 500 chars):');
            console.log(userFileContent.substring(0, 500) + '...');
        }
        
    } catch (error) {
        console.error('❌ ERRO:', error.message);
        if (error.code === 'MODULE_NOT_FOUND') {
            console.log('🔍 Verificando problema no módulo...');
        }
    } finally {
        await mongoose.disconnect();
        console.log('\n🔒 CONEXÃO FECHADA');
    }
}

// Executar
verificarHash();