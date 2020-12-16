import DefaultGrammar from "./default-grammar";

class ErrorAnalyzers{
    //Error analyzers are arrow functions that receive token text as input
    //and return a string explaining the nature of any parsing/verification errors encountered
    //
    //NOTES:
    //1) analyzers return a message of the FIRST error encountered
    //2) analyzers are not expected to return anything if the text is valid
    constructor(){}

    timeoutText = (text) => {
        if(/\D/.test(text)){
            return "Timeout must be a positive round number of seconds";
        }else if(text.trim() === "0"){
            return "Timeout must be greater than 0";
        }else if(text.startsWith("0")){
            return "Timeout cannot contain trailing zeros";
        }else if(parseInt(text) >= DefaultGrammar.maxIntValue){
            return `Timeout cannot be greater than ${DefaultGrammar.maxIntValue - 1}`;
        }
    };

    sleepText = (text) => {
        if(/\D/.test(text)){
            return "Sleep must be a positive round number of seconds";
        }else if(parseInt(text) >= DefaultGrammar.maxIntValue){
            return `Sleep cannot be greater than ${DefaultGrammar.maxIntValue - 1}`;
        }
    };

    chmodPermissions = (text) => {
        if(!/^[0-7]{3}\s*$/.test(text)){
            return "Permissions must be specified in octal format (111 -> 777)";
        }
    };

