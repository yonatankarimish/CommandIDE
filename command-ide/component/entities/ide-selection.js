class TokenSelection{
    constructor(line, rule, token, textNode, letterIdx = 0) {
        this.line = line;
        this.rule = rule;
        this.token = token;
        this.textNode = textNode; //will be null if textNode has empty text

        //generate indices of node hierarchy for each node, within it's containing parent
        //the difference between (for example) line.rules.indexOf(rule) and ruleIdx is that ruleIdx counts the number all child nodes, while line.rules only counts child rules.
        this.lineIdx = Array.prototype.indexOf.call(this.line.parentNode.childNodes, this.line);
        this.ruleIdx = Array.prototype.indexOf.call(this.line.childNodes, this.rule);
        this.tokenIdx = Array.prototype.indexOf.call(this.rule.childNodes, this.token);
        this.letterIdx = letterIdx;
    }

    static fromTextNode = (textNode, letterIdx = 0) => {
        const token = textNode.parentNode;
        const rule = token.parentNode;
        const line = rule.parentNode;
        return new TokenSelection(line, rule, token, textNode, letterIdx);
    };

    static fromToken = (token, letterIdx = 0) => {
        const rule = token.parentNode;
        const line = rule.parentNode;
        return new TokenSelection(line, rule, token, null, letterIdx);
    };
}

class SeparatorSelection{
    constructor(line, separator, textNode, letterIdx = 0) {
        this.line = line;
        this.separator = separator;
        this.textNode = textNode; //will be null if separator has empty text

        this.lineIdx = Array.prototype.indexOf.call(this.line.parentNode.childNodes, this.line);
        this.separatorIdx = Array.prototype.indexOf.call(this.line.childNodes, this.separator);
        this.letterIdx = letterIdx;
    }

    static fromTextNode = (textNode, letterIdx = 0) => {
        const separator = textNode.parentNode;
        const line = separator.parentNode;
        return new SeparatorSelection(line, separator, textNode, letterIdx);
    };
}

export {TokenSelection, SeparatorSelection};