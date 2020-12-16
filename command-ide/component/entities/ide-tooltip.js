import CommandIde from "../command-ide";

class IdeTooltip extends HTMLElement{
    constructor(CommandIDE){
        super();

        this.CommandIDE = CommandIDE; //Reference to the containing IDE
        this.attachmentOffset = 5; //How many pixels to offset the tooltip from elements it is attached to

        //Autocomplete toggles
        this.autoCompleteMenu = document.createElement("ul");
        this.autoCompleteSelection = null;
        this.autocompleteFocusIdx = NaN;

        CommandIde.addEventListener(this, "mouseleave", this.CommandIDE.exitAutoComplete);
    }

    //Applies the given class to the tooltip
    withStyle = (style) => {
        this.setAttribute("class", style);
        return this;
    };

    //Displays the given text within the tooltip
    withMessage = (message) => {
        this.resetAutoCompleteState();
        this.textContent = message;
        return this;
    };

    //Creates an autocomplete menu based on the entries provided
    withAutoComplete = (entries) => {
        this.innerHTML = "";
        this.autoCompleteMenu.innerHTML = "";
        for(const entry of entries){
            const listItem = document.createElement("li");
            listItem.textContent = entry;
            listItem.classList.add("autocomplete-item");
            listItem.addEventListener("click", () => this.CommandIDE.completeText(entry));
            this.autoCompleteMenu.append(listItem);
        }

        this.append(this.autoCompleteMenu);
        return this;
    };

    //Attaches the tooltip to the provided element
    //Must be invoked after .withMessage() or .withAutoComplete() to ensure proper positioning
    attachTo = (element) => {
        //Get bounding rectangles for all relevant elements
        const thisRectangle = this.getBoundingClientRect();
        const elementRectangle = element.getBoundingClientRect();
        const lineRectangle = this.CommandIDE.utils.lineUtils.getParentLine(element).getBoundingClientRect();
        const ideRectangle = this.CommandIDE.getBoundingClientRect();

        //x-coordinates are straightforward: since the tooltip uses position:absolute, the xCoord is relative to ideRectangle.left
        const xCoord = elementRectangle.left - ideRectangle.left + this.attachmentOffset;
        this.style.left = Math.max(xCoord, this.attachmentOffset)+ "px";

        //y-coordinates aren't easy: These calculations position the tooltip accordingly
        const adjustedBottom = elementRectangle.top === elementRectangle.bottom? lineRectangle.bottom : elementRectangle.bottom; //tokens and rules require display:inline for fluent selection experience, forcing us to calculate this property manually
        const yCoord = adjustedBottom - ideRectangle.top + this.attachmentOffset;
        const bottomPositionLimit = ideRectangle.height - thisRectangle.height - this.attachmentOffset;
        if(yCoord <= bottomPositionLimit) {
            //Tooltip can be positioned underneath the element
            this.style.top = yCoord + "px";
            this.classList.remove("positioned-above");
        }else{
            //Standard position would overflow outside the IDE, so we position the tooltip ABOVE the element instead
            const yAlternateCoord = elementRectangle.top - ideRectangle.top - thisRectangle.height - this.attachmentOffset;
            this.style.top = yAlternateCoord + "px";
            this.classList.add("positioned-above");
        }

        return this;
    };

    //Hope this needs no explanation...
    show = () => {
        this.style.visibility = "visible";
        return this;
    };

    //Hope this needs no explanation...
    hide = () => {
        this.resetAutoCompleteState();
        this.style.visibility = "hidden";
        return this;
    };

    //Reset all flags defining autocomplete t
    resetAutoCompleteState = () => {
        if(Array.prototype.includes.call(this.childNodes, this.autoCompleteMenu)){
            this.removeChild(this.autoCompleteMenu);
        }

        this.autoCompleteSelection = null;
        this.autocompleteFocusIdx = NaN;
    };

    countAutoCompleteItems = () => {
        return this.querySelectorAll(".autocomplete-item").length;
    };

    markAutoCompleteItem = (autocompleteFocusIdx) => {
        if(this.autoCompleteSelection){
            this.autoCompleteSelection.classList.remove("focused");
        }

        this.autocompleteFocusIdx = autocompleteFocusIdx;
        this.autoCompleteSelection = this.autoCompleteMenu.childNodes[autocompleteFocusIdx];
        this.autoCompleteSelection.classList.add("focused");
    };

    handleUpArrow = () => {
        const autoCompleteItems = this.countAutoCompleteItems();
        const autocompleteFocusIdx = isNaN(this.autocompleteFocusIdx)? autoCompleteItems - 1 : (this.autocompleteFocusIdx + autoCompleteItems - 1) % autoCompleteItems;
        this.markAutoCompleteItem(autocompleteFocusIdx);
    }

    handleDownArrow = () => {
        const autoCompleteItems = this.countAutoCompleteItems();
        const autocompleteFocusIdx = isNaN(this.autocompleteFocusIdx)? 0 : (this.autocompleteFocusIdx + 1) % autoCompleteItems;
        this.markAutoCompleteItem(autocompleteFocusIdx);
    }
}

export default IdeTooltip;