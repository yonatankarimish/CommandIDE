/**
 * Created by yonatan on 2/8/2020.
 */
import CommandIde from "./component/command-ide";
import IdeLine from "./component/elements/ide-line";
import IdeRule from "./component/elements/ide-rule";
import IdeToken from "./component/elements/ide-token";
import IdeSeparator from "./component/elements/ide-separator";
import IdeTooltip from "./component/entities/ide-tooltip";

import DefaultGrammar from "./component/grammar/default-grammar";
import TaskGrammar from "./extension-grammars/task-grammar";
import IntellicheckGrammar from "./extension-grammars/intellicheck-grammar";
import corpus from "./component/grammar/corpus";

//This is the AngularJS component wrapper for the command-ide class
//If you ever migrate to another front-end framework, all you have to do is replace the wrapper
//(as opposed to rewriting the entire IDE from scratch)
(function (angular) {
    const rankedNgrams = new Promise((resolve, reject) => {
        //Construct an occurrence map by checking for nGram occurrence in the provided corpus, on a line-by-line basis
        //Because this is a costly operation, we defer the operation to a web-worker, running it in a separate thread.
        const absoluteWorkerPath = new URL("./angular-app/shared/components/command-ide/corpus-worker.js", window.location.origin);
        const nGramWorker = new Worker(absoluteWorkerPath.toString());
        nGramWorker.onmessage = (event) => {
            resolve(event.data);
        };

        nGramWorker.postMessage(corpus);
    });

    angular.module('Backbox').component('commandIde', {
        bindings: {
            commands: '<',
            api: '<',
            grammar: '<',
            tvFields: '<',
            errorCount: '='
        },
        controller: ['$scope', '$element', function ($scope, $element) {
            const $ctrl = this;
            const dropdownButtons = [];
            const sheetForm = angular.element("md-bottom-sheet[bb-sheet] bb-session-command-table").parents("md-bottom-sheet[bb-sheet]").scope().ctrl.sheetForm;

            $ctrl.$onInit = $onInit;

            async function $onInit() {
                //Register custom elements with the browser
                if(!window.customElements.get('command-ide')){
                    window.customElements.define('command-ide', CommandIde);
                    window.customElements.define('ide-line', IdeLine);
                    window.customElements.define('ide-rule', IdeRule);
                    window.customElements.define('ide-token', IdeToken);
                    window.customElements.define('ide-separator', IdeSeparator);
                    window.customElements.define('ide-tooltip', IdeTooltip);
                }

                //Create the IDE and it's public api (passed to parent AngularJS controllers)
                $ctrl.ide = new CommandIde();
                createApi();

                //Invoke the init phase on the IDE
                const autocompleteNgrams = await rankedNgrams;
                const providedGrammar = getGrammar();
                $ctrl.ide.init(
                    $ctrl.sessionId,
                    angular.copy($ctrl.commands),
                    providedGrammar,
                    autocompleteNgrams,
                    generateIdeHeaderButtons(providedGrammar)
                );

                //Append the generated IDE to this component wrapper, and register the validity and touch listener
                $element[0].append($ctrl.ide);
                listenToIdeChanges();
            }

            //Generate the api object for the IDE
            function createApi() {
                addAndBind("getCommands", () => $ctrl.ide.createCommandsFromLines(...$ctrl.ide.lines));
                addAndBind("toggleDefaultValues", () => {
                    $ctrl.ide.toggleDefaultValues(...$ctrl.ide.lines);
                    updateErrorIndicators();
                });
                addAndBind("validateLines", () => {
                    $ctrl.ide.utils.lineUtils.validateLines(true, ...$ctrl.ide.lines);
                    updateErrorIndicators();
                });
                addAndBind("changeDefaultRulePreferences", $ctrl.ide.changeDefaultRulePreferences);
                addAndBind("toggleTokenInspector", $ctrl.ide.toggleTokenInspector);
                addAndBind("findAndReplace", $ctrl.ide.findAndReplace);
            }

            //Expose the lambda through the api, wrapped with a function bound to the IDE itself
            function addAndBind(methodName, lambda) {
                $ctrl.api[methodName] = (function () {
                    return lambda(...arguments);
                }).bind($ctrl.ide);
            }

            //Generate a grammar object, based upon the binding provided in the html template of this component
            function getGrammar() {
                if($ctrl.grammar === "intellicheck"){
                    return new IntellicheckGrammar($ctrl.tvFields);
                }else if($ctrl.grammar === "task"){
                    return new TaskGrammar();
                }else{
                    return new DefaultGrammar();
                }
            }

            //Generate header buttons, styled according to our current stylesheets
            //(allows replacing the header w.o. modifying ide source code)
            function generateIdeHeaderButtons(providedGrammar) {
                return [
                    generateMenu(providedGrammar),
                    generateFindAndReplace(),
                    generateButton('Toggle default values', $ctrl.api.toggleDefaultValues),
                    generateButton('Validate commands', $ctrl.api.validateLines),
                    generateButton('Token inspector', $ctrl.api.toggleTokenInspector)
                ];
            }

            //Creates a menu icon for use within the IDE header section
            function generateMenu(providedGrammar) {
                const menu = document.createElement('span');
                menu.classList.add("icon-menu");
                menu.showDropdown = (event) => showHelper(event, dropdown);
                menu.hideDropdown = (event) => hideHelper(event, dropdown);

                const dropdown = document.createElement('ul');
                dropdown.setAttribute('id', 'ide-settings-menu');
                menu.append(dropdown);

                const header = document.createElement('li');
                header.textContent = "Show these rules by default:";
                dropdown.append(header);

                CommandIde.addEventListener(menu, 'mouseup', (event) => {
                    if(dropdown.style.visibility === "visible"){
                        if (menu === event.target) {
                            menu.hideDropdown(event);
                        }
                    }else{
                        menu.showDropdown(event);
                    }
                });

                const toggleableRules = providedGrammar.grammarRules.filter(rule => rule.toggleable);
                const cachedToggledRules = window.localStorage.getItem('toggledRuleNames'); //returns a comma-delimited string with all toggled rule names
                const toggledRuleNames = cachedToggledRules?.length? new Set(cachedToggledRules.split(",")) : new Set();
                for (const rule of toggleableRules){
                    const listItem = document.createElement('li');
                    const checkboxLabel = createMenuLabel(rule, toggledRuleNames.has(rule.name));
                    listItem.append(checkboxLabel);
                    dropdown.append(listItem);
                }

                dropdownButtons.push(menu);
                return menu;
            }

            //Create a menu label (checkbox + rule name) for use in the settings menu
            function createMenuLabel(grammarRule, initChecked) {
                const checkboxLabel = document.createElement('label');
                checkboxLabel.classList.add("checkbox-label");

                const checkbox = document.createElement('input');
                checkbox.setAttribute('type', 'checkbox');
                checkbox.checked = initChecked;
                CommandIde.addEventListener(checkbox, 'change', () => $ctrl.api.changeDefaultRulePreferences(grammarRule.name, checkbox.checked));
                checkboxLabel.append(checkbox);

                const checkmark = document.createElement('span');
                checkmark.classList.add("checkmark");
                checkboxLabel.append(checkmark);

                const labelText = document.createElement('span');
                labelText.classList.add("label-text");
                labelText.textContent = grammarRule.descriptiveName;
                checkboxLabel.append(labelText);

                return checkboxLabel;
            }


            //Create a button for use within the IDE header section
            function generateButton(buttonText, callback) {
                const button = document.createElement('button');
                button.setAttribute('class', 'md-primary md-raised md-button');
                button.textContent = buttonText;

                if(callback) {
                    CommandIde.addEventListener(button, 'mouseup', callback);
                }

                return button;
            }

            //Create a find & replace menu for use within the IDE header section
            function generateFindAndReplace() {
                const button = document.createElement('button');
                button.setAttribute('class', 'md-primary md-raised md-button');

                const buttonText = document.createElement('span');
                buttonText.textContent = "Find & Replace";
                buttonText.style.pointerEvents = "none";
                button.append(buttonText);

                const dropdown = document.createElement('section');
                dropdown.setAttribute('id', 'ide-find-replace');
                button.append(dropdown);

                const find = document.createElement('input');
                find.placeholder = "Find this text...";
                dropdown.append(find);

                const replace = document.createElement('input');
                replace.placeholder = "...then type Enter to replace with this text";
                dropdown.append(replace);

                button.showDropdown = (event) => {
                    button.style.width = button.getBoundingClientRect().width + "px";
                    buttonText.textContent = "Hide";
                    showHelper(event, dropdown);
                };
                button.hideDropdown = (event) => {
                    hideHelper(event, dropdown);
                    button.style.width = "";
                    buttonText.textContent = "Find & Replace";
                };
                CommandIde.addEventListener(button, 'mouseup', (event) => {
                    if(event.button === 0) {
                        if (dropdown.style.visibility === "visible") {
                            if (button === event.target) {
                                button.hideDropdown(event);
                            }
                        } else {
                            button.showDropdown(event);
                        }
                    }
                });

                CommandIde.addEventListener(replace, 'keyup', (event) => {
                    if(event.key === "Enter" && find.value.length > 0) {
                        const matchesLength = $ctrl.api.findAndReplace(find.value, replace.value);
                        if(matchesLength > 0) {
                            hideMenusAndUpdate();
                        }else{
                            button.hideDropdown(event);
                        }
                    }
                });

                dropdownButtons.push(button);
                return button;
            }

            //Show the provided helper element, hiding all other helpers that were previously visible
            function showHelper(event, element) {
                $ctrl.ide.tooltip.hide();
                for(const menuButton of dropdownButtons){
                    if(element.parentNode !== menuButton) {
                        menuButton.hideDropdown(event);
                    }
                }
                
                element.style.visibility = "visible";
                element.setAttribute("visible", "");
            }

            //Hide the provided helper element
            function hideHelper(event, element) {
                element.removeAttribute("visible");
                element.style.visibility = "hidden";
            }

            //Update the error count and form validity state
            function updateErrorIndicators() {
                $scope.$apply(() => {
                    //Error count is external to the IDE. Although related to the validity state, they are both separate.
                    $ctrl.errorCount = $ctrl.ide.querySelectorAll('.invalidLine, .invalidRule, .invalidToken').length;
                    sheetForm.$setDirty(true);
                    sheetForm.$setValidity('command-ide', $ctrl.ide.valid);
                });
            }

            //Hide any open dropdown menus, and update the error count and form validity state
            function hideMenusAndUpdate(event) {
                for(const menuButton of dropdownButtons){
                    menuButton.hideDropdown(event);
                }

                updateErrorIndicators();
            }

            //Toggle the containing form ng-dirty state whenever typing in the IDE
            //NOTE: this is possible because this listener happens after any keyup listeners in the IDE (and ignoring any preventDefaults() on the ide keydown events)
            function listenToIdeChanges() {
                $ctrl.ide.linePane.addEventListener('keyup', hideMenusAndUpdate);
            }
        }],
    });
})(angular);