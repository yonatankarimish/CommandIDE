import CommandIde from "../command-ide";
import IdeToken from "../elements/ide-token";
import IdeRule from "../elements/ide-rule";
import IdeSeparator from "../elements/ide-separator";

class TokenUtils{
    constructor(CommandIDE){
        this.CommandIDE = CommandIDE;
    }

    makeNewToken = (tokenText = "", grammarToken = this.CommandIDE.grammar.defaultRule.defaultToken) => {
        const token = new IdeToken(grammarToken, tokenText);
        CommandIde.addEventListener(token, "contextmenu", this.handleTokenRightClick);
        CommandIde.addEventListener(token, "mouseleave", this.CommandIDE.exitAutoComplete);
        return token;
    };

    //Displays error explanations in the IDE tooltip, if any are present
    handleTokenRightClick = (event) => {
        event.preventDefault();
        const token = event.target;

        // .tooltip() is an expensive function. Use it sparingly
        const tokenTooltip = token.tooltip();
        if(tokenTooltip) {
            this.CommandIDE.tooltip.withStyle("error").withMessage(tokenTooltip).attachTo(token).show();
            return;
        }

        const parentRule = token.parentNode;
        const ruleTooltip = parentRule.tooltip();
        if(ruleTooltip) {
            this.CommandIDE.tooltip.withStyle("error").withMessage(ruleTooltip).attachTo(parentRule).show();
            return;
        }

        const parentLine = parentRule.parentNode;
        const lineTooltip = parentLine.tooltip();
        if(lineTooltip) {
            this.CommandIDE.tooltip.withStyle("error").withMessage(lineTooltip).attachTo(parentLine).show();
            return;
        }
    };

    //generates a token array from the backing getters defined by the grammar tokens of the given grammar rule: [<T1>, <T2>, ... <Tn>]
    wrapWithTokens = (command, grammarRule) => {
        const tokens = [];
        for(const grammarToken of grammarRule.grammarTokens){
            const initialText = (grammarToken.backingGet? grammarToken.backingGet(command) : grammarToken.initialText) || grammarToken.initialText;
            const defaultTokenValue = grammarToken.defaultValue(command);

            if(this.CommandIDE.displayDefaultValues || initialText.trim() !== defaultTokenValue){
                tokens.push(
                    this.makeNewToken(
                        initialText,
                        grammarToken
                    )
                );
            }
        }

        return tokens;
    };

    //tries to convert the provided text into a token array, according to the provided grammar rule
    //note that there is no guarantee the returned tokens are compliant with the grammar rule's validation
    tokenizeText = (text, grammarRule) => {
        const tokens = [];
        let untokenizedText = "";

        //Iterate the given text character by character, and try to construct tokens from it
        //The text is iterated backwards (end to start) to avoid partial matches to content regex-es of grammar tokens.
        const letters = text.split("");
        let canCreateTokens = false;
        for(let letterIdx = letters.length - 1; letterIdx >= 0; letterIdx--){
            const letter = letters[letterIdx];
            untokenizedText = letter + untokenizedText;
            if(letterIdx > 0){
                //The look-ahead prevents falsely tokenizing text of the form "foo + keyword" (e.g. footimeout, blahappend) as non-default tokens
                const lookAhead = letters[letterIdx - 1];
                canCreateTokens = lookAhead.trim() !== lookAhead;
            }else{
                //omitting this line will always add the remaining untokenized text (at the end of iterating the letters) as a default token
                canCreateTokens = true;
            }

            if(canCreateTokens) {
                const [matchData, grammarToken] = this.containsToken(untokenizedText, grammarRule); //[matchData, token] OR [null, null]
                if (grammarToken && matchData?.index === 0) {
                    //By this stage the untokenized text contains tokens which we are allowed to parse
                    const endOfMatch = matchData.index + matchData[0].length;

                    //Unshift a default token when any non-trivial text is written after the token (rightwards)
                    let leftText;
                    const rightText = untokenizedText.substring(endOfMatch);
                    if (rightText.trim().length > 0) {
                        tokens.unshift(
                            this.makeNewToken(
                                rightText,
                                grammarRule.defaultToken
                            )
                        );
                        leftText = untokenizedText.substring(0, endOfMatch);
                    } else {
                        leftText = untokenizedText;
                    }

                    //Then unshift the token itself
                    tokens.unshift(
                        this.makeNewToken(
                            leftText,
                            grammarToken
                        )
                    );

                    //and reset our flags
                    untokenizedText = "";
                    canCreateTokens = false;
                }
            }
        }

        //if the remaining untokenized text can construct a non-trivial default token, add it as a default token
        //otherwise, just concatenate the whitespace to the leftmost token
        if(untokenizedText.trim().length === 0 && tokens.length > 0){
            tokens[0].textContent = untokenizedText + tokens[0].textContent;
        }else{
            tokens.unshift(
                this.makeNewToken(
                    untokenizedText,
                    grammarRule.defaultToken
                )
            );
        }


        return tokens;
    };

