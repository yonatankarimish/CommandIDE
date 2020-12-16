import {TokenSelection, SeparatorSelection} from "../entities/ide-selection";
import IdeToken from "../elements/ide-token";
import IdeSeparator from "../elements/ide-separator";
import {Separators} from "../grammar/default-grammar";
import IdeRule from "../elements/ide-rule";

class SelectionUtils {
    constructor(CommandIDE){
        this.CommandIDE = CommandIDE;
    }

    //Convenience method for extracting the current selection and range
    getSelectionAndRange = () => {
        const selection = window.getSelection();
        const range = selection.getRangeAt(0); //as of writing this code, browsers only have one selected range
        return [selection, range];
    };

    //Generate ide-selection drilldowns from a given selection range
    getSelectedNodes = (selectionRange) => {
        if(this.CommandIDE.lines.length > 0) {
            const startSelection = this.getIdeSelectionElement(selectionRange.startContainer, selectionRange.startOffset);
            const endSelection = this.getIdeSelectionElement(selectionRange.endContainer, selectionRange.endOffset);
            return [startSelection, endSelection];
        }
        return [null, null];
    };

    //Generate an ide-selection based on a range container node + offset
    getIdeSelectionElement = (rangeContainer, rangeOffset) => {
        //1) get the left-most child of rangeContainer
        //(browsers seem to set the endContainer to an element only when selecting the start of that element, so this works for both sides of a selection)
        let deepestNode;
        if (rangeContainer instanceof Text) {
            deepestNode = rangeContainer;
        } else if (rangeContainer.hasChildNodes()) {
            if (rangeContainer instanceof IdeToken) {
                deepestNode = rangeContainer.childNodes[0];
            }else{
                const boundedOffset = Math.max(0, Math.min(rangeOffset, rangeContainer.childNodes.length - 1));
                deepestNode = this.getDeepestLeftChild(rangeContainer.childNodes[boundedOffset]);
            }
        } else{
            deepestNode = rangeContainer;
        }

        //2) Generate an ide-selection object using deepestNode
        if (deepestNode instanceof Text) {
            if (deepestNode.parentNode instanceof IdeToken) {
                return TokenSelection.fromTextNode(deepestNode, rangeOffset);
            } else if (deepestNode.parentNode instanceof IdeSeparator) {
                return SeparatorSelection.fromTextNode(deepestNode, rangeOffset);
            }
        } else if (deepestNode instanceof IdeToken) {
            return TokenSelection.fromToken(deepestNode, rangeOffset);
        } else {
            console.warn("deepestNode is not an IdeToken or Text. This shouldn't happen...", deepestNode);
            return null;
        }
    };

    //Check if the current selection starts at the leftmost part of it's startContainer
    isSelectionAtNodeStart = (node) => {
        const [selection, selectionRange] = this.getSelectionAndRange();
        let currentNode = selectionRange.startContainer;

        if(!selection.containsNode(node, true)) {
            return false;
        } else if(currentNode instanceof Text && selectionRange.startOffset !== 0) {
            return false;
        } else {
            while (currentNode !== node && currentNode !== document && currentNode != null) {
                if (currentNode.parentNode.firstChild !== currentNode) {
                    return false;
                }

                currentNode = currentNode.parentNode;
            }
        }

        return true;
    };

    //Check if the current selection finishes at the rightmost part of it's endContainer
    isSelectionAtNodeEnd = (node) => {
        const [selection, selectionRange] = this.getSelectionAndRange();
        let currentNode = selectionRange.endContainer;

        if(!selection.containsNode(node, true)) {
            return false;
        } else if(currentNode instanceof Text && selectionRange.endOffset !== currentNode.textContent.length) {
            return false;
        } else {
            while (currentNode !== node && currentNode !== document && currentNode != null) {
                if (currentNode.parentNode.lastChild !== currentNode) {
                    return false;
                }

                currentNode = currentNode.parentNode;
            }
        }

        return true;
    };

    //Convert a degenerate selection (the editor itself, or a given degenerate node) to an appropriate line element
    extractLineFromDegenerateSelection = (selectionNode, nodeOffset) => {
        if(selectionNode.isIdeEditor){
            return selectionNode.childNodes[nodeOffset];
        }else if(selectionNode.isDegenerate){
            return this.CommandIDE.utils.lineUtils.getParentLine(selectionNode);
        }

        return undefined; //i.e. the selection node is an actual line with contents
    };

