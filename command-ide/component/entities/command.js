class Command{
    static defaultOtherTimeout = 0;
    static defaultLocalTimeout = 30;
    static defaultRemoteTimeout = 60;
    static defaultOtherWaitfor = ``;
    static defaultLocalWaitfor = `[{"waitfor":"BBP","status":"success","message":""}]`;
    static defaultRemoteWaitfor = `[{"waitfor":"#","status":"success","message":""}, {"waitfor":"%%CURRENT_PROMPT%%","status":"success","message":""}]`;

    constructor(commandType="remote") {
        this.id = 0;
        this.session_ID = 0;
        this.setDefaults(commandType);

        this.addToFileRepository = false;
        this.collected = false;
        this.command = "";
        this.condition = [];
        this.description = "";
        this.error_MESSAGE = "";
        this.hide_OUTPUT = false;
        this.output_TYPE = "file";
        this.outputAppendToFile = false;
        this.queue = 0;
        this.save_OUTPUT = "";
        this.saveFlag = false;
        this.saveToFilePermissions = 664;
        this.sleep = 0;
        this.status = "Success";
        this.statusFlag = false;
    }

    setDefaults = (commandType) => {
        //may god forgive whoever decided to pass around wait_FOR as stringified json...
        this.command_TYPE = commandType;
        switch (commandType){
            case "remote":
                this.timeout = Command.defaultRemoteTimeout;
                this.wait_FOR = Command.defaultRemoteWaitfor
                break;

            case "local":
                this.timeout = Command.defaultLocalTimeout;
                this.wait_FOR = Command.defaultLocalWaitfor
                break;

            default:
                this.timeout = Command.defaultOtherTimeout;
                this.wait_FOR = Command.defaultOtherWaitfor
                break;
        }
    };

    castToObject = () => {
        const obj = {};
        for(let key of Object.keys(this)){
            obj[key] = this[key];
        }

        return obj;
    };
}

export default Command;