    verifyFileSearchExpression = (text) => {
        if(!text.trim().startsWith('"') || !text.trim().endsWith('"')){
            return "Search expression should be specified between \" symbols";
        }else if(text.match(/"/g).length > 2){
            return "Search expression cannot contain double quotes";
        }
    };

    verifyFileStartLine = (text) => {
        if(/\D/.test(text)){
            return "Lower bound must be a positive round number";
        }
    };

    verifyFileFinishLine = (text) => {
        if(/\D/.test(text)){
            return "Upper bound must be a positive round number";
        }
    };

    verifySizeLowerBound = (text) => {
        //Basically we're expecting an array of the form ["{number}", "{measure-unit}"]
        const parsedText = text.split(/(\d+|\D+)/).filter(chunk => chunk.length > 0);

        if(parsedText.length !== 2){
            return "Lower bound must contain a value and it's measuring unit (e.g. 42kb)";
        }else if(/\D/.test(parsedText[0])){
            return "Lower bound value must be a positive round number";
        }else if(/\W/.test(parsedText[1].trim())){
            return "The measuring unit must be one of: b, kb, mb, gb, tb";
        }
    };

    verifySizeUpperBound = (text) => {
        //Basically we're expecting an array of the form ["{number}", "{measure-unit}"]
        const parsedText = text.split(/(\d+|\D+)/).filter(chunk => chunk.length > 0);

        if(parsedText.length !== 2){
            return "Lower bound must contain a value and it's measuring unit (e.g. 42kb)";
        }else if(/\D/.test(parsedText[0])){
            return "Lower bound value must be a positive round number";
        }else if(/\W/.test(parsedText[1].trim())){
            return "The measuring unit must be one of: b, kb, mb, gb, tb";
        }
    };

    verifyArchiveFileName = (text) => {
        if(!text.trim().startsWith('"') || !text.trim().endsWith('"')){
            return "File name should be specified between \" symbols";
        }else if(text.match(/"/g).length > 2){
            return "File name cannot contain double quotes";
        }
    };

    conditionClause = (text) => {
        const trimmedText = text.trim();
        if (!trimmedText.startsWith("(") || !trimmedText.endsWith(")")) {
            return "Condition must be declared between round brackets";
        }

        const clauses = trimmedText.substring(1, trimmedText.length - 1);
        if (clauses.trim().startsWith(";")) {
            return "No clause to the left of the first semicolon";
        }
        if (clauses.trim().endsWith(";")) {
            return "No clause to the right of the last semicolon";
        }

        const parsedClauses = clauses.split(";");
        if (parsedClauses.length === 1 && parsedClauses[0].trim() === "") {
            return "Condition cannot be empty";
        }

        const allowed3ArgConditions = ["equal", "notequal", "less", "greater", "contains", "notcontains", "regex"];
        const allowed2ArgConditions = ["exists", "isempty", "isnotempty"];
        const allConditions = allowed3ArgConditions.concat(allowed2ArgConditions);
        const splitOnCondition = new RegExp(`(?<=(\\s|^))(${allConditions.join("|")})(?=(\\s|$))`);
        for (const [idx, clause] of parsedClauses.entries()) {
            const filteredArgs = clause.trim().split(splitOnCondition).filter(arg => arg.trim().length > 0);
            if(filteredArgs.length < 2){
                if(allConditions.includes(clause.trim())){
                    return `Clause number ${idx + 1} has no argument defined`;
                }
                for (const condition of allConditions){
                    if(clause.includes(condition)){
                        return `Clause number ${idx + 1} must have spaces around the ${condition} argument`;
                    }
                }
                return `Clause number ${idx + 1} has no condition defined`;
            }
            if (filteredArgs.length < 3 && !allowed2ArgConditions.includes(filteredArgs[1].trim())) {
                if(allowed3ArgConditions.includes(filteredArgs[1].trim())) {
                    return `Clause number ${idx + 1} has a missing right argument
                                        condition ${condition} compares between two arguments`;
                }
                if (allConditions.includes(filteredArgs[0].trim())) {
                    return `Clause number ${idx + 1} has no argument defined`;
                }
                return `Clause number ${idx + 1} has no condition defined`;
            }

            const lastArg = filteredArgs[filteredArgs.length - 1].trim();
            const argBeforeLast = filteredArgs[filteredArgs.length - 2].trim();
            if (!allowed3ArgConditions.includes(argBeforeLast) && allowed3ArgConditions.includes(lastArg)) {
                return `Clause number ${idx + 1} has a missing right argument
                                            condition ${lastArg} compares between two arguments`;
            } else if (allowed2ArgConditions.includes(argBeforeLast) && !allowed2ArgConditions.includes(lastArg)) {
                return `Clause number ${idx + 1} cannot have a right argument
                                            condition ${argBeforeLast} applies to one argument only`;
            }
        }
    };

    waitforClause = (text) => {
        const trimmedText = text.trim();
        if(!trimmedText.startsWith("(") || !trimmedText.endsWith(")")){
            return "Wait-for must be declared between round brackets";
        }

        const clauses = trimmedText.substring(1, trimmedText.length - 1);
        if(clauses.trim().startsWith(";")){
            return "No clause to the left of the first semicolon";
        }
        if(clauses.trim().endsWith(";")){
            return "No clause to the right of the last semicolon";
        }

        const parsedClauses = clauses.split(";");
        if(parsedClauses.length === 1 && parsedClauses[0].trim() === ""){
            return "Wait-for cannot be empty";
        }

        const arrowSign = "=>";
        const allowedStatusCodes = ["success", "suspect", "failure"];
        const splitOnArrow = /(?<=(\s|^))(=>)(?=(\s|$))/;
        for(const [idx, clause] of parsedClauses.entries()){
            const filteredArgs = clause.trim().split(splitOnArrow).filter(arg => arg.trim().length > 0);
            if (filteredArgs.length < 2){
                if (filteredArgs[0]?.trim() === arrowSign) {
                    return `Clause number ${idx + 1} has no output argument defined`;
                } else if (clause.includes(arrowSign)) {
                    return `Clause number ${idx + 1} must have spaces around => sign`;
                } else {
                    return `Clause number ${idx + 1} has no => sign defined`;
                }
            }
            if (filteredArgs.length < 3) {
                if (filteredArgs[0].trim() === arrowSign) {
                    return `Clause number ${idx + 1} has no output argument defined`;
                } else {
                    return `Clause number ${idx+1} has no status code defined`
                }
            }

            const lastArg = filteredArgs[filteredArgs.length - 1].trim();
            const argBeforeLast = filteredArgs[filteredArgs.length - 2].trim();
            if(!allowedStatusCodes.includes(lastArg)){
                if(arrowSign !== lastArg) {
                    return `Clause number ${idx + 1} contains an invalid status code
                                            status must be one of the following: ${allowedStatusCodes.join(", ")}`;
                }else{
                    return `Clause number ${idx+1} has no status code defined`
                }
            }
            if(argBeforeLast !== arrowSign){
                return `Clause number ${idx+1} must contain an => sign between the output and the status code`;
            }

        }
    };
}

const Analyzers = new ErrorAnalyzers();
export default Analyzers;