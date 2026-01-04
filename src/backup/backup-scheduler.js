// src/backup/backup-scheduler.js
const cron = require('node-cron');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs');
const path = require('path');

class BackupScheduler {
    constructor() {
        this.backupDir = path.join(__dirname, '../../backups');
        this.logsDir = path.join(this.backupDir, 'logs');
        this.ensureDirectories();
    }

    ensureDirectories() {
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }
    }

    // Log de atividades do agendador
    log(message, type = 'INFO') {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${type}] ${message}\n`;
        const logFile = path.join(this.logsDir, 'scheduler.log');
        
        fs.appendFileSync(logFile, logMessage);
        console.log(`[Backup Scheduler] ${logMessage}`);
    }

    // Inicia o agendador
    start() {
        this.log('Iniciando agendador de backups...');
        
        // Agendamento diário às 2h da manhã
        cron.schedule('0 2 * * *', async () => {
            this.log('Iniciando backup agendado...');
            
            try {
                const { stdout, stderr } = await execPromise('node scripts/backup.js');
                
                if (stderr) {
                    this.log(`Erro no backup: ${stderr}`, 'ERRO');
                } else {
                    this.log('Backup agendado concluído com sucesso');
                    this.log(`Output: ${stdout.substring(0, 200)}...`);
                }
            } catch (error) {
                this.log(`Erro ao executar backup: ${error.message}`, 'ERRO');
            }
        });

        // Limpeza semanal de logs antigos (domingo às 3h)
        cron.schedule('0 3 * * 0', () => {
            this.log('Iniciando limpeza de logs antigos...');
            this.cleanOldLogs();
        });

        // Verificação semanal de espaço em disco (sábado às 4h)
        cron.schedule('0 4 * * 6', async () => {
            this.log('Verificando espaço em disco...');
            await this.checkDiskSpace();
        });

        this.log('Agendador de backups iniciado com sucesso');
        this.log('Backups programados: Diário às 2h, Limpeza: Domingos às 3h, Verificação: Sábados às 4h');
    }

    // Limpa logs antigos (mais de 30 dias)
    cleanOldLogs() {
        try {
            const files = fs.readdirSync(this.logsDir);
            const now = Date.now();
            const thirtyDays = 30 * 24 * 60 * 60 * 1000;
            let cleaned = 0;

            files.forEach(file => {
                if (file.endsWith('.log')) {
                    const filePath = path.join(this.logsDir, file);
                    const stats = fs.statSync(filePath);
                    
                    if (now - stats.mtime.getTime() > thirtyDays) {
                        fs.unlinkSync(filePath);
                        cleaned++;
                    }
                }
            });

            this.log(`Limpeza concluída: ${cleaned} arquivos de log antigos removidos`);
        } catch (error) {
            this.log(`Erro na limpeza de logs: ${error.message}`, 'ERRO');
        }
    }

    // Verifica espaço em disco
    async checkDiskSpace() {
        try {
            const { stdout } = await execPromise('df -h .');
            this.log(`Status do disco:\n${stdout}`);
            
            // Verificar se há menos de 10% de espaço livre
            const lines = stdout.split('\n');
            if (lines.length > 1) {
                const diskInfo = lines[1].split(/\s+/);
                const usePercent = parseInt(diskInfo[4]);
                
                if (usePercent > 90) {
                    this.log(`ALERTA: Espaço em disco crítico (${usePercent}% usado)`, 'ALERTA');
                }
            }
        } catch (error) {
            this.log(`Erro ao verificar espaço: ${error.message}`, 'ERRO');
        }
    }

    // Para o agendador
    stop() {
        this.log('Parando agendador de backups...');
        // node-cron não tem método stop global, mas podemos controlar tarefas individuais
        // Por enquanto, apenas registramos
        this.log('Agendador parado (reiniciar o servidor para recomeçar)');
    }
}

module.exports = BackupScheduler;