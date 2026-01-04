// src/config/email.js
const nodemailer = require('nodemailer');

// Configuração do transporte de email
const transporter = nodemailer.createTransport({
    service: 'gmail', // Você pode mudar para seu provedor (ex: Outlook, SMTP próprio)
    auth: {
        user: process.env.EMAIL_USER || 'seu-email@gmail.com',
        pass: process.env.EMAIL_PASS || 'sua-senha-app' // Use senha de app, não a senha normal
    },
    tls: {
        rejectUnauthorized: false // Para desenvolvimento, pode remover em produção
    }
});

// Verificar conexão
transporter.verify((error, success) => {
    if (error) {
        console.error('❌ Erro na configuração do email:', error);
    } else {
        console.log('✅ Servidor de email configurado com sucesso!');
    }
});

// Templates de email
const emailTemplates = {
    // Template para notificação de nova solicitação de cadastro (para admin)
    notificacaoNovaSolicitacao: (solicitacao) => ({
        from: `"Sistema de Demandas Escolares" <${process.env.EMAIL_USER || 'nao-responder@sistema.com'}>`,
        to: process.env.ADMIN_EMAIL || 'ecramos@sedu.es.gov.br',
        subject: '🆕 Nova Solicitação de Cadastro - Sistema de Demandas',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 5px 5px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
                    .info-box { background: white; border-left: 4px solid #667eea; padding: 15px; margin: 15px 0; }
                    .btn { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; }
                    .footer { margin-top: 30px; font-size: 12px; color: #666; text-align: center; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🆕 Nova Solicitação de Cadastro</h1>
                    </div>
                    <div class="content">
                        <p>Olá, Administrador!</p>
                        <p>Uma nova solicitação de cadastro foi recebida no sistema:</p>
                        
                        <div class="info-box">
                            <h3>📋 Dados da Solicitação</h3>
                            <p><strong>Nome:</strong> ${solicitacao.nome}</p>
                            <p><strong>Email:</strong> ${solicitacao.email}</p>
                            <p><strong>Telefone:</strong> ${solicitacao.telefone}</p>
                            <p><strong>Função:</strong> ${solicitacao.funcao}</p>
                            <p><strong>Departamento:</strong> ${solicitacao.departamento}</p>
                            <p><strong>Escola:</strong> ${solicitacao.escola}</p>
                            <p><strong>Data:</strong> ${new Date(solicitacao.dataSolicitacao).toLocaleDateString('pt-BR')}</p>
                        </div>
                        
                        <div class="info-box">
                            <h3>📝 Justificativa</h3>
                            <p>${solicitacao.justificativa}</p>
                        </div>
                        
                        <p style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.APP_URL || 'http://localhost:3000'}/admin/solicitacoes" class="btn">
                                👨‍💼 Acessar Solicitações Pendentes
                            </a>
                        </p>
                        
                        <p><strong>⚠️ Importante:</strong> Esta solicitação expira em 7 dias se não for processada.</p>
                    </div>
                    <div class="footer">
                        <p>Sistema de Demandas Escolares • ${new Date().getFullYear()}</p>
                        <p>Este é um email automático, por favor não responda.</p>
                    </div>
                </div>
            </body>
            </html>
        `
    }),

    // Template para aprovação de cadastro (para usuário)
    aprovacaoCadastro: (usuario, senhaTemporaria) => ({
        from: `"Sistema de Demandas Escolares" <${process.env.EMAIL_USER || 'nao-responder@sistema.com'}>`,
        to: usuario.email,
        subject: '✅ Cadastro Aprovado - Sistema de Demandas Escolares',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white; padding: 20px; border-radius: 5px 5px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
                    .credentials { background: white; border: 2px dashed #4CAF50; padding: 20px; margin: 20px 0; text-align: center; }
                    .btn { display: inline-block; background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; }
                    .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; }
                    .footer { margin-top: 30px; font-size: 12px; color: #666; text-align: center; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>✅ Cadastro Aprovado!</h1>
                    </div>
                    <div class="content">
                        <p>Olá, <strong>${usuario.nome}</strong>!</p>
                        <p>Seu cadastro no <strong>Sistema de Demandas Escolares</strong> foi aprovado com sucesso!</p>
                        
                        <div class="credentials">
                            <h3>🔐 Suas Credenciais de Acesso</h3>
                            <p><strong>📧 Email:</strong> ${usuario.email}</p>
                            <p><strong>🔑 Senha Temporária:</strong> <code style="font-size: 18px; background: #f1f1f1; padding: 5px 10px; border-radius: 3px;">${senhaTemporaria}</code></p>
                            <p><strong>🔗 Link de Acesso:</strong> ${process.env.APP_URL || 'http://localhost:3000'}/login</p>
                        </div>
                        
                        <div class="warning">
                            <h4>⚠️ IMPORTANTE - PRIMEIRO ACESSO</h4>
                            <ol>
                                <li>Acesse o sistema com sua senha temporária acima</li>
                                <li>Você será <strong>OBRIGADO a alterar a senha</strong> no primeiro acesso</li>
                                <li>Crie uma senha forte (mínimo 8 caracteres, com números e letras)</li>
                                <li>Não compartilhe suas credenciais com ninguém</li>
                            </ol>
                        </div>
                        
                        <p style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.APP_URL || 'http://localhost:3000'}/login" class="btn">
                                🚀 Fazer Primeiro Login
                            </a>
                        </p>
                        
                        <p><strong>Dica de segurança:</strong> Após fazer login, altere sua senha imediatamente.</p>
                    </div>
                    <div class="footer">
                        <p>Sistema de Demandas Escolares • Secretaria de Educação • ${new Date().getFullYear()}</p>
                        <p>Este é um email automático, por favor não responda.</p>
                    </div>
                </div>
            </body>
            </html>
        `
    }),

    // Template para rejeição de cadastro
    rejeicaoCadastro: (solicitacao, motivo) => ({
        from: `"Sistema de Demandas Escolares" <${process.env.EMAIL_USER || 'nao-responder@sistema.com'}>`,
        to: solicitacao.email,
        subject: '❌ Solicitação de Cadastro Analisada - Sistema de Demandas',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%); color: white; padding: 20px; border-radius: 5px 5px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
                    .info-box { background: white; border-left: 4px solid #f44336; padding: 15px; margin: 15px 0; }
                    .footer { margin-top: 30px; font-size: 12px; color: #666; text-align: center; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>❌ Solicitação Analisada</h1>
                    </div>
                    <div class="content">
                        <p>Olá, <strong>${solicitacao.nome}</strong>!</p>
                        <p>Sua solicitação de cadastro no <strong>Sistema de Demandas Escolares</strong> foi analisada.</p>
                        
                        <div class="info-box">
                            <h3>📋 Status: <span style="color: #f44336;">REJEITADA</span></h3>
                            <p><strong>Motivo:</strong> ${motivo || 'Não especificado pelo administrador.'}</p>
                            <p><strong>Data da solicitação:</strong> ${new Date(solicitacao.dataSolicitacao).toLocaleDateString('pt-BR')}</p>
                            <p><strong>Data da análise:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
                        </div>
                        
                        <p>Se você acredita que houve um erro ou deseja mais informações, entre em contato com a administração do sistema.</p>
                        
                        <p><strong>Contato administrador:</strong> ${process.env.ADMIN_EMAIL || 'ecramos@sedu.es.gov.br'}</p>
                    </div>
                    <div class="footer">
                        <p>Sistema de Demandas Escolares • Secretaria de Educação • ${new Date().getFullYear()}</p>
                        <p>Este é um email automático, por favor não responda.</p>
                    </div>
                </div>
            </body>
            </html>
        `
    }),

    // Template para recuperação de senha
    recuperacaoSenha: (usuario, senhaTemporaria) => ({
        from: `"Sistema de Demandas Escolares" <${process.env.EMAIL_USER || 'nao-responder@sistema.com'}>`,
        to: usuario.email,
        subject: '🔑 Recuperação de Senha - Sistema de Demandas Escolares',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%); color: white; padding: 20px; border-radius: 5px 5px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
                    .credentials { background: white; border: 2px dashed #2196F3; padding: 20px; margin: 20px 0; text-align: center; }
                    .btn { display: inline-block; background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; }
                    .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; }
                    .footer { margin-top: 30px; font-size: 12px; color: #666; text-align: center; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🔑 Recuperação de Senha</h1>
                    </div>
                    <div class="content">
                        <p>Olá, <strong>${usuario.nome}</strong>!</p>
                        <p>Recebemos uma solicitação de recuperação de senha para sua conta no <strong>Sistema de Demandas Escolares</strong>.</p>
                        
                        <div class="credentials">
                            <h3>🔐 Nova Senha Temporária</h3>
                            <p><strong>📧 Email:</strong> ${usuario.email}</p>
                            <p><strong>🔑 Senha Temporária:</strong> <code style="font-size: 18px; background: #f1f1f1; padding: 5px 10px; border-radius: 3px;">${senhaTemporaria}</code></p>
                        </div>
                        
                        <div class="warning">
                            <h4>⚠️ IMPORTANTE - SEGURANÇA</h4>
                            <ol>
                                <li>Use esta senha temporária para acessar o sistema</li>
                                <li>Você será <strong>OBRIGADO a alterar a senha</strong> após o login</li>
                                <li>Crie uma nova senha forte que você não use em outros sites</li>
                                <li>Se não foi você quem solicitou, ignore este email e contate o administrador</li>
                            </ol>
                        </div>
                        
                        <p style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.APP_URL || 'http://localhost:3000'}/login" class="btn">
                                🔐 Fazer Login com Senha Temporária
                            </a>
                        </p>
                        
                        <p><strong>Dica de segurança:</strong> Após fazer login, altere sua senha imediatamente para garantir a segurança da sua conta.</p>
                    </div>
                    <div class="footer">
                        <p>Sistema de Demandas Escolares • Secretaria de Educação • ${new Date().getFullYear()}</p>
                        <p>Este é um email automático, por favor não responda. Se tiver problemas, contate o suporte.</p>
                    </div>
                </div>
            </body>
            </html>
        `
    })
};

// Funções utilitárias para envio de email
const emailService = {
    // Enviar notificação de nova solicitação para admin
    enviarNotificacaoNovaSolicitacao: async (solicitacao) => {
        try {
            const template = emailTemplates.notificacaoNovaSolicitacao(solicitacao);
            const info = await transporter.sendMail(template);
            console.log('✅ Email de notificação enviado para admin:', info.messageId);
            return info;
        } catch (error) {
            console.error('❌ Erro ao enviar email para admin:', error);
            throw error;
        }
    },

    // Enviar aprovação de cadastro para usuário
    enviarAprovacaoCadastro: async (usuario, senhaTemporaria) => {
        try {
            const template = emailTemplates.aprovacaoCadastro(usuario, senhaTemporaria);
            const info = await transporter.sendMail(template);
            console.log(`✅ Email de aprovação enviado para ${usuario.email}:`, info.messageId);
            return info;
        } catch (error) {
            console.error(`❌ Erro ao enviar email para ${usuario.email}:`, error);
            throw error;
        }
    },

    // Enviar rejeição de cadastro
    enviarRejeicaoCadastro: async (solicitacao, motivo) => {
        try {
            const template = emailTemplates.rejeicaoCadastro(solicitacao, motivo);
            const info = await transporter.sendMail(template);
            console.log(`✅ Email de rejeição enviado para ${solicitacao.email}:`, info.messageId);
            return info;
        } catch (error) {
            console.error(`❌ Erro ao enviar email de rejeição:`, error);
            throw error;
        }
    },

    // Enviar recuperação de senha
    enviarRecuperacaoSenha: async (usuario, senhaTemporaria) => {
        try {
            const template = emailTemplates.recuperacaoSenha(usuario, senhaTemporaria);
            const info = await transporter.sendMail(template);
            console.log(`✅ Email de recuperação enviado para ${usuario.email}:`, info.messageId);
            return info;
        } catch (error) {
            console.error(`❌ Erro ao enviar email de recuperação:`, error);
            throw error;
        }
    },

    // Testar conexão com servidor de email
    testarConexao: async () => {
        try {
            await transporter.verify();
            console.log('✅ Conexão com servidor de email: OK');
            return true;
        } catch (error) {
            console.error('❌ Falha na conexão com servidor de email:', error);
            return false;
        }
    }
};

// ============================================
// FUNÇÕES DE SIMULAÇÃO PARA DESENVOLVIMENTO
// ============================================

// Verificar se o email está realmente configurado
const verificarConfiguracaoEmail = () => {
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;
    
    // Se não tem configuração ou tem valores padrão
    if (!emailUser || 
        !emailPass || 
        emailUser.includes('seu-email@gmail.com') || 
        emailPass.includes('sua-senha-app')) {
        
        console.log('🔧 Modo SIMULAÇÃO ativado: Email não configurado');
        console.log('💡 Para ativar emails reais, configure no .env:');
        console.log('   EMAIL_USER=seu-email@gmail.com');
        console.log('   EMAIL_PASS=sua-senha-de-app');
        console.log('   Ou use um email @outlook.com');
        
        return false; // Modo simulação
    }
    
    return true; // Modo produção
};

const emailConfigurado = verificarConfiguracaoEmail();

// Sobrescrever funções se email não estiver configurado
if (!emailConfigurado) {
    console.log('📧 Sistema funcionando em MODO SIMULAÇÃO');
    console.log('📧 Emails serão exibidos no console em vez de enviados');
    
    // Substituir funções por versões de simulação
    const simulacaoService = {
        enviarNotificacaoNovaSolicitacao: async (solicitacao) => {
            console.log('\n📧 ===== SIMULAÇÃO DE EMAIL =====');
            console.log('📧 PARA: Admin (' + (process.env.ADMIN_EMAIL || 'ecramos@sedu.es.gov.br') + ')');
            console.log('📧 ASSUNTO: 🆕 Nova Solicitação de Cadastro');
            console.log('📧 CONTEÚDO:');
            console.log('   Nome: ' + solicitacao.nome);
            console.log('   Email: ' + solicitacao.email);
            console.log('   Telefone: ' + solicitacao.telefone);
            console.log('   Função: ' + solicitacao.funcao);
            console.log('   Departamento: ' + solicitacao.departamento);
            console.log('   Escola: ' + solicitacao.escola);
            console.log('   Justificativa: ' + solicitacao.justificativa);
            console.log('📧 ================================\n');
            
            return { 
                messageId: 'simulado_' + Date.now(),
                simulacao: true 
            };
        },

        enviarAprovacaoCadastro: async (usuario, senhaTemporaria) => {
            console.log('\n📧 ===== SIMULAÇÃO DE EMAIL =====');
            console.log('📧 PARA: ' + usuario.email);
            console.log('📧 ASSUNTO: ✅ Cadastro Aprovado');
            console.log('📧 CONTEÚDO:');
            console.log('   Nome: ' + usuario.nome);
            console.log('   Email: ' + usuario.email);
            console.log('   Senha Temporária: ' + senhaTemporaria);
            console.log('   Link: ' + (process.env.APP_URL || 'http://localhost:3000') + '/login');
            console.log('📧 ================================\n');
            
            return { 
                messageId: 'simulado_' + Date.now(),
                simulacao: true 
            };
        },

        enviarRejeicaoCadastro: async (solicitacao, motivo) => {
            console.log('\n📧 ===== SIMULAÇÃO DE EMAIL =====');
            console.log('📧 PARA: ' + solicitacao.email);
            console.log('📧 ASSUNTO: ❌ Solicitação Rejeitada');
            console.log('📧 CONTEÚDO:');
            console.log('   Nome: ' + solicitacao.nome);
            console.log('   Status: REJEITADA');
            console.log('   Motivo: ' + (motivo || 'Não especificado'));
            console.log('📧 ================================\n');
            
            return { 
                messageId: 'simulado_' + Date.now(),
                simulacao: true 
            };
        },

        enviarRecuperacaoSenha: async (usuario, senhaTemporaria) => {
            console.log('\n📧 ===== SIMULAÇÃO DE EMAIL =====');
            console.log('📧 PARA: ' + usuario.email);
            console.log('📧 ASSUNTO: 🔑 Recuperação de Senha');
            console.log('📧 CONTEÚDO:');
            console.log('   Nome: ' + usuario.nome);
            console.log('   Nova Senha Temporária: ' + senhaTemporaria);
            console.log('   Link: ' + (process.env.APP_URL || 'http://localhost:3000') + '/login');
            console.log('📧 ================================\n');
            
            return { 
                messageId: 'simulado_' + Date.now(),
                simulacao: true 
            };
        },

        testarConexao: async () => {
            console.log('🔧 Modo simulação - Email não configurado');
            return false;
        }
    };
    
    // Substituir o serviço original pelo de simulação
    Object.assign(emailService, simulacaoService);
} else {
    console.log('✅ Email configurado para envios reais');
}

// ============================================
// EXPORTAR SERVIÇO FINAL
// ============================================

module.exports = emailService;
