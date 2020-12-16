import CommandIde from "../command-ide";
import IdeLine from "../elements/ide-line";
import Command from "../entities/command";
import IdeRule from "../elements/ide-rule";
import IdeSeparator from "../elements/ide-separator";
import {Separators} from "../grammar/default-grammar";

class LineUtils{
    constructor(CommandIDE){
        this.CommandIDE = CommandIDE;
    }

    makeNewLine = (textContent = "") => {
        const ruleUtils = this.CommandIDE.utils.ruleUtils;
        const newLine = new IdeLine();
        for(const ruleText of textContent.split(Separators.RULE)){
            const [newRule,] = ruleUtils.makeNewRule(ruleText);
            newLine.addRule(newRule, false);
        }

        return [newLine, textContent];
    };

    //Splits a given line into two separate lines, separated at the slice point
    //The left line will contain the rules before the splice point, the right line will contain the rules after the splice point
    //Any pointers to the original line will point to the left line after the split
    splitLine = (sliceNode, sliceIndex) => {
        let leftLine, rightLine;
        if (sliceNode.isIdeEditor) {
            leftLine = sliceNode.childNodes[sliceIndex];
            [rightLine,] = this.makeNewLine();
        } else {
            const ruleUtils = this.CommandIDE.utils.ruleUtils;
            const [leftRule, rightRule] = ruleUtils.splitRule(sliceNode, sliceIndex);

            leftLine = this.getParentLine(leftRule);
            [rightLine,] = this.makeNewLine();

            let iterRight = rightRule;
            do{
                let nextSibling = iterRight.nextSibling;
                iterRight.remove();

                if(rightLine.lastChild instanceof IdeRule && iterRight instanceof IdeRule){
                    ruleUtils.mergeRules(rightLine.lastChild, iterRight);
                }else{
                    rightLine.append(iterRight);
                }

                iterRight = nextSibling;
            } while(iterRight);


            delete leftRule.nextRule;
            delete rightRule.prevRule;
        }

        leftLine.insertAdjacentElement("afterend", rightLine);
        return [leftLine, rightLine];
    };


    //Same as standard split
    //But any pointers to the original line will point to the right line (instead of to the left line)
    reverseSplitLine = (sliceNode, sliceIndex) => {
        let leftLine, rightLine;
        if (sliceNode.isIdeEditor) {
            [leftLine,] = this.makeNewLine();
            rightLine = sliceNode.childNodes[sliceIndex];
        } else {
            const ruleUtils = this.CommandIDE.utils.ruleUtils;
            const [leftRule, rightRule] = ruleUtils.reverseSplitRule(sliceNode, sliceIndex);

            [leftLine,] = this.makeNewLine();
            rightLine = this.getParentLine(leftRule);

            let iterLeft = leftRule;
            do{
                let prevSibling = iterLeft.previousSibling;
                iterLeft.remove();

                if(leftLine.firstChild instanceof IdeRule && iterLeft instanceof IdeRule){
                    ruleUtils.reverseMergeRules(iterLeft, leftLine.firstChild);
                }else{
                    leftLine.prepend(iterLeft);
                }

                iterLeft = prevSibling;
            } while(iterLeft);


            delete leftRule.nextRule;
            delete rightRule.prevRule;
        }

        rightLine.insertAdjacentElement("beforebegin", leftLine);
        return [leftLine, rightLine];
    };

    //Merges the right line into the left line, and invalidates the new merged rule
    mergeLines = (leftLine, rightLine) => {
        if(leftLine !== rightLine) {
            const ruleUtils = this.CommandIDE.utils.ruleUtils;
            rightLine.remove();

            while (rightLine.hasChildNodes()) {
                const childNode = rightLine.removeChild(rightLine.firstChild);
                if (!childNode.isDegenerate) {
                    if (leftLine.lastChild instanceof IdeRule && childNode instanceof IdeRule) {
                        ruleUtils.mergeRules(leftLine.lastChild, childNode);
                    } else {
                        leftLine.append(childNode);
                    }
                }
            }

            this.invalidateLines(leftLine);
        }

        return leftLine;
    };

    //Merges the left line into the right line, and invalidates the new merged rule
    reverseMergeLines = (leftLine, rightLine) => {
        if(leftLine !== rightLine) {
            const ruleUtils = this.CommandIDE.utils.ruleUtils;
            leftLine.remove();

            while (leftLine.hasChildNodes()) {
                const childNode = leftLine.removeChild(leftLine.lastChild);
                if (!childNode.isDegenerate) {
                    if (rightLine.firstChild instanceof IdeRule && childNode instanceof IdeRule) {
                        ruleUtils.reverseMergeRules(childNode, rightLine.firstChild);
                    } else {
                        rightLine.prepend(childNode);
                    }
                }
            }

            this.invalidateLines(rightLine);
        }

        return rightLine;
    };

