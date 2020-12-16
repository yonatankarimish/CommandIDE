class OrdinalUtils{
    constructor(CommandIDE){
        this.CommandIDE = CommandIDE;
    }

    //Creates an empty ordinal element
    createEmptyOrdinal = () => {
        const ordinal = document.createElement('span');
        ordinal.classList.add("ordinal");
        return ordinal;
    };

    //Refill the ordinal pane with the correct ordinals for the lines currently displayed in the line pane
    invalidateOrdinals = () => {
        const ordinalPane = this.CommandIDE.ordinalPane;
        ordinalPane.innerHTML = "";

        let ordinal = 1;
        for(const line of this.CommandIDE.lines.values()) {
            const nextOrdinal = this.createEmptyOrdinal();
            if(line.isExtensionLine){
                nextOrdinal.textContent = " ";
            }else{
                nextOrdinal.textContent = ordinal++;
            }

            ordinalPane.append(nextOrdinal);
        }
    };
}

export default OrdinalUtils;