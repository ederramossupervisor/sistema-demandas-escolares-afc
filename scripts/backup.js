// scripts/backup.js
require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');
const { format } = require('date-fns');
const { MongoClient } = require('mongodb');

class BackupSystem {
    constructor() {
        this.backupDir = path.join(__dirname, '../backups');
    }

    // Criar pasta com data atual
    getTodayBackupPath() {
        const today = new Date();
        const dateStr = format(today, 'yyyy-MM-dd');
        return path.join(this.backupDir, 'database', dateStr);
    }

    // Backup do MongoDB usando driver nativo
    async backupDatabase() {
        let client;
        
        try {
            console.log('🔄 Iniciando backup do banco de dados...');
            
            // Verificar se MONGODB_URI existe
            if (!process.env.MONGODB_URI) {
                throw new Error('MONGODB_URI não encontrada no arquivo .env');
            }
            
            console.log('🔗 Conectando ao MongoDB...');
            
            // Conectar ao MongoDB usando driver nativo
            client = new MongoClient(process.env.MONGODB_URI);
            await client.connect();
            
            const db = client.db();
            
            // Pasta do backup de hoje
            const backupPath = this.getTodayBackupPath();
            await fs.ensureDir(backupPath);
            
            // Lista de coleções para backup (adapte conforme suas coleções)
            const collections = ['users', 'demandas', 'notificacaos', 'solicitacaocadastros', 'sessions'];
            
            for (const collectionName of collections) {
                try {
                    const collection = db.collection(collectionName);
                    const data = await collection.find({}).toArray();
                    
                    // Salvar em arquivo JSON
                    const filePath = path.join(backupPath, `${collectionName}.json`);
                    await fs.writeJson(filePath, data, { spaces: 2 });
                    
                    console.log(`✅ ${collectionName}: ${data.length} registros`);
                } catch (err) {
                    console.log(`⚠️ Coleção ${collectionName} não encontrada: ${err.message}`);
                }
            }
            
            console.log(`✅ Backup completo salvo em: ${backupPath}`);
            return { success: true, path: backupPath };
            
        } catch (error) {
            console.error('❌ Erro no backup:', error.message);
            return { success: false, error: error.message };
        } finally {
            if (client) {
                await client.close();
            }
        }
    }

    // Backup de relatórios
    async backupReports() {
        try {
            console.log('📊 Fazendo backup de relatórios...');
            
            const reportsPath = path.join(__dirname, '../reports');
            const backupPath = path.join(this.backupDir, 'reports', format(new Date(), 'yyyy-MM-dd'));
            
            if (await fs.pathExists(reportsPath)) {
                await fs.copy(reportsPath, backupPath);
                console.log(`✅ Relatórios backup: ${backupPath}`);
            } else {
                console.log('ℹ️ Pasta de relatórios não encontrada, pulando...');
            }
            
            return { success: true };
        } catch (error) {
            console.error('❌ Erro no backup de relatórios:', error);
            return { success: false, error: error.message };
        }
    }

    // Limpar backups antigos (mais de 30 dias)
    async cleanOldBackups(daysToKeep = 30) {
        try {
            console.log('🧹 Limpando backups antigos...');
            
            const databasePath = path.join(this.backupDir, 'database');
            const reportsPath = path.join(this.backupDir, 'reports');
            
            await this.cleanDirectory(databasePath, daysToKeep);
            await this.cleanDirectory(reportsPath, daysToKeep);
            
            console.log('✅ Limpeza concluída');
            return { success: true };
        } catch (error) {
            console.error('❌ Erro na limpeza:', error);
            return { success: false, error: error.message };
        }
    }

    async cleanDirectory(dirPath, daysToKeep) {
        if (!await fs.pathExists(dirPath)) return;
        
        const folders = await fs.readdir(dirPath);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        
        for (const folder of folders) {
            const folderPath = path.join(dirPath, folder);
            const stat = await fs.stat(folderPath);
            
            if (stat.isDirectory()) {
                const folderDate = new Date(folder);
                if (folderDate < cutoffDate) {
                    await fs.remove(folderPath);
                    console.log(`🗑️ Removido backup antigo: ${folderPath}`);
                }
            }
        }
    }

    // Executar backup completo
    async runFullBackup() {
        console.log('🚀 INICIANDO BACKUP COMPLETO DO SISTEMA');
        console.log('='.repeat(50));
        
        const dbResult = await this.backupDatabase();
        const reportsResult = await this.backupReports();
        const cleanResult = await this.cleanOldBackups();
        
        console.log('='.repeat(50));
        
        if (dbResult.success) {
            console.log('🎉 BACKUP FINALIZADO COM SUCESSO!');
        } else {
            console.log('⚠️ BACKUP PARCIAL: Banco de dados não foi copiado');
            console.log('   Erro:', dbResult.error);
        }
        
        return {
            database: dbResult,
            reports: reportsResult,
            cleanup: cleanResult,
            timestamp: new Date().toISOString()
        };
    }
}

// Se executar diretamente: node scripts/backup.js
if (require.main === module) {
    const backup = new BackupSystem();
    backup.runFullBackup()
        .then(result => {
            console.log('\n📋 RESULTADO FINAL:');
            console.log('-'.repeat(40));
            console.log('Database:', result.database.success ? '✅ SUCESSO' : '❌ FALHA');
            console.log('Reports:', result.reports.success ? '✅ SUCESSO' : '❌ FALHA');
            console.log('Cleanup:', result.cleanup.success ? '✅ SUCESSO' : '❌ FALHA');
            console.log('Timestamp:', result.timestamp);
            
            if (!result.database.success) {
                console.log('\n💡 SUGESTÕES:');
                console.log('1. Verifique se os nomes das coleções estão corretos');
                console.log('2. Tente listar coleções disponíveis (veja instruções abaixo)');
            }
            
            process.exit(result.database.success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Falha crítica no backup:', error);
            process.exit(1);
        });
}

module.exports = BackupSystem;