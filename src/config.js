const fs = require('fs');
const yaml = require('yaml');
const path = require('path');

class Config {
    constructor() {
        const configPath = path.join(__dirname, '../config.yml');
        const configFile = fs.readFileSync(configPath, 'utf8');
        this.config = yaml.parse(configFile);
    }

    getServerConfig() {
        return this.config.server;
    }

    getCacheConfig() {
        return this.config.cache;
    }

    getUpstreamServers() {
        return this.config.upstream;
    }

    getRules() {
        return this.config.rules;
    }

    getAdblockConfig() {
        return this.config.adblock;
    }

    getLoggingConfig() {
        return this.config.logging;
    }

    getLoadBalancerConfig() {
        return this.config.loadbalancer || {
            strategy: 'weighted',
            healthCheck: {
                enabled: true,
                interval: 30,
                timeout: 2000,
                testDomain: 'www.google.com'
            }
        };
    }

    getDNSTimeout() {
        return this.config.server.timeout || 3000;
    }

    getMaxRetries() {
        return this.config.server.maxRetries || 3;
    }

    getCacheCheckPeriod() {
        return this.config.cache.checkPeriod || 600;
    }

    getAdblockUpdateInterval() {
        return this.config.adblock.updateInterval || 86400;
    }
}

module.exports = new Config(); 