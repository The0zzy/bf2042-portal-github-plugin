(function () {
    // Load the script
    const script = document.createElement("script");
    script.src = 'https://ajax.googleapis.com/ajax/libs/jquery/3.6.0/jquery.min.js';
    script.type = 'text/javascript';
    script.addEventListener('load', () => {
        console.log(`jQuery ${$.fn.jquery} has been loaded successfully!`);
        test()
        initGitHubPlugin().then((result) => {
            try {
                _Blockly.ContextMenuRegistry.registry.register(gitHubExportItem());
                _Blockly.ContextMenuRegistry.registry.register(gitHubImportItem());
                _Blockly.ContextMenuRegistry.registry.register(gitHubSetupItem());
                _Blockly.ContextMenuRegistry.registry.register(gitHubPullItem());
                _Blockly.ContextMenuRegistry.registry.register(gitHubCommitItem());
                console.log("GitHub Plugin loaded.");
            } catch (exception) {
                console.error("could not register blockly menu items\n", exception);
            }
        }).catch((exc) => {
            console.error("Could not load plugin:", exc);
        });
    });
    document.head.appendChild(script);
})();

function test() {
    console.log($.fn.jquery)
}

const pluginID = "bf2042-portal-github-plugin";
const defaultExperienceData = {
    playgroundId: "",
    personalAccessToken: "",
    repository: {name: "", owner: "", branch: "", full_name: ""},
    workspacePath: "workspace.xml",
    auth: {},
    commitOnSave: false,
    autoCommit: false,
    autoCommitCount: 30,
    autoCommitEvents: []
}

let plugin = {
        manifest: {
            id: pluginID,
            version: "0.1.0"
        }
    },
    userAgent = plugin.manifest.id + "/" + plugin.manifest.version,
    octokit,
    octokitModule,
    gitHubPluginData = {
        experiences: [
            defaultExperienceData
        ],
        version: plugin.manifest.version
    },
    changeStack = [];


function loadPluginData() {
    let loadedData = localStorage.getItem(pluginID);
    console.log("GitHubPlugin - loaded plugin data.");
    if (loadedData != null) {
        loadedData = JSON.parse(loadedData);
        if (!loadedData || !loadedData.version === plugin.manifest.version) {
            console.error("GitHub Plugin: invalid plugin data retrieved from storage.");
        } else {
            gitHubPluginData = loadedData;
        }
    }
}

function storePluginData() {
    let pluginDataString = JSON.stringify(gitHubPluginData);
    localStorage.setItem(pluginID, pluginDataString);
    console.log("GitHubPlugin - stored plugin data.");
}

function getPlaygroundID() {
    const params = new URLSearchParams(window.location.search);
    if (params.has("playgroundId")) {
        return params.get("playgroundId");
    }
    return "";
}

function getPluginDataForPlayground(playgroundId) {
    pluginData = gitHubPluginData.experiences.find(el => el.playgroundId === playgroundId);
    if (!pluginData) {
        pluginData = JSON.parse(JSON.stringify(defaultExperienceData));
        pluginData.playgroundId = playgroundId;
        gitHubPluginData.experiences.push(pluginData);
    }
    return pluginData;
}

function getFormattedWorkspaceXML() {
    const workspace = _Blockly.getMainWorkspace();
    const workspaceDOM = _Blockly.Xml.workspaceToDom(workspace, true);
    const variablesDOM = _Blockly.Xml.variablesToDom(workspace.getAllVariables());
    const variableElements = variablesDOM.getElementsByTagName("variable");
    //clean up corrupted variables
    for (let index = 0; index < variableElements.length; index++) {
        const element = variableElements[index];
        if (!element.getAttributeNode("type") || element.innerHTML.trim().length === 0) {
            variablesDOM.removeChild(element);
        }
    }
    const workspaceVariables = workspaceDOM.getElementsByTagName("variables") // incase there are no variables in the workspace
    if (workspaceVariables.length){
        workspaceDOM.removeChild(workspaceVariables[0]);
    }

    workspaceDOM.insertBefore(variablesDOM, workspaceDOM.firstChild);
    return _Blockly.Xml.domToPrettyText(workspaceDOM);
}