    //Checks that the provided lines, and all child elements are valid
    validateLines = (markIfInvalid, ...lines) => {
        const ruleUtils = this.CommandIDE.utils.ruleUtils;
        let linesValid = true;

        for(const line of lines) {
            const contentCompliant = line.contentCompliant();
            const rulesValid = ruleUtils.validateRules(markIfInvalid, ...line.rules);
            linesValid = linesValid && rulesValid && contentCompliant;

            if(contentCompliant){
                line.classList.remove('invalidLine');
            }else if(markIfInvalid){
                line.classList.add('invalidLine');
            }
        }

        return linesValid;
    };

    //Verifies there are no inconsistencies within each passed line
    invalidateLines = (...lines) => {
        const ruleUtils = this.CommandIDE.utils.ruleUtils;

        for(const line of lines) {
            const rules = line.rules;
            if (rules.length > 0) {
                //invalidate the rule's tokens according to the applied grammar rule.
                ruleUtils.invalidateRules(...rules);
            }
        }
    };

    //Gets the parent line of the element passed as an argument, or null if the element has no parent line
    getParentLine = (element) => {
        let currentNode = element;
        while(!(currentNode instanceof CommandIde) && currentNode !== document && currentNode != null){
            if(currentNode instanceof IdeLine){
                return currentNode;
            }

            currentNode = currentNode.parentNode;
        }

        return null;
    };

    //Returns the distance between the two lines; negative distance indicated line A is AFTER line B
    distanceBetweenLines = (aLine, bLine) => {
        if(!aLine || !bLine){
            return 0
        }

        const bLineIdx = Array.prototype.indexOf.call(this.CommandIDE.lines, bLine);
        const aLineIdx = Array.prototype.indexOf.call(this.CommandIDE.lines, aLine);
        return bLineIdx - aLineIdx;
    };

    //Shows all rules with default values, according to user preferences
    showDefaultRules = (toggledRules, ...lines) => {
        const ruleUtils = this.CommandIDE.utils.ruleUtils;
        const tokenUtils = this.CommandIDE.utils.tokenUtils;

        const emptyCommand = new Command();
        let iteratedLine = lines[0];
        while(iteratedLine) {
            const firstGrammarRule = iteratedLine.firstRule.grammarRule;
            if (!firstGrammarRule.isFreestandingRule) {
                //Very tightly coupled selectors, but couldn't think of an easy way to avoid this...
                const commandRule = iteratedLine.rules.filter(rule => rule.grammarRule.name === "command")?.[0];
                const channelSelector = commandRule?.tokens?.filter(token => token.grammarToken.key === "ET")?.[0];
                emptyCommand.setDefaults(channelSelector?.textContent || "remote");

                const ruleNames = iteratedLine.rules.map(rule => rule.grammarRule.name);
                const extensionRuleNames = iteratedLine.extensionLines.flatMap(line => line.rules).map(rule => rule.grammarRule.name);
                for (const grammarRule of toggledRules) {
                    if (!ruleNames.concat(extensionRuleNames).includes(grammarRule.name) && ![0, ""].includes(grammarRule.defaultToken.defaultValue(emptyCommand))) {
                        const tokenList = tokenUtils.wrapWithTokens(emptyCommand, grammarRule);
                        const formattedRule = new IdeRule(grammarRule).addTokens(tokenList);

                        if (grammarRule.isExtensionRule) {
                            iteratedLine.insertAdjacentElement("afterend", new IdeLine().addRule(formattedRule))
                        } else {
                            iteratedLine.addRule(formattedRule);
                        }
                    }
                }

                //Reposition any comments at the end of the line (including the invalid case where there is more than one comment)
                const commentRules = iteratedLine.rules.filter(rule => rule.grammarRule.name === "description");
                for (const commentRule of commentRules) {
                    const precedingSeparator = commentRule.previousSibling;
                    if (precedingSeparator instanceof IdeSeparator) {
                        iteratedLine.removeChild(precedingSeparator); //will be readded by addRule()
                    }

                    iteratedLine.removeChild(commentRule);
                    iteratedLine.addRule(commentRule);
                }
            }

            ruleUtils.showDefaultTokens(...iteratedLine.rules);
            iteratedLine = iteratedLine.nextLine;
        }
    };

    //Hides all rules which match their default values in the provided lines
    hideDefaultRules = (...lines) => {
        const ruleUtils = this.CommandIDE.utils.ruleUtils;

        const linesForRemoval = [];
        for(const line of lines) {
            const linesThatHidAllRules = ruleUtils.hideDefaultTokens(...line.rules);
            linesForRemoval.push(...linesThatHidAllRules)
        }

        while(linesForRemoval.length > 0){
            const lineForRemoval = linesForRemoval.pop();
            lineForRemoval.remove();
        }
    };
}

export default LineUtils;