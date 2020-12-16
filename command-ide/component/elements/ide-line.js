import IdeRule from "./ide-rule";
import IdeSeparator from "./ide-separator";
import {Separators} from "../grammar/default-grammar";

class IdeLine extends HTMLElement{
    //Constructor args may be undefined if created from browser internals (as they call new HTMLElement() with no args)
    constructor(){
        super();

        this.rules = []; //this.childNodes gives all descendants, while this.rules gives all child rules
    }

    //add the provided rule element as a child of this line
    addRule = (rule, padFirstToken = true) => {
        if(this.childNodes.length > 0){
            const separator = IdeSeparator.ruleSeparator();
            this.append(separator);

            if(padFirstToken && !rule.firstToken.textContent.startsWith(" ") && !rule.firstToken.textContent.startsWith(String.fromCharCode(9))){
                rule.firstToken.textContent = " " + rule.firstToken.textContent;
            }
        }

        this.append(rule);
        return this;
    };

    //add the provided rules element as children of this line
    addRules = (rules) => {
        for(const rule of rules){
            this.addRule(rule);
        }

        return this;
    };

    //Link the next line with the current line for next/prev element navigation
    linkNewNextLine = (nextLine) => {
        if(this.nextLine) {
            this.nextLine.prevLine = nextLine;
        }
        nextLine.prevLine = this;
        nextLine.nextLine = this.nextLine;
        this.nextLine = nextLine;
    };

    //Link the previous line with the current line for next/prev element navigation
    linkNewPrevLine = (prevLine) => {
        if(this.prevLine){
            this.prevLine.nextLine = prevLine;
        }
        prevLine.nextLine = this;
        prevLine.prevLine = this.prevLine;
        this.prevLine = prevLine;
    };

    //Delete the current line's links with it's neighbours, and links them with each other for next/prev element navigation
    unlinkFromLines = () => {
        const prevLine = this.prevLine;
        const nextLine = this.nextLine;

        if(prevLine) {
            prevLine.nextLine = nextLine;
        }
        if(nextLine){
            nextLine.prevLine = prevLine;
        }
    };

    //Return the first rule in this line's token collection (expected to match the first child rule of this line)
    get firstRule(){
        return this.rules[0];
    }

    //Return the last rule in this line's token collection (expected to match the first child rule of this line)
    get lastRule(){
        return this.rules[this.rules.length - 1];
    }

    //Get the nearest line (from this line upwards, including this line) which does not contain an extension rule
    get nearestCommandLine(){
        let nearestLine = this;
        while(nearestLine?.firstRule?.grammarRule.isExtensionRule){
            nearestLine = nearestLine.prevLine;
        }

        return nearestLine;
    };

    //Check if this line has any child nodes
    get isEmpty(){
        return this.childNodes.length === 0;
    }

    //Check if this line's child rules are all degenerate
    get isDegenerate(){
        for(const child of this.childNodes){
            if(!(child.isDegenerate || child instanceof IdeSeparator)){
                return false;
            }
        }

        return true;
    }

    //Check if the line is an extension line, by checking the extension flag of it's first rule
    get isExtensionLine(){
        return this.firstRule?.grammarRule?.isExtensionRule || false;
    }

    //Check if this line contains any text
    get containsText(){
        return this.textContent.trim().length > 0;
    }

    //A line is considered to extend another line if it contains an extension rule
    //(note this does not indicate the line's validity - only for the presence of a freestanding rule)
    get extendsAnotherLine(){
        return this.rules.filter(rule => rule.grammarRule.isExtensionRule).length > 0;
    }

    //Get all subsequent extension lines for this line
    //Returns an empty array if there are no extending lines, or if this line is itself an extension line
    get extensionLines(){
        const extensionLines = [];
        if(!this.extendsAnotherLine) {
            let iteratedLine = this.nextLine;
            while (iteratedLine) {
                if (iteratedLine.extendsAnotherLine) {
                    extensionLines.push(iteratedLine);
                    iteratedLine = iteratedLine.nextLine;
                } else {
                    break;
                }
            }
        }

        return extensionLines;
    }

    //Check that the line satisfies the following requirements:
    //1) it contains no duplicate rules AND
    //2) it does not extend another line, without any lines above it (i.e. the first line in the editor cannot be an extension line) AND
    //3)    it either contains only one rule, which is a freestanding rule
    //4)    or it contains no freestanding rules, while containing the default rule
    contentCompliant = () => {
        const potentialError = this.tooltip();
        return potentialError.length === 0;
    };