function downloadFile(fileData, fileName) {
    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", fileData);
    linkElement.setAttribute("download", fileName);
    linkElement.style.display = "none";

    document.body.appendChild(linkElement);
    linkElement.click();
    document.body.removeChild(linkElement);
}

function exportWorkspaceXML() {
    const workspaceXML = getFormattedWorkspaceXML();
    const dataUri = `data:application/xml;charset=utf-8,${encodeURIComponent(workspaceXML)}`;
    downloadFile(dataUri, "workspace.xml");
}

function importFormattedXMLFile() {
    if (confirm("WARNING:\nThis will remove all contents from the workspace and load the contents of the specified file.\n\nDo you wish to continue?")) {
        const inputElement = document.createElement("input");
        inputElement.setAttribute("type", "file");
        inputElement.setAttribute("accept", ".json");
        inputElement.style.display = "none";

        inputElement.addEventListener("change", function () {
            if (!inputElement.files || inputElement.files.length === 0) {
                return;
            }

            const fileReader = new FileReader;
            fileReader.onload = function (e) {

                _Blockly.getMainWorkspace().clear();
                try {
                    const loadData = e.target.result;

                    if (!loadFormattedXML(loadData)) {
                        alert("Failed to import workspace!");
                    }
                } catch (e) {
                    alert("Failed to import workspace!");
                }
            }

            fileReader.readAsText(inputElement.files[0]);
        });

        document.body.appendChild(inputElement);
        inputElement.click();
        document.body.removeChild(inputElement);
    }
}

function loadFormattedXML(data) {
    const workspace = _Blockly.getMainWorkspace();

    try {
        _Blockly.Xml.domToWorkspace(_Blockly.Xml.textToDom(data ? data : "<xml />"), workspace);
        return true;
    } catch (e) {
        BF2042Portal.Shared.logError("Failed to load workspace!", e);
    }

    return false;
}

function addSaveBtnObserver() {
    const observer = new MutationObserver(highlightSaveBtn);
    const mutationEvents = {
        childList: true,
        subtree: true
    };

    observer.observe(document.body, mutationEvents);
}

function highlightSaveBtn() {
    let saveBtn = document.querySelector('[aria-label="save button"]');
    if (!saveBtn) {
        //console.log("GitHub Plugin: Could not highlight save-button");
    } else {
        if (getPluginDataForPlayground(getPlaygroundID()).commitOnSave) {
            saveBtn.style.backgroundColor = "#26ffdf";
        } else {
            saveBtn.style.backgroundColor = "";
        }
        saveBtn.onmouseup = saveBtnClicked;
    }
}

function saveBtnClicked(event) {
    if (event.button === 0 && getPluginDataForPlayground(getPlaygroundID()).commitOnSave) {
        gitHubCommit();
    }
}

function addAutoCommitListener() {
    _Blockly.getMainWorkspace().addChangeListener((changeEvent) => {
        let pluginData = getPluginDataForPlayground(getPlaygroundID());
        if (pluginData.autoCommit) {
            if ((changeEvent.type === _Blockly.Events.BLOCK_CHANGE
                    && pluginData.autoCommitEvents.includes("BLOCK_CHANGE"))
                || (changeEvent.type === _Blockly.Events.BLOCK_CREATE
                    && pluginData.autoCommitEvents.includes("BLOCK_CREATE"))
                || (changeEvent.type === _Blockly.Events.BLOCK_DELETE
                    && pluginData.autoCommitEvents.includes("BLOCK_DELETE"))
                || (changeEvent.type === _Blockly.Events.BLOCK_DRAG
                    && pluginData.autoCommitEvents.includes("BLOCK_DRAG"))
                || (changeEvent.type === _Blockly.Events.BLOCK_MOVE
                    && pluginData.autoCommitEvents.includes("BLOCK_MOVE"))
                || (changeEvent.type === _Blockly.Events.COMMENT_CHANGE
                    && pluginData.autoCommitEvents.includes("COMMENT_CHANGE"))
                || (changeEvent.type === _Blockly.Events.COMMENT_CREATE
                    && pluginData.autoCommitEvents.includes("COMMENT_CREATE"))
                || (changeEvent.type === _Blockly.Events.COMMENT_DELETE
                    && pluginData.autoCommitEvents.includes("COMMENT_DELETE"))
                || (changeEvent.type === _Blockly.Events.COMMENT_MOVE
                    && pluginData.autoCommitEvents.includes("COMMENT_MOVE"))
                || (changeEvent.type === _Blockly.Events.VAR_CREATE
                    && pluginData.autoCommitEvents.includes("VAR_CREATE"))
                || (changeEvent.type === _Blockly.Events.VAR_DELETE
                    && pluginData.autoCommitEvents.includes("VAR_DELETE"))
                || (changeEvent.type === _Blockly.Events.VAR_RENAME
                    && pluginData.autoCommitEvents.includes("VAR_RENAME"))
            ) {
                changeStack.push(changeEvent);
                if (changeStack.length >= pluginData.autoCommitCount) {
                    autoCommit();
                }
            }
        }

    })
}

