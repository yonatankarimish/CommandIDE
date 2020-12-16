/**
 * Created by Yonatan on 07/11/2017.
 */
const os = require('os');
const fs = require('fs');
const path = require('path');
const Promise = require('promise');
const SSH2Utils = require('ssh2-utils');
const archiver = require('archiver');
const yargs = require('yargs').argv;
const bbProperties = require('./webpack.properties');
const sftpConfig = require(bbProperties.filePaths.sftpConfig)();

const appRoot = path.join(__dirname, "/../../..");
const remoteRoot = " /backbox/backbox-3.0/app-server/apache-tomcat-7.0.37/webapps/ROOT";

const sshUtils = new SSH2Utils();
const uploadTasks = {
    a: uploadAll, all: uploadAll,
    c: uploadClient, client: uploadClient,
    db: updateDb, database: updateDb,
    j: uploadSecurityJAR, jar: uploadSecurityJAR,
    r: enableRemote, remote: enableRemote,
    w: uploadWar, war: uploadWar
};

//Executes the proper upload task according to the value passed to the --task flag.
//Usage:
init();
function init(){
    let execPromise = yargs.task ? uploadTasks[yargs.task]() : uploadTasks['client']();
    execPromise.then(() => {
        process.exit(0);
    }).catch((e) => {
        console.error("SSH upload: failed to execute script with task argument = "+yargs.task);
        console.error("Caused by: ", e);
        process.exit(1);
    });
}

//Executes a complete upload sequence of all upload scripts
function uploadAll(){
    return uploadWar().then(enableRemote).then(updateDb).then(uploadSecurityJAR);
}

//Uploads all relevant web client folders to the remote Backbox server
function uploadClient(){
    let unzipCommands = [
        "cd  " + remoteRoot,
        "tar -xzvf angular-app.tar",
        "rm -f angular-app.tar"
    ];

    return compressFolder(appRoot + bbProperties.angularRoot, "angular-app").then((angularZip) => {
        return Promise.all([
            sftpTransferFile(angularZip, sftpConfig.basePath + "/angular-app.tar"),
            sftpTransferFile(appRoot + bbProperties.webContent + "/terminal.html", sftpConfig.basePath + "/terminal.html"),
            sftpTransferFile(appRoot + bbProperties.webContent + "/" + bbProperties.login.outputFile, sftpConfig.basePath + "/" + bbProperties.login.outputFile),
            sftpTransferDir(appRoot + bbProperties.distFolder, sftpConfig.basePath + "/dist")
        ]).then(()=>{
            fs.unlink(angularZip, (err) => {/*intentionally empty*/});
            console.log(unzipCommands);
            return executeSsh(unzipCommands);
        });
    });
}

//Updates the database of the remote Backbox server with all changes made by developers
function updateDb(){
    let updateCommands = [
        'mysql -f -u root -pbackbox6 backboxV3 < /data/tmp/db-updates.sql', //executes the sql commands for database schema alterations
        'mysql -f -u root -pbackbox6 backboxV3 < /data/tmp/foreign-keys.sql', //executes the sql commands for foreign key alterations
        'rm -f /data/tmp/db-updates.sql', //delete temporary script after its execution
        'rm -f /data/tmp/foreign-keys.sql', //delete temporary script after its execution
        'service backbox stop',
        'service backbox start',
        'echo "finished running updateDb"', //notify the developer's machine CLI that all commands have run successfully.
    ];
    return sftpTransferFile(appRoot+bbProperties.filePaths.dbUpdates, "/data/tmp/db-updates.sql").then(() => {
        return  sftpTransferFile(appRoot+bbProperties.filePaths.foreignKeys, "/data/tmp/foreign-keys.sql");
    }).then(() => {
        return executeSsh(updateCommands);
    });
}


//Uploads the backbox-server-security JAR file to the remote Backbox server
function uploadSecurityJAR(){
    let updateCommands = ['service backbox stop', 'service backbox start'];
    return sftpTransferFile(appRoot+bbProperties.filePaths.securityJAR, "/backbox/default/app-server/default/lib/backbox-server-security-3.0.2.jar").then(() => {
        return executeSsh(updateCommands);
    });
}

