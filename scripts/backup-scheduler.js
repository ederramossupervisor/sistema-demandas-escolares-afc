// scripts/backup-scheduler.js - AGENDADOR DE BACKUPS
const cron = require('node-cron');
const BackupSystem = require('./backup');
const path = require('path');
const fs = require('fs-extra');

class BackupScheduler {
    constructor() {
        this.backup = new BackupSystem();
        this.logFile = path.join(__dirname, '../backups/logs/backup.log');
        
        // Garantir que a pasta de logs existe
        fs.ensureDirSync(path.dirname(this.logFile));
    }

    // Registrar no log
    async log(message, type = 'INFO') {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${type}] ${message}\n`;
        
        console.log(logMessage);
        await fs.appendFile(this.logFile, logMessage);
    }

    // Agendar backups diários
    scheduleDailyBackup() {
        try {
            // Formato: segundo minuto hora dia-do-mês mês dia-da-semana
            // Executa todo dia às 2h da manhã
            this.cronJob = cron.schedule('0 0 2 * * *', async () => {
                await this.log('⏰ Iniciando backup agendado (2h da manhã)...');
                console.log('⏰ Iniciando backup agendado...');
                
                try {
                    const result = await this.backup.runFullBackup();
                    await this.log(`✅ Backup concluído: ${JSON.stringify(result)}`);
                    console.log('✅ Backup agendado concluído');
                } catch (error) {
                    const errorMsg = `❌ ERRO no backup: ${error.message}`;
                    await this.log(errorMsg, 'ERROR');
                    console.error(errorMsg);
                }
            }, {
                scheduled: true,
                timezone: "America/Sao_Paulo"
            });
            
            console.log('📅 Agendador de backups configurado (todos os dias às 2h BRT)');
            this.log('Sistema de backup automático iniciado');
            
            return { success: true, message: 'Agendador configurado' };
            
        } catch (error) {
            console.error('❌ Erro ao configurar agendador de backups:', error);
            return { success: false, error: error.message };
        }
    }

    // Backup manual
    async manualBackup() {
        await this.log('🔧 Backup manual solicitado...');
        console.log('🔧 Executando backup manual...');
        return await this.backup.runFullBackup();
    }

    // Ver logs
    async getLogs(limit = 50) {
        try {
            if (await fs.pathExists(this.logFile)) {
                const content = await fs.readFile(this.logFile, 'utf8');
                const lines = content.split('\n').filter(line => line.trim());
                return lines.slice(-limit); // Últimas X linhas
            }
            return ['Arquivo de logs não encontrado'];
        } catch (error) {
            console.error('❌ Erro ao ler logs:', error);
            return [`Erro ao ler logs: ${error.message}`];
        }
    }

    // Parar agendador
    stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            console.log('⏰ Agendador de backups parado');
            this.log('Agendador de backups parado manualmente');
        }
    }

    // Status do agendador
    status() {
        return {
            ativo: this.cronJob ? true : false,
            proximaExecucao: '02:00 BRT (diário)',
            timezone: 'America/Sao_Paulo',
            logFile: this.logFile
        };
    }
}

// Se executar diretamente: iniciar como serviço independente
if (require.main === module) {
    const scheduler = new BackupScheduler();
    
    console.log('🚀 INICIANDO AGENDADOR DE BACKUPS');
    console.log('='.repeat(50));
    
    // Configurar agendamento
    const setupResult = scheduler.scheduleDailyBackup();
    
    if (setupResult.success) {
        console.log('✅ Agendador configurado com sucesso!');
        console.log('📝 Logs sendo salvos em:', scheduler.logFile);
        console.log('⏰ Backups agendados para: 2h da manhã (diariamente)');
        console.log('✋ Pressione Ctrl+C para parar');
        console.log('='.repeat(50));
        
        // Manter processo vivo
        process.on('SIGINT', () => {
            console.log('\n🛑 Recebido Ctrl+C, parando agendador...');
            scheduler.stop();
            process.exit(0);
        });
        
        // Manter processo rodando
        setInterval(() => {}, 1000 * 60 * 60 * 24); // 24 horas
        
    } else {
        console.error('❌ Falha ao configurar agendador:', setupResult.error);
        process.exit(1);
    }
}

module.exports = BackupScheduler;