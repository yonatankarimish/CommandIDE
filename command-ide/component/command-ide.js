import OrdinalUtils from "./utilities/ordinal-utils";
import LineUtils from "./utilities/line-utils";
import RuleUtils from "./utilities/rule-utils";
import TokenUtils from "./utilities/token-utils";
import SelectionUtils from "./utilities/selection-utils";

import {TokenSelection, SeparatorSelection} from "./entities/ide-selection";
import Command from "./entities/command";
import DefaultGrammar, {Separators} from "./grammar/default-grammar";

import IdeLine from "./elements/ide-line";
import IdeRule from "./elements/ide-rule";
import IdeToken from "./elements/ide-token";
import IdeSeparator from "./elements/ide-separator";
import IdeTooltip from "./entities/ide-tooltip";
import CompletionUtils from "./utilities/completion-utils";

class CommandIde extends HTMLElement {
    #ordinalUtils;
    #lineUtils;
    #ruleUtils;
    #tokenUtils;
    #selectionUtils;
    #completionUtils;

    constructor(){
        super();
        //Utility classes (that can be created during construction phase)
        this.#ordinalUtils = new OrdinalUtils(this);
        this.#lineUtils = new LineUtils(this);
        this.#ruleUtils = new RuleUtils(this);
        this.#tokenUtils = new TokenUtils(this);
        this.#selectionUtils = new SelectionUtils(this);

        //Editor toggles
        this.displayDefaultValues = false;
        this.showTokenInspector = false;
        this.autocompleting = true;
        this.toggledRuleNames = new Set();

        //Event data
        this.latestSelection = null;
        this.latestSelectionRange = null;
        this.latestStartSelection = null;
        this.latestEndSelection = null;
        this.latestKeyEvent = null;
        this.valid = true;

        console.log(this);
    }

    //injects an IDE instance with a list of commands, which are used to write the initial lines inside the editor
    init = (sessionId, commands, grammar, autocompleteNgrams, headerButtons = []) => {
        this.sessionId = sessionId;
        this.commands = commands;
        this.grammar = grammar;
        this.loadUserPreferences();
        this.generateElement(headerButtons);

        //Utility classes (that can only be created after the init phase)
        this.#completionUtils = new CompletionUtils(this, autocompleteNgrams);
        return this;
    };

    //Load any user preferences that have been cached in the web browser
    loadUserPreferences = () => {
        const toggledRuleNames = window.localStorage.getItem('toggledRuleNames'); //returns a comma-delimited string with all toggled rule names
        if(toggledRuleNames?.length > 0){
            this.toggledRuleNames = new Set(toggledRuleNames.split(","));
        }
    };

    //Create the DOM structure for the editor
    generateElement = (headerButtons) => {
        this.header = this.generateHeader(headerButtons);
        this.tooltip = this.generateTooltip();
        this.editor = this.generateEditor();
        this.append(this.header, this.tooltip, this.editor);
        this.#ordinalUtils.invalidateOrdinals();
    };

    //Create the header section for the editor, attaching any buttons provided during the init phase
    generateHeader = (headerButtons) => {
        const header = document.createElement('section');
        header.classList.add("command-ide-header");
        header.append(...headerButtons);

        return header;
    };

    //Create the tooltip element, used for displaying messages within the IDE
    generateTooltip = () => {
        const tooltip = new IdeTooltip(this);
        tooltip.textContent = "IDE tooltip element";
        return tooltip;
    };

    //Create the editor pane: consisting of an ordinal numbers section and a line section
    generateEditor = () => {
        const editor = document.createElement('section');
        editor.classList.add("command-ide-editor");

        this.ordinalPane = document.createElement('div');
        this.ordinalPane.classList.add("ordinals");
        editor.append(this.ordinalPane);

        this.linePane = document.createElement('div');
        this.linePane.classList.add("lines");
        this.linePane.setAttribute('contenteditable', 'true');
        this.linePane.setAttribute('autocomplete', 'off');
        this.linePane.setAttribute('autocorrect', 'off');
        this.linePane.setAttribute('autocapitalize', 'off');
        this.linePane.setAttribute('spellcheck', 'false');
        this.linePane.setAttribute('data-placeholder', 'Enter your first command...');
        this.linePane.isIdeEditor = true;
        editor.append(this.linePane);

        let previousLine;
        this.createLinesFromCommands(...this.commands).forEach(line => {
            if(previousLine){
                previousLine.linkNewNextLine(line);
            }

            this.linePane.append(line);
            previousLine = line;
        });

        CommandIde.addEventListener(this.linePane, 'mousedown', this.handleMouseDownEvent);
        CommandIde.addEventListener(this.linePane, 'mouseup', this.handleMouseUpEvent);
        CommandIde.addEventListener(this.linePane, 'keydown', this.handleKeyDownEvent);
        CommandIde.addEventListener(this.linePane, 'keyup', this.handleKeyUpEvent);
        CommandIde.addEventListener(this, 'dragstart', event => event.preventDefault());
        CommandIde.addEventListener(this, 'dragend', event => event.preventDefault());

        const editorObserver = new MutationObserver(this.handleTreeChange);
        editorObserver.observe(this.linePane, {subtree: true, childList: true});
        return editor;
    };

    //Converts session commands into line elements, ready to be embedded within the IDE
    createLinesFromCommands = (...commands) => {
        const lines = [];

        for(const command of commands) {
            const line = new IdeLine();
            const extensionLines = [];

            //we iterate over the grammar rule names to preserve grammar token order (otherwise iteration will be according to the ordering of each commands keys)
            for (const property of this.grammar.ruleNames) {
                const grammarRule = this.grammar.rules[property];
                const defaultToken = grammarRule.defaultToken;
                const tokenText = (defaultToken.backingGet? defaultToken.backingGet(command) : defaultToken.initialText) || defaultToken.initialText;
                const defaultTokenValue = defaultToken.defaultValue(command);

                if(this.displayDefaultValues || tokenText.trim() !== defaultTokenValue){
                    const tokenList = this.#tokenUtils.wrapWithTokens(command, grammarRule);
                    const formattedRule = new IdeRule(grammarRule).addTokens(tokenList);

                    if(grammarRule.isExtensionRule) {
                        extensionLines.push(
                            new IdeLine().addRule(formattedRule)
                        );
                    } else {
                        line.addRule(formattedRule);
                    }
                }
            }

            lines.push(line);
            lines.push(...extensionLines);
        }

        return lines;
    };