//Updates the remote server to allow debugger access for IDE and MySQL Workbench
function enableRemote(){
    //Get the developer machine network interfaces and extract the local ethernet ipv4 address
    let localIp = "";
    let interfaces = os.networkInterfaces();
    for (let iface of Object.keys(interfaces)){
        if (iface.toLowerCase().startsWith("ethernet")) {
            for (let recordKey of Object.keys(interfaces[iface])){
                let record = interfaces[iface][recordKey];
                if (record.family === "IPv4"){
                    console.log('Allow debug for interface: ', iface);
                    console.log('With address: ', record.address);
                    localIp = record.address;
                    break;
                }
            }
            break;
        }
    }

    if(localIp != null && localIp !== "") {
        let enableCommands = [
            //Stops the monit service to prevent the automatic relaunch of services
            'service monit stop',

            //Alter tomcat binaries to enable debugging using an IDE, by enabling communication on port 1044
            "sed -ie 's/ -Xdebug -Xrunjdwp:transport=dt_socket,server=y,suspend=n,address=1044//g' /backbox/default/app-server/default/bin/app-server.sh",
            "sed -ie 's/-XX:MaxPermSize=512m/-XX:MaxPermSize=512m -Xdebug -Xrunjdwp:transport=dt_socket,server=y,suspend=n,address=1044/g' /backbox/default/app-server/default/bin/app-server.sh",
            'service backbox stop',
            'service backbox start',

            //Grant access privileges to database for developer machine
            "mysql -u root -pbackbox6 -e \"GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' IDENTIFIED BY 'backbox6' WITH GRANT OPTION; FLUSH PRIVILEGES;\" backboxV3",

            //Create access rules to enable debugger connections for Java and MySql from local dev computer to our remote server, and sync them with Backbox internal tracking
            "iptables -L INPUT --line-numbers -n | grep 'DEVELOPER_CONSOLE_ACCESS' | sed 's/--//g' | sed -r 's/(\\s+)/|/' | sed 's/  \\+/|/g' | tr \"|\" \"\\n\" | sed -e 's/\\/\\*//g' -e 's/\\*\\///g' | while read -r RULEID; do read -r ACTION; read -r SRCDST; read -r IPADDR; read -r NETWORK; read -r COMMENT; mysql -u root -pbackbox6 -D backboxV3 -e \"DELETE FROM ACCESS_RULES WHERE COMMENT LIKE '%$COMMENT%'; UPDATE ACCESS_RULES SET ROW_INDEX = ROW_INDEX - 1  WHERE ROW_INDEX > $RULEID AND CHAIN = 'INPUT' AND TYPE = 'IPV4'  ORDER BY ROW_INDEX ASC;\"; done",
            "/sbin/iptables -D INPUT -j LOGDROP",
            'if /sbin/iptables -L | grep DEVELOPER_CONSOLE_ACCESS; then /sbin/iptables -D INPUT `/sbin/iptables -nvL --line-numbers | grep DEVELOPER_CONSOLE_ACCESS | awk \'{print $1}\'`; fi',
            '/sbin/iptables -A INPUT -s ' + localIp +' -j ACCEPT -m comment --comment \'DEVELOPER_CONSOLE_ACCESS\'',
            '/sbin/iptables -A INPUT -j LOGDROP',
            'service iptables save',
            "iptables -L INPUT --line-numbers -n | grep 'DEVELOPER_CONSOLE_ACCESS' | sed 's/--//g' | sed -r 's/(\\s+)/|/' | sed 's/  \\+/|/g' | tr \"|\" \"\\n\" | sed -e 's/\\/\\*//g' -e 's/\\*\\///g' | while read -r RULEID; do read -r ACTION; read -r SRCDST; read -r IPADDR; read -r NETWORK; read -r COMMENT; mysql -u root -pbackbox6 -D backboxV3 -e \"INSERT INTO ACCESS_RULES (ROW_INDEX, SOURCE, CHAIN, TYPE, COMMENT, TARGET, PROTOCOL, PORTS) VALUES ($RULEID, '$IPADDR', 'INPUT', 'IPV4',  ' $COMMENT ', '$ACTION', '$SRCDST', '');\"; done ",

            //notify the developer's machine CLI that all commands have run successfully.
            'echo "finished running enableRemote"',
        ];
        return executeSsh(enableCommands);
    }else{
        return new Promise((resolve, reject) => {
            console.error("Failed to open an access rule on Backbox machine");
        });
    }
}


