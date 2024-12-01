const NodeCache = require('node-cache');
const logger = require('./logger');

class DomainClassifier {
    constructor() {
        // 缓存域名分类结果，TTL为1小时
        this.cache = new NodeCache({
            stdTTL: 3600,
            checkperiod: 600
        });

        // 常见域名后缀分类
        this.domainSuffixes = {
            china: [
                'cn', 'com.cn', 'net.cn', 'org.cn', 'gov.cn', 'edu.cn',
                'mil.cn', 'ac.cn', 'ah.cn', 'bj.cn', 'cq.cn', 'fj.cn',
                'gd.cn', 'gs.cn', 'gz.cn', 'gx.cn', 'ha.cn', 'hb.cn',
                'he.cn', 'hi.cn', 'hk.cn', 'hl.cn', 'hn.cn', 'jl.cn',
                'js.cn', 'jx.cn', 'ln.cn', 'mo.cn', 'nm.cn', 'nx.cn',
                'qh.cn', 'sc.cn', 'sd.cn', 'sh.cn', 'sn.cn', 'sx.cn',
                'tj.cn', 'tw.cn', 'xj.cn', 'xz.cn', 'yn.cn', 'zj.cn'
            ],
            foreign: [
                'com', 'net', 'org', 'edu', 'gov', 'mil', 'int',
                'eu', 'us', 'uk', 'jp', 'kr', 'de', 'fr', 'au',
                'ru', 'br', 'in', 'info', 'biz', 'name', 'pro',
                'aero', 'museum', 'coop', 'travel', 'xxx', 'idv'
            ]
        };

        // 常见网站分类
        this.commonSites = {
            china: [
                'baidu.com', 'alibaba.com', 'taobao.com', 'qq.com',
                'jd.com', 'tmall.com', 'weibo.com', 'alipay.com',
                'bilibili.com', 'youku.com', 'iqiyi.com', '163.com',
                'zhihu.com', 'sina.com.cn', 'sohu.com', 'douyin.com',
                'tencent.com', 'meituan.com', 'didi.com', 'ctrip.com'
            ],
            foreign: [
                'google.com', 'facebook.com', 'youtube.com', 'twitter.com',
                'instagram.com', 'netflix.com', 'amazon.com', 'microsoft.com',
                'apple.com', 'github.com', 'wikipedia.org', 'yahoo.com',
                'linkedin.com', 'reddit.com', 'twitch.tv', 'spotify.com',
                'discord.com', 'telegram.org', 'whatsapp.com', 'zoom.us'
            ]
        };
    }

    classify(domain) {
        // 检查缓存
        const cached = this.cache.get(domain);
        if (cached) {
            return cached;
        }

        let result = this.checkCommonSites(domain);
        if (!result) {
            result = this.checkDomainSuffix(domain);
        }

        // 缓存结果
        this.cache.set(domain, result);
        return result;
    }

    checkCommonSites(domain) {
        // 检查是否是常见网站
        for (const site of this.commonSites.china) {
            if (domain === site || domain.endsWith('.' + site)) {
                return 'china';
            }
        }
        for (const site of this.commonSites.foreign) {
            if (domain === site || domain.endsWith('.' + site)) {
                return 'foreign';
            }
        }
        return null;
    }

    checkDomainSuffix(domain) {
        // 获取顶级域名
        const parts = domain.split('.');
        const tld = parts[parts.length - 1];
        const sld = parts.length > 2 ? parts[parts.length - 2] : null;

        // 检查是否是中国域名
        if (this.domainSuffixes.china.includes(tld) ||
            (sld && this.domainSuffixes.china.includes(sld + '.' + tld))) {
            return 'china';
        }

        // 检查是否是国外域名
        if (this.domainSuffixes.foreign.includes(tld)) {
            return 'foreign';
        }

        // 默认返回foreign
        return 'foreign';
    }

    // 获取缓存统计
    getStats() {
        return {
            keys: this.cache.keys().length,
            hits: this.cache.getStats().hits,
            misses: this.cache.getStats().misses
        };
    }
}

module.exports = new DomainClassifier(); 