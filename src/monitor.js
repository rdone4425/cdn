class DNSMonitor {
    constructor() {
        this.stats = {
            totalQueries: 0,
            cacheHits: 0,
            cacheMisses: 0,
            blockedQueries: 0,
            failedQueries: 0,
            averageResponseTime: 0,
            queryHistory: []
        };
        
        this.startTime = Date.now();
    }

    recordQuery(queryInfo) {
        this.stats.totalQueries++;
        this.stats.queryHistory.push({
            timestamp: Date.now(),
            ...queryInfo
        });

        // 只保留最近1000条查询记录
        if (this.stats.queryHistory.length > 1000) {
            this.stats.queryHistory.shift();
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
        this.stats.averageResponseTime = 
            (this.stats.averageResponseTime * (this.stats.totalQueries - 1) + time) 
            / this.stats.totalQueries;
    }

    getStats() {
        return {
            ...this.stats,
            uptime: Math.floor((Date.now() - this.startTime) / 1000),
            cacheHitRate: this.stats.totalQueries ? 
                (this.stats.cacheHits / this.stats.totalQueries * 100).toFixed(2) + '%' : 
                '0%'
        };
    }
}

module.exports = new DNSMonitor(); 