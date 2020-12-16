import DefaultGrammar from '../component/grammar/default-grammar';
import GrammarRule from "../component/grammar/grammar-rule";
import GrammarToken, {TokenClasses} from "../component/grammar/grammar-token";


class IntellicheckGrammar extends DefaultGrammar {
    //technicalVettingFields: An array containing the names
    constructor(technicalVettingFields) {
        super();

        const savetoVar = this.rules["saveto-var"];
        this.addRule(
            new GrammarRule("saveto-trend")
                .withDescriptiveName("save to trend")
                .withMutualExclusion("save")
                .addToken(
                    new GrammarToken("ST")
                        .withDescriptiveName("save to trend variable")
                        .withInitialText("saveto-trend")
                        .withContentRegex(/saveto-trend /)
                        .withTokenClass(TokenClasses.KEYWORD)
                )
                .addToken(
                    savetoVar.tokens["TT"].clone()
                        .withBackingGet((cmd) => cmd["output_TYPE"] === "variable" && cmd["collected"]? cmd["save_OUTPUT"] : "")
                        .withBackingSet((cmd, value) => {
                            cmd["output_TYPE"] = "variable";
                            cmd["save_OUTPUT"] = value;
                            cmd["saveFlag"] = value.trim().length > 0;
                            cmd["collected"] = true;
                        })
                )
        );

        const tvRegex = new RegExp(`(${technicalVettingFields.join("|")})\\s*$`);
        this.addRule(
            new GrammarRule("saveto-survey")
                .withDescriptiveName("save to technical survey")
                .withMutualExclusion("save")
                .addToken(
                    new GrammarToken("ST")
                        .withDescriptiveName("save to technical survey")
                        .withInitialText("saveto-survey")
                        .withContentRegex(/saveto-survey /)
                        .withTokenClass(TokenClasses.KEYWORD)
                )
                .addToken(
                    savetoVar.tokens["TT"].clone()
                        .withContentRegex(tvRegex)
                        .withBackingGet((cmd) => cmd["output_TYPE"] === "tv"?  cmd["save_OUTPUT"] : "")
                        .withBackingSet((cmd, value) => {
                            cmd["output_TYPE"] = "tv";
                            cmd["save_OUTPUT"] = value;
                            cmd["saveFlag"] = value.trim().length > 0;
                        })
                        .withErrorAnalyzer((text) => {
                            if(!technicalVettingFields.includes(text.trim())){
                                return "Variable is not a known Technical Vetting field name";
                            }
                        })
                )
        );

        this.addRule(
            new GrammarRule("saveto-performance")
                .withDescriptiveName("save to performance")
                .withMutualExclusion("save")
                .addToken(
                    new GrammarToken("TT")
                        .withDescriptiveName("save to performance monitoring")
                        .withContentRegex(/saveto-performance\s*$/)
                        .withBackingGet((cmd) => cmd["output_TYPE"] === "performance"?  "saveto-performance" : "")
                        .withBackingSet((cmd, value) => {
                            cmd["output_TYPE"] = "performance";
                            cmd["saveFlag"] = true;
                        })
                        .withTokenClass(TokenClasses.KEYWORD)
                )
        );
    }
}

export default IntellicheckGrammar;