function autoCommit() {
    let commitMessage = "auto-commit from portal website\n\nChanges:";
    changeStack.forEach(element => {
        commitMessage += "\n" + JSON.stringify(element.toJson());
    });
    changeStack = [];
    gitHubCommit(commitMessage);
}

function showLoadingPopup(message) {
    // const styleElement = document.createElement("style");
    // styleElement.setAttribute("type", "text/css");
    $('<style>').load(plugin.getUrl("/resources/loadingPopup.css")).appendTo('head')
    let loaderPopup = document.getElementById("github_loader_popup");
    if (loaderPopup) {
        document.body.removeChild(loaderPopup);
    }
    loaderPopup = document.createElement("div");
    loaderPopup.setAttribute("class", "github_loader_popup");
    loaderPopup.setAttribute("id", "github_loader_popup");
    loaderPopup.innerHTML = `<table><tr><td id="github_loader_popup_status" class="github_plugin_loader"></td><td id="github_loader_popup_text">${message}</td></tr></table>`;
    document.body.appendChild(loaderPopup);
    loaderPopup.style.display = "block";
}

async function initGitHubPlugin() {
    try {
        plugin = BF2042Portal.Plugins.getPlugin(pluginID);
        userAgent = plugin.manifest.id + "/" + plugin.manifest.version;
    } catch (exception) {
        console.error("Couldn't get plugin data:\n", exception);
    }
    showLoadingPopup("Initializing GitHub Plugin...");
    octokitModule = await import("https://cdn.skypack.dev/octokit");
    loadPluginData();
    addSaveBtnObserver();
    highlightSaveBtn();
    addAutoCommitListener();
    hideLoadingPopup();
}


function hideLoadingPopup() {
    let loaderPopup = document.getElementById("github_loader_popup");
    if (loaderPopup) {
        loaderPopup.style.display = "none";
    }
}

function hideSetupDialog() {
    document.getElementById("github_plugin_modal_backdrop").style.display = "none";
}

function onModalClick(event) {
    if (event.target === document.getElementById('github_plugin_modal_backdrop')) {
        hideSetupDialog();
    }
}

function autoCommitChanged() {
    let autoCommitElement = document.getElementById("github_plugin_modal_autocommit");
    if (autoCommitElement) {
        if (!autoCommitElement.checked) {
            document.querySelector("#github_plugin_modal_autocommit_options").style.display = "none";
        } else {
            document.querySelector("#github_plugin_modal_autocommit_options").style.display = "block";
        }
    }
}