    //Converts IDE line elements into session commands
    createCommandsFromLines = (...lines) => {
        this.validateLines(true, ...lines);
        if(!this.valid){
            throw 'Cannot generate commands - editor is invalid or in an inconsistent state';
        }

        const commands = [];
        for(const line of lines) {
            if(line.containsText) {
                const extendsAnotherLine = line.extendsAnotherLine;
                const command = extendsAnotherLine ? commands[commands.length - 1] : new Command();

                for (const rule of line.rules) {
                    const tokens = rule.tokens;
                    for (const token of tokens) {
                        const tokenText = token.textContent.trim();
                        const grammarToken = token.grammarToken;
                        if (grammarToken.backingSet) { //some tokens don't have backing setters (i.e. first tokens, which are used for semantic grammar purposes and not for mapping to a property)
                            grammarToken.backingSet(command, tokenText);
                        }
                    }
                }

                if (!extendsAnotherLine) {
                    commands.push(command);
                }
            }
        }

        this.postprocessCommands(commands);
        return commands;
    };

    //apply additional data and transformations to commands, not defined by a grammar
    postprocessCommands = (commands) => {
        for(const [index, command] of commands.entries()) {
            command.session_ID = this.sessionId;
            command.queue = index + 1;
        }
        return commands;
    };

    //Changes the user preferences for default rule display when showing/hiding default values
    changeDefaultRulePreferences = (ruleName, toggleState) => {
        if(toggleState){
            this.toggledRuleNames.add(ruleName);
        }else{
            this.toggledRuleNames.delete(ruleName);
        }

        window.localStorage.setItem('toggledRuleNames', [...this.toggledRuleNames].join(","));
    };

    //Adds/removes tokens which have non-trivial default values (e.g. "echo foo" => "echo foo visible remote")
    toggleDefaultValues = (...lines) => {
        this.displayDefaultValues = !this.displayDefaultValues;
        if(this.displayDefaultValues) {
            const orderedToggledRules = this.grammar.grammarRules.filter(rule => rule.toggleable && this.toggledRuleNames.has(rule.name)); //maintain natural ordering of the rules
            this.#lineUtils.showDefaultRules(orderedToggledRules, ...lines);
        } else {
            this.#lineUtils.hideDefaultRules(...lines);
        }

        this.#ordinalUtils.invalidateOrdinals();
        this.validateLines(true, ...this.lines);
    };

    //Toggles the token inspector utility, which highlights tokens with a border when active
    //This can give a better insight to the user as to how the ide parses the text into tokens
    toggleTokenInspector = () => {
        this.showTokenInspector = !this.showTokenInspector;
        if(this.showTokenInspector){
            this.setAttribute("token-inspector", "");
        }else{
            this.removeAttribute("token-inspector")
        }
    };

    //Freeze the utility classes for external reference (this does not prevent modifying them externally, so don't be stupid and do that)
    get utils(){
        return Object.freeze({
            ordinalUtils: this.#ordinalUtils,
            lineUtils: this.#lineUtils,
            ruleUtils: this.#ruleUtils,
            tokenUtils: this.#tokenUtils,
            selectionUtils: this.#selectionUtils,
            completionUtils: this.#completionUtils
        });
    }

    //Returns the ordinal elements contained within the editor
    get ordinals(){
        return this.ordinalPane.childNodes;
    }

    //Returns the line elements contained within the editor
    get lines(){
        return this.linePane.childNodes;
    }

    //Returns the first line written in the editor
    get firstLine(){
        return this.linePane.firstChild;
    }

    //Returns the last line written in the editor
    get lastLine(){
        return this.linePane.lastChild;
    }

    //Makes the added event listener accessible as a property of the node the listener is applied to
    //(note: calling ideInstance.addEventListener will call the undecorated function. must be invoked statically using CommandIDE.addEventListener)
    static addEventListener = (node, eventType, callback, ...params) => {
        if(!node.eventCache){
            node.eventCache = {};
        }

        node.addEventListener(eventType, callback, ...params);
        node.eventCache[eventType] = callback;
    };

    //Remove the exposed reference to the event listener from the node's event cache
    static removeEventListener = (node, eventType) => {
        node.removeEventListener(eventType, node.eventCache[eventType]);
        delete node.eventCache[eventType];
    };

    //Just as the method name says...
    handleMouseDownEvent = (event) => {
        this.updateLatestState();
    };

    //Just as the method name says...
    handleMouseUpEvent = (event) => {
        //Get the start and end lines, as registered during the mousedown event
        let mouseDownStart, mouseDownEnd;
        if(this.latestStartSelection){
            mouseDownStart = this.latestStartSelection.line;
            mouseDownEnd = this.latestEndSelection.line;
        }

        this.updateLatestState();
        if(this.latestStartSelection) {
            this.toggleAutoComplete();
            if (mouseDownStart && mouseDownStart !== this.latestStartSelection.line) {
                this.validateLines(true, mouseDownStart);
            }
            if (mouseDownEnd && mouseDownEnd !== this.latestStartSelection.line) {
                this.validateLines(true, mouseDownEnd);
            }
        }else{
            this.exitAutoComplete();
        }
    };

