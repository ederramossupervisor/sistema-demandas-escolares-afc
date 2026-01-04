// src/backup/backup-admin.js
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class BackupAdmin {
    constructor() {
        this.backupDir = path.join(__dirname, '../../backups');
        this.ensureDirectories();
    }

    // Garante que os diretórios existam
    ensureDirectories() {
        const dirs = ['database', 'reports', 'logs'];
        dirs.forEach(dir => {
            const dirPath = path.join(this.backupDir, dir);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
        });
    }

    // Lista todos os backups
    async listBackups() {
        const backups = {
            database: [],
            reports: [],
            logs: []
        };

        try {
            // Listar backups de banco de dados
            const dbBackupPath = path.join(this.backupDir, 'database');
            if (fs.existsSync(dbBackupPath)) {
                backups.database = fs.readdirSync(dbBackupPath)
                    .filter(file => file.endsWith('.gz'))
                    .map(file => {
                        const filePath = path.join(dbBackupPath, file);
                        const stats = fs.statSync(filePath);
                        return {
                            nome: file,
                            caminho: filePath,
                            tamanho: (stats.size / (1024 * 1024)).toFixed(2) + ' MB',
                            dataCriacao: stats.birthtime,
                            dataModificacao: stats.mtime
                        };
                    })
                    .sort((a, b) => b.dataCriacao - a.dataCriacao);
            }

            // Listar backups de relatórios
            const reportsPath = path.join(this.backupDir, 'reports');
            if (fs.existsSync(reportsPath)) {
                backups.reports = fs.readdirSync(reportsPath)
                    .map(file => {
                        const filePath = path.join(reportsPath, file);
                        const stats = fs.statSync(filePath);
                        return {
                            nome: file,
                            caminho: filePath,
                            tamanho: (stats.size / 1024).toFixed(2) + ' KB',
                            dataCriacao: stats.birthtime,
                            dataModificacao: stats.mtime
                        };
                    })
                    .sort((a, b) => b.dataCriacao - a.dataCriacao);
            }

            // Listar logs de backup
            const logsPath = path.join(this.backupDir, 'logs');
            if (fs.existsSync(logsPath)) {
                backups.logs = fs.readdirSync(logsPath)
                    .filter(file => file.endsWith('.log'))
                    .map(file => {
                        const filePath = path.join(logsPath, file);
                        const stats = fs.statSync(filePath);
                        const content = fs.readFileSync(filePath, 'utf8');
                        return {
                            nome: file,
                            caminho: filePath,
                            tamanho: (stats.size / 1024).toFixed(2) + ' KB',
                            dataCriacao: stats.birthtime,
                            ultimaExecucao: content.split('\n').slice(-3, -1).join('\n'),
                            linhas: content.split('\n').length
                        };
                    })
                    .sort((a, b) => b.dataCriacao - a.dataCriacao);
            }

            return backups;
        } catch (error) {
            console.error('Erro ao listar backups:', error);
            throw error;
        }
    }

    // Exclui um backup
    async deleteBackup(tipo, nomeArquivo) {
        try {
            const caminho = path.join(this.backupDir, tipo, nomeArquivo);
            
            if (!fs.existsSync(caminho)) {
                throw new Error('Arquivo não encontrado');
            }

            fs.unlinkSync(caminho);
            
            // Registrar ação no log
            const logEntry = `[${new Date().toISOString()}] BACKUP EXCLUÍDO - Tipo: ${tipo}, Arquivo: ${nomeArquivo}\n`;
            const logPath = path.join(this.backupDir, 'logs', 'backup-admin.log');
            fs.appendFileSync(logPath, logEntry);

            return { success: true, mensagem: 'Backup excluído com sucesso' };
        } catch (error) {
            console.error('Erro ao excluir backup:', error);
            throw error;
        }
    }

    // Executa backup manual
    async executeManualBackup() {
        try {
            // Executa o script de backup
            const { stdout, stderr } = await execPromise('node scripts/backup.js');
            
            const resultado = {
                success: !stderr,
                mensagem: stderr ? 'Erro ao executar backup' : 'Backup manual executado com sucesso',
                output: stdout || stderr,
                timestamp: new Date()
            };

            // Registrar no log
            const logEntry = `[${resultado.timestamp.toISOString()}] BACKUP MANUAL - Status: ${resultado.success ? 'SUCESSO' : 'ERRO'}\n`;
            const logPath = path.join(this.backupDir, 'logs', 'backup-admin.log');
            fs.appendFileSync(logPath, logEntry);

            return resultado;
        } catch (error) {
            console.error('Erro ao executar backup manual:', error);
            throw error;
        }
    }

    // Obtém estatísticas de backup
    async getBackupStats() {
        try {
            const backups = await this.listBackups();
            
            const stats = {
                totalBackups: backups.database.length + backups.reports.length + backups.logs.length,
                tamanhoTotal: 0,
                ultimoBackup: null,
                statusEspaco: 'adequado'
            };

            // Calcular tamanho total
            let tamanhoTotalMB = 0;
            
            backups.database.forEach(b => {
                const tamanho = parseFloat(b.tamanho);
                tamanhoTotalMB += tamanho;
            });

            // Encontrar último backup
            const todosBackups = [...backups.database, ...backups.reports, ...backups.logs];
            if (todosBackups.length > 0) {
                stats.ultimoBackup = todosBackups.reduce((latest, current) => 
                    current.dataCriacao > latest.dataCriacao ? current : latest
                );
            }

            stats.tamanhoTotal = tamanhoTotalMB.toFixed(2) + ' MB';
            
            // Verificar espaço (alerta se maior que 500MB)
            if (tamanhoTotalMB > 500) {
                stats.statusEspaco = 'critico';
            } else if (tamanhoTotalMB > 300) {
                stats.statusEspaco = 'alerta';
            }

            return stats;
        } catch (error) {
            console.error('Erro ao obter estatísticas:', error);
            throw error;
        }
    }
}

module.exports = BackupAdmin;