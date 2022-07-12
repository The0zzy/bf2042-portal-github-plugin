const pluginID = "bf2042-portal-github-plugin";
let plugin = {
  manifest: {
    id: pluginID,
    version: "0.0.2"
  }
};
let userAgent = plugin.manifest.id + "/" + plugin.manifest.version;
let octokit;
let gitHubPluginData = {
  experiences: [
    {
      playgroundId: "",
      personalAccessToken: "",
      repositoryName: "",
      branch: "",
      workspacePath: "workspace.xml",
      auth: {},
      commitOnSave: true,
      autoCommit: true,
      autoCommitCount: 25,
      autoCommitEvents: []
    }
  ],
  version: plugin.manifest.version
}

function loadPluginData() {
  let loadedData = localStorage.getItem(pluginID);
  console.log("GitHubPlugin - loaded plugin data.");
  if (loadedData != null) {
    loadedData = JSON.parse(loadedData);
    if (!loadedData || !loadedData.version == plugin.manifest.version) {
      console.error("GitHub Plugin: invalid plugin data retrieved from storage.");
    } else {
      gitHubPluginData = loadedData;
    }
  }
}

function storePluginData() {
  let pluginDataString = JSON.stringify(gitHubPluginData);
  localStorage.setItem(pluginID, pluginDataString);
  console.log("GitHubPlugin - storing plugin data.");
}

function getPlaygroundID() {
  const params = new URLSearchParams(window.location.search);
  if (params.has("playgroundId")) {
    return params.get("playgroundId");
  }
  return "";
}

function getPluginDataForPlayground(playgroundId) {
  return gitHubPluginData.experiences.find(el => el.playgroundId == playgroundId);
}

function getFormattedWorkspaceXML() {
  const workspace = _Blockly.getMainWorkspace();
  const workspaceDOM = _Blockly.Xml.workspaceToDom(workspace, true);
  const variablesDOM = _Blockly.Xml.variablesToDom(workspace.getAllVariables());
  const variableElements = variablesDOM.getElementsByTagName("variable");
  //clean up corrupted variables
  for (let index = 0; index < variableElements.length; index++) {
    const element = variableElements[index];
    if (!element.getAttributeNode("type") || element.innerHTML.trim().length == 0) {
      variablesDOM.removeChild(element);
    }
  }
  workspaceDOM.removeChild(workspaceDOM.getElementsByTagName("variables")[0]);
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
    if (gitHubPluginData.commitOnSave) {
      saveBtn.style.backgroundColor = "#26ffdf";
    } else {
      saveBtn.style.backgroundColor = "";
    }
    saveBtn.onmouseup = saveBtnClicked;
  }
}

function saveBtnClicked(event) {
  if (event.button == 0 && gitHubPluginData.commitOnSave) {
    gitHubCommit();
  }
}

async function initGitHubPlugin() {
  try {
    plugin = BF2042Portal.Plugins.getPlugin(pluginID);
    userAgent = plugin.manifest.id + "/" + plugin.manifest.version;
  } catch (exception) {
    console.error("Couldn't get plugin data:\n", exception);
  }
  octokitModule = await import("https://cdn.skypack.dev/octokit");
  loadPluginData();
  addSaveBtnObserver();
  highlightSaveBtn();
}

function askForRepoSetup() {
  if (confirm("You have not setup a repository for this experience - would you like to do so now?")) {
    setupRepository();
  }
}

function toggleElementDisplay(elementId) {
  let element = document.getElementById('elementId');
  if (element.style.display == "none" || element.style.display == "") {
    element.style.display = "block";
  } else {
    element.style.display = "none";
  }
}

function showElement(elementId) {
  let element = document.getElementById('elementId');
  element.style.display = "block";
}

function hideElement(elementId) {
  let element = document.getElementById('elementId');
  element.style.display = "none";
}

function showDialogSimple() {
  document.getElementById("github_plugin_modal").style.display = "block";
}
function hideDialog() {
  document.getElementById("github_plugin_modal").style.display = "none";
}
function onModalClick(event) {
  if (event.target == document.getElementById('github_plugin_modal_backdrop')) {
    hideDialog();
  }
}

function autoCommitChange(autoCommitElement) {
  if (!autoCommitElement.checked) {
    document.querySelectorAll("#github_plugin_autocommit_options input").forEach((element) => { element.disabled = true });
    document.querySelectorAll("#github_plugin_autocommit_options select").forEach((element) => { element.disabled = true });
  } else {
    document.querySelectorAll("#github_plugin_autocommit_options input").forEach((element) => { element.disabled = false });
    document.querySelectorAll("#github_plugin_autocommit_options select").forEach((element) => { element.disabled = false });
  }
}

function initDialog() {
  document.getElementById("github_plugin_modal_backdrop").addEventListener("click", onModalClick);
}

