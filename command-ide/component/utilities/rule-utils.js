import CommandIde from "../command-ide";
import IdeLine from "../elements/ide-line";
import IdeRule from "../elements/ide-rule";
import IdeToken from "../elements/ide-token";
import Command from "../entities/command";
import IdeSeparator from "../elements/ide-separator";

class RuleUtils{
    constructor(CommandIDE){
        this.CommandIDE = CommandIDE;
    }

    makeNewRule = (textContent = "", grammarRule = this.CommandIDE.grammar.defaultRule) => {
        const tokenUtils = this.CommandIDE.utils.tokenUtils;
        const newRule = new IdeRule(grammarRule);
        const newToken = tokenUtils.makeNewToken(textContent, grammarRule.defaultToken);

        newRule.append(newToken);
        return [newRule, newToken.childNodes[0]];
    };

    //finds a grammar rule matching the given text with O(n) time complexity
    //note 1: the rules are matched by their first tokens
    //note 2: if you have a formatted rule, this can be trivially done using rule.grammarRule.name with O(1) time complexity
    findMatchingGrammarRule = (token, grammar = this.CommandIDE.grammar) => {
        for(const grammarRule of grammar.grammarRules){
            if((!grammarRule.firstToken.equals(grammarRule.defaultToken) || grammarRule.tokenKeys.length === 1) && token.contentCompliant(grammarRule.firstToken)){
                return grammarRule;
            }
        }

        return grammar.defaultRule;
    };

    //Splits a given rule into two separate rules, separated at the slice point
    //The left rule will contain the tokens before the splice point, the right token will contain the tokens after the splice point
    //Any pointers to the original rule will point to the left rule after the split
    splitRule = (sliceNode, sliceIndex) => {
        let leftRule, rightRule;
        if(sliceNode instanceof IdeLine) {
            leftRule = sliceNode.childNodes[sliceIndex];
            [rightRule,] = this.makeNewRule();
        } else {
            const tokenUtils = this.CommandIDE.utils.tokenUtils;
            const [leftToken, rightToken] = tokenUtils.splitToken(sliceNode, sliceIndex);

            leftRule = this.getParentRule(leftToken);
            [rightRule,] = this.makeNewRule();

            let iterRight = rightToken;
            do{
                let nextSibling = iterRight.nextSibling;
                iterRight.remove();
                if(!iterRight.isDegenerate) {
                    if(rightRule.lastToken.grammarToken.equals(iterRight.grammarToken)){
                        tokenUtils.mergeTokens(rightRule.lastToken, iterRight);
                    }else{
                        rightRule.append(iterRight);
                    }
                }

                iterRight = nextSibling;
            } while(iterRight);


            delete leftToken.nextToken;
            delete rightToken.prevToken;
        }

        leftRule.insertAdjacentElement("afterend", rightRule);
        return [leftRule, rightRule];
    };

    //Same as standard split
    //But any pointers to the original rule will point to the right rule (instead of to the left rule)
    reverseSplitRule = (sliceNode, sliceIndex) => {
        let leftRule, rightRule;
        if(sliceNode instanceof IdeLine) {
            [leftRule,] = this.makeNewRule();
            rightRule = sliceNode.childNodes[sliceIndex];
        } else {
            const tokenUtils = this.CommandIDE.utils.tokenUtils;
            const [leftToken, rightToken] = tokenUtils.reverseSplitToken(sliceNode, sliceIndex);

            [leftRule,] = this.makeNewRule();
            rightRule = this.getParentRule(rightToken);

            let iterLeft = leftToken;
            do{
                let prevSibling = iterLeft.previousSibling;
                iterLeft.remove();
                if(!iterLeft.isDegenerate) {
                    if(leftRule.firstToken.grammarToken.equals(iterLeft.grammarToken)){
                        tokenUtils.reverseMergeTokens(iterLeft, leftRule.firstToken);
                    }else{
                        leftRule.prepend(iterLeft);
                    }
                }

                iterLeft = prevSibling;
            } while(iterLeft);


            delete leftToken.nextToken;
            delete rightToken.prevToken;
        }

        rightRule.insertAdjacentElement("beforebegin", leftRule);
        return [leftRule, rightRule];
    };

    //Merges the right rule into the left rule, and invalidates the new merged rule
    mergeRules = (leftRule, rightRule) => {
        if(leftRule !== rightRule) {
            rightRule.remove();

            while (rightRule.hasChildNodes()) {
                //We simply remove and append, because invalidateRules() will retokenize the text
                const childNode = rightRule.removeChild(rightRule.firstChild);
                leftRule.append(childNode);
            }

            this.invalidateRules(leftRule);
        }

        return leftRule;
    };

    //Merges the left rule into the right rule, and invalidates the new merged rule
    reverseMergeRules = (leftRule, rightRule) => {
        if(leftRule !== rightRule) {
            leftRule.remove();

            while (leftRule.hasChildNodes()) {
                //We simply remove and prepend, because invalidateRules() will retokenize the text
                const childNode = leftRule.removeChild(leftRule.lastChild);
                rightRule.prepend(childNode);
            }

            this.invalidateRules(rightRule);
        }

        return rightRule;
    };

