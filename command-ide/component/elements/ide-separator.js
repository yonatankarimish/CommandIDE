import {Separators} from "../grammar/default-grammar";

class IdeSeparator extends HTMLElement{
    constructor() {
        super();
    }

    static ruleSeparator = (textContent = Separators.RULE) => {
        const separator = new IdeSeparator();
        separator.classList.add("ide-rule-separator");
        separator.textContent = textContent;
        return separator;
    };

    get isEmpty(){
        return this.textContent.length === 0;
    }

    get isDegenerate(){
        return this.isEmpty;
    }
}

export default IdeSeparator;