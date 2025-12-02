require('dotenv').config();
const logger = require('./logger');

class Config {
  constructor() {
    this.evolution = {
      apiUrl: process.env.EVOLUTION_API_URL || 'https://evo-api.pro',
      apiKey: process.env.EVOLUTION_API_KEY
    };

    this.instances = this.loadInstances();
    this.globalWebhooks = this.loadGlobalWebhooks();
    
    this.webhooks = {
      retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3'),
      retryDelay: parseInt(process.env.RETRY_DELAY || '1000'),
      timeout: parseInt(process.env.TIMEOUT || '10000')
    };

    this.server = {
      port: parseInt(process.env.PORT || '3000')
    };

    this.logging = {
      statsInterval: parseInt(process.env.LOG_STATS_INTERVAL || '5')
    };

    this.features = {
      addInstancePrefix: process.env.ADD_INSTANCE_PREFIX === 'true'
    };

    this.validate();
  }

  loadInstances() {
    const instances = [];
    let instanceNumber = 1;

    while (true) {
      const nameKey = `INSTANCE_${instanceNumber}_NAME`;
      const webhooksKey = `INSTANCE_${instanceNumber}_WEBHOOKS`;
      const eventsKey = `INSTANCE_${instanceNumber}_EVENTS`;

      const name = process.env[nameKey];
      const webhooks = process.env[webhooksKey];

      if (!name || !webhooks) {
        break;
      }

      instances.push({
        number: instanceNumber,
        name: name.trim(),
        webhooks: webhooks.split(',').map(url => url.trim()).filter(url => url),
        events: process.env[eventsKey]
          ? process.env[eventsKey].split(',').map(e => e.trim()).filter(e => e)
          : []
      });

      instanceNumber++;
    }

    return instances;
  }

  loadGlobalWebhooks() {
    if (!process.env.GLOBAL_WEBHOOKS) {
      return [];
    }

    return process.env.GLOBAL_WEBHOOKS
      .split(',')
      .map(url => url.trim())
      .filter(url => url);
  }

  validate() {
    if (!this.evolution.apiKey) {
      logger.error('EVOLUTION_API_KEY não configurada no .env');
      process.exit(1);
    }

    // Verificar se há pelo menos uma configuração válida
    const hasInstances = this.instances.length > 0;
    const hasGlobalWebhooks = this.globalWebhooks.length > 0;
    
    if (!hasInstances && !hasGlobalWebhooks) {
      logger.error('Nenhuma configuração de webhook encontrada');
      logger.info('💡 Configure pelo menos:');
      logger.info('   - Webhooks globais: GLOBAL_WEBHOOKS');
      logger.info('   - Ou instâncias específicas: INSTANCE_1_NAME e INSTANCE_1_WEBHOOKS');
      process.exit(1);
    }

    // Validação de instâncias (apenas se existirem)
    if (hasInstances) {
      logger.info(`✅ ${this.instances.length} instância(s) configurada(s)`);
      this.instances.forEach(instance => {
        const instanceWebhooks = instance.webhooks.length;
        const globalWebhooks = this.globalWebhooks.length;
        const totalWebhooks = instanceWebhooks + globalWebhooks;
        
        // Apenas alertar se a instância não tiver webhooks próprios nem globais
        if (instanceWebhooks === 0 && globalWebhooks === 0) {
          logger.error(`Instância "${instance.name}" sem webhooks`);
          logger.info(`💡 Adicione webhooks para esta instância ou configure GLOBAL_WEBHOOKS`);
          process.exit(1);
        }

        logger.info(`   - ${instance.name}: ${totalWebhooks} webhook(s) ` + 
                    `(${instanceWebhooks} próprio(s) + ${globalWebhooks} global(is))`);
      });
    }

    // Validação de webhooks globais
    if (hasGlobalWebhooks) {
      logger.info(`✅ ${this.globalWebhooks.length} webhook(s) global(is)`);
      
      // Se não há instâncias, explicar como os webhooks globais funcionam
      if (!hasInstances) {
        logger.info('ℹ️  Os webhooks globais receberão todos os eventos de TODAS as instâncias do Evolution');
        logger.info('   (mesmo que elas não estejam listadas nas configurações)');
      }
    }

    // Resumo da configuração
    if (hasInstances && hasGlobalWebhooks) {
      logger.info('📋 Configuração: Instâncias específicas + Webhooks globais');
    } else if (hasInstances) {
      logger.info('📋 Configuração: Apenas instâncias específicas');
    } else {
      logger.info('📋 Configuração: Apenas webhooks globais');
    }
  }

  getAllWebhooksForInstance(instanceName) {
    const instance = this.instances.find(i => i.name === instanceName);
    if (!instance) return [];
    return [...instance.webhooks, ...this.globalWebhooks];
  }

  getEnabledEventsForInstance(instanceName) {
    const instance = this.instances.find(i => i.name === instanceName);
    if (!instance) return [];
    return instance.events;
  }
}

module.exports = new Config();