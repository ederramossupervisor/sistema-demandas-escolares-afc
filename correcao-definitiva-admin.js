// correcao-definitiva-admin.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function correcaoDefinitiva() {
    try {
        console.log('🎯 CORREÇÃO DEFINITIVA DO ADMIN');
        console.log('=' .repeat(50));
        
        // Conectar ao banco SEM importar o modelo (para evitar hooks)
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('✅ Conectado ao MongoDB Atlas');
        
        // Acessar a coleção diretamente
        const usersCollection = mongoose.connection.collection('users');
        
        // 1. Verificar estado atual
        console.log('\n🔍 VERIFICANDO ESTADO ATUAL DO ADMIN...');
        const adminAtual = await usersCollection.findOne({
            email: 'admin@escola.gov.br'
        });
        
        if (!adminAtual) {
            console.log('❌ Admin não encontrado! Criando novo...');
            
            // Criar admin se não existir
            const salt = await bcrypt.genSalt(10);
            const senhaHash = await bcrypt.hash('Admin123', salt);
            
            const novoAdmin = {
                nome: 'Admin Sistema',
                email: 'admin@escola.gov.br',
                senha: senhaHash,
                tipo: 'administrador',
                departamento: 'Supervisão',
                primeiroAcesso: true,
                obrigarAlteracaoSenha: true,
                ativo: true,
                contaAtiva: true,
                criadoEm: new Date(),
                atualizadoEm: new Date(),
                dataCadastro: new Date(),
                dataUltimaAlteracaoSenha: new Date()
            };
            
            await usersCollection.insertOne(novoAdmin);
            console.log('✅ Admin criado com hash BCrypt');
            
        } else {
            console.log('📊 ADMIN ENCONTRADO:');
            console.log(`📧 Email: ${adminAtual.email}`);
            console.log(`👤 Nome: ${adminAtual.nome}`);
            console.log(`🔑 Senha atual: ${adminAtual.senha}`);
            console.log(`📏 Tamanho: ${adminAtual.senha ? adminAtual.senha.length : 'null'} chars`);
            console.log(`🎯 Primeiro acesso: ${adminAtual.primeiroAcesso}`);
            console.log(`⚠️ Forçar alteração: ${adminAtual.obrigarAlteracaoSenha}`);
            
            // Verificar se senha está em texto
            const estaEmTexto = adminAtual.senha && 
                               adminAtual.senha.length < 60 && 
                               !adminAtual.senha.startsWith('$2');
            
            if (estaEmTexto) {
                console.log('\n⚠️ PROBLEMA DETECTADO: Senha em texto puro!');
                
                // 2. Criar hash BCrypt
                console.log('🔄 CRIANDO HASH BCrypt...');
                const salt = await bcrypt.genSalt(10);
                const senhaHash = await bcrypt.hash('Admin123', salt);
                
                // 3. Atualizar diretamente na coleção (bypass hooks)
                console.log('⚡ ATUALIZANDO NO BANCO (bypass hooks)...');
                
                const resultado = await usersCollection.updateOne(
                    { email: 'admin@escola.gov.br' },
                    {
                        $set: {
                            senha: senhaHash,
                            primeiroAcesso: true,
                            obrigarAlteracaoSenha: true,
                            atualizadoEm: new Date(),
                            dataUltimaAlteracaoSenha: new Date()
                        }
                    }
                );
                
                console.log(`✅ Documentos modificados: ${resultado.modifiedCount}`);
                
                if (resultado.modifiedCount > 0) {
                    console.log('\n🎉 ADMIN CORRIGIDO COM SUCESSO!');
                }
            } else {
                console.log('\n✅ Admin já tem senha em hash BCrypt!');
                
                // Apenas garantir que os flags estão corretos
                await usersCollection.updateOne(
                    { email: 'admin@escola.gov.br' },
                    {
                        $set: {
                            primeiroAcesso: true,
                            obrigarAlteracaoSenha: true,
                            atualizadoEm: new Date()
                        }
                    }
                );
                
                console.log('✅ Flags de primeiro acesso configurados');
            }
        }
        
        // 4. Verificar a correção
        console.log('\n🔍 VERIFICANDO CORREÇÃO FINAL...');
        const adminVerificado = await usersCollection.findOne({
            email: 'admin@escola.gov.br'
        }, {
            projection: { senha: 1, email: 1, nome: 1, primeiroAcesso: 1, obrigarAlteracaoSenha: 1 }
        });
        
        if (adminVerificado) {
            console.log('\n📋 RESULTADO FINAL:');
            console.log('=' .repeat(40));
            console.log(`👤 Nome: ${adminVerificado.nome}`);
            console.log(`📧 Email: ${adminVerificado.email}`);
            console.log(`🔑 Hash: ${adminVerificado.senha.substring(0, 30)}...`);
            console.log(`📏 Tamanho hash: ${adminVerificado.senha.length} chars`);
            console.log(`🎯 Primeiro acesso: ${adminVerificado.primeiroAcesso}`);
            console.log(`⚠️ Forçar alteração: ${adminVerificado.obrigarAlteracaoSenha}`);
            
            // Testar login
            const senhaCorreta = await bcrypt.compare('Admin123', adminVerificado.senha);
            console.log(`🔐 Teste login "Admin123": ${senhaCorreta ? '✅ CORRETO' : '❌ ERRADO'}`);
            
            if (senhaCorreta) {
                console.log('\n🎯 FLUXO ESPERADO AGORA:');
                console.log('1. Login com: admin@escola.gov.br / Admin123');
                console.log('2. Middleware detecta primeiroAcesso: true');
                console.log('3. Redireciona para /alterar-senha');
                console.log('4. Você altera para nova senha');
                console.log('5. Redireciona para /dashboard');
            }
        }
        
    } catch (error) {
        console.error('❌ ERRO CRÍTICO:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        // Aguardar e desconectar
        setTimeout(async () => {
            await mongoose.disconnect();
            console.log('\n🔒 Conexão fechada');
            console.log('\n✅ CORREÇÃO CONCLUÍDA!');
            console.log('\n🚀 AGORA EXECUTE:');
            console.log('1. npm start (ou node src/server.js)');
            console.log('2. Acesse: http://localhost:3000/login');
            console.log('3. Use: admin@escola.gov.br / Admin123');
            console.log('4. Siga o fluxo de primeiro acesso!');
        }, 1000);
    }
}

// Executar correção
correcaoDefinitiva();