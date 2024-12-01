class DomainMatcher {
    constructor(rules) {
        this.rules = rules;
    }

    match(domain) {
        for (const rule of this.rules) {
            if (rule.type === 'domain') {
                if (domain.endsWith(rule.domain)) {
                    return rule.action;
                }
            }
        }
        return 'foreign'; // 默认使用国外DNS
    }
}

module.exports = DomainMatcher; 