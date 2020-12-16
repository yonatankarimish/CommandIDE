class CompletionUtils{
    constructor(CommandIDE, suggestionCorpus){
        this.CommandIDE = CommandIDE;
        this.suggestionCorpus = suggestionCorpus; //autocomplete suggestions, ranked by occurrence frequency
    }

    //Best explained by example: converts "cat in the hat" to: [
    //             "hat",
    //         "the hat",
    //      "in the hat",
    //  "cat in the hat"
    //];
    createStartPyramid = (startText) => {
        const startPyramid = [];
        for(const word of startText.split(/[\r\n ]+/).reverse()){
            if(startPyramid.length > 0){
                const longerWord = [word, startPyramid[startPyramid.length - 1]].join(" ");
                startPyramid.push(longerWord);
            }else{
                startPyramid.push(word);
            }
        }

        return startPyramid;
    };

    //Determines if the given completion term can complete any of the starting texts in a text pyramid (see the method above)
    canCompletePyramid = (textPyramid, completionTerm) => {
        for(const startingText of textPyramid){
            if(completionTerm.startsWith(startingText) && completionTerm !== startingText){
                return true;
            }
        }

        return false;
    }

    //Return a list of autocomplete suggestions, based on the provided TokenSelection and the available completion data
    suggestCompletionTexts = (tokenSelection) => {
        const selectionUtils = this.CommandIDE.utils.selectionUtils;
        const absoluteStartOffset = selectionUtils.getAbsoluteLineCaretPosition(tokenSelection);

        const startingText = tokenSelection.line.textContent.slice(0, absoluteStartOffset).replace(/(^[\r\n ]+|[\r\n ]+$)/g, "").toLowerCase();
        const startingTermPyramid = this.createStartPyramid(startingText);
        const matchingTerms = this.suggestionCorpus.filter(term => this.canCompletePyramid(startingTermPyramid, term.toLowerCase()));
        return matchingTerms.slice(0, 5);
    };

    //Collects all user-typed texts from default tokens, and tokenizes them into autocomplete suggestions
    collectUserTypedData = (significanceThreshold = 2) => {
        //1) Extract all default tokens from each each non-extension line
        const defaultRules = Array.prototype.flatMap.call(this.CommandIDE.lines, line => line.rules.filter(rule => !rule.grammarRule.isExtensionRule));
        const defaultTokens = defaultRules.flatMap(rule => rule.tokens.filter(token => token.grammarToken === rule.grammarRule.defaultToken))

        //2) Concat all text contents and remove irrelevant data like comments, pipes etc...
        const textAggregation = defaultTokens.map(token => token.textContent).join(" ")
        const processedText = textAggregation.replace(/("[^"]*"|'[^']*'|`[^`]*`|[^a-zA-Z0-9%:./\-\s]+)/g, "")

        //3) Filter the obtained tokens so that only significant tokens (longer = more significant) are returned
        return processedText.split(/\s+/).filter(text => text.length >= significanceThreshold)
    };
}

export default CompletionUtils;