    //Runs the actual check for content compliance
    //returning a human-readable error message if the line is not compliant
    tooltip = () => {
        let defaultRules = [];
        let freestandingRules =[];
        const ruleNames = new Set();
        const mutualExclusionGroups = {};

        for(const rule of this.rules){
            const grammarRule = rule.grammarRule;
            const keyword = grammarRule.firstToken.textContent?.trim() || grammarRule.firstToken.descriptiveName;

            if(ruleNames.has(keyword)){
                return `Line contains more than one ${keyword} rule`;
            }else{
                ruleNames.add(keyword);
            }
            if(grammarRule.mutualExclusionKey) {
                if(mutualExclusionGroups[grammarRule.mutualExclusionKey]){
                    return `The rules ${mutualExclusionGroups[grammarRule.mutualExclusionKey]} and ${keyword} are mutually exclusive`;
                }else {
                    mutualExclusionGroups[grammarRule.mutualExclusionKey] = keyword;
                }
            }
            if (grammarRule.isDefaultRule){
                defaultRules.push(keyword);
            }
            if (grammarRule.isFreestandingRule){
                freestandingRules.push(keyword);
            }
        }

        if(this.prevLine == null && this.extendsAnotherLine){
            return "No command is written above this result handling line";
        }else if(freestandingRules.length > 0 && ruleNames.size > 1){
            const ruleName = freestandingRules[0];
            return `The ${ruleName} rule must be written in a separate line`;
        }else if(freestandingRules.length === 0 && defaultRules.length !== 1){
            return "Line must contain a command, or handle command results";
        }

        return "";
    };

    //Decorate the default behavior for insertAdjacentElement() with type checking
    insertAdjacentElement = (position, element) => {
        switch (position) {
            case "beforebegin": {
                if(element instanceof IdeLine) {
                    this.linkNewPrevLine(element);
                } else {
                    throw "Can only insert another line before a given rule";
                }
            } break;
            case "afterbegin":{
                if(element instanceof IdeRule) {
                    if(this.rules.length > 0) {
                        const firstRule = this.firstRule;
                        firstRule.linkNewPrevRule(element);
                    }
                    this.rules.unshift(element);
                }else if(!(element instanceof IdeSeparator)){
                    throw "Can only insert a rule or a separator as the child of a given line";
                }
            } break;
            case "beforeend": {
                if(!(element instanceof IdeRule || element instanceof IdeSeparator)) {
                    if(this.rules.length > 0) {
                        const previousRule = this.lastRule;
                        previousRule.linkNewNextRule(element);
                    }
                    this.rules.push(element);
                }else if(!(element instanceof IdeSeparator)){
                    throw "Can only insert a rule or a separator as the child of a given line";
                }
            } break;
            case "afterend": {
                if(element instanceof IdeLine) {
                    this.linkNewNextLine(element);
                } else {
                    throw "Can only insert another line after a given rule";
                }
            } break;
        }

        return super.insertAdjacentElement(position, element);
    };

    //decorate the default behavior for append() by linking child tokens
    append = (newChild) => {
        super.append(newChild);

        if(newChild instanceof IdeRule){
            if(this.rules.length > 0) {
                const previousRule = this.lastRule;
                previousRule.linkNewNextRule(newChild);
            }else {
                this.rules.push(newChild);
            }
        }
    };

    //decorate the default behavior for prepend() by linking child tokens
    prepend = (newChild) => {
        super.prepend(newChild);

        if(newChild instanceof IdeRule){
            if(this.rules.length > 0) {
                const nextRule = this.firstRule;
                nextRule.linkNewPrevRule(newChild);
            }else {
                this.rules.push(newChild);
            }
        }
    };


    //decorate the default behavior for removeChild() by unlinking child tokens
    removeChild = (childNode) => {
        super.removeChild(childNode);

        if(childNode instanceof IdeRule){
            this.unlinkChild(childNode);
        }

        return childNode;
    };

    //unlink the child rule from this line and from it's sibling rules
    unlinkChild = (childNode) => {
        childNode.unlinkFromRules();
        const ruleIdx = this.rules.indexOf(childNode);
        if(ruleIdx >= 0){
            this.rules.splice(ruleIdx, 1);
        }
    };

    //removes all children from this line, unlinking any child rules in the process;
    clear = () => {
        while(this.hasChildNodes()){
            this.removeChild(this.firstChild);
        }

        this.rules.length = 0;
        this.innerHTML = "";
    };

    //decorate the default behavior for remove() by unlinking self from neighbouring lines
    remove = () => {
        this.unlinkFromLines();
        super.remove();
    };

    //decorate the default behavior for cloneNode() by adding cloned child rules to the rules property
    cloneNode = (deepClone) => {
        const selfClone = super.cloneNode(false);
        if(deepClone){
            for(const childNode of this.childNodes){
                const nodeClone = childNode.cloneNode(true);
                selfClone.append(nodeClone); //using the childNodes append() method will register any rules added
            }
        }

        return selfClone;
    };
}

export default IdeLine;