function initSetupDialog() {
    document.getElementById("github_plugin_modal_backdrop").addEventListener("click", onModalClick);
    let pluginData = getPluginDataForPlayground(getPlaygroundID());
    document.forms.githubSetup.pat.value = pluginData.personalAccessToken;
    statusIndicatorPat = document.getElementById("status_indicator_pat");
    statusIndicatorPat.innerHTML = "&#8635;";
    statusIndicatorPat.style.color = "#26ffdf";
    statusIndicatorPat.style.cursor = "pointer";
    statusIndicatorPat.addEventListener("click", document.forms.githubSetup.pat.onblur);
    document.forms.githubSetup.repository.value = pluginData.repository.full_name;
    document.forms.githubSetup.repository.innerHTML = '<option value="' + pluginData.repository.owner + ";" + pluginData.repository.name + ";" + pluginData.repository.full_name + '">' + pluginData.repository.full_name + '</option>';
    document.forms.githubSetup.repository.disabled = true;
    document.forms.githubSetup.branch.value = pluginData.repository.branch;
    document.forms.githubSetup.branch.innerHTML = '<option value="' + pluginData.repository.branch + '">' + pluginData.repository.branch + '</option>';
    document.forms.githubSetup.branch.disabled = true;
    document.forms.githubSetup.commitOnSave.checked = pluginData.commitOnSave;
    document.forms.githubSetup.autoCommit.checked = pluginData.autoCommit;
    document.forms.githubSetup.autoCommitCount.value = pluginData.autoCommitCount;
    document.getElementById("BLOCK_ALL").checked = false;
    document.getElementById("COMMENT_ALL").checked = false;
    document.getElementById("VAR_ALL").checked = false;
    document.querySelectorAll(".blockEvent").forEach(element => {
        element.checked = false;
    });
    document.querySelectorAll(".commentEvent").forEach(element => {
        element.checked = false;
    });
    document.querySelectorAll(".varEvent").forEach(element => {
        element.checked = false;
    });
    pluginData.autoCommitEvents.forEach(element => {
        document.getElementById(element).checked = true;
        if (element.startsWith("BLOCK")) {
            document.getElementById("BLOCK_ALL").checked = true;
        } else if (element.startsWith("COMMENT")) {
            document.getElementById("COMMENT_ALL").checked = true;
        } else if (element.startsWith("VAR")) {
            document.getElementById("VAR_ALL").checked = true;
        }
    });
    autoCommitChanged();
}


function toggleChangeEventsDisplay() {
    let autoCommitEventsPanel = document.getElementById('github_plugin_autocommit_events');
    let collapsibleSymbold = document.getElementById('github_plugin_collapsible_symbol');
    if (autoCommitEventsPanel.style.display === "none" || autoCommitEventsPanel.style.display === "") {
        autoCommitEventsPanel.style.display = "block";
        collapsibleSymbold.innerHTML = "&#8722;";
    } else {
        autoCommitEventsPanel.style.display = "none";
        collapsibleSymbold.innerHTML = "&#43;";
    }
}

function showSetupDialog() {
    $('<style>').load(plugin.getUrl("/resources/setupDialog.css")).appendTo('head')
    let modalDialog = document.getElementById("github_plugin_modal_backdrop");
    if (modalDialog) document.body.removeChild(modalDialog)
    $('<div>', {
        class: "github_plugin_modal_backdrop",
        id: "github_plugin_modal_backdrop"
    }).load(plugin.getUrl("/resources/modalDialogInner.html")).appendTo('body')
    initSetupDialog();
    modalDialog.style.display = "block";
}

function setStatusIndicatorLoading(indicatorElement) {
    indicatorElement.innerHTML = "";
    indicatorElement.removeAttribute("class");
    indicatorElement.removeAttribute("style");
    indicatorElement.setAttribute("class", "github_plugin_loader");
    indicatorElement.removeEventListener("click", document.forms.githubSetup.pat.onblur);
}

function setStatusIndicatorFailure(indicatorElement) {
    indicatorElement.innerHTML = "";
    indicatorElement.removeAttribute("class");
    indicatorElement.removeAttribute("style");
    indicatorElement.setAttribute("style", "color:#f00; display: inline-block;");
    indicatorElement.removeEventListener("click", document.forms.githubSetup.pat.onblur);
    indicatorElement.innerHTML = "&cross;";
}

function setStatusIndicatorSuccess(indicatorElement) {
    indicatorElement.innerHTML = "";
    indicatorElement.removeAttribute("class");
    indicatorElement.removeAttribute("style");
    indicatorElement.setAttribute("style", "color:#26ffdf; display: inline-block;");
    indicatorElement.removeEventListener("click", document.forms.githubSetup.pat.onblur);
    indicatorElement.innerHTML = "&check;";
}