    //Checks that the provided lines, and all child elements are valid
    validateRules = (markIfInvalid, ...rules) => {
        const tokenUtils = this.CommandIDE.utils.tokenUtils;
        let rulesValid = true;

        for(const rule of rules){
            const contentCompliant = rule.contentCompliant();
            const tokensValid = tokenUtils.validateTokens(markIfInvalid, ...rule.tokens);
            rulesValid = rulesValid && tokensValid && contentCompliant;

            if(contentCompliant){
                rule.classList.remove('invalidRule');
            }else if(markIfInvalid){
                rule.classList.add('invalidRule');
            }
        }

        return rulesValid;
    };

    //Verifies the tokens within each passed rule match the grammar for the given token and rule
    //If there is a mismatch, modify the rule according to the mismatch's nature.
    invalidateRules = (...rules) => {
        const tokenUtils = this.CommandIDE.utils.tokenUtils;

        //Replaces the tokens within the provided rule with tokens extracted from it's untokenized text
        for(const modifiedRule of rules) {
            //First make sure the first token complies with the first token of the currently applied grammar rule
            //(applying a different rule if necessary)
            const matchingGrammarRule = this.findMatchingGrammarRule(modifiedRule.firstToken);
            modifiedRule.applyGrammarRule(matchingGrammarRule);

            //Then retokenize the text within the modified rule
            const currentText = modifiedRule.textContent;
            const textTokens = tokenUtils.tokenizeText(currentText, matchingGrammarRule);
            modifiedRule.clear();
            modifiedRule.addTokens(textTokens, false);
        }
    };

    //Gets the parent rule of the element passed as an argument, or null if the element has no parent rule
    getParentRule = (element) => {
        let currentNode = element;
        while(!(currentNode instanceof CommandIde) && currentNode !== document && currentNode != null){
            if(currentNode instanceof IdeRule){
                return currentNode;
            }

            currentNode = currentNode.parentNode;
        }

        return null;
    };

    //Gets the nearest rule to the left of the element passed as an argument, or null if the element has no rule to it's left
    getNearestLeftRule(element){
        let currentNode = element;
        while(currentNode){
            if(currentNode instanceof IdeRule){
                return currentNode;
            }

            currentNode = currentNode.previousSibling;
        }

        return null;
    }

    //Gets the nearest rule to the right of the element passed as an argument, or null if the element has no rule to it's right
    getNearestRightRule(element){
        let currentNode = element;
        while(currentNode){
            if(currentNode instanceof IdeRule){
                return currentNode;
            }

            currentNode = currentNode.nextSibling;
        }

        return null;
    }

    //Try and link the provided rule to it's sibling rules
    linkToNearestRule(rule){
        if(rule instanceof IdeRule){
            const nearestLeftRule = this.getNearestLeftRule(rule);
            if(nearestLeftRule){
                nearestLeftRule.linkNewNextRule(rule);
            }else{
                const nearestRightRule = this.getNearestRightRule(rule);
                if(nearestRightRule){
                    nearestRightRule.linkNewPrevRule(rule);
                }
            }
        }
    }

    //Gets the parent separator of the element passed as an argument, or null if the element has no parent separator
    getParentSeparator = (element) => {
        let currentNode = element;
        while(!(currentNode instanceof CommandIde) && currentNode !== document && currentNode != null){
            if(currentNode instanceof IdeSeparator){
                return currentNode;
            }

            currentNode = currentNode.parentNode;
        }

        return null;
    };

    //Shows all default tokens available for the provided rules
    showDefaultTokens = (...rules) => {
        const tokenUtils = this.CommandIDE.utils.tokenUtils;
        const emptyCommand = new Command(); //used to generate new tokens for each rule

        for(const rule of rules){
            const grammarRule = rule.grammarRule;
            const pristineTokens = tokenUtils.wrapWithTokens(emptyCommand, grammarRule);

            const pristineTokensByKeys = {}; //key: grammarToken.key, value: matching token element
            for(const token of pristineTokens){
                pristineTokensByKeys[token.grammarToken.key] = token;
            }

            for(const token of rule.tokens){
                const grammarTokenKey = token.grammarToken.key;
                const matchingPristineToken = pristineTokensByKeys[grammarTokenKey];
                matchingPristineToken.textContent = token.textContent;
            }

            rule.clear();
            rule.addTokens(pristineTokens);
        }
    };

    //Hides all tokens which match their default values in the provided rules
    //Return a list of lines which can be safely deleted after the token removal
    hideDefaultTokens = (...rules) => {
        const linesForRemoval = [];
        const rulesForRemoval = [];
        const separatorsForRemoval = [];
        const tokensForRemoval = [];

        for(const rule of rules){
            const parentLine = rule.parentNode.nearestCommandLine;

            for(const token of rule.tokens){
                const grammarToken = token.grammarToken;
                const defaultTokenValue = grammarToken.defaultValue(parentLine);
                if(defaultTokenValue?.length > 0 && token.textContent.trim() === defaultTokenValue){
                    tokensForRemoval.push(token);

                    if(token.grammarToken.equals(rule.grammarRule.defaultToken)){
                        if(rule?.previousSibling instanceof IdeSeparator){
                            separatorsForRemoval.push(rule.previousSibling);
                        }

                        if(rule.grammarRule.isExtensionRule){
                            linesForRemoval.push(rule.parentNode);
                        }

                        rulesForRemoval.push(rule);
                        break;
                    }
                }
            }
        }

        for(const token of tokensForRemoval){
            token.remove();
        }

        for(const separator of separatorsForRemoval){
            separator.remove();
        }

        for(const rule of rulesForRemoval){
            rule.remove();
        }

        return linesForRemoval;
    };
}

export default RuleUtils;