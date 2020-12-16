import GrammarRule from "./grammar-rule";
import GrammarToken, {TokenClasses} from "./grammar-token";
import ErrorAnalyzers from "./error-analyzers"
import Command from "../entities/command";
import IdeLine from "../elements/ide-line";

//The definitive IDE syntax bible, defining what can be written where. Different grammars can be provided to the IDE, but this is the default one
//NOTE: many features and functions rely on the ordering of the grammar (property order, function chaining order etc..)
//Take caution when reordering stuff
class DefaultGrammar {
    constructor() {
        this.rules = {};
        this.constructGrammarRules();
        this.constructGrammarConstants();
    }

    constructGrammarRules = () => {
        this.addRule(
            new GrammarRule("command")
                .withDescriptiveName("command")
                .markAsDefault()
                .addToken(
                    new GrammarToken("TT")
                        .withDescriptiveName("command")
                        .withBackingGet((cmd) => cmd["command_TYPE"] === "verification"? "" : cmd["command"])
                        .withBackingSet((cmd, value) =>  cmd["command"] = value) //stringifying the text for verification commands is handled in the token for command_TYPE
                )
                .addToken(
                    new GrammarToken("HT")
                        .withDescriptiveName("visibility modifier")
                        .withInitialText("visible")
                        .withContentRegex(/(visible|hidden)(\s*|$)/)
                        .withTokenClass(TokenClasses.ARGUMENT)
                        .withDefaultValue("visible")
                        .withBackingGet((cmd) => cmd["hide_OUTPUT"]? "hidden" : "visible")
                        .withBackingSet((cmd, value) => cmd["hide_OUTPUT"] = value === "hidden")
                )
                .addToken(
                    new GrammarToken("ET")
                        .withDescriptiveName("channel selector")
                        .withInitialText("remote")
                        .withContentRegex(/(remote|local|internal)\s*$/)
                        .withTokenClass(TokenClasses.ARGUMENT)
                        .withDefaultValue("remote")
                        .withBackingGet((cmd) => cmd["command_TYPE"])
                        .withBackingSet((cmd, value) => {
                            //Set the command type
                            cmd["command_TYPE"] = value;

                            //cmd["timeout"] and cmd["wait_FOR"] are just context-aware defaults.
                            //They get overridden if the user typed in different values
                            switch(value){
                                case "internal":
                                    cmd["timeout"] = Command.defaultOtherTimeout;
                                    cmd["wait_FOR"] = Command.defaultOtherWaitfor;
                                    break;
                                case "local":
                                    cmd["timeout"] = Command.defaultLocalTimeout;
                                    cmd["wait_FOR"] = Command.defaultLocalWaitfor;
                                    break;
                                case "remote":
                                default:
                                    cmd["timeout"] = Command.defaultRemoteTimeout;
                                    cmd["wait_FOR"] = Command.defaultRemoteWaitfor;
                                    break;
                            }
                        })
                )
        ).addRule(
            new GrammarRule("timeout")
                .withDescriptiveName("timeout")
                .withToggleableFlag(true)
                .addToken(
                    new GrammarToken("ST")
                        .withDescriptiveName("timeout")
                        .withInitialText("timeout")
                        .withContentRegex(/timeout /)
                        .withTokenClass(TokenClasses.KEYWORD)
                )
                .addToken(
                    new GrammarToken("TT")
                        .withDescriptiveName("second limit")
                        .withContentRegex(/[1-9]\d{0,8}\s*$/)
                        .withDefaultValue((dataSource) => {
                            if(dataSource instanceof IdeLine) {
                                //Passing a line (when a command is not available) has an amortized time complexity of O(1)
                                //But a worse-case performance of O(lines*rules*tokens) if iterating over the entire IDE
                                for(let rule of dataSource.rules){
                                    const grammarRule = rule.grammarRule;
                                    if(grammarRule.name === "command" && rule.lastToken){
                                        switch(rule.lastToken.textContent.trim()){
                                            case "internal": return DefaultGrammar.defaultOtherTimeout;
                                            case "verification": return DefaultGrammar.defaultOtherTimeout;
                                            case "local": return DefaultGrammar.defaultLocalTimeout;
                                            default: return DefaultGrammar.defaultRemoteTimeout;
                                        }
                                    }
                                }
                            } else if(dataSource instanceof Command || dataSource["command_TYPE"]) {
                                //Best to pass a command datasource - time complexity of O(1)
                                switch(dataSource["command_TYPE"] ){
                                    case "internal": return DefaultGrammar.defaultOtherTimeout;
                                    case "verification": return DefaultGrammar.defaultOtherTimeout;
                                    case "local": return DefaultGrammar.defaultLocalTimeout;
                                    default: return DefaultGrammar.defaultRemoteTimeout;
                                }
                            }

                            return DefaultGrammar.defaultRemoteTimeout; //default when no datasource is provided (or a datasource of a non-standard type)
                        })
                        .withBackingGet((cmd) => cmd["timeout"].toString())
                        .withBackingSet((cmd, value) => cmd["timeout"] = parseInt(Math.min(value, DefaultGrammar.maxIntValue)))
                        .withErrorAnalyzer(ErrorAnalyzers.timeoutText)
                )
        ).addRule(
            new GrammarRule("sleep")
                .withDescriptiveName("sleep")
                .withToggleableFlag(true)
                .addToken(
                    new GrammarToken("ST")
                        .withDescriptiveName("sleep")
                        .withInitialText("sleep")
                        .withContentRegex(/sleep /)
                        .withTokenClass(TokenClasses.KEYWORD)
                )
                .addToken(
                    new GrammarToken("TT")
                        .withDescriptiveName("sleep limit")
                        .withContentRegex(/\d{1,9}\s*$/)
                        .withDefaultValue("0")
                        .withBackingGet((cmd) => cmd["sleep"].toString())
                        .withBackingSet((cmd, value) => cmd["sleep"] = parseInt(Math.min(value, DefaultGrammar.maxIntValue)))
                        .withErrorAnalyzer(ErrorAnalyzers.sleepText)
                )
        ).addRule(
            new GrammarRule("saveto-file")
                .withDescriptiveName("save to file")
                .withMutualExclusion("save")
                .addToken(
                    new GrammarToken("ST")
                        .withDescriptiveName("save to file")
                        .withInitialText("saveto-file")
                        .withContentRegex(/saveto-file /)
                        .withTokenClass(TokenClasses.KEYWORD)
                )
                .addToken(
                    new GrammarToken("TT")
                        .withDescriptiveName("file name")
                        .withBackingGet((cmd) => cmd["output_TYPE"] === "file" && !cmd["addToFileRepository"]?  cmd["save_OUTPUT"] : "")
                        .withBackingSet((cmd, value) => {
                            cmd["output_TYPE"] = "file";
                            cmd["save_OUTPUT"] = value;
                            cmd["saveFlag"] = value.trim().length > 0;
                        })
                )
                .addToken(
                    new GrammarToken("ET")
                        .withDescriptiveName("overwrite toggle")
                        .withInitialText("overwrite")
                        .withContentRegex(/(overwrite|append)\s*$/)
                        .withTokenClass(TokenClasses.ARGUMENT)
                        .withDefaultValue("overwrite")
                        .withBackingGet((cmd) => cmd["output_TYPE"] === "file" && cmd["outputAppendToFile"]? "append" : "overwrite")
                        .withBackingSet((cmd, value) => cmd["outputAppendToFile"] = (value === "append"))
                )
        ).addRule(
            new GrammarRule("saveto-var")
                .withDescriptiveName("save to variable")
                .withMutualExclusion("save")
                .addToken(
                    new GrammarToken("ST")
                        .withDescriptiveName("save to variable")
                        .withInitialText("saveto-var")
                        .withContentRegex(/saveto-var /)
                        .withTokenClass(TokenClasses.KEYWORD)
                )
                .addToken(
                    new GrammarToken("TT")
                        .withDescriptiveName("variable name")
                        .withBackingGet((cmd) => cmd["output_TYPE"] === "variable" && !cmd["collected"]? cmd["save_OUTPUT"] : "")
                        .withBackingSet((cmd, value) => {
                            cmd["output_TYPE"] = "variable";
                            cmd["save_OUTPUT"] = value;
                            cmd["saveFlag"] = value.trim().length > 0;
                        })
                )
        ).addRule(
            new GrammarRule("saveToFilePermissions")
                .withDescriptiveName("chmod file")
                .withToggleableFlag(true)
                .addToken(
                    new GrammarToken("ST")
                        .withDescriptiveName("chmod")
                        .withInitialText("chmod-file")
                        .withContentRegex(/chmod-file /)
                        .withTokenClass(TokenClasses.KEYWORD)
                )
                .addToken(
                    new GrammarToken("TT")
                        .withDescriptiveName("permission octal")
                        .withContentRegex(/[0-7]{3}\s*$/)
                        .withDefaultValue("664")
                        .withBackingGet((cmd) => cmd["saveToFilePermissions"] > 0? cmd["saveToFilePermissions"].toString(): "")
                        .withBackingSet((cmd, value) => cmd["saveToFilePermissions"] = parseInt(value))
                        .withErrorAnalyzer(ErrorAnalyzers.chmodPermissions)
                )
        ).addRule(
            new GrammarRule("verify-file")
                .withDescriptiveName("verify file contents")
                .markAsFreestanding()
                .addToken(
                    new GrammarToken("ST")
                        .withDescriptiveName("verify file")
                        .withInitialText("verify-file")
                        .withContentRegex(/verify-file /)
                        .withTokenClass(TokenClasses.KEYWORD)
                        .withBackingSet((cmd, value) => cmd["temp_verify"] = {"command": "findtext"})
                )
                .addToken(
                    new GrammarToken("TT")
                        .withDescriptiveName("file name")
                        .withBackingGet((cmd) => cmd["command_TYPE"] === "verification" && cmd["command"]["command"] === "findtext"? cmd["command"]["source"]: "")
                        .withBackingSet((cmd, value) => cmd["temp_verify"]["source"] = value)
                ).addToken(
                    new GrammarToken("CKW")
                        .withDescriptiveName("contains toggle")
                        .withInitialText("contains")
                        .withContentRegex(/(contains|lacks) /)
                        .withTokenClass(TokenClasses.ARGUMENT)
                        .withBackingGet((cmd) => cmd["command"]["presence"] === "found"? "contains" : "lacks")
                        .withBackingSet((cmd, value) => cmd["temp_verify"]["presence"] = value === "lacks"? "notfound" : "found")
                ).addToken(
                    new GrammarToken("CT")
                        .withDescriptiveName("search expression")
                        .withContentRegex(/"[^"]+" /)
                        .withBackingGet((cmd) => `"${cmd["command"]["text"]}"` || "")
                        .withBackingSet((cmd, value) => cmd["temp_verify"]["text"] = value.replace(/"/g, ''))
                        .withErrorAnalyzer(ErrorAnalyzers.verifyFileSearchExpression)
                ).addToken(
                    new GrammarToken("BKW")
                        .withDescriptiveName("the term \"between lines\"")
                        .withInitialText("between lines")
                        .withContentRegex(/between +lines /)
                        .withTokenClass(TokenClasses.ARGUMENT)
                        .withBackingGet((cmd) => "between lines")
                ).addToken(
                    new GrammarToken("LB")
                        .withDescriptiveName("starting line")
                        .withContentRegex(/\d+ /)
                        .withBackingGet((cmd) => cmd["command"]["fromline"])
                        .withBackingSet((cmd, value) => cmd["temp_verify"]["fromline"] = value)
                        .withErrorAnalyzer(ErrorAnalyzers.verifyFileStartLine)
                ).addToken(
                    new GrammarToken("AKW")
                        .withDescriptiveName("the term \"and\"")
                        .withInitialText("and")
                        .withContentRegex(/and /)
                        .withTokenClass(TokenClasses.ARGUMENT)
                        .withBackingGet((cmd) => "and")
                ).addToken(
                    new GrammarToken("UB")
                        .withDescriptiveName("finish line")
                        .withContentRegex(/\d+\s*$/)
                        .withBackingGet((cmd) => cmd["command"]["toline"])
                        .withBackingSet((cmd, value) => {
                            cmd["temp_verify"]["toline"] = value;
                            cmd["temp_verify"]["sourcetype"] = "file";

                            cmd["command"] = cmd["temp_verify"];
                            cmd["command_TYPE"] = "verification";
                            delete cmd["temp_verify"];

                            cmd["timeout"] = Command.defaultOtherTimeout;
                            cmd["wait_FOR"] = Command.defaultOtherWaitfor;
                        })
                        .withErrorAnalyzer(ErrorAnalyzers.verifyFileFinishLine)
                )
        ).addRule(
            new GrammarRule("verify-sizeof")
                .withDescriptiveName("verify file size")
                .markAsFreestanding()
                .addToken(
                    new GrammarToken("ST")
                        .withDescriptiveName("verify size of")
                        .withInitialText("verify-sizeof")
                        .withContentRegex(/verify-sizeof /)
                        .withTokenClass(TokenClasses.KEYWORD)
                        .withBackingSet((cmd, value) => cmd["temp_verify"] = {"command": "checksize"})
                )
                .addToken(
                    new GrammarToken("TT")
                        .withDescriptiveName("file name")
                        .withBackingGet((cmd) => cmd["command_TYPE"] === "verification" && cmd["command"]["command"] === "checksize"? cmd["command"]["source"]: "")
                        .withBackingSet((cmd, value) => cmd["temp_verify"]["source"] = value)
                ).addToken(
                    new GrammarToken("BKW")
                        .withDescriptiveName("between toggle")
                        .withInitialText("between")
                        .withContentRegex(/(between|notwithin) /)
                        .withTokenClass(TokenClasses.ARGUMENT)
                        .withBackingGet((cmd) => cmd["command"]["presence"] === "inrange"? "between" : "notwithin")
                        .withBackingSet((cmd, value) => cmd["temp_verify"]["presence"] = value === "between"? "inrange" : "notinrange")
                ).addToken(
                    new GrammarToken("LB")
                        .withDescriptiveName("lower bound")
                        .withContentRegex(/\d+ *(b|kb|mb|gb|tb|B|KB|MB|GB|TB|Kb|Mb|Gb|Tb|kB|mB|gB|tB) /)
                        .withBackingGet((cmd) => {
                            const minSize = cmd["command"]["minsize"];
                            const measureUnit = cmd["command"]["minsizeunit"]? cmd["command"]["minsizeunit"].toLowerCase().replace(/ytes/, "") : "";
                            return minSize + measureUnit;
                        })
                        .withBackingSet((cmd, value) => {
                            const parsedText = value.split(/(\d+|\D+)/).filter(chunk => chunk.length > 0);
                            cmd["temp_verify"]["minsize"] = parsedText[0];
                            cmd["temp_verify"]["minsizeunit"] = parsedText[1] + "ytes";
                        })
                        .withErrorAnalyzer(ErrorAnalyzers.verifySizeLowerBound)
                ).addToken(
                    new GrammarToken("AKW")
                        .withDescriptiveName("the term \"and\"")
                        .withInitialText("and")
                        .withContentRegex(/and /)
                        .withTokenClass(TokenClasses.ARGUMENT)
                        .withBackingGet((cmd) => "and")
                ).addToken(
                    new GrammarToken("UB")
                        .withDescriptiveName("upper bound")
                        .withContentRegex(/\d+ *(b|kb|mb|gb|tb|B|KB|MB|GB|TB|Kb|Mb|Gb|Tb|kB|mB|gB|tB)\s*$/)
                        .withBackingGet((cmd) => {
                            const maxSize = cmd["command"]["maxsize"];
                            const measureUnit =  cmd["command"]["maxsizeunit"]? cmd["command"]["maxsizeunit"].toLowerCase().replace(/ytes/, "") : "";
                            return maxSize + measureUnit;
                        })
                        .withBackingSet((cmd, value) => {
                            const parsedText = value.split(/(\d+|\D+)/).filter(chunk => chunk.length > 0);
                            cmd["temp_verify"]["maxsize"] =  parsedText[0];
                            cmd["temp_verify"]["maxsizeunit"] = parsedText[1] + "ytes";

                            cmd["command"] = cmd["temp_verify"];
                            cmd["command_TYPE"] = "verification";
                            delete cmd["temp_verify"];

                            cmd["timeout"] = Command.defaultOtherTimeout;
                            cmd["wait_FOR"] = Command.defaultOtherWaitfor;
                        })
                        .withErrorAnalyzer(ErrorAnalyzers.verifySizeUpperBound)
                )
        ).addRule(
            new GrammarRule("verify-archive")
                .withDescriptiveName("verify archive contents")
                .markAsFreestanding()
                .addToken(
                    new GrammarToken("ST")
                        .withDescriptiveName("verify archive")
                        .withInitialText("verify-archive")
                        .withContentRegex(/verify-archive /)
                        .withTokenClass(TokenClasses.KEYWORD)
                        .withBackingSet((cmd, value) => cmd["temp_verify"] = {"command": "archivecontains"})
                )
                .addToken(
                    new GrammarToken("TT")
                        .withDescriptiveName("archive name")
                        .withBackingGet((cmd) => cmd["command_TYPE"] === "verification" && cmd["command"]["command"] === "archivecontains"? cmd["command"]["archive"]: "")
                        .withBackingSet((cmd, value) => cmd["temp_verify"]["archive"] = value)
                )
                .addToken(
                    new GrammarToken("CKW")
                        .withDescriptiveName("inclusion toggle")
                        .withInitialText("contains")
                        .withContentRegex(/(contains|lacks) /)
                        .withTokenClass(TokenClasses.ARGUMENT)
                        .withBackingGet((cmd) => cmd["command"]["presence"] === "contains"? "contains" : "lacks")
                        .withBackingSet((cmd, value) => cmd["temp_verify"]["presence"] = value === "lacks"? "notcontains" : "contains")
                ).addToken(
                    new GrammarToken("CT")
                        .withDescriptiveName("file name")
                        .withContentRegex(/"[^"]+"\s*$/)
                        .withBackingGet((cmd) => `"${cmd["command"]["file"]}"` || "")
                        .withBackingSet((cmd, value) => {
                            cmd["temp_verify"]["file"] = value.replace(/"/g, '');

                            cmd["command"] = cmd["temp_verify"];
                            cmd["command_TYPE"] = "verification";
                            delete cmd["temp_verify"];

                            cmd["timeout"] = Command.defaultOtherTimeout;
                            cmd["wait_FOR"] = Command.defaultOtherWaitfor;
                        })
                        .withErrorAnalyzer(ErrorAnalyzers.verifyArchiveFileName)
                )
        ).addRule(
            new GrammarRule("description")
                .withDescriptiveName("description")
                .addToken(
                    new GrammarToken("ST")
                        .withDescriptiveName("comment mark")
                        .withInitialText("//")
                        .withContentRegex(/\/\/ /)
                        .withTokenClass(TokenClasses.COMMENT)
                )
                .addToken(
                    new GrammarToken("TT")
                        .withDescriptiveName("comment")
                        .withTokenClass(TokenClasses.COMMENT)
                        .withBackingProperty("description")
                )
        ).addRule(
            new GrammarRule("status")
                .withDescriptiveName("set status")
                .markAsExtension()
                .addToken(
                    new GrammarToken("ST")
                        .withDescriptiveName("set status")
                        .withInitialText("\u0009set-status")
                        .withContentRegex(/\u0009\s*set-status /) //requires set-status clauses to begin with a tab character
                        .withTokenClass(TokenClasses.KEYWORD)
                ).addToken(
                    new GrammarToken("RT")
                        .withDescriptiveName("status code")
                        .withContentRegex(/(success|suspect|failure) /)
                        .withTokenClass(TokenClasses.ARGUMENT)
                        .withBackingProperty("status")
                ).addToken(
                    new GrammarToken("TT")
                        .withDescriptiveName("status message")
                        .withBackingProperty("error_MESSAGE")
                        .withBackingGet((cmd) => cmd["error_MESSAGE"])
                        .withBackingSet((cmd, value) => {
                            cmd["error_MESSAGE"] = value;
                            cmd["statusFlag"] = true;
                        })
                )
        ).addRule(
            new GrammarRule("condition")
                .withDescriptiveName("if condition")
                .markAsExtension()
                .addToken(
                    new GrammarToken("ST")
                        .withDescriptiveName("if")
                        .withInitialText("\u0009if")
                        .withContentRegex(/\u0009\s*if /) //requires if clauses to begin with a tab character
                        .withTokenClass(TokenClasses.KEYWORD)
                )
                .addToken(
                    new GrammarToken("BT")
                        .withDescriptiveName("boolean aggregator")
                        .withContentRegex(/(all|either) /)
                        .withTokenClass(TokenClasses.ARGUMENT)
                        .withDefaultValue("all")
                        .withBackingGet((cmd) => cmd["condition"].length > 0 && cmd["condition"][0].operator === "2"? "either" : "all") //Somebody on the server-side never heard about enums...
                        .withBackingSet((cmd, value) => {cmd["temp_condition_operator"] = (value === "all"? "1" : "2")}) //Somebody on the server-side never heard about enums...
                )
                .addToken(
                    new GrammarToken("TT")
                        .withDescriptiveName("condition clause")
                        .withDefaultValue("()") //this is not an allowed value, but will prevent the editor from rendering empty "if" statements
                        .withContentRegex((() => {
                            /*This regex from hell requires a little explanation...
                            * The general structure of the provided text is (<clause>;<clause>;...<clause>).
                            * Each clause is formed as <argL> <condition> <argR>, with argR being optional.
                            * Clauses are separated by semicolons, and wrapped with circular brackets.
                            *
                            * We now construct the regex by running this lambda as an IIFE, to make it readable to the average programmer.
                            * */
                            const allowedChars = `[^;\\r\\n]`; //captures the characters allowed in clause arguments and conditions (not whitespace, semicolon or round bracket)
                            const requireNonSpace = `[^;\\s]`; //Used to prevent argL and argR from containing no letters
                            const nonLineBreak = `[\\t\\f\\v ]`; //equivalent to \s, but without supporting line breaks (\r and \n)

                            const allowed3ArgConditions = `(equal|notequal|less|greater|contains|notcontains|regex)`; //captures the allowed condition operators, which can be followed by an argument
                            const allowed2ArgConditions = `(exists|isempty|isnotempty)`; //captures the allowed condition operators, which cannot be followed by an argument
                            const notFollowedBy2Arg = `(?!.*${allowed2ArgConditions})`; //ensures 3-arg conditions will not be followed by 2-arg conditions
                            const argL = `${requireNonSpace}+${allowedChars}*`; //ensures that <argL> has one or more of the allowed characters
                            const argR = `${nonLineBreak}+${requireNonSpace}+${allowedChars}*`; //ensures that <argR> has one or more of the allowed characters, separated by whitespace from <condition>

                            const clauseTail = `${nonLineBreak}+(${allowed2ArgConditions}${nonLineBreak}*|${allowed3ArgConditions}${notFollowedBy2Arg}${argR})`; //ensures the condition has one or more of the allowed characters, separated by whitespace from <argL>
                            const clause = `${nonLineBreak}*${argL}${clauseTail}${nonLineBreak}*`; //concatenates the above variables to ensure clauses are written as <argL> <condition> <argR> (brackets form a regex capture group)

                            const optionalClauses = `(;${clause})*`; //if a semicolon is written, another clause must follow it
                            const bracketWrapper = `\\(${clause}${optionalClauses}\\)`; //ensures the clauses (one or more) are surrounded with brackets
                            const followedByWhiteSpace = `${nonLineBreak}*$`; //and that only whitespace can follow the brackets, until the end of the line

                            // The final regex is the following abomination: /\([\t\f\v ]*[^;\s]+[^;\r\n]*[\t\f\v ]+((exists|isempty|isnotempty)[\t\f\v ]*|(equal|notequal|less|greater|contains|notcontains|regex)(?!.*(exists|isempty|isnotempty))[\t\f\v ]+[^;\s]+[^;\r\n]*)[\t\f\v ]*(;[\t\f\v ]*[^;\s]+[^;\r\n]*[\t\f\v ]+((exists|isempty|isnotempty)[\t\f\v ]*|(equal|notequal|less|greater|contains|notcontains|regex)(?!.*(exists|isempty|isnotempty))[\t\f\v ]+[^;\s]+[^;\r\n]*)[\t\f\v ]*)*\)[\t\f\v ]*$/
                            // (and also the longest regex I ever wrote...)
                            // If you ever need to update this: https://regex101.com/r/m4dniU/6/debugger
                            return new RegExp(bracketWrapper + followedByWhiteSpace);
                        })())
                        .withBackingGet((cmd) => {
                            const allowed3ArgConditions = ["equal", "notequal", "less", "greater", "contains", "notcontains", "regex"];
                            const allowed2ArgConditions = ["exists", "isempty", "isnotempty"];
                            let stringDisplay = "";

                            for(let clause of cmd["condition"]){
                                if(stringDisplay.length > 0){
                                    stringDisplay += "; ";
                                }
                                if(allowed3ArgConditions.includes(clause.condition)) {
                                    stringDisplay += `${clause.arg1} ${clause.condition} ${clause.arg2}`;
                                }else if(allowed2ArgConditions.includes(clause.condition)) {
                                    stringDisplay += `${clause.arg1} ${clause.condition}`;
                                }
                            }

                            return `(${stringDisplay})`;
                        })
                        .withBackingSet((cmd, value) => {
                            const conditionOperator = cmd["temp_condition_operator"]? cmd["temp_condition_operator"] : "1"; //Somebody on the server-side never heard about enums...
                            delete cmd["temp_condition_operator"];

                            const trimmedText = value.trim();
                            const clauses = trimmedText.substring(1, trimmedText.length - 1); // remove the brackets

                            const allowed3ArgConditions = ["equal", "notequal", "less", "greater", "contains", "notcontains", "regex"];
                            const allowed2ArgConditions = ["exists", "isempty", "isnotempty"];
                            const argsRegex = new RegExp(`\\s*(${allowed3ArgConditions.concat(allowed2ArgConditions).join("|")})\\s*`); //and split on any condition
                            for(let clause of clauses.split(";")){
                                const members = clause.trim().split(argsRegex).filter(member => member.length > 0);
                                const construct = {};

                                if(!allowed2ArgConditions.includes(members[members.length - 1])) {
                                    construct.arg2 = members.pop();
                                }
                                construct.condition = members.pop();
                                construct.arg1 = members.join(" ");
                                construct.operator = conditionOperator;

                                cmd["condition"].push(construct);
                            }
                        })
                        .withErrorAnalyzer(ErrorAnalyzers.conditionClause)
                )
        ).addRule(
            new GrammarRule("wait_FOR")
                .withDescriptiveName("wait for")
                .markAsExtension()
                .withToggleableFlag(true)
                .addToken(
                    new GrammarToken("ST")
                        .withDescriptiveName("wait for")
                        .withInitialText("\u0009wait-for")
                        .withContentRegex(/\u0009\s*wait-for /) //requires wait-for clauses to begin with a tab character
                        .withTokenClass(TokenClasses.KEYWORD)
                )
                .addToken(
                    new GrammarToken("TT")
                        .withDescriptiveName("result clause")
                        .withDefaultValue((dataSource) => {
                            if(dataSource instanceof IdeLine) {
                                //Passing a line (when a command is not available) has an amortized time complexity of O(1)
                                //But a worse-case performance of O(lines*rules*tokens) if iterating over the entire IDE
                                for(let rule of dataSource.rules){
                                    const grammarRule = rule.grammarRule;
                                    if(grammarRule.name === "command" && rule.lastToken){
                                        switch(rule.lastToken.textContent.trim()){
                                            case "internal": return DefaultGrammar.defaultOtherWaitfor;
                                            case "verification": return DefaultGrammar.defaultOtherWaitfor;
                                            case "local": return DefaultGrammar.defaultLocalWaitfor;
                                            default: return DefaultGrammar.defaultRemoteWaitfor;
                                        }
                                    }
                                }
                            } else if(dataSource instanceof Command || dataSource["command_TYPE"]) {
                                //Best to pass a command datasource - time complexity of O(1)
                                switch(dataSource["command_TYPE"]){
                                    case "internal": return DefaultGrammar.defaultOtherWaitfor;
                                    case "verification": return DefaultGrammar.defaultOtherWaitfor;
                                    case "local": return DefaultGrammar.defaultLocalWaitfor;
                                    default: return DefaultGrammar.defaultRemoteWaitfor;
                                }
                            }

                            return DefaultGrammar.defaultRemoteWaitfor; //default when no datasource is provided (or a datasource of a non-standard type)
                        })
                        .withContentRegex((() => {
                            /*This regex from hell requires a little explanation...
                            * The general structure of the provided text is (<clause>;<clause>;...<clause>).
                            * Each clause is formed as <wait-for> => <status>
                            * Clauses are separated by semicolons, and wrapped with circular brackets.
                            *
                            * We now construct the regex by running this lambda as an IIFE, to make it readable to the average programmer.
                            * */
                            const allowedChars = `[^\\r\\n;]`; //captures the characters allowed in clause arguments (not whitespace, semicolon or round bracket)
                            const requireNonSpace = `[^\\s;]`; //Used to prevent waitFor from containing no letters
                            const nonLineBreak = `[\\t\\f\\v ]`; //equivalent to \s, but without supporting line breaks (\r and \n)

                            const waitFor = `${requireNonSpace}+${allowedChars}*`; //captures the characters allowed in wait-for values
                            const arrow = `${nonLineBreak}+=>`; //captures the arrow symbol, ensuring it only appears once
                            const status = `${nonLineBreak}+(success|suspect|failure)`; //captures the three valid statuses
                            const clause = `${nonLineBreak}*${waitFor}${arrow}${status}${nonLineBreak}*`; //concatenates the above variables to ensure clauses are written as <wait-for> => <status> (brackets form a regex capture group)

                            const optionalClauses = `(;${clause})*`; //if a semicolon is written, another clause must follow it
                            const bracketWrapper = `\\(${clause}${optionalClauses}\\)`; //ensures the clauses (one or more) are surrounded with brackets
                            const followedByWhiteSpace = `${nonLineBreak}*$`; //and that only whitespace can follow the brackets, until the end of the line

                            // The final regex is the following abomination: /\([\t\f\v ]*[^\s;]+[^\r\n;]*[\t\f\v ]+=>[\t\f\v ]+(success|suspect|failure)[\t\f\v ]*(;[\t\f\v ]*[^\s;]+[^\r\n;]*[\t\f\v ]+=>[\t\f\v ]+(success|suspect|failure)[\t\f\v ]*)*\)[\t\f\v ]*$/
                            // If you ever need to update this: https://regex101.com/r/VqphV1/5/debugger
                            return new RegExp(bracketWrapper + followedByWhiteSpace);
                        })())
                        .withBackingGet((cmd) => {
                            if(cmd["wait_FOR"]) {
                                const waitFor = JSON.parse(cmd["wait_FOR"]);
                                let stringDisplay = "";

                                for (let clause of waitFor) {
                                    if (stringDisplay.length > 0) {
                                        stringDisplay += "; ";
                                    }
                                    stringDisplay += `${clause.waitfor} => ${clause.status}`;
                                }

                                return `(${stringDisplay})`;
                            } else{
                                return "";
                            }
                        })
                        .withBackingSet((cmd, value) => {
                            const waitFor = [];
                            const trimmedText = value.trim();
                            const clauses = trimmedText.substring(1, trimmedText.length - 1); // remove the brackets
                            const splitOnArrow = /\s*(=>)\s*/; // and split on arrow signs
                            for(let clause of clauses.split(";")){
                                const members = clause.trim().split(splitOnArrow).filter(member => member.length > 0);

                                const status = members.pop();
                                const arrow = members.pop();
                                const waitforText = members.join(" ");
                                waitFor.push({
                                    waitfor: waitforText,
                                    status: status,
                                    message: ""
                                });
                            }

                            cmd["wait_FOR"] = JSON.stringify(waitFor);
                        })
                        .withErrorAnalyzer(ErrorAnalyzers.waitforClause)
                )
        );
    };

    constructGrammarConstants = () => {
        //We're slightly "cheating" on this one: knowing the expected argument for the backing getter
        //we provide the static value for the command's "wait_FOR" JSON, wrapped in an object
        //The backing getter doesn't know the argument is not a command, and will parse the JSON for us
        //
        //Notes:
        //1) The big benefit is that any change to the backing getter will also reflect here
        //2) This might not be "fair play" (you can call it ugly), but bad legacy code (passing wait_FOR as stringified JSON)
        //   requires bad tricks...
        const waitForBackingGet = this.rules["wait_FOR"].tokens["TT"].backingGet;

        DefaultGrammar.maxIntValue = 1e9;
        DefaultGrammar.defaultOtherTimeout = Command.defaultOtherTimeout.toString();
        DefaultGrammar.defaultLocalTimeout = Command.defaultLocalTimeout.toString();
        DefaultGrammar.defaultRemoteTimeout = Command.defaultRemoteTimeout.toString();
        DefaultGrammar.defaultOtherWaitfor = "";
        DefaultGrammar.defaultLocalWaitfor = waitForBackingGet({"wait_FOR": Command.defaultLocalWaitfor});
        DefaultGrammar.defaultRemoteWaitfor = waitForBackingGet({"wait_FOR": Command.defaultRemoteWaitfor});
    };

    addRule = (grammarRule) => {
        this.rules[grammarRule.name] = grammarRule;
        return this;
    };

    get defaultRule(){
        const defaultRules = this.grammarRules.filter(rule => rule.isDefaultRule);
        if(defaultRules.length === 1) {
            return defaultRules[0];
        } else if (defaultRules.length > 1) {
            throw "Multiple default rules were defined in this grammar";
        } else {
            throw "No default rule was defined in this grammar";
        }
    }

    get ruleNames(){
        return Object.keys(this.rules);
    }

    get grammarRules(){
        return Object.values(this.rules);
    }

    get firstTokens(){
        return this.grammarRules.map(rule => rule.firstToken);
    }
}

const Separators = {
    LINE: '\n', //newline character
    RULE: ',', //comma character
    TOKEN: ' ', //space character
};

export {DefaultGrammar as default, Separators};