function patChanged() {
    let personalAccessToken = document.forms.githubSetup.pat.value;
    if (!personalAccessToken || personalAccessToken.length === 0) {
        return;
    }
    setStatusIndicatorLoading(document.getElementById('status_indicator_pat'));
    octokit = new octokitModule.Octokit({
        auth: personalAccessToken,
        userAgent: userAgent
    });

    octokit.rest.users.getAuthenticated().then((authResult) => {
        console.log(JSON.stringify(authResult));
        console.log("Logged in to GitHub: %s", authResult.data.login);
        document.forms.githubSetup.user.value = authResult.data.login;
        setStatusIndicatorSuccess(document.getElementById('status_indicator_pat'));
        getRepos();
    }).catch((exc) => {
        console.error(exc);
        setStatusIndicatorFailure(document.getElementById('status_indicator_pat'));
    });
}

function getRepos() {
    setStatusIndicatorLoading(document.getElementById('status_indicator_repository'));
    let apiEndPoint = '/user/repos';

    if(!document.getElementById("list_org_repo").checked) {
        apiEndPoint += "?affiliation=owner"
    }
    octokit.request(`GET ${apiEndPoint}`, {}).then((repoResult) => {
        setStatusIndicatorSuccess(document.getElementById('status_indicator_repository'));
        document.forms.githubSetup.repository.innerHTML = "";
        let repoOption = document.createElement("option");
        repoOption.setAttribute("value", "select");
        repoOption.innerHTML = "Please select...";
        document.forms.githubSetup.repository.appendChild(repoOption);
        repoResult.data.forEach((repo) => {
            repoOption = document.createElement("option");
            repoOption.setAttribute("value", repo.owner.login + ";" + repo.name + ";" + repo.full_name);
            repoOption.innerHTML = repo.full_name;
            document.forms.githubSetup.repository.appendChild(repoOption);
        });
        document.forms.githubSetup.repository.disabled = false;
        document.forms.githubSetup.repository.addEventListener("change", getBranches);
    }).catch((exc) => {
        setStatusIndicatorFailure(document.getElementById('status_indicator_repository'));
    });
}

function getBranches() {
    setStatusIndicatorLoading(document.getElementById('status_indicator_branch'));
    octokit.request('GET /repos/{owner}/{repo}/branches', {
        owner: document.forms.githubSetup.repository.value.split(";", 1)[0],
        repo: document.forms.githubSetup.repository.value.split(";", 2)[1]
    }).then((branchResult) => {
        setStatusIndicatorSuccess(document.getElementById('status_indicator_branch'));
        document.forms.githubSetup.branch.innerHTML = "";
        let branchOption = document.createElement("option");
        branchOption.setAttribute("value", "select");
        branchOption.innerHTML = "Please select...";
        document.forms.githubSetup.branch.appendChild(branchOption);
        branchResult.data.forEach((branch) => {
            branchOption = document.createElement("option");
            branchOption.setAttribute("value", branch.name);
            branchOption.innerHTML = branch.name;
            document.forms.githubSetup.branch.appendChild(branchOption);
        });
        document.forms.githubSetup.branch.disabled = false;

    }).catch((exc) => {
        console.error(exc);
        setStatusIndicatorFailure(document.getElementById('status_indicator_branch'));
    });
}

function isSetupDataValid() {
    let githubSetup = document.forms.githubSetup;
    if (!githubSetup.pat.value || !githubSetup.pat.value.length > 0) {
        return false;
    }
    if (githubSetup.repository.value && githubSetup.repository.value.length > 0) {
        let repoDetails = githubSetup.repository.value.split(";");
        if (!(repoDetails.length === 3)) {
            return false;
        }
    } else {
        return false;
    }
    if (!githubSetup.branch.value || !githubSetup.branch.value.length > 0 || githubSetup.branch.value === "select") {
        return false;
    }
    return true;
}