function toggleChangeEventsDisplay() {
  let autoCommitEventsPanel = document.getElementById('github_plugin_autocommit_events');
  let collapsibleSymbold = document.getElementById('github_plugin_collapsible_symbol');
  if (autoCommitEventsPanel.style.display == "none" || autoCommitEventsPanel.style.display == "") {
    autoCommitEventsPanel.style.display = "block";
    collapsibleSymbold.innerHTML = "&#8722;";
  } else {
    autoCommitEventsPanel.style.display = "none";
    collapsibleSymbold.innerHTML = "&#43;";
  }
}

function showSetupDialog() {
  const styleElement = document.createElement("style");
  styleElement.setAttribute("type", "text/css");
  styleElement.innerHTML = ``;
  document.head.appendChild(styleElement);
  const modalDialog = document.createElement("div");
  modalDialog.setAttribute("class", "github_plugin_modal_backdrop");
  modalDialog.setAttribute("id", "github_plugin_modal_backdrop");
  modalDialog.innerHTML = ``;
  document.body.appendChild(modalDialog);
  initDialog();
  modalDialog.style.display = "block";
}

function hideDialog() {
  let dialog = document.getElementById('github_plugin_modal_backdrop');
  dialog.style.display = "none";
  document.body.removeChild(dialog);
}

function setStatusIndicatorLoading(indicatorElement){
  indicatorElement.innerHTML = "";
  indicatorElement.removeAttribute("class");
  indicatorElement.removeAttribute("style");
  indicatorElement.setAttribute("class", "github_plugin_loader");
}

function setStatusIndicatorFailure(indicatorElement){
  indicatorElement.innerHTML = "";
  indicatorElement.removeAttribute("class");
  indicatorElement.removeAttribute("style");
  indicatorElement.setAttribute("class", "github_plugin_loader");
}

function setStatusIndicatorSuccess(indicatorElement){
  indicatorElement.innerHTML = "";
  indicatorElement.removeAttribute("class");
  indicatorElement.removeAttribute("style");
  indicatorElement.setAttribute("style", "color:#26ffdf; display: inline-block;");
  indicatorElement.innerHTML = "&#10004;";
}

