import DefaultGrammar from '../component/grammar/default-grammar';
import GrammarRule from "../component/grammar/grammar-rule";
import GrammarToken, {TokenClasses} from "../component/grammar/grammar-token";
import ErrorAnalyzers from "../component/grammar/error-analyzers";

class TaskGrammar extends DefaultGrammar {
    constructor() {
        super();

        const savetoFile = this.rules["saveto-file"];
        this.addRule(
            new GrammarRule("saveto-repo")
                .withDescriptiveName("save to file repository")
                .withMutualExclusion("save")
                .addToken(
                    new GrammarToken("ST")
                        .withDescriptiveName("save to file repository")
                        .withInitialText("saveto-repo")
                        .withContentRegex(/saveto-repo /)
                        .withTokenClass(TokenClasses.KEYWORD)
                )
                .addToken(
                    savetoFile.tokens["TT"].clone()
                        .withBackingGet((cmd) => cmd["output_TYPE"] === "file" && cmd["addToFileRepository"]?  cmd["save_OUTPUT"] : "")
                        .withBackingSet((cmd, value) => {
                            cmd["output_TYPE"] = "file";
                            cmd["save_OUTPUT"] = value;
                            cmd["saveFlag"] = value.trim().length > 0;
                            cmd["addToFileRepository"] = true;
                        })
                )
                .addToken(savetoFile.tokens["ET"].clone())
        );
    }
}

export default TaskGrammar;