    //Searches the text for tokens defined in the provided grammar rule, returning the first matching token and the match data for the content regex
    containsToken = (text, grammarRule) => {
        const defaultToken = grammarRule.defaultToken;
        for(const token of grammarRule.grammarTokens){
            if(!defaultToken.equals(token)) {
                const matchData = text.match(token.contentRegex); //returns regex match data if found, or null if no match exists
                if (matchData) { //i.e. a match was found
                    return [matchData, token];
                }
            }
        }

        return [null, null];
    };

    //Splits a given token into two identical tokens, separated at the slice point
    //The left token will contain the text before the splice point, the right token will contain the text after the splice point
    //Any pointers to the original token will point to the left token after the split
    splitToken = (sliceNode, sliceIndex) => {
        let leftToken, rightToken;
        if (sliceNode instanceof IdeRule) {
            leftToken = sliceNode.childNodes[sliceIndex];
            rightToken = this.makeNewToken();
        } else {
            //Handle all possible edge-cases when splitting on a rule separator, to establish a left token for the separation
            if(sliceNode.parentNode instanceof IdeSeparator){
                const ruleUtils = this.CommandIDE.utils.ruleUtils;
                if(sliceIndex > 0){
                    const nextSibling = sliceNode.parentNode.nextSibling;
                    if(nextSibling == null || nextSibling instanceof IdeSeparator){
                        const [emptyRule,] = ruleUtils.makeNewRule();
                        sliceNode.parentNode.insertAdjacentElement("afterend", emptyRule);
                        leftToken = emptyRule.firstToken;
                    }else{
                        leftToken = sliceNode.parentNode.nextSibling.firstToken;
                    }

                    sliceIndex = 0;
                } else {
                    const prevSibling = sliceNode.parentNode.previousSibling;
                    if(prevSibling == null || prevSibling instanceof IdeSeparator){
                        const [emptyRule,] = ruleUtils.makeNewRule();
                        sliceNode.parentNode.insertAdjacentElement("beforebegin", emptyRule);
                        leftToken = emptyRule.lastToken;
                    }else{
                        leftToken = sliceNode.parentNode.previousSibling.lastToken;
                    }

                    sliceIndex = leftToken.textContent.length;
                }
            }else{
                leftToken = this.getParentToken(sliceNode); //if not already a token, will find the most immediate parent token
            }

            rightToken = this.makeNewToken(leftToken.textContent.slice(sliceIndex));
            leftToken.textContent = leftToken.textContent.slice(0, sliceIndex);
        }

        leftToken.insertAdjacentElement("afterend", rightToken);
        return [leftToken, rightToken];
    };

    //Same as standard split
    //But any pointers to the original token will point to the right token (instead of to the left token)
    reverseSplitToken = (sliceNode, sliceIndex) => {
        let leftToken, rightToken;
        if (sliceNode instanceof IdeRule) {
            leftToken = this.makeNewToken();
            rightToken = sliceNode.childNodes[sliceIndex];
        } else {
            //Handle all possible edge-cases when splitting on a rule separator, to establish a left token for the separation
            if(sliceNode.parentNode instanceof IdeSeparator){
                const ruleUtils = this.CommandIDE.utils.ruleUtils;
                if(sliceIndex > 0){
                    const nextSibling = sliceNode.parentNode.nextSibling;
                    if(nextSibling == null || nextSibling instanceof IdeSeparator){
                        const [emptyRule,] = ruleUtils.makeNewRule();
                        sliceNode.parentNode.insertAdjacentElement("afterend", emptyRule);
                        rightToken = emptyRule.firstToken;
                    }else{
                        rightToken = sliceNode.parentNode.nextSibling.firstToken;
                    }

                    sliceIndex = 0;
                } else {
                    const prevSibling = sliceNode.parentNode.previousSibling;
                    if(prevSibling == null || prevSibling instanceof IdeSeparator){
                        const [emptyRule,] = ruleUtils.makeNewRule();
                        sliceNode.parentNode.insertAdjacentElement("beforebegin", emptyRule);
                        rightToken = emptyRule.lastToken;
                    }else{
                        rightToken = sliceNode.parentNode.previousSibling.lastToken;
                    }

                    sliceIndex = rightToken.textContent.length;
                }
            }else{
                rightToken = this.getParentToken(sliceNode); //if not already a token, will find the most immediate parent token
            }

            leftToken = this.makeNewToken(rightToken.textContent.slice(0, sliceIndex));
            rightToken.textContent = rightToken.textContent.slice(sliceIndex);
        }

        rightToken.insertAdjacentElement("beforebegin", leftToken);
        return [leftToken, rightToken];
    };

