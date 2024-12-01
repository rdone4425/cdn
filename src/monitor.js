class DNSMonitor {
    constructor() {
        this.stats = {
            totalQueries: 0,
            cacheHits: 0,
            cacheMisses: 0,
            blockedQueries: 0,
            failedQueries: 0,
            averageResponseTime: 0,
            totalResponseTime: 0,
            queryHistory: []
        };
        
        this.startTime = Date.now();
    }

    recordQuery(queryInfo) {
        this.stats.totalQueries++;
        
        // 添加查询记录到历史
        const record = {
            timestamp: Date.now(),
            domain: queryInfo.domain,
            client: queryInfo.client,
            result: queryInfo.result || '-',
            responseTime: queryInfo.responseTime || 0
        };
        
        this.stats.queryHistory.unshift(record);

        // 只保留最近100条查询记录
        if (this.stats.queryHistory.length > 100) {
            this.stats.queryHistory.pop();
        }
    }

    recordCacheHit() {
        this.stats.cacheHits++;
    }

    recordCacheMiss() {
        this.stats.cacheMisses++;
    }

    recordBlockedQuery() {
        this.stats.blockedQueries++;
    }

    recordFailedQuery() {
        this.stats.failedQueries++;
    }

    recordResponseTime(time) {
        this.stats.totalResponseTime += time;
        this.stats.averageResponseTime = 
            this.stats.totalResponseTime / this.stats.totalQueries;
    }

    getStats() {
        return {
            totalQueries: this.stats.totalQueries,
            cacheHits: this.stats.cacheHits,
            cacheMisses: this.stats.cacheMisses,
            blockedQueries: this.stats.blockedQueries,
            failedQueries: this.stats.failedQueries,
            averageResponseTime: Math.round(this.stats.averageResponseTime),
            queryHistory: this.stats.queryHistory,
            uptime: Math.floor((Date.now() - this.startTime) / 1000)
        };
    }
}

module.exports = new DNSMonitor(); 