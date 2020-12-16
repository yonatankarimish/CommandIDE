const TokenClasses = {
    KEYWORD: "KEYWORD",
    ARGUMENT: "ARGUMENT",
    COMMENT: "COMMENT",
    TEXT: "TEXT"
};
class GrammarToken {
    constructor(key){
        this.key = key; //unique key (within a rule's scope) used for identifying the token
        this.descriptiveName = "<unspecified-token>";
        this.contentRegex = new RegExp("");
        this.tokenClass = TokenClasses.TEXT;
        this.initialText = "";
        this.defaultValue = () => "";
        this.errorAnalyzer = () => "";
    }

    clone = () => {
        return new GrammarToken(this.key)
            .withContentRegex(this.contentRegex)
            .withTokenClass(this.tokenClass)
            .withInitialText(this.initialText)
            .withDefaultValue(this.defaultValue)
            .withBackingGet(this.backingGet)
            .withBackingSet(this.backingSet)
            .withErrorAnalyzer(this.errorAnalyzer);
    };

    //human readable name to describe the token in tooltips and messages
    withDescriptiveName = (descriptiveName) => {
        this.descriptiveName = descriptiveName;
        return this;
    };

    //regex used to validate that the token is well-formatted
    withContentRegex = (contentRegex) => {
        this.contentRegex = contentRegex;
        return this;
    };

    //used to mark the token with different css classes
    withTokenClass = (tokenClass) => {
        this.tokenClass = tokenClass;
        return this;
    };

    //initial text content to render inside the token (in the absence of backingGet)
    withInitialText = (initialText) => {
        this.initialText = initialText;
        return this;
    };

    //function used to check whether the token contains a default value (may be shown/hidden accordingly when the function is invoked)
    //The expected format is either a value or a lambda of the form (dataSource) => {...}
    withDefaultValue = (defaultValue) => {
        if(typeof defaultValue === "function"){
            this.defaultValue = defaultValue
        }else{
            this.defaultValue = () => defaultValue;
        }

        return this;
    };

    //shorthand assignment of backingGet and backingSet
    withBackingProperty = (backingProperty) => {
        this.backingGet = (cmd) => cmd[backingProperty];
        this.backingSet = (cmd, value) => cmd[backingProperty] = value;
        return this;
    };

    //provide a lambda to extract properties from a command object into the initial display value for this token
    //The expected format is a lambda of the form (cmd) => {...}
    //returning a textual value representing the property
    withBackingGet = (backingLambda) => {
        this.backingGet = backingLambda;
        return this;
    };

    //provide a lambda to assign the current value of this token into properties of a command object
    //The expected format is a lambda of the form (cmd, value) => {...}
    //assigning the value to one or more of the command's properties, making any modifications necessary
    withBackingSet = (backingLambda) => {
        this.backingSet = backingLambda;
        return this;
    };

    //Assigns an error analyzer function to this token
    //The expected format is a lambda of the form (text) => {...}
    //returning a human-readable explanation for one type of error
    withErrorAnalyzer = (errorAnalyzer) => {
        this.errorAnalyzer = errorAnalyzer;
        return this;
    };

    //Performs an equality check by comparing token keys
    equals = (other) => {
        return other instanceof GrammarToken && this.key === other.key;
    };
}

export {GrammarToken as default, TokenClasses};