    //Just as the method name says...
    //Note: whenever event.preventDefault() is invoked, handleKeyUpEvent will not be triggered
    handleKeyDownEvent = (event) => {
        this.updateLatestState();
        this.latestKeyEvent = event;

        if(this.requiresFirstLine()){
            //If the editor is empty, insert a new degenerate line before any other processing is done
            this.createFirstLine();
        }

        //If the start and end nodes are degenerate nodes (i.e. degenerate lines or the editor itself), get the closest line to these nodes
        const degenerateStartLine = this.#selectionUtils.extractLineFromDegenerateSelection(this.latestSelectionRange.startContainer, this.latestSelectionRange.startOffset);
        const degenerateEndLine = this.#selectionUtils.extractLineFromDegenerateSelection(this.latestSelectionRange.endContainer, this.latestSelectionRange.endOffset);

        //Browsers aren't very good yet at handling all the IDE actions, so we handle some edge-cases ourselves:
        const typedKey = this.latestKeyEvent.key;
        if (this.latestKeyEvent.ctrlKey) {
            this.latestKeyEvent.preventDefault();
            switch (typedKey.toLowerCase()) {
                case "a": this.#selectionUtils.selectAll(); break;
                case "x": this.deleteLineContents("Delete", degenerateStartLine, degenerateEndLine, true); break;
                case "c": this.copyLineContents(); break;
                case "v": this.pasteContents(); break;
            }
        } else {
            if (typedKey === "ArrowUp") {
                this.handleArrowKey(this.tooltip.handleUpArrow, this.latestStartSelection.line?.prevLine);
            } else if (typedKey === "ArrowDown") {
                this.handleArrowKey(this.tooltip.handleDownArrow, this.latestStartSelection.line?.nextLine);
            } else if (typedKey === "ArrowLeft" || typedKey === "ArrowRight") {
                /*Do nothing; Do not override any behaviour*/
            } else if (typedKey === "Enter") {
                this.latestKeyEvent.preventDefault();
                if(this.tooltip.autoCompleteSelection){
                    const completionText = this.tooltip.autoCompleteSelection.textContent;
                    this.completeText(completionText);
                }else{
                    this.tooltip.hide();
                    this.breakLine(degenerateStartLine);
                }
            } else if (typedKey === ",") {
                this.latestKeyEvent.preventDefault();
                this.separateRules(degenerateStartLine);
            } else if (typedKey === "Backspace" || typedKey === "Delete") {
                const wereContentsDeleted = this.deleteLineContents(typedKey, degenerateStartLine, degenerateEndLine);
                wereContentsDeleted && this.latestKeyEvent.preventDefault();
            } else {
                const wasCharacterInserted = this.insertManuallyIfNeeded();
                wasCharacterInserted && this.latestKeyEvent.preventDefault();
            }
        }
    };