function patChanged(personalAccessToken) {
  if (!personalAccessToken || personalAccessToken.length == 0) {
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
  octokit.request('GET /user/repos', {}).then((repoResult) => {
    setStatusIndicatorSuccess(document.getElementById('status_indicator_repository'));
    document.forms.githubSetup.repository.innerHTML = "";
    let repoOption = document.createElement("option");
    repoOption.setAttribute("value", "selection");
    repoOption.innerHTML = "Please select...";
    document.forms.githubSetup.repository.appendChild(repoOption);
    repoResult.data.forEach((repo) => {
      repoOption = document.createElement("option");
      repoOption.setAttribute("value", repo.name);
      repoOption.innerHTML = repo.name;
      document.forms.githubSetup.repository.appendChild(repoOption);
    });
    document.forms.githubSetup.repository.disabled = false;
    document.forms.githubSetup.repository.addEventListener("change", getBranches);
  }).catch((exc) => {
    setStatusIndicatorFailure(document.getElementById('status_indicator_repository'));
  });
}

function getBranches(){
  setStatusIndicatorLoading(document.getElementById('status_indicator_branch'));
  octokit.request('GET /repos/{owner}/{repo}/branches', {
    owner: document.forms.githubSetup.user.value,
    repo: document.forms.githubSetup.repository.value
  }).then((branchResult)=>{
    setStatusIndicatorSuccess(document.getElementById('status_indicator_branch'));
    document.forms.githubSetup.branch.innerHTML = "";
    let branchOption = document.createElement("option");
    branchOption.setAttribute("value", "selection");
    branchOption.innerHTML = "Please select...";
    document.forms.githubSetup.branch.appendChild(branchOption);
    branchResult.data.forEach((branch) => {
      branchOption = document.createElement("option");
      branchOption.setAttribute("value", branch.name);
      branchOption.innerHTML = branch.name;
      document.forms.githubSetup.branch.appendChild(branchOption);
    });
    document.forms.githubSetup.branch.disabled = false;
    
  }).catch((exc)=>{
    console.error(exc);
    setStatusIndicatorFailure(document.getElementById('status_indicator_branch'));
  });
}

function setupDialogConfirmed() {
  let githubSetup = document.forms.githubSetup;
  let pluginData = getPluginDataForPlayground(getPlaygroundID());
  pluginData.personalAccessToken = githubSetup.pat.value;
  pluginData.repositoryName = githubSetup.repository.value;
  pluginData.branch = githubSetup.branch.value;
  pluginData.commitOnSave = githubSetup.commitOnSave.checked;
  pluginData.autoCommit = githubSetup.autoCommit.checked;
  pluginData.autoCommitCount = githubSetup.autoCommitCount.value;
  storePluginData();
  hideDialog();
  highlightSaveBtn();
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

function setupRepository() {
  let personalAccessToken;
  while (!personalAccessToken) {
    personalAccessToken = prompt("Please enter your GitHub personal access token:");
  }

  let repository;
  while (!repository) {
    repository = prompt("Please enter the repository name to be used:");
  }

  octokit = new octokitModule.Octokit({
    auth: personalAccessToken,
    userAgent: userAgent
  });

  octokit.rest.users.getAuthenticated().then((authResult) => {
    console.log(JSON.stringify(authResult));
    console.log("Logged in to GitHub: %s", authResult.data.login);
    alert("Logged in to GitHub: " + authResult.data.login);

    let playgroundId = getPlaygroundID();
    let pluginDataForPlayground = getPluginDataForPlayground(playgroundId);
    if (!pluginDataForPlayground) {
      gitHubPluginData.experiences.push({
        playgroundId: playgroundId,
        auth: authResult.data,
        personalAccessToken: personalAccessToken,
        repositoryName: repository,
        workspacePath: "workspace.xml"
      });
    } else {
      pluginDataForPlayground.auth = authResult.data;
      pluginDataForPlayground.personalAccessToken = personalAccessToken;
      pluginDataForPlayground.repositoryName = repository;
    }
    storePluginData();
  }).catch((exc) => {
    console.error(exc);
    alert("Failed to setup Repository!");
  });
}

function gitHubPull() {
  if (!isRepoDefined()) {
    askForRepoSetup();
  }
  if (isRepoDefined()) {
    let pluginDataForPlayground = getPluginDataForPlayground(getPlaygroundID());
    if (confirm("Do you really want to reset this workspace to the latest commit of '" + pluginDataForPlayground.repositoryName + "'?")) {
      try {
        octokit = new octokitModule.Octokit({
          auth: pluginDataForPlayground.personalAccessToken,
          userAgent: userAgent
        });
        octokit.rest.repos.getContent({
          mediaType: {
            format: "raw",
          },
          owner: pluginDataForPlayground.auth.login,
          repo: pluginDataForPlayground.repositoryName,
          path: pluginDataForPlayground.workspacePath,
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
      }
      catch (e) {
        console.error(e);
        alert("Failed to import workspace!");
      }
    }
  }
}

function gitHubCommit() {
  if (!isRepoDefined()) {
    askForRepoSetup();
  }
  if (isRepoDefined()) {
    let commitMessage = prompt("Enter commit message:");
    if (commitMessage === null) {
      return;
    } else {
      if (commitMessage.trim() == "") {
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
        mediaType: {
          format: "object",
        },
        owner: pluginDataForPlayground.auth.login,
        repo: pluginDataForPlayground.repositoryName
      }).then((result) => {
        console.log(JSON.stringify(result));
        let workspaceFile = result.data.entries.find((entry) => entry.path == pluginDataForPlayground.workspacePath);
        if (workspaceFile) {
          octokit.rest.repos.createOrUpdateFileContents({
            owner: pluginDataForPlayground.auth.login,
            repo: pluginDataForPlayground.repositoryName,
            path: pluginDataForPlayground.workspacePath,
            message: commitMessage,
            content: contentString,
            sha: workspaceFile.sha
          }).then((result1) => {
            let updateResultText = JSON.stringify(result1);
            console.log("Update Result: " + updateResultText);
            alert("Commited: " + result1.data.commit.sha);
          }).catch((exc) => {
            console.error(exc);
            alert("Failed to commit!\n" + JSON.stringify(exc));
          });
        } else {
          octokit.rest.repos.createOrUpdateFileContents({
            owner: pluginDataForPlayground.auth.login,
            repo: pluginDataForPlayground.repositoryName,
            path: pluginDataForPlayground.workspacePath,
            message: commitMessage,
            content: contentString
          }).then((result1) => {
            let updateResultText = JSON.stringify(result1);
            console.log("Update Result: " + updateResultText);
            alert("Commited: " + result1.data.commit.sha);
          }).catch((exc) => {
            console.error(exc);
            alert("Failed to commit!\n" + JSON.stringify(exc));
          });
        }
      }).catch((e) => {
        console.error(e);
        alert("Failed to commit!\n" + JSON.stringify(e));
      });
    }
  }
}

function isRepoDefined() {
  if (!getPluginDataForPlayground(getPlaygroundID())) {
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
    callback: setupRepository,
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
    callback: setupRepository,
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
    callback: gitHubCommit,
    scopeType: _Blockly.ContextMenuRegistry.ScopeType.WORKSPACE,
    id: 'gitHubCommitItem',
    weight: 184
  }
  return gitHubCommitItem;
}


initGitHubPlugin().then((result) => {
  try {
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