    getRuleFromSelection = (ideSelection) => {
        if(ideSelection instanceof TokenSelection){
            return ideSelection.rule;
        }else if(ideSelection instanceof SeparatorSelection){
            return this.getClosestRuleToCaret(ideSelection, ideSelection.separator);
        }else{
            return null;
        }
    };

    //Gets the nearest rule to the separator, based on the caret position
    //Assumes a collapsed selection
    getClosestRuleToCaret = (selectionRange, separator) => {
        const commaIdx = separator.textContent.indexOf(Separators.RULE);
        if(selectionRange.startOffset <= commaIdx){
            return separator.previousSibling instanceof IdeRule? separator.previousSibling : null;
        }else{
            return separator.nextSibling instanceof IdeRule? separator.nextSibling : null;
        }
    }

    //Returns the left-most child of a given node
    getDeepestLeftChild = (selectedNode) => {
        let deepestNode = selectedNode;
        while (deepestNode.hasChildNodes()) {
            deepestNode = deepestNode.firstChild;
        }

        return deepestNode;
    };

    //Returns the right-most child of a given node
    getDeepestRightChild = (selectedNode) => {
        let deepestNode = selectedNode;
        while (deepestNode.hasChildNodes()) {
            deepestNode = deepestNode.lastChild;
        }

        return deepestNode;
    };

    //Extracts the text from a given rule and returns the index of the letter the caret is positioned before
    getAbsoluteCaretPosition = (selection) => {
        let absoluteIdx = 0;
        const tokens = selection.rule.tokens;
        for (let i = 0; i < selection.tokenIdx; i++) {
            absoluteIdx += tokens[i].textContent.length;
        }

        return absoluteIdx + selection.letterIdx;
    };

    //Extracts the text from a given line and returns the index of the letter the caret is positioned before
    getAbsoluteLineCaretPosition = (selection) => {
        let absoluteIdx = 0;
        const lineChildren = selection.line.childNodes;
        for (let i = 0; i < selection.ruleIdx; i++) {
            absoluteIdx += lineChildren[i].textContent.length;
        }

        return absoluteIdx + this.getAbsoluteCaretPosition(selection);
    };

    //Iterates a given rule and returns the relative position an absolute caret position represents, along with the token it resides in
    getRelativeCaretPosition = (rule, absoluteCaretPosition) => {
        let countdownIdx = absoluteCaretPosition;
        let candidateToken =  rule.childNodes?.[0];
        while(countdownIdx >= 0 && candidateToken){
            if(countdownIdx - candidateToken.textContent.length >= 0 && candidateToken.nextSibling) {
                countdownIdx -= candidateToken.textContent.length;
                candidateToken = candidateToken.nextSibling;
            }else{
                break;
            }
        }

        return [candidateToken, countdownIdx];
    };

    //Iterates a given rule and returns the relative position an absolute caret position represents, along with the token it resides in
    //(funnily enough, the relative caret methods are currently identical, but i'm keeping them separate if we ever want to change either of them)
    getRelativeLineCaretPosition = (line, absoluteCaretPosition) => {
        let countdownIdx = absoluteCaretPosition;
        let candidateRule =  line.childNodes?.[0];
        while(countdownIdx >= 0 && candidateRule){
            if(countdownIdx - candidateRule.textContent.length >= 0 && candidateRule.nextSibling) {
                countdownIdx -= candidateRule.textContent.length;
                candidateRule = candidateRule.nextSibling;
            }else{
                break;
            }
        }

        return this.getRelativeCaretPosition(candidateRule, countdownIdx);
    };

    //Get the first and last lines currently selected, based on any degenerate lines currently selected
    getWrappingLines = (degenerateStartLine, degenerateEndLine) => {
        const lineUtils = this.CommandIDE.utils.lineUtils;
        const startLine = degenerateStartLine || lineUtils.getParentLine(this.CommandIDE.latestSelectionRange.startContainer);
        const endLine = degenerateEndLine || lineUtils.getParentLine(this.CommandIDE.latestSelectionRange.endContainer);
        return [startLine, endLine];
    };

    //If the node contains text, position the caret before it's first letter
    makeDeepSelectionAtStart = (selectionRange, node) => {
        if(node instanceof Text){
            selectionRange.setEnd(node, 0);
        }else{
            selectionRange.setEndBefore(node);
        }
    }

    //If the node contains text, position the caret after it's last letter
    makeDeepSelectionAtEnd = (selectionRange, node) => {
        if(node instanceof Text){
            selectionRange.setStart(node, node.length);
        }else{
            selectionRange.setStartAfter(node);
        }
    }