    //Just as the method name says...
    //Note: handleKeyUpEvent() will not be triggered whenever event.preventDefault() is invoked in handleKeyDownEvent(),
    handleKeyUpEvent = (event) => {
        this.updateLatestState();
        this.latestKeyEvent = event;
        const startLine = this.#lineUtils.getParentLine(this.latestSelectionRange.startContainer);
        const endLine = this.#lineUtils.getParentLine(this.latestSelectionRange.endContainer);

        if (this.latestKeyEvent.ctrlKey){
            return;
        }

        if(startLine) {
            const typedKey = this.latestKeyEvent.key;
            const wasExtensionLine = startLine.isExtensionLine;
            const modifiedRule = this.#selectionUtils.getRuleFromSelection(this.latestStartSelection);

            if (typedKey === "Backspace" || typedKey === "Delete") {
                //Handle delete cases that "passed through" handleKeyDown (single backspace/delete key presses)
                if (modifiedRule?.nextSibling instanceof IdeRule) {
                    //If we just erased a rule separator, merge the rules it used to separate
                    this.invokeAndRepositionCaret(() => this.#ruleUtils.mergeRules(modifiedRule, modifiedRule.nextSibling));
                }

                if (startLine.containsText) {
                    //TODO: check if we can perform a cheaper invalidation than line invalidation (maybe in tree change event...)
                    this.invokeAndRepositionCaret(() => this.#lineUtils.invalidateLines(startLine));
                    this.toggleAutoComplete(startLine);
                } else {
                    this.handleEmptyLine(startLine);
                    this.tooltip.hide();
                }
            } else if (typedKey.length === 1) {
                //Handle type cases that "passed through" handleKeyDown (single character keyboard types)
                if(modifiedRule) {
                    this.invokeAndRepositionCaret(() => this.#ruleUtils.invalidateRules(modifiedRule));
                    this.toggleAutoComplete(startLine);
                }
            }

            if(startLine.isExtensionLine !== wasExtensionLine){
                this.#ordinalUtils.invalidateOrdinals();
            }
        }
    };

    //Triggered via a WebAPI whenever DOM changes happen within the editor
    handleTreeChange = (mutations, observer) => {
        for(const mutation of mutations){
            for(const fragment of mutation.addedNodes){
                if (fragment instanceof HTMLBRElement){
                    console.log("Removing rogue <br> element ", fragment, " from parent ", mutation.target);
                    fragment.remove();
                } else if(fragment instanceof Text){
                    if(!(mutation.target instanceof IdeToken)){
                        if(!(mutation.target instanceof IdeSeparator && fragment.textContent.trim() === ",")){
                            console.error("Appending ", fragment, " to illegal parent ", mutation.target);
                        }
                    }
                }  else if(fragment instanceof IdeToken){
                    if(!(mutation.target instanceof IdeRule)){
                        console.error("Appending ", fragment, " to illegal parent ", mutation.target);
                    }
                } else if(fragment instanceof IdeRule || fragment instanceof IdeSeparator){
                    if(!(mutation.target instanceof IdeLine)){
                        console.error("Appending ", fragment, " to illegal parent ", mutation.target);
                    }
                } else if(fragment instanceof IdeLine){
                    if(mutation.target !== this.linePane){
                        console.error("Appending ", fragment, " to illegal parent ", mutation.target);
                    }
                } else{
                    console.warn("Appending suspicious element ", fragment, " to parent ", mutation.target)
                }
            }
            for(const fragment of mutation.removedNodes){
                const childNodeSet = new Set(mutation.target.childNodes);
                if(!childNodeSet.has(fragment)) {
                    if (fragment instanceof IdeToken) {
                        if (mutation.target.tokens.indexOf(fragment) > -1) {
                            //console.warn("IdeToken ", fragment, " was not removed from parent IdeRule ", mutation.target, " - check if this is your problem or a javascript bug");
                            console.warn("IdeToken ", fragment, " was not removed from parent IdeRule ", mutation.target, " - removing now");
                            mutation.target.unlinkChild(fragment);
                        }
                    } else if (fragment instanceof IdeRule) {
                        if (mutation.target.rules.indexOf(fragment) > -1) {
                            //console.warn("IdeRule ", fragment, " was not removed from parent IdeLine ", mutation.target, " - check if this is your problem or a javascript bug");
                            console.warn("IdeRule ", fragment, " was not removed from parent IdeLine ", mutation.target, " - removing now");
                            mutation.target.unlinkChild(fragment);
                        }
                    }
                }
            }
        }
    };

    //Query the selection utils to obtain the latest editor state
    updateLatestState = () => {
        [this.latestSelection, this.latestSelectionRange] = this.#selectionUtils.getSelectionAndRange();
        [this.latestStartSelection, this.latestEndSelection] = this.#selectionUtils.getSelectedNodes(this.latestSelectionRange);
    };

    //Select the provided node, at the given offset, with the selection range. Then update the stand and end drilldown-selections
    selectAndUpdateRefs = (node, offset) => {
        this.latestSelectionRange.setEnd(node, offset);
        this.latestSelectionRange.collapse();
        [this.latestStartSelection, this.latestEndSelection] = this.#selectionUtils.getSelectedNodes(this.latestSelectionRange);
    };

    //If the start or end containers are separators, the selectionRange will extend to before/after the separator
    selectAroundSeparator = () => {
        this.#selectionUtils.selectAroundSeparator(this.latestSelectionRange);
        [this.latestStartSelection, this.latestEndSelection] = this.#selectionUtils.getSelectedNodes(this.latestSelectionRange);
    };

    //Validate the provided lines, then toggle the editor validity state
    validateLines = (markIfInvalid, ...lines) => {
        //First validate the provided lines
        const linesValid = this.#lineUtils.validateLines(markIfInvalid, ...lines);
        if(linesValid){
            //If they are valid, collect the other lines
            const validatedLines = new Set(lines);
            const restOfLines = []
            if(validatedLines.size < this.lines.length) {
                for (const line of this.lines) {
                    if (!validatedLines.has(line)) { // Allows the for loop to run in O(n) instead of O(n2)
                        restOfLines.push(line);
                    }
                }
            }

            //and set the editor validity state according to them
            this.valid = this.#lineUtils.validateLines(markIfInvalid, ...restOfLines);
        }else{
            //Otherwise, don't bother validating the others - the editor is obviously invalid
            this.valid = false;
        }
    };

    //Toggle whether autocomplete mode, validation and hints should be active or not
    toggleAutoComplete = (...linesToValidate) => {
        //Autocomplete is only active on collapsed selections
        if (this.latestSelectionRange.collapsed) {
            //If selecting a separator, reposition the caret in an adjacent rule
            if (this.latestStartSelection instanceof SeparatorSelection) {
                const separator = this.latestStartSelection.separator;
                const commaIdx = separator.textContent.indexOf(Separators.RULE);
                this.ensureSeparatorBetweenRules(separator);

                let targetTextNode;
                if (this.latestSelectionRange.startOffset <= commaIdx) {
                    const prevRule = separator.previousSibling;
                    targetTextNode = this.#selectionUtils.getDeepestRightChild(prevRule);
                    this.selectAndUpdateRefs(targetTextNode, targetTextNode.length);
                } else {
                    const nextRule = separator.nextSibling;
                    targetTextNode = this.#selectionUtils.getDeepestLeftChild(nextRule);
                    this.selectAndUpdateRefs(targetTextNode, 0);
                }
            }

            //Get the caret's adjacent letters...
            const textContent = this.latestStartSelection.token.textContent;
            const caretOffset = this.latestStartSelection.letterIdx;
            const bounds = {
                left: Math.max(caretOffset - 1, 0),
                right: Math.min(caretOffset + 1, textContent.length),
            };

            //...and use them to define a neighbourhood.
            // Toggle autocomplete if the caret is at the end of a token, or before a space character
            const neighbourhood = textContent.substring(bounds.left, bounds.right);
            this.autocompleting = neighbourhood.endsWith(" ") || caretOffset === textContent.length;
        } else {
            this.exitAutoComplete();
        }

        //Suggest completion texts or hide the tooltip, depending on the autocomplete state
        if(this.autocompleting){
            const currentMatches = this.#completionUtils.suggestCompletionTexts(this.latestStartSelection);
            if(currentMatches.length > 0) {
                this.tooltip.withStyle("autocomplete").withAutoComplete(currentMatches).attachTo(this.latestStartSelection.token).show();
            }else{
                this.exitAutoComplete();
            }
        }else{
            this.exitAutoComplete();
        }

        //Validate any lines passed to the method as arguments
        this.validateLines(!this.autocompleting, ...linesToValidate);
        return this.autocompleting;
    };

    //Disable autocomplete mode
    exitAutoComplete = () => {
        this.autocompleting = false;
        this.tooltip.hide();
    };

    //Inserts the selected autocomplete term at the current caret position
    completeText = (autoCompleteTerm) => {
        const termInLowerCase = autoCompleteTerm.toLowerCase();
        const absoluteStartOffset = this.#selectionUtils.getAbsoluteLineCaretPosition(this.latestStartSelection);
        const currentLineText = this.latestStartSelection.line.textContent.slice(0, absoluteStartOffset).toLowerCase();
        let completionText = "";

        for(let letterIdx = autoCompleteTerm.length - 1; letterIdx >= 0; letterIdx--){
            completionText = termInLowerCase[letterIdx] + completionText;
            if((currentLineText + completionText).endsWith(termInLowerCase)){
                const shiftedStartIdx = absoluteStartOffset - autoCompleteTerm.length + completionText.length;
                const [positionToken, caretPosition] = this.#selectionUtils.getRelativeLineCaretPosition(this.latestStartSelection.line, shiftedStartIdx);

                if(positionToken.hasChildNodes()){
                    this.latestSelectionRange.setStart(positionToken.childNodes[0], caretPosition);
                }else{
                    this.latestSelectionRange.setStart(positionToken, 0);
                }

                this.extractAndDelete();
                const [wrappedFragment,] = this.#lineUtils.makeNewLine(autoCompleteTerm);
                this.insertFragment([wrappedFragment]);
                break;
            }
        }

        this.exitAutoComplete();
    };

    //check if the editor is empty, and the key is not a control character etc (text was actually inserted)...
    requiresFirstLine = () => {
        const typedKey = this.latestKeyEvent.key;
        const editorIsEmpty = this.lines.length === 0; //check if html elements are present (the first typed character is a text node, and won't be counted by lines.children)
        const createNewLine = typedKey.length === 1 || typedKey === "Enter" || typedKey === "Tab";
        const selecting = this.latestKeyEvent.ctrlKey && "axc".includes(typedKey.toLowerCase());
        return editorIsEmpty && createNewLine && !selecting;
    };

    //Insert a single empty line into the editor
    createFirstLine = () => {
        const [firstLine,] = this.#lineUtils.makeNewLine();
        this.linePane.append(firstLine);
        this.#ordinalUtils.invalidateOrdinals();

        const deepestChild = this.#selectionUtils.getDeepestLeftChild(firstLine);
        this.selectAndUpdateRefs(deepestChild, 0);
    };

    //Modify the line pane if no lines are left; Also ensure the provided line line is well formatted if it is empty
    handleEmptyLine = (emptyLine) => {
        const lastLineLeft = this.lines.length === 1;
        const isEditorEmpty = this.linePane.textContent === "";
        if (lastLineLeft && isEditorEmpty) {
            this.linePane.innerHTML = "";
        } else if(emptyLine.isEmpty){
            const [emptyRule,] = this.#ruleUtils.makeNewRule();
            emptyLine.clear();
            emptyLine.append(emptyRule);
        }

        this.#ordinalUtils.invalidateOrdinals();
    };

    //Invokes the handle function if autocompleting, or selects
    handleArrowKey = (arrowHandle, adjacentLine) => {
        if (this.autocompleting) {
            this.latestKeyEvent.preventDefault();
            arrowHandle();
        } else if(!adjacentLine?.containsText) {
            this.latestKeyEvent.preventDefault();
            const targetNode = this.#selectionUtils.getDeepestLeftChild(adjacentLine);
            this.selectAndUpdateRefs(targetNode, 0);
        }
    };

    //Splits the currently selected line into two separate lines
    //at the current position (offset) within the start container
    breakLine = (degenerateStartLine) => {
        let startLine, insertedLine;

        if(this.latestSelectionRange.startContainer.isIdeEditor){
            [startLine ,insertedLine] = this.#lineUtils.splitLine(degenerateStartLine, 0);
        }else{
            [startLine ,insertedLine] = this.#lineUtils.splitLine(this.latestSelectionRange.startContainer, this.latestSelectionRange.startOffset);
        }

        if(startLine.lastRule){
            this.#ruleUtils.invalidateRules(startLine.lastRule);
        }
        if(insertedLine.firstRule){
            this.#ruleUtils.invalidateRules(insertedLine.firstRule);
        }

        const deepestChild = this.#selectionUtils.getDeepestLeftChild(insertedLine);
        this.selectAndUpdateRefs(deepestChild, 0);

        this.exitAutoComplete();
        this.validateLines(true, startLine ,insertedLine);
        this.#ordinalUtils.invalidateOrdinals();
    };

    //Splits the currently selected rule into two separate rules
    //at the current position (offset) within the start container
    separateRules = (degenerateStartLine) => {
        let startRule, insertedRule;

        if(this.latestSelectionRange.startContainer.isIdeEditor) {
            [startRule, insertedRule] = this.#ruleUtils.splitRule(degenerateStartLine.firstRule, 0);
        } else {
            [startRule, insertedRule] = this.#ruleUtils.splitRule(this.latestSelectionRange.startContainer, this.latestSelectionRange.startOffset);
        }

        const separator = IdeSeparator.ruleSeparator();
        startRule.insertAdjacentElement("afterend", separator);

        const deepestChild = this.#selectionUtils.getDeepestLeftChild(insertedRule);
        this.selectAndUpdateRefs(deepestChild, 0);
        this.toggleAutoComplete(insertedRule.parentNode);
    };

    //Copied the selected contents (assuming a non-collapsed selection range)
    copyLineContents = () => {
        if(!this.latestSelectionRange.collapsed) {
            const extractedFragment = this.extractAndCopy();
            this.#selectionUtils.copyContents(extractedFragment);
        }
    };

    //Deletes the selected contents in edge-cases where the content-editable functionality is buggy (assuming a non-collapsed selection range)
    //then sorts out the mess in the DOM tree
    deleteLineContents = (typedKey, degenerateStartLine, degenerateEndLine, copyToClipboard = false) => {
        let deletedContents = false;
        const [startLine, endLine] = this.#selectionUtils.getWrappingLines(degenerateStartLine, degenerateEndLine);
        if (startLine && endLine) {
            if(!this.latestSelectionRange.collapsed) {
                const extractedFragment = this.extractAndDelete();
                if(copyToClipboard){
                    const copySuccessful = this.#selectionUtils.copyContents(extractedFragment);
                    if(!copySuccessful){
                        return false; //should only happen (under normal circumstances) if not focusing on the document (e.g. using devtools). A warning should be issued by copyContents() in any case.
                    }
                }
                deletedContents = true;
            }

            const [extendedStartLine, extendedEndLine, howManyLinesToDelete] = this.getDeleteBounds(typedKey, startLine, endLine);
            if (howManyLinesToDelete > 0) {
                if(!deletedContents){
                    //extractAndDelete() already does a merge, so only merge again if it was not invoked
                    this.mergeAndReselect(extendedStartLine, extendedEndLine);
                }
                deletedContents = true; // Even if no text was deleted, we have at least one ide-line less after the merge
                this.#ordinalUtils.invalidateOrdinals();
            }

            if(!deletedContents){
                this.invokeAndRepositionCaret(() => this.#lineUtils.invalidateLines(extendedStartLine, extendedEndLine));
            }else if(this.lines[0] && !this.lines[0].containsText){
                this.handleEmptyLine(extendedStartLine);
            }

            this.exitAutoComplete();
            this.validateLines(true, extendedStartLine, extendedEndLine);
        }

        return deletedContents;
    };

    //Expands a selection due for deletion into adjacent lines if needed; Calculates how many lines should be deleted
    //Then returns the correct start and end lines for deletion, along with the amount of lines that will be erased
    getDeleteBounds = (typedKey, startLine, endLine) => {
        //Count how many lines need to be erased
        const howManyLinesToDelete = this.#lineUtils.distanceBetweenLines(startLine, endLine);

        //1) when erasing from the start of any line using Backspace (except the first line in the editor)
        if (typedKey === "Backspace" && this.firstLine !== startLine && howManyLinesToDelete === 0 && this.latestSelectionRange.collapsed && this.#selectionUtils.isSelectionAtNodeStart(startLine)) {
            return [startLine.prevLine, endLine, howManyLinesToDelete + 1];
        }
        //2) when erasing from the end of any line using Delete (except the last line in the editor)
        else if (typedKey === "Delete" && this.lastLine !== endLine && howManyLinesToDelete === 0 && this.latestSelectionRange.collapsed && this.#selectionUtils.isSelectionAtNodeEnd(endLine)) {
            return [startLine, endLine.nextLine, howManyLinesToDelete + 1];
        }

        return [startLine, endLine, howManyLinesToDelete];
    };

    //Copied the selected contents from the DOM tree
    extractAndCopy = () => {
        this.selectAroundSeparator();

        const copiedLines = [];
        let iteratedLine = this.latestStartSelection.line;
        do{
            const clonedLine = iteratedLine.cloneNode(true);
            copiedLines.push(clonedLine);
            iteratedLine = iteratedLine.nextLine;
        } while(iteratedLine && iteratedLine.prevLine !== this.latestEndSelection.line);

        //trim order matters(trimming previous siblings before next siblings will modify element indices)
        this.trimCopiedLine(copiedLines[copiedLines.length - 1], this.latestEndSelection, "nextSibling", 0, this.latestEndSelection.letterIdx);
        this.trimCopiedLine(copiedLines[0], this.latestStartSelection, "previousSibling", this.latestStartSelection.letterIdx, this.latestStartSelection.textNode.textContent.length);
        return copiedLines;
    };

    //Trims the copied line, based on the original selection data
    trimCopiedLine = (copiedLine, nodeSelection, adjacencyProperty, trimTextStart, trimTextEnd) => {
        if(nodeSelection instanceof TokenSelection){
            const copiedRule = copiedLine.childNodes[nodeSelection.ruleIdx];
            const copiedToken = copiedRule.childNodes[nodeSelection.tokenIdx];
            this.deleteAdjacentNodes(copiedRule, adjacencyProperty);
            this.deleteAdjacentNodes(copiedToken, adjacencyProperty);

            copiedToken.textContent = copiedToken.textContent.substring(trimTextStart, trimTextEnd)
        }else if(nodeSelection instanceof SeparatorSelection){
            const copiedSeparator = copiedLine.childNodes[nodeSelection.separatorIdx];
            this.deleteAdjacentNodes(copiedSeparator, adjacencyProperty);

            copiedSeparator.textContent = copiedSeparator.textContent.substring(trimTextStart, trimTextEnd);
        }
    };

    //Deletes any nodes left/right of the provided node. The next adjacent node is defined by the adjacencyProperty
    deleteAdjacentNodes = (node, adjacencyProperty) => {
        let iteratedNode = node[adjacencyProperty];
        while(iteratedNode){
            const adjacentNode = iteratedNode[adjacencyProperty];
            iteratedNode.remove();
            iteratedNode = adjacentNode;
        }
    };

    //Extracts the selected contents from the DOM tree, after performing the necessary splits (assuming a non-collapsed selection range)
    extractAndDelete = () => {
        this.selectAroundSeparator();

        //The two splits results in ...mergeStart] -> [deleteStart... -> ...deleteEnd] -> [mergeEnd...
        //split order matters(making the left split before the right split will modify element indices)
        const absoluteStartOffset = this.#selectionUtils.getAbsoluteCaretPosition(this.latestStartSelection);
        const deepestEndNode = this.latestEndSelection.textNode || this.latestEndSelection.token;
        const [deleteEnd, mergeEnd] = this.#lineUtils.reverseSplitLine(deepestEndNode, this.latestEndSelection.letterIdx); // ensures pointers on this line will point to the undeleted fragment

        //Fix the pointers on this.latestStartSelection in cases where reverseSplitLine() breaks them
        if(this.latestStartSelection.line === this.latestEndSelection.line) {
            this.#selectionUtils.invalidateSelection(this.latestStartSelection, deleteEnd, absoluteStartOffset);
        }
        const deepestStartNode = this.latestStartSelection.textNode || this.latestStartSelection.token;
        const [mergeStart, deleteStart] = this.#lineUtils.reverseSplitLine(deepestStartNode, this.latestStartSelection.letterIdx); //ensures deleteEnd will point to the undeleted fragment

        //extract the lines in the [deleteStart... -> ...deleteEnd] fragment
        const extractedLines = [];
        let iteratedLine = deleteStart;
        while(deleteEnd.isConnected){
            const nextLine = iteratedLine.nextLine;
            extractedLines.push(iteratedLine);
            iteratedLine.remove();
            iteratedLine = nextLine;
        }

        //merge the leftovers: ...mergeStart] to [mergeEnd...
        this.mergeAndReselect(mergeStart, mergeEnd, true);
        return extractedLines;
    };

    //Pastes contents from the clipboard/editor cache to the start of the selected range
    pasteContents = async () => {
        if(!this.latestSelectionRange.collapsed){
            this.extractAndDelete();
        }

        const copiedFragment = await this.#selectionUtils.getCopiedFragment();
        if(copiedFragment?.length > 0){
            this.insertFragment(copiedFragment);
        }
    };

    //insert the provided fragment at the start of the selected range
    insertFragment = (fragment) => {
        const [startJoin, endJoin] = this.#lineUtils.splitLine(this.latestSelectionRange.startContainer, this.latestSelectionRange.startOffset);

        let insertAnchor = startJoin;
        for(const fragmentLine of fragment){
            insertAnchor.insertAdjacentElement("afterend", fragmentLine);
            insertAnchor = fragmentLine;
        }

        this.#lineUtils.reverseMergeLines(startJoin, fragment[0]);
        this.mergeAndReselect(fragment[fragment.length - 1], endJoin);
        this.#lineUtils.invalidateLines(...fragment.slice(1, fragment.length - 1));

        this.validateLines(true, ...fragment);
        this.#ordinalUtils.invalidateOrdinals();
    };

    //Generate text to insert from a key with non-standard default behaviour
    extractInsertionCharacter = () => {
        const typedKey = this.latestKeyEvent.key;
        if (typedKey === "Tab") {
            return String.fromCharCode(9); //generate a non breaking tab; requires the tokens to have "white-space: pre;" defined in their css rules
        } else if (typedKey.length === 1) { //if the key is not a control character etc...
            return typedKey;
        } else{
            return null;
        }
    };

    //Inserts the provided text into a token adjacent to the provided separator, and return that token
    //Wrap the text with a token and a rule, if there is no adjacent token or rule.
    insertTextNearSeparator = (separator, insertionText) => {
        const commaIdx = separator.textContent.indexOf(Separators.RULE);
        //If the separator contains a comma, move the text to the correct adjacent rule
        if (commaIdx >= 0) {
            //Ensure the separator has rules on both sides, adding empty rules if they are missing
            this.ensureSeparatorBetweenRules(separator);

            //Write the character in the correct rule, then position the caret accordingly
            let targetTextNode;
            if(this.latestSelectionRange.startOffset <= commaIdx){
                const prevRule = separator.previousSibling;
                prevRule.lastToken.textContent += insertionText;
                targetTextNode =  this.#selectionUtils.getDeepestRightChild(prevRule);
                this.selectAndUpdateRefs(targetTextNode, targetTextNode.length);
            }else{
                const nextRule = separator.nextSibling;
                nextRule.firstToken.textContent = insertionText + nextRule.firstToken.textContent;
                targetTextNode =  this.#selectionUtils.getDeepestLeftChild(nextRule);
                this.selectAndUpdateRefs(targetTextNode, 1);
            }

            //Finally, make sure the separator only contains the comma character
            separator.textContent = Separators.RULE;
            return this.#tokenUtils.getParentToken(targetTextNode);
        } else {
            //If the separator doesn't contains a comma (i.e. degenerate separator), move the text to a nearby token, according to a "best guess" policy
            let targetToken;
            if (separator.previousSibling) {
                targetToken = separator.previousSibling.lastToken;
                targetToken.textContent += insertionText;
            } else if (separator.nextSibling) {
                targetToken = separator.nextSibling.firstToken;
                targetToken.textContent = insertionText + targetToken.textContent;
            } else {
                const [emptyRule,] = this.#ruleUtils.makeNewRule();
                targetToken = emptyRule.firstToken;
                targetToken.textContent = insertionText;
                separator.parentNode.append(emptyRule);
            }

            //then delete the separator
            separator.remove();
            return targetToken;
        }
    };

    //Ensure the separator has rules on both sides, adding empty rules if they are missing
    ensureSeparatorBetweenRules = (separator) => {
        let prevRule = separator.previousSibling;
        if(!(prevRule instanceof IdeRule)){
            [prevRule,] = this.#ruleUtils.makeNewRule();
            separator.insertAdjacentElement("beforebegin", prevRule);
            this.#ruleUtils.linkToNearestRule(prevRule);
        }

        let nextRule = separator.nextSibling;
        if(!(nextRule instanceof IdeRule)){
            [nextRule,] = this.#ruleUtils.makeNewRule();
            separator.insertAdjacentElement("afterend", nextRule);
            this.#ruleUtils.linkToNearestRule(nextRule);
        }
    };

    //Handles edge cases where the content-editable functionality is buggy
    //and requires manual insertion of the typed character
    insertManuallyIfNeeded = () => {
        if(!this.latestSelectionRange.collapsed) {
            this.extractAndDelete();
        }

        let wasCharacterInserted = false;
        const charForInsertion = this.extractInsertionCharacter();
        if(charForInsertion) {
            if (this.latestSelectionRange.startContainer.isDegenerate) {
                //If a degenerate start line was detected, focus the selection within it's deepest right child
                const deepestNode = this.#selectionUtils.getDeepestRightChild(this.latestSelectionRange.startContainer);
                this.modifyTextInToken(deepestNode, charForInsertion);
                this.#ordinalUtils.invalidateOrdinals();
                wasCharacterInserted = true;
            } else {
                const wasExtensionLine = this.latestStartSelection.line.isExtensionLine;
                let modifiedToken;

                if (this.latestStartSelection instanceof SeparatorSelection) {
                    //If the selection resides within a rule separator, focus the selection into an adjacent token instead
                    modifiedToken = this.insertTextNearSeparator(this.latestStartSelection.separator, charForInsertion);
                } else if (this.latestStartSelection instanceof TokenSelection && charForInsertion !== this.latestKeyEvent.key){
                    //If the typed character is not the required character for insertion, perform the insertion manually
                    const selectedTextNode = this.latestStartSelection.token.childNodes[0];
                    const originalText = selectedTextNode.textContent;
                    const originalOffset = this.latestStartSelection.letterIdx;
                    const modifiedText = originalText.substring(0, originalOffset) + charForInsertion + originalText.substring(originalOffset);

                    modifiedToken = this.modifyTextInToken(selectedTextNode, modifiedText);
                }

                if (modifiedToken) {
                    const modifiedRule = this.#ruleUtils.getParentRule(modifiedToken.parentNode);
                    this.invokeAndRepositionCaret(() => this.#ruleUtils.invalidateRules(modifiedRule));
                    wasCharacterInserted = true;

                    const parentLine = this.latestStartSelection.line;
                    this.toggleAutoComplete(parentLine);
                    if(this.latestStartSelection.line.isExtensionLine !== wasExtensionLine){
                        this.#ordinalUtils.invalidateOrdinals();
                    }
                }
            }
        }

        return wasCharacterInserted;
    };

    //Update token text and position the caret after the last character in the token
    modifyTextInToken = (targetToken, modifiedText) => {
        targetToken.textContent = modifiedText;
        this.selectAndUpdateRefs(targetToken, this.latestStartSelection.letterIdx + 1);
        return targetToken;
    };

    //Invoke the provided function, and reposition the caret to provide a fluent typing user-experience (i.e. no jumping caret)
    invokeAndRepositionCaret = (lambdaExpression) => {
        if(this.latestStartSelection instanceof TokenSelection) {
            const positionRule = this.latestStartSelection.rule;

            //calculate the original caret index and invoke the provided lambda expression
            const absoluteCaretIdx = this.#selectionUtils.getAbsoluteCaretPosition(this.latestStartSelection);
            lambdaExpression();

            //reposition the caret according to the calculated position, and collapse the selection
            const [positionToken, caretPosition] = this.#selectionUtils.getRelativeCaretPosition(positionRule, absoluteCaretIdx);
            if (positionToken.textContent) {
                const positionNode = positionToken.childNodes[0];
                this.selectAndUpdateRefs(positionNode, caretPosition);
            } else {
                this.selectAndUpdateRefs(positionToken, 0);
            }
        }else{
            lambdaExpression();
        }
    };

    //Merges lines after a delete has taken place
    //The invoking method should handle ordinal invalidation
    mergeAndReselect = (startLine, endLine, invertMerge = false) => {
        const startLastChild = startLine.lastChild;
        const endFirstChild = endLine.firstChild;

        const originalTextLength = startLastChild.textContent.length;
        let positionToken, caretPosition;
        if(invertMerge){
            this.#lineUtils.reverseMergeLines(startLine, endLine);
            [positionToken, caretPosition] = this.#selectionUtils.getRelativeCaretPosition(endFirstChild, originalTextLength);
        }else {
            this.#lineUtils.mergeLines(startLine, endLine);
            [positionToken, caretPosition] = this.#selectionUtils.getRelativeCaretPosition(startLastChild, originalTextLength);
        }

        if(positionToken.textContent) {
            const positionNode = positionToken.childNodes[0] || positionToken;
            this.selectAndUpdateRefs(positionNode, caretPosition);
        }else{
            this.selectAndUpdateRefs(positionToken, 0);
        }
    };

    //Finds and replaces every occurrence of searchText with the value in replaceText
    //Returns how many matches were found
    findAndReplace = (searchText, replacementText) => {
        this.updateLatestState();
        const matches = this.#selectionUtils.findText(searchText);
        const [replacementLine,] = this.#lineUtils.makeNewLine(replacementText);

        //1) Get the absolute position of every match, using an ide-selection
        const absolutePositions = matches.map(match => {
            return match.map(rangeFragment => {
                const ideSelection = this.#selectionUtils.getIdeSelectionElement(...rangeFragment);
                if(ideSelection instanceof TokenSelection){
                    return [ideSelection, this.#selectionUtils.getAbsoluteCaretPosition(ideSelection)];
                }else{
                    return [ideSelection, ideSelection.letterIdx];
                }
            });
        });

        //2) Convert every absolute position to it's relative location
        // in reverse match order (to avoid breaking indices, first pair becomes last pair)
        absolutePositions.reverse().forEach(absolutePosition => {
            const relativePositions = absolutePosition.map(absFragment => {
                const ideSelection = absFragment[0];
                const caretIdx = absFragment[1]; //absoluteIdx if ideSelection is a TokenSelection
                const containingLine = this.lines[ideSelection.lineIdx];
                this.#selectionUtils.invalidateSelection(ideSelection, containingLine, caretIdx);
                return [ideSelection.textNode, ideSelection.letterIdx];
            });

            //3) Use every matching pair as a basis for a selection range
            //then perform a cut & paste action on that selection
            this.latestSelectionRange.setStart(...relativePositions[0]);
            this.latestSelectionRange.setEnd(...relativePositions[1]);
            this.extractAndDelete();
            this.insertFragment([replacementLine.cloneNode(true)]);
        });

        return matches.length;
    };
}

export default CommandIde;