function setupDialogConfirmed() {
    if (isSetupDataValid()) {
        let githubSetup = document.forms.githubSetup;
        let pluginData = getPluginDataForPlayground(getPlaygroundID());
        pluginData.personalAccessToken = githubSetup.pat.value;
        let repoDetails = githubSetup.repository.value.split(";", 3);
        pluginData.repository.owner = repoDetails[0];
        pluginData.repository.name = repoDetails[1];
        pluginData.repository.full_name = repoDetails[2];
        pluginData.repository.branch = githubSetup.branch.value;
        pluginData.commitOnSave = githubSetup.commitOnSave.checked;
        pluginData.autoCommit = githubSetup.autoCommit.checked;
        if (pluginData.autoCommit) {
            pluginData.autoCommitCount = githubSetup.autoCommitCount.value;
            pluginData.autoCommitEvents = [];
            document.querySelectorAll(".blockEvent").forEach(element => {
                if (element.checked) {
                    pluginData.autoCommitEvents.push(element.value);
                }
            });
            document.querySelectorAll(".commentEvent").forEach(element => {
                if (element.checked) {
                    pluginData.autoCommitEvents.push(element.value);
                }
            });
            document.querySelectorAll(".varEvent").forEach(element => {
                if (element.checked) {
                    pluginData.autoCommitEvents.push(element.value);
                }
            });
        }
        storePluginData();
        hideSetupDialog();
        highlightSaveBtn();
    } else {
        alert("Setup data is missing or incorrect.");
    }


}

function toggleBlockEvents() {
    const toggle = document.getElementById("BLOCK_ALL");
    document.querySelectorAll(".blockEvent").forEach((blockEvent) => {
        blockEvent.checked = toggle.checked;
    });
}

function toggleCommentEvents() {
    const toggle = document.getElementById("COMMENT_ALL");
    document.querySelectorAll(".commentEvent").forEach((blockEvent) => {
        blockEvent.checked = toggle.checked;
    });
}

function toggleVarEvents() {
    const toggle = document.getElementById("VAR_ALL");
    document.querySelectorAll(".varEvent").forEach((blockEvent) => {
        blockEvent.checked = toggle.checked;
    });
}

function gitHubPull() {
    if (isRepoDefined()) {
        let pluginDataForPlayground = getPluginDataForPlayground(getPlaygroundID());
        if (confirm("Do you really want to reset this workspace to the latest commit of '" + pluginDataForPlayground.repository.name + "' on branch '" + pluginDataForPlayground.repository.branch + "'?")) {
            try {
                octokit = new octokitModule.Octokit({
                    auth: pluginDataForPlayground.personalAccessToken,
                    userAgent: userAgent
                });
                octokit.rest.repos.getContent({
                    mediaType: {
                        format: "raw",
                    },
                    owner: pluginDataForPlayground.repository.owner,
                    repo: pluginDataForPlayground.repository.name,
                    path: pluginDataForPlayground.workspacePath,
                    ref: pluginDataForPlayground.repository.branch
                }).then((workspaceResult) => {
                    console.log(JSON.stringify(workspaceResult));
                    _Blockly.getMainWorkspace().clear();
                    if (!loadFormattedXML(workspaceResult.data)) {
                        alert("Failed to import workspace!");
                    }
                }).catch((exc) => {
                    console.error(exc);
                    alert("Failed to load latest workspace!");
                });
            } catch (e) {
                console.error(e);
                alert("Failed to import workspace!");
            }
        }
    }
}