//Uploads the WAR file to the remote Backbox server
function uploadWar(){
    let deployCommands = [
        'service monit stop', //Stops the monit service to prevent an automatic relaunch of backbox service
        'service backbox stop', //Orders backbox
        'rm -rf /backbox/default/app-server/default/webapps/ROOT*', //delete the old WAR file and deployed ROOT directory
        'mv /data/tmp/ROOT.war /backbox/default/app-server/default/webapps/', //relocate the newly uploaded WAR file to the /webapps folder
        'service backbox start', //Because we manually remove the WAR file, the paths under the /libs folder break down on the first launch of tomcat.
        'service backbox stop', //We launch backbox service a second time, so tomcat will fix the broken links
        'service backbox start',
        'service guacd start', //Launch the Guacamoli tunnel service, for use by the Backbox access terminal
        'rm -rf ' + remoteRoot + '/scripts/webpack/', //clean all client side build scripts
        'find ' + remoteRoot + '/scripts/ -type f -exec dos2unix {} {} \\;', //convert the shell scripts to unix format
        'chmod +x ' + remoteRoot + '/scripts/*', //grant proper access permissions on all shell scripts
        'chmod 755 /backbox/default/app-server/default/webapps/ROOT/bin/phantomjs/phantomjs', //grant proper access permissions for phantomjs script. Required for Backbox reports
        'rm -rf /usr/local/bin/phantomjs', //delete old phantomjs script
        'mv -f /backbox/default/app-server/default/webapps/ROOT/bin/phantomjs /usr/local/bin', //relocate any changes to phantomjs script to its assigned folder
        'rm -rf /backbox/default/app-server/default/webapps/ROOT/bin', //delete all binary files under the newly deployed ROOT folder
        'echo "finished running uploadWar"', //notify the developer's machine CLI that all commands have run successfully.
    ];
    return sftpTransferFile(appRoot+bbProperties.filePaths.war, "/data/tmp/ROOT.war").then(() => {
        return executeSsh(deployCommands);
    });
}

//Converts a folder into a .tar archive
function compressFolder(pathToDirectory, rootDir){
    return new Promise((resolve, reject) => {
        let tarArchive = archiver('tar', {
            gzip: true
        });
        let output = fs.createWriteStream(pathToDirectory + ".tar");

        // listen for all archive data to be written
        // 'close' event is fired only when a file descriptor is involved
        output.on('close', function() {
            console.log(tarArchive.pointer() + ' total bytes');
            console.log('archiver has been finalized and the output file descriptor has closed.');
            output.end();
            resolve(pathToDirectory + ".tar");
        });

        // This event is fired when the data source is drained no matter what was the data source.
        // It is not part of this library but rather from the NodeJS Stream API.
        // @see: https://nodejs.org/api/stream.html#stream_event_end
        output.on('end', function() {
            console.log('Data has been drained');
        });

        tarArchive.on('warning', function(warning) {
            console.log("compressFolder warning: ", warning);
        });
        tarArchive.on('error', function(err) {
            output.end();
            reject(err);
        });

        tarArchive.pipe(output);
        tarArchive.directory(pathToDirectory, rootDir);
        tarArchive.finalize();
    });
}

//transfers a directory from the local dev enviroment to the remote Backbox server, as defined in the sftp.config.js file
function sftpTransferDir(source, destination){
    console.log("starting sftp transfer from " + source);
    let executions = [];

    for(let remote of sftpConfig.remotes){
        executions.push(new Promise((resolve, reject) => sshUtils.putDir(remote, source, destination, (error, server, connection) => {
            sftpCallback(error, server, connection, source, destination, resolve, reject);
        })));
    }

    return Promise.all(executions);
}

//transfers a single file from the local dev enviroment to the remote Backbox server, as defined in the sftp.config.js file
function sftpTransferFile(source, destination){
    console.log("starting sftp transfer from " + source);
    let executions = [];

    for(let remote of sftpConfig.remotes){
        executions.push(new Promise((resolve, reject) => sshUtils.putFile(remote, source, destination, (error, server, connection) => {
            sftpCallback(error, server, connection, source, destination, resolve, reject);
        })));
    }

    return Promise.all(executions);
}

function sftpCallback(error, server, connection, source, destination, resolve, reject){
    connection.on('error', (err) => {
        reject(err);
    });
    connection.on('close', (hadError) => {
        if(hadError){
            console.log("failed to execute sftp transfer to "+ server.host + ": " + destination);
            reject("connection closed with error");
        }else{
            console.log("finished sftp transfer to " + server.host + ": " + destination);
            resolve("connection closed");
        }
    });

    if (error) {
        console.log(error);
        reject(error);
    }
    connection.end();
}

function executeSsh(commandArr){
    let joinedCmds = commandArr.join(' && ');
    let executions = [];

    for(let remote of sftpConfig.remotes){
        executions.push(new Promise((resolve, reject) => {
            sshUtils.run(remote, joinedCmds, (error, stdout, stderr, server, connection) => {
                stdout.on('data', function (data) {
                    console.log('stdout: ', bufferStringify(data));
                });
                stderr.on('data', function (err) {
                    console.log('stderr: ', bufferStringify(err));
                });
                stdout.on('close', function () {
                    resolve("connection closed");
                    connection.end();
                });
            });
        }));
    }

    return Promise.all(executions);
}

function bufferStringify(buffer) {
    return buffer.toString().replace(/[\r\n]+/g," ").trim()
}