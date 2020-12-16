import IdeRule from "./ide-rule";
import {TokenClasses} from "../grammar/grammar-token";

class IdeToken extends HTMLElement{
    //Constructor args may be undefined if created from browser internals (as they call new HTMLElement() with no args)
    constructor(grammarToken, tokenText = ""){
        super();
        this.textContent = tokenText;
        this.applyGrammarToken(grammarToken)
    }

    //apply the provided grammar token to this token element
    applyGrammarToken = (grammarToken) => {
        if(grammarToken) {
            this.grammarToken = grammarToken;
            this.applyStyle(grammarToken.tokenClass);
        }else{
            console.warn("Created element with no grammar token: ", this);
        }

        return this;
    };

    //Applies style classes to the token element, according to the tokenClass of the provided grammarToken
    applyStyle = (tokenClass) => {
        switch (tokenClass) {
            case TokenClasses.KEYWORD: {
                this.setAttribute('class', 'ide-token keywordToken');
            }break;
            case TokenClasses.ARGUMENT: {
                this.setAttribute('class', 'ide-token argumentToken');
            }break;
            case TokenClasses.COMMENT: {
                this.setAttribute('class', 'ide-token commentToken');
            }break;
            case TokenClasses.TEXT: {
                this.setAttribute('class', 'ide-token textToken');
            }break;
        }

        return this;
    };

    //Link the next token with the current token for next/prev element navigation
    linkNewNextToken = (nextToken) => {
        if(this.nextToken){
            this.nextToken.prevToken = nextToken;
        }
        nextToken.prevToken = this;
        nextToken.nextToken = this.nextToken;
        this.nextToken = nextToken;

        const parentRule = this.parentNode;
        if(parentRule instanceof IdeRule){
            const selfIndex = parentRule.tokens.indexOf(this);
            parentRule.tokens.splice(selfIndex + 1, 0, nextToken);
        }
    };

    //Link the previous token with the current token for next/prev element navigation
    linkNewPrevToken = (prevToken) => {
        if(this.prevToken){
            this.prevToken.nextToken = prevToken;
        }
        prevToken.nextToken = this;
        prevToken.prevToken = this.prevToken;
        this.prevToken = prevToken;

        const parentRule = this.parentNode;
        if(parentRule instanceof IdeRule){
            const selfIndex = parentRule.tokens.indexOf(this);
            parentRule.tokens.splice(selfIndex, 0, prevToken);
        }
    };

    //Delete the current token's links with it's neighbours, and links them with each other for next/prev element navigation
    unlinkFromTokens = () => {
        const prevToken = this.prevToken;
        const nextToken = this.nextToken;

        if(prevToken) {
            prevToken.nextToken = nextToken;
        }
        if(nextToken){
            nextToken.prevToken = prevToken;
        }
    };

    //Check if this token has any text content
    get isEmpty(){
        return this.textContent.length === 0;
    }

    //Check if this token has no child elements (de facto alias for isEmpty())
    get isDegenerate(){
        return this.isEmpty;
    }

    //Check if this token contains any text
    get containsText(){
        return this.textContent.trim().length > 0;
    }

    //Check if this token's text contents match the regex of the provided grammar token
    contentCompliant = (grammarToken = this.grammarToken) => {
        const sourceText = this.textContent.startsWith(String.fromCharCode(9))? this.textContent : this.textContent.trimStart(); //remove any whitespace from the start of the text, unless it is an indent tab
        return sourceText.search(grammarToken.contentRegex) === 0;
    };

    //Create a human-readable error message if the token is not content compliant
    tooltip = () => {
        return this.grammarToken.errorAnalyzer(this.textContent) || "";
    };

    //Decorate the default behavior for insertAdjacentElement() with type checking
    insertAdjacentElement = (position, element) => {
        switch (position) {
            case "beforebegin": {
                if(element instanceof IdeToken) {
                    this.linkNewPrevToken(element);
                } else {
                    throw "Can only insert another token before a given token";
                }
            } break;
            case "afterbegin":
            case "beforeend": {
                if(!(element instanceof Text)) {
                    throw "Can only insert a text node as the child of a given token";
                }
            } break;
            case "afterend": {
                if(element instanceof IdeToken) {
                    this.linkNewNextToken(element);
                } else {
                    throw "Can only insert another token after a given token";
                }
            } break;
        }

        return super.insertAdjacentElement(position, element);
    };

    //decorate the default behavior for remove() by unlinking self from parent rule
    remove = () => {
        const parentRule = this.parentNode;
        if(parentRule instanceof IdeRule){
            parentRule.removeChild(this);
        } else {
            super.remove();
        }
    };

    //decorate the default behavior for cloneNode() by ensuring the text content is copied to the cloned token
    cloneNode = (deepClone) => {
        const clonedToken = super.cloneNode(deepClone).applyGrammarToken(this.grammarToken);
        if(deepClone){
            clonedToken.textContent = this.textContent;
        }

        return clonedToken;
    };
}

export default IdeToken;