function gitHubCommit(commitMessage) {
    // todo: only do commit when there is an actual change in the editor
    if (isRepoDefined()) {
        if (!commitMessage) {
            commitMessage = prompt("Enter commit message:");
        } else {
            showLoadingPopup("Committing...");
            if (commitMessage.trim() === "") {
                commitMessage = "auto-commit from portal website\n\nChanges:";
                _Blockly.getMainWorkspace().getUndoStack().forEach(element => {
                    commitMessage += "\n" + JSON.stringify(element.toJson());
                });
            }
            let pluginDataForPlayground = getPluginDataForPlayground(getPlaygroundID());

            let contentString = btoa(getFormattedWorkspaceXML());

            octokit = new octokitModule.Octokit({
                auth: pluginDataForPlayground.personalAccessToken,
                userAgent: userAgent
            });

            octokit.rest.repos.getContent({
                owner: pluginDataForPlayground.repository.owner,
                repo: pluginDataForPlayground.repository.name,
                ref: pluginDataForPlayground.repository.branch
            }).then((result) => {
                console.log(JSON.stringify(result));
                let workspaceFile = null;
                result.data.forEach(element => {
                    if (element.path === pluginDataForPlayground.workspacePath && element.type === "file") {
                        workspaceFile = element;
                    }
                });
                if (workspaceFile) {
                    octokit.rest.repos.createOrUpdateFileContents({
                        owner: pluginDataForPlayground.repository.owner,
                        repo: pluginDataForPlayground.repository.name,
                        path: pluginDataForPlayground.workspacePath,
                        branch: pluginDataForPlayground.repository.branch,
                        message: commitMessage,
                        content: contentString,
                        sha: workspaceFile.sha
                    }).then((result1) => {
                        let updateResultText = JSON.stringify(result1);
                        console.log("Commit Result: " + updateResultText);
                        //alert("Commited: " + result1.data.commit.sha);
                        showLoadingPopup("Commited: " + result1.data.commit.sha);
                        setTimeout(hideLoadingPopup, 1500);
                    }).catch((exc) => {
                        console.error(exc);
                        alert("Failed to commit!\n" + JSON.stringify(exc));
                        setTimeout(hideLoadingPopup, 1500);
                    });
                } else {
                    octokit.rest.repos.createOrUpdateFileContents({
                        owner: pluginDataForPlayground.repository.owner,
                        repo: pluginDataForPlayground.repository.name,
                        path: pluginDataForPlayground.workspacePath,
                        branch: pluginDataForPlayground.repository.branch,
                        message: commitMessage,
                        content: contentString
                    }).then((result1) => {
                        let updateResultText = JSON.stringify(result1);
                        console.log("Update Result: " + updateResultText);
                        //alert("Commited: " + result1.data.commit.sha);
                        showLoadingPopup("Commited: " + result1.data.commit.sha);
                        setTimeout(hideLoadingPopup, 1500);
                    }).catch((exc) => {
                        console.error(exc);
                        alert("Failed to commit!\n" + JSON.stringify(exc));
                        setTimeout(hideLoadingPopup, 1500);
                    });
                }
            }).catch((e) => {
                console.error(e);
                alert("Failed to commit!\n" + JSON.stringify(e));
                setTimeout(hideLoadingPopup, 1500);
            });
        }
    }
}

function isRepoDefined() {
    let pluginData = getPluginDataForPlayground(getPlaygroundID());
    if (!pluginData.repository.owner) {
        return false;
    }
    return true;
}

function gitHubExportItem() {
    const gitHubSetupItem = {
        displayText: 'Export formatted XML',
        preconditionFn: function (scope) {
            return 'enabled';
        },
        callback: exportWorkspaceXML,
        scopeType: _Blockly.ContextMenuRegistry.ScopeType.WORKSPACE,
        id: 'gitHubExportItem',
        weight: 180
    }
    return gitHubSetupItem;
}

function gitHubImportItem() {
    const gitHubSetupItem = {
        displayText: 'Import formatted XML',
        preconditionFn: function (scope) {
            return 'enabled';
        },
        callback: importFormattedXMLFile,
        scopeType: _Blockly.ContextMenuRegistry.ScopeType.WORKSPACE,
        id: 'gitHubImportItem',
        weight: 181
    }
    return gitHubSetupItem;
}

function gitHubSetupItem() {
    const gitHubSetupItem = {
        displayText: 'GitHub Setup',
        preconditionFn: function (scope) {
            return 'enabled';
        },
        callback: showSetupDialog,
        scopeType: _Blockly.ContextMenuRegistry.ScopeType.WORKSPACE,
        id: 'gitHubSetupItem',
        weight: 182
    }
    return gitHubSetupItem;
}

function gitHubPullItem() {
    const gitHubPullItem = {
        displayText: 'GitHub Pull',
        preconditionFn: function (scope) {
            if (isRepoDefined()) {
                return 'enabled';
            }
            return 'disabled';
        },
        callback: gitHubPull,
        scopeType: _Blockly.ContextMenuRegistry.ScopeType.WORKSPACE,
        id: 'gitHubPullItem',
        weight: 183
    }

    return gitHubPullItem;
}

function gitHubCommitItem() {
    const gitHubCommitItem = {
        displayText: 'GitHub Commit+Push',
        preconditionFn: function (scope) {
            if (isRepoDefined()) {
                return 'enabled';
            }
            return 'disabled';
        },
        callback: function () {
            gitHubCommit(null);
        },
        scopeType: _Blockly.ContextMenuRegistry.ScopeType.WORKSPACE,
        id: 'gitHubCommitItem',
        weight: 184
    }
    return gitHubCommitItem;
}
