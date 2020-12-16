import IdeLine from "./ide-line";
import IdeToken from "./ide-token";
import IdeSeparator from "./ide-separator";

class IdeRule extends HTMLElement{
    //Constructor args may be undefined if created from browser internals (as they call new HTMLElement() with no args)
    constructor(grammarRule){
        super();

        this.tokens = []; //this.childNodes gives all descendants, while this.tokens gives all child tokens
        this.applyGrammarRule(grammarRule);
    }

    //apply the provided grammar rule to this rule element
    applyGrammarRule = (grammarRule) => {
        this.grammarRule = grammarRule;
        return this;
    };

    //add the provided token element as a child of this rule
    addToken = (token, tokenSeparator = true) => {
        if(tokenSeparator && this.tokens.length > 0 && !this.lastToken.textContent.endsWith(" ")){
            this.lastToken.textContent += " ";
        }

        this.append(token);
        return this;
    };

    //add the provided tokens element as children of this rule
    addTokens = (tokens, tokenSeparators = true) => {
        for(const token of tokens){
            this.addToken(token, tokenSeparators);
        }

        return this;
    };

    //Link the next rule with the current rule for next/prev element navigation
    linkNewNextRule = (nextRule) => {
        if(this.nextRule){
            this.nextRule.prevRule = nextRule;
        }
        nextRule.prevRule = this;
        nextRule.nextRule = this.nextRule;
        this.nextRule = nextRule;

        const parentLine = this.parentNode;
        if(parentLine instanceof IdeLine){
            const selfIndex = parentLine.rules.indexOf(this);
            parentLine.rules.splice(selfIndex + 1, 0, nextRule);
        }
    };

    //Link the previous rule with the current rule for next/prev element navigation
    linkNewPrevRule = (prevRule) => {
        if(this.prevRule){
            this.prevRule.nextRule = prevRule;
        }
        prevRule.nextRule = this;
        prevRule.prevRule = this.prevRule;
        this.prevRule = prevRule;

        const parentLine = this.parentNode;
        if(parentLine instanceof IdeLine){
            const selfIndex = parentLine.rules.indexOf(this);
            parentLine.rules.splice(selfIndex, 0, prevRule);
        }
    };

    //Delete the current rule's links with it's neighbours, and links them with each other for next/prev element navigation
    unlinkFromRules = () => {
        const prevRule = this.prevRule;
        const nextRule = this.nextRule;

        if(prevRule) {
            prevRule.nextRule = nextRule;
        }
        if(nextRule){
            nextRule.prevRule = prevRule;
        }
    };

    //Return the first token in this rule's token collection (expected to match the first child token of this rule)
    get firstToken(){
        return this.tokens[0];
    }

    //Return the last token in this rule's token collection (expected to match the last child token of this rule)
    get lastToken(){
        return this.tokens[this.tokens.length - 1];
    }

    //Check if this rule has any child nodes
    get isEmpty(){
        return this.childNodes.length === 0;
    }

    //Check if this rule's child tokens are all degenerate
    get isDegenerate(){
        for(const child of this.childNodes){
            if(!(child.isDegenerate || child instanceof IdeSeparator)){
                return false;
            }
        }

        return true;
    }

    //Check if this rule contains any text
    get containsText(){
        return this.textContent.trim().length > 0;
    }

    //Check if this rule's tokens are all present in the correct order
    //allowing the exclusion of tokens with default values
    contentCompliant = (grammarRule = this.grammarRule) => {
        const potentialError = this.tooltip(grammarRule);
        return potentialError.length === 0;
    };

    //Runs the actual check for content compliance
    //returning a human-readable error message if the rule is not compliant
    tooltip = (grammarRule = this.grammarRule) => {
        const parentLine = this.parentNode.nearestCommandLine;
        const expectedGrammarTokens = grammarRule.tokens;
        const expectedKeyOrder = grammarRule.tokenKeys;
        const actualGrammarTokens = this.tokens.map(token => token.grammarToken);
        const actualKeyOrder = actualGrammarTokens.map(grammarToken => grammarToken.key);

        const keyword = this.firstToken.textContent.trim();
        const expectedOrderIterator = expectedKeyOrder[Symbol.iterator]();
        const actualOrderIterator = actualKeyOrder[Symbol.iterator]();

        let keyOrdinal = 1;
        let iteratedActualKey = actualOrderIterator.next();
        for(let iteratedExpectedKey = expectedOrderIterator.next(); !iteratedExpectedKey.done; iteratedExpectedKey = expectedOrderIterator.next(), keyOrdinal++){
            const expectedKey = iteratedExpectedKey.value;
            const actualKey = iteratedActualKey.value;
            const expectedName = expectedGrammarTokens[expectedKey].descriptiveName;

            if(expectedKey !== actualKey) {
                const expectedGrammarToken = expectedGrammarTokens[expectedKey];
                const defaultTokenValue = expectedGrammarToken.defaultValue(parentLine);
                if(!defaultTokenValue || defaultTokenValue.length === 0 || expectedGrammarToken.equals(grammarRule.defaultToken)){
                    const actualName = actualKey? expectedGrammarTokens[actualKey].descriptiveName : "empty space";
                    const expectedPronoun = "aeiou".indexOf(expectedName.charAt(0).toLowerCase()) > -1? "an" : "a";
                    const actualPronoun = "aeiou".indexOf(actualName.charAt(0).toLowerCase()) > -1? "an" : "a";

                    return `${keyword} was expecting ${expectedPronoun} ${expectedName} at position ${keyOrdinal}, 
                            but found ${actualPronoun} ${actualName} instead`;
                }
            }else{
                iteratedActualKey = actualOrderIterator.next();
            }
        }

        if(!this.containsText && this.parentNode.containsText){
            return "This rule cannot be empty"
        }else if(!iteratedActualKey.done){
            //actual token count may not exceed the expected token count (obviously...)
            return `${keyword} was not expecting more than ${expectedKeyOrder.length} tokens`;
        }

        return "";
    };

