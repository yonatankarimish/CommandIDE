class GrammarRule {
    constructor(ruleName){
        /*A note on default, freestanding and extension rules:
        * By default, each line consists of one or more rules. A line is only valid if it contains the default rule
        * Freestanding rules modify this concept: A line can also be valid if it contains one (and only one) rule, which is a freestanding rule
        *
        * Lines with extension rules "extend" standard lines, and are written below them. For example:
        * echo foo, timeout 30 => standard line
        *       if (%%bar%% isnotempty) => freestanding line
        *
        * the second line will "extend" the command represented by the first line, mapping the extension rule into additional fields on the command object
        * extension rules are by definition also freestanding rules, but the inverse is not always true*/
        this.name = ruleName;
        this.descriptiveName = "<unspecified-rule>";
        this.tokens = {};
        this.isDefaultRule = false;
        this.isFreestandingRule = false;
        this.isExtensionRule = false;
        this.mutualExclusionKey = "";
        this.toggleable = false;
    }

    clone = () => {
        return new GrammarRule(this.name)
            .withDescriptiveName(this.descriptiveName)
            .markAsDefault(this.isDefaultRule)
            .markAsFreestanding(this.isFreestandingRule)
            .markAsExtension(this.isExtensionRule)
            .withMutualExclusion(this.mutualExclusionKey)
            .withToggleableFlag(this.toggleable)
            .addTokens(this.grammarTokens);
    };

    //human readable name to describe the rule in tooltips and messages
    withDescriptiveName = (descriptiveName) => {
        this.descriptiveName = descriptiveName;
        return this;
    };

    //Each line must contain a default rule; A line cannot contain more than one default rule... (e.g. [command] rule)
    markAsDefault = (mark = true) => {
        this.isDefaultRule = mark;
        return this;
    };

    //...Unless it contains a freestanding rule; In this case, this is the only rule the line can contain (e.g. verify-file)
    markAsFreestanding = (mark = true) => {
        this.isFreestandingRule = mark;
        return this;
    };

    //Extension rules are a special type of freestanding rules, which are defined below a line with a default rule (e.g. wait-for)
    markAsExtension = (mark = true) => {
        this.isFreestandingRule = mark;
        this.isExtensionRule = mark;
        return this;
    };

    //Mutually exclusive rules with the same exclusion key cannot appear together in the same line (e.g. saveto-file and saveto-var)
    withMutualExclusion = (key) => {
        this.mutualExclusionKey = key;
        return this;
    };

    //Toggleable rules can be selected by the user for "Toggle default values" show/hide
    withToggleableFlag = (toggleable) => {
        this.toggleable = toggleable;
        return this;
    };

    //Add a grammar token to the token map of this rule
    //The ordering of the tokens matters, because validating the rule checks its child contents are correctly ordered
    addToken = (token) => {
        this.tokens[token.key] = token;
        return this;
    };

    //Add multiple grammar tokens to the token map of this rule
    //The ordering of the tokens matters, because validating the rule checks its child contents are correctly ordered
    addTokens = (tokens) => {
        for(const token of tokens){
            this.addToken(token);
        }

        return this;
    };

    get defaultToken(){
        if(this.tokens["TT"]){
            return this.tokens["TT"];
        }else{
            throw `The defined default token does not exist for rule ${this.name}`;
        }
    }

    get firstToken(){
        const keys = this.tokenKeys;
        if(keys.length > 0){
            return this.tokens[keys[0]];
        }else{
            throw `No tokens have been added to rule ${this.name}`;
        }
    }

    get tokenKeys(){
        return Object.keys(this.tokens);
    }

    get grammarTokens(){
        return Object.values(this.tokens);
    }
}

export default GrammarRule;