    //Modifies the selection to select around any containers which are IdeSeparators
    selectAroundSeparator = (selectionRange) => {
        const ruleUtils = this.CommandIDE.utils.ruleUtils;
        const startSeparator = ruleUtils.getParentSeparator(selectionRange.startContainer);
        const endSeparator = ruleUtils.getParentSeparator(selectionRange.endContainer);

        if(startSeparator){
            this.CommandIDE.ensureSeparatorBetweenRules(startSeparator);
            const prevRule = startSeparator.previousSibling;
            const rightmostChild = this.getDeepestRightChild(prevRule);
            this.makeDeepSelectionAtEnd(selectionRange, rightmostChild);
        }

        if(endSeparator){
            this.CommandIDE.ensureSeparatorBetweenRules(endSeparator);
            const nextRule = endSeparator.nextSibling;
            const leftmostChild = this.getDeepestLeftChild(nextRule);
            this.makeDeepSelectionAtStart(selectionRange, leftmostChild);
        }
    };

    //Selects everything currently written in the editor
    selectAll = () => {
        if(this.CommandIDE.linePane.textContent !== "") {
            const firstToken = this.getDeepestLeftChild(this.CommandIDE.firstLine);
            const lastToken = this.getDeepestRightChild(this.CommandIDE.lastLine);

            this.CommandIDE.latestSelectionRange.setStart(firstToken, 0);
            this.CommandIDE.latestSelectionRange.setEnd(lastToken, lastToken.textContent.length);
        }
    };

    //Copies the fragment to the editor cache, while erasing any contents that might be contained in the browser clipboard
    //Returns true if no exceptions were encountered
    copyContents = async (fragment) => {
        try {
            await navigator.clipboard.writeText(fragment.map(node => node.textContent).join(Separators.LINE));
            return true;
        }catch (e) {
            if(e instanceof DOMException) {
                console.warn("Cannot write to clipboard when focusing outside the document (e.g. when using devtools). Copy aborted")
            }else{
                console.error(e);
            }

            return false;
        }
    };

    //Get any fragment copied to the clipboard. If no fragment exists, return the latest selection from the clipboard
    getCopiedFragment = async () => {
        const lineUtils = this.CommandIDE.utils.lineUtils;
        const clipboardText = await navigator.clipboard.readText();
        if(clipboardText) {
            return clipboardText.split(Separators.LINE).map(lineText => {
                return lineUtils.makeNewLine(lineText.replace(/[\r\n ]+/g, ' '))[0];
            });
        }

        return null;
    };

    //Parses the DOM structure of the IDE as a tree
    //and searches for the given text across all it's leaves
    //returning [node, idx] start + end pairs marking the position of each match
    findText = (searchText) => {
        const textContainers = this.CommandIDE.querySelectorAll("ide-token, ide-separator");
        const matchingPairs = [];
        let currentStart = [];
        let currentMatch = "";

        for(const tag of textContainers){
            const enumeratedLetters = Array.prototype.entries.call(tag.textContent);
            for(const [idx, letter] of enumeratedLetters) {
                if (currentMatch.length === 0) {
                    currentStart = [tag.childNodes[0], idx];
                }

                currentMatch += letter;
                if (searchText === currentMatch) {
                    const currentEnd = [tag.childNodes[0], idx + 1];
                    matchingPairs.push([currentStart, currentEnd]);
                }

                if (!searchText.startsWith(currentMatch) || searchText === currentMatch) {
                    currentMatch = "";
                    currentStart = [];
                }
            }
        }

        return matchingPairs;
    };

    //Repopulate the provided ide selection with element references, using the selection indices
    invalidateSelection = (ideSelection, containingLine, absoluteOffset) => {
        if (ideSelection instanceof TokenSelection) {
            ideSelection.line = containingLine;
            ideSelection.rule = ideSelection.line.childNodes[ideSelection.ruleIdx];
            [ideSelection.token, ideSelection.letterIdx] = this.getRelativeCaretPosition(ideSelection.rule, absoluteOffset);
            ideSelection.tokenIdx = Array.prototype.indexOf.call(ideSelection.rule.childNodes, ideSelection.token);
            ideSelection.textNode = ideSelection.token.childNodes[0];
        } else if (ideSelection instanceof SeparatorSelection) {
            ideSelection.separator = ideSelection.line.childNodes[ideSelection.separatorIdx];
            ideSelection.textNode = ideSelection.separator.childNodes[0];
        }
    };
}

export default SelectionUtils;