    //Merges the right token into the left token, and invalidates the new merged token
    mergeTokens = (leftToken, rightToken) => {
        if(leftToken !== rightToken) {
            rightToken.remove();
            leftToken.textContent += rightToken.textContent;
            leftToken.nextToken = rightToken.nextToken;
            this.invalidateTokens(leftToken);
        }

        return leftToken;
    };

    //Merges the left token into the right token, and invalidates the new merged token
    reverseMergeTokens = (leftToken, rightToken) => {
        if(leftToken !== rightToken) {
            leftToken.remove();
            rightToken.textContent = leftToken.textContent + rightToken.textContent;
            rightToken.prevToken = leftToken.prevToken;
            this.invalidateTokens(rightToken);
        }

        return rightToken;
    };


    //Gets the parent token of the element passed as an argument, or null if the element has no parent token
    getParentToken = (element) => {
        let currentNode = element;
        while(!(currentNode instanceof CommandIde) && currentNode !== document && currentNode != null){
            if(currentNode instanceof IdeToken){
                return currentNode;
            }

            currentNode = currentNode.parentNode;
        }

        return null;
    };

    //Checks that the provided lines, and all child elements are valid
    validateTokens = (markIfInvalid, ...tokens) => {
        let tokensValid = true;

        for(const token of tokens){
            const contentCompliant = token.contentCompliant();
            tokensValid = tokensValid && contentCompliant;

            if(contentCompliant){
                token.classList.remove('invalidToken');
            }else if(markIfInvalid){
                token.classList.add('invalidToken');
            }
        }

        return tokensValid;
    };

    //Verifies the token key, text and style match those defined for it's grammar token
    //If there is a mismatch, modify these fields according to the mismatch's nature.
    invalidateTokens = (...tokens) => {
        const ruleUtils = this.CommandIDE.utils.ruleUtils;

        for(const token of tokens) {
            const parentRule = ruleUtils.getParentRule(token);
            let matchingToken;
            if (token === parentRule.firstToken) {
                //if the token being invalidated is the first token of it's rule, the rule itself might need invalidating
                //therefore we find a matching first token, and update the grammar rule if needed
                matchingToken = this.findMatchingFirstToken(token, this.CommandIDE.grammar);
                if (!matchingToken.equals(token.grammarToken)) {
                    token.applyGrammarToken(matchingToken);
                    ruleUtils.invalidateRules(parentRule);
                }
            } else {
                //the default token regex trivially matches any text
                //therefore we search the rule for a non-trivial match before resorting to the default token
                matchingToken = this.findMatchingGrammarToken(token, parentRule.grammarRule);
                token.applyGrammarToken(matchingToken);
            }
        }
    };

    //Searches for a matching grammar token by matching the token against all first tokens of the provided grammar. If no such rule is found, return the default grammar token.
    findMatchingFirstToken = (token, grammar) => {
        const firstTokens = grammar.firstTokens;
        const defaultToken = grammar.defaultRule.defaultToken;

        for(const grammarToken of firstTokens){
            if(!grammarToken.equals(defaultToken) && token.contentCompliant(grammarToken)){
                return grammarToken;
            }
        }

        return defaultToken;
    };

    //Searches for a matching grammar token by matching the text with it's content regex. If no such rule is found, return the default grammar token.
    findMatchingGrammarToken = (token, grammarRule) => {
        const defaultToken = grammarRule.defaultToken;

        for(const grammarToken of grammarRule.grammarTokens){
            if(!grammarToken.equals(defaultToken) && token.contentCompliant(grammarToken)){
                return grammarToken;
            }
        }

        return defaultToken;
    };
}

export default TokenUtils;