    //Decorate the default behavior for insertAdjacentElement() with type checking
    insertAdjacentElement = (position, element) => {
        switch (position) {
            case "beforebegin": {
                if(element instanceof IdeRule) {
                    this.linkNewPrevRule(element);
                } else if(!(element instanceof IdeSeparator)) {
                    throw "Can only insert another rule or a separator before a given rule";
                }
            } break;
            case "afterbegin":{
                if(element instanceof IdeToken) {
                    if(this.tokens.length > 0) {
                        const nextToken = this.firstToken;
                        nextToken.linkNewPrevToken(element);
                    }
                    this.tokens.unshift(element);

                }else{
                    throw "Can only insert a token as the child of a given rule";
                }
            } break;
            case "beforeend": {
                if(element instanceof IdeToken) {
                    if(this.tokens.length > 0) {
                        const previousToken = this.lastToken;
                        previousToken.linkNewNextToken(element);
                    }
                    this.tokens.push(element);
                }else{
                    throw "Can only insert a token as the child of a given rule";
                }
            } break;
            case "afterend": {
                if(element instanceof IdeRule) {
                    this.linkNewNextRule(element);
                } else if(!(element instanceof IdeSeparator)) {
                    throw "Can only insert another rule or a separator after a given rule";
                }
            } break;
        }

        return super.insertAdjacentElement(position, element);
    };

    //decorate the default behavior for append() by linking child tokens
    append = (newChild) => {
        super.append(newChild);

        if(newChild instanceof IdeToken){
            if(this.tokens.length > 0) {
                const previousToken = this.lastToken;
                previousToken.linkNewNextToken(newChild);
            } else {
                this.tokens.push(newChild);
            }
        }
    };

    //decorate the default behavior for prepend() by linking child tokens
    prepend = (newChild) => {
        super.prepend(newChild);

        if(newChild instanceof IdeToken){
            if(this.tokens.length > 0) {
                const nextToken = this.firstToken;
                nextToken.linkNewPrevToken(newChild);
            } else {
                this.tokens.push(newChild);
            }
        }
    };

    //decorate the default behavior for removeChild() by unlinking child tokens
    removeChild = (childNode) => {
        super.removeChild(childNode);

        if(childNode instanceof IdeToken){
            this.unlinkChild(childNode);
        }

        return childNode;
    };

    //unlink the child token from this rule and from it's sibling tokens
    unlinkChild = (childNode) => {
        childNode.unlinkFromTokens();
        const tokenIdx = this.tokens.indexOf(childNode);
        if(tokenIdx >= 0){
            this.tokens.splice(tokenIdx, 1);
        }
    };

    //removes all children from this rule, unlinking any child tokens in the process;
    clear = () => {
        while(this.hasChildNodes()){
            this.removeChild(this.firstChild);
        }

        this.tokens.length = 0;
        this.innerHTML = "";
    };

    //decorate the default behavior for remove() by unlinking self from parent line
    remove = () => {
        const parentLine = this.parentNode;
        if(parentLine instanceof IdeLine){
            parentLine.removeChild(this);
        } else {
            super.remove();
        }
    };

    //decorate the default behavior for cloneNode() by adding cloned child tokens to the tokens property
    cloneNode = (deepClone) => {
        const selfClone = super.cloneNode(false).applyGrammarRule(this.grammarRule);
        if(deepClone){
            for(const childNode of this.childNodes){
                const nodeClone = childNode.cloneNode(true);
                selfClone.append(nodeClone); //using the childNodes append() method will register any rules added
            }
        }

        return selfClone;
    };
}

export default IdeRule;