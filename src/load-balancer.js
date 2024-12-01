const logger = require('./logger');

class LoadBalancer {
    constructor() {
        // 服务器状态记录
        this.serverStats = new Map();
        // 轮询计数器
        this.roundRobinCounter = {
            china: 0,
            foreign: 0
        };
    }

    // 初始化服务器统计信息
    initServer(server) {
        const serverKey = typeof server === 'string' ? server : server.ip;
        if (!this.serverStats.has(serverKey)) {
            this.serverStats.set(serverKey, {
                available: true,
                failCount: 0,
                successCount: 0,
                totalResponseTime: 0,
                averageResponseTime: 0,
                lastCheckTime: Date.now(),
                weight: server.weight || 1
            });
        }
    }

    // 更新服务器统计信息
    updateServerStats(server, responseTime, success) {
        const serverKey = typeof server === 'string' ? server : server.ip;
        const stats = this.serverStats.get(serverKey);
        if (!stats) return;

        if (success) {
            stats.failCount = 0;
            stats.successCount++;
            stats.totalResponseTime += responseTime;
            stats.averageResponseTime = stats.totalResponseTime / stats.successCount;
            stats.available = true;
            
            // 根据响应时间动态调整权重
            const baseWeight = typeof server === 'object' ? server.weight : 1;
            stats.weight = Math.max(0.1, (baseWeight * 1000) / stats.averageResponseTime);
        } else {
            stats.failCount++;
            stats.available = stats.failCount < 3; // 连续失败3次则标记为不可用
        }

        stats.lastCheckTime = Date.now();
        this.serverStats.set(serverKey, stats);
    }

    // 获取可用服务器列表
    getAvailableServers(servers) {
        return servers.filter(server => {
            const serverKey = typeof server === 'string' ? server : server.ip;
            const stats = this.serverStats.get(serverKey);
            return stats && stats.available;
        });
    }

    // 轮询策略
    roundRobin(servers, type) {
        const availableServers = this.getAvailableServers(servers);
        if (availableServers.length === 0) return servers[0];

        const index = this.roundRobinCounter[type]++ % availableServers.length;
        return availableServers[index];
    }

    // 加权响应时间策略
    weightedResponseTime(servers) {
        const availableServers = this.getAvailableServers(servers);
        if (availableServers.length === 0) return servers[0];

        // 计算总权重
        let totalWeight = 0;
        availableServers.forEach(server => {
            const serverKey = typeof server === 'string' ? server : server.ip;
            const stats = this.serverStats.get(serverKey);
            totalWeight += stats.weight;
        });

        // 随机选择一个服务器，权重越大越容易被选中
        let random = Math.random() * totalWeight;
        for (const server of availableServers) {
            const serverKey = typeof server === 'string' ? server : server.ip;
            const stats = this.serverStats.get(serverKey);
            random -= stats.weight;
            if (random <= 0) {
                return server;
            }
        }

        return availableServers[0];
    }

    // 选择最佳服务器
    selectServer(servers, type, strategy = 'weighted') {
        // 确保所有服务器都有统计信息
        servers.forEach(server => this.initServer(server));

        // 根据策略选择服务器
        if (strategy === 'roundrobin') {
            return this.roundRobin(servers, type);
        } else {
            return this.weightedResponseTime(servers);
        }
    }

    // 获取服务器状态
    getServerStats() {
        const stats = {};
        this.serverStats.forEach((value, key) => {
            stats[key] = {
                available: value.available,
                averageResponseTime: value.averageResponseTime.toFixed(2),
                successRate: value.successCount === 0 ? 0 : 
                    ((1 - value.failCount / (value.successCount + value.failCount)) * 100).toFixed(2),
                weight: value.weight.toFixed(2)
            };
        });
        return stats;
    }

    // 健康检查
    async healthCheck(server) {
        const dns = require('dns').promises;
        const testDomain = 'www.google.com';
        const serverIP = typeof server === 'string' ? server : server.ip;
        
        try {
            const startTime = Date.now();
            dns.setServers([serverIP]);
            await dns.resolve4(testDomain);
            const responseTime = Date.now() - startTime;
            
            this.updateServerStats(server, responseTime, true);
            logger.info(`健康检查成功: ${serverIP}, 响应时间: ${responseTime}ms`);
            return true;
        } catch (error) {
            this.updateServerStats(server, 0, false);
            logger.error(`健康检查失败: ${serverIP} - ${error.message}`);
            return false;
        }
    }
}

module.exports = new LoadBalancer(); 