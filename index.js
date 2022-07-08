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
      workspacePath: "workspace.xml",
      auth: {},
      commitOnSave: true,
      autoCommit: true,
      autoCommitChanges: 25,
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
    if (!loadedData || !loadedData.experiences[0].playgroundId == "") {
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
    saveBtn.style.backgroundColor = "red";
    saveBtn.onmouseup = saveBtnClicked;
  }
}

function saveBtnClicked(event) {
  if (event.button == 0) {
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
  document.getElementById("github-plugin-modal").style.display = "block";
}
function hideDialog() {
  document.getElementById("github-plugin-modal").style.display = "none";
}
function onModalClick(event) {
  if (event.target == document.getElementById('github-plugin-modal')) {
    hideDialog();
  }
}

function autoCommitChange(autoCommitElement) {
  if (!autoCommitElement.checked) {
    document.querySelectorAll("#github-plugin-autocommit-options input").forEach((element) => { element.disabled = true });
    document.querySelectorAll("#github-plugin-autocommit-options select").forEach((element) => { element.disabled = true });
  } else {
    document.querySelectorAll("#github-plugin-autocommit-options input").forEach((element) => { element.disabled = false });
    document.querySelectorAll("#github-plugin-autocommit-options select").forEach((element) => { element.disabled = false });
  }
}

function initDialog() {
  document.getElementById("github-plugin-modal").addEventListener("click", onModalClick);
}

function toggleChangeEventsDisplay() {
  let autoCommitEventsPanel = document.getElementById('github-plugin-autocommit-events');
  let collapsibleSymbold = document.getElementById('github-plugin-collapsible-symbol');
  if (autoCommitEventsPanel.style.display == "none" || autoCommitEventsPanel.style.display == "") {
    autoCommitEventsPanel.style.display = "block";
    collapsibleSymbold.innerHTML = "&#8722;";
  } else {
    autoCommitEventsPanel.style.display = "none";
    collapsibleSymbold.innerHTML = "&#43;";
  }
}


function showDialog() {
  const styleElement = document.createElement("style");
  styleElement.setAttribute("type", "text/css");
  styleElement.innerHTML = `
  .github-plugin-modal {
    display: none;
    position: fixed;
    z-index: 1;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    overflow: auto;
    background-color: rgb(0, 0, 0);
    background-color: rgba(0, 0, 0, 0.4);
}

.github-plugin-modal-content {
    background-color: #424242;
    color: #fff;
    margin: 15% auto;
    /*width: 80%;*/
    width: 400px;
}

.github-plugin-modal-content-pane {
    padding: 10px;
    font-size: 16px;
    color: #fff;
    font-family: "Arial";
    line-height: 36px;
}

#github-plugin-autocommit-options {
    padding-left: 25px;
}

#github-plugin-modal-autocommit-changes {
    width: 60px;
}

#github-plugin-collapsible-events {
    cursor: pointer;
}

#github-plugin-autocommit-events {
    display: none;
    line-height: normal;
}

label {
    color: #fff;
}

ul,
li {
    margin-top: 0px;
    list-style: none;
}

.github-plugin-modal-button-pane {
    padding: 10px;
    text-align: center;
}

.github-plugin-modal-button {
    cursor: pointer;
    text-align: center;
    vertical-align: baseline;
    min-width: 164px;
    line-height: 36px;
    padding: 3px 10px;
    text-transform: uppercase;
    color: #fff;
    background-color: #999;
    border-radius: 0;
    border: none;
    box-sizing: border-box;
    font-family: "BF_Modernista-Regular, Arial";
    font-weight: bold;
    font-size: 18px;
}

.github-plugin-modal-button:hover {
    color: #000;
    background-color: #26ffdf;
}

.github-plugin-modal-button:active {
    color: #fff;
    background-color: #26ffdf;
}

.github-plugin-modal-header {
    background-color: #26ffdf;
    color: #000;
    padding: 10px;
}

.github-plugin-modal-title {
    background-color: #26ffdf;
    color: #000;
    text-transform: uppercase;
    font-family: "BF_Modernista-Regular, Arial";
    font-weight: bold;
    font-size: 20px;
}

.github-plugin-modal-close {
    color: #000;
    float: right;
    font-size: 20px;
    font-weight: bold;
}

.github-plugin-modal-close:hover,
.github-plugin-modal-close:focus {
    color: #fff;
    text-decoration: none;
    cursor: pointer;
}

.github-plugin-loader {
    display: inline-block;
    border: 6px solid #999;
    border-radius: 50%;
    border-top: 6px solid #26ffdf;
    width: 10px;
    height: 10px;
    animation: github-plugin-spinner 1s linear infinite;
}

@keyframes github-plugin-spinner {
    0% {
        transform: rotate(0deg);
    }

    100% {
        transform: rotate(360deg);
    }
}
        `;
  document.head.appendChild(styleElement);
  const modalDialog = document.createElement("div");
  modalDialog.setAttribute("class", "github-plugin-modal");
  modalDialog.setAttribute("id", "github-plugin-modal");
  modalDialog.innerHTML = `
  <div class="github-plugin-modal-content">
            <div class="github-plugin-modal-header">
                <span class="github-plugin-modal-title">GitHub Setup</span>
                <span class="github-plugin-modal-close" onclick="hideDialog()">X</span>
            </div>
            <div class="github-plugin-modal-content-pane">
                <table>
                    <tr>
                        <td>
                            <label for="githubPAT">Personal Access Token</label>
                        </td>
                        <td>
                            <input type="password" id="githubPAT" placeholder="Personal Access Token" />
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <label for="github-plugin-modal-repository">Repository Name</label>
                        </td>
                        <td>
                            <select id="github-plugin-modal-repository" disabled>
                                <option value="select">Please select...</option>
                                <option value="repo-number-one">repo-number-one</option>
                                <option value="repo-number-two">repo-number-two</option>
                            </select>
                            <div id="github-plugin-modal-loader-repositories" class="github-plugin-loader"></div>
                        </td>
                    </tr>
                    <tr>
                        <td><label for="github-plugin-modal-branch">Branch</label></td>
                        <td>
                            <select id="github-plugin-modal-branch" disabled>
                                <option value="main">main</option>
                                <option value="master">master</option>
                            </select>
                            <div id="github-plugin-modal-loader-branches" class="github-plugin-loader"></div>
                        </td>
                    </tr>
                </table>

                <input type="checkbox" id="githubCommitOnSave" checked="true" />
                <label for="githubCommitOnSave">Commit on Save</label>
                <br/>
                <input type="checkbox" id="githubAutoCommit" onchange="autoCommitChange(this)" checked="true" />
                <label for="githubAutoCommit">Auto-Commit</label>
                <br />
                <div id="github-plugin-autocommit-options">
                    <label for="githubAutoCommitCount">Commit after</label>
                    <input type="number" value="25" size="4" maxlength="4" min="1" max="9999"
                        id="github-plugin-modal-autocommit-changes" /> changes
                    <br />
                    <span id="github-plugin-collapsible-events" onclick="toggleChangeEventsDisplay()">
                        <b id="github-plugin-collapsible-symbol">&#43;</b> Changes to consider
                    </span>
                    <br />
                    <div id="github-plugin-autocommit-events">
                        <input type="checkbox" id="BLOCK_ALL" value="BLOCK_ALL" checked />
                        <label for="BLOCK_ALL">Blocks</label>
                        <ul>
                            <li>
                                <input type="checkbox" id="BLOCK_CHANGE" value="BLOCK_CHANGE" checked />
                                <label for="BLOCK_CHANGE">Change</label>
                            </li>
                            <li>
                                <input type="checkbox" id="BLOCK_CREATE" value="BLOCK_CREATE" checked />
                                <label for="BLOCK_CREATE">Create</label>
                            </li>
                            <li>
                                <input type="checkbox" id="BLOCK_DELETE" value="BLOCK_DELETE" checked />
                                <label for="BLOCK_DELETE">Delete</label>
                            </li>
                            <li>
                                <input type="checkbox" id="BLOCK_DRAG" value="BLOCK_DRAG" checked />
                                <label for="BLOCK_DRAG">Drag</label>
                            </li>
                            <li>
                                <input type="checkbox" id="BLOCK_MOVE" value="BLOCK_MOVE" checked />
                                <label for="BLOCK_MOVE">Move</label>
                            </li>
                        </ul>
                        <input type="checkbox" id="COMMENT_ALL" value="COMMENT_ALL" checked />
                        <label for="COMMENT_ALL">Comments</label>
                        <ul>
                            <li>
                                <input type="checkbox" id="COMMENT_CHANGE" value="COMMENT_CHANGE" checked />
                                <label for="COMMENT_CHANGE">Change</label>
                            </li>
                            <li>
                                <input type="checkbox" id="COMMENT_CREATE" value="COMMENT_CREATE" checked />
                                <label for="COMMENT_CREATE">Create</label>
                            </li>
                            <li>
                                <input type="checkbox" id="COMMENT_DELETE" value="COMMENT_DELETE" checked />
                                <label for="COMMENT_DELETE">Delete</label>
                            </li>
                            <li>
                                <input type="checkbox" id="COMMENT_MOVE" value="COMMENT_MOVE" checked />
                                <label for="COMMENT_MOVE">Move</label>
                            </li>
                        </ul>
                        <input type="checkbox" id="VAR_ALL" value="VAR_ALL" checked />
                        <label for="VAR_ALL">Variables</label>
                        <ul>
                            <li>
                                <input type="checkbox" id="VAR_CREATE" value="VAR_CREATE" checked />
                                <label for="VAR_CREATE">Create</label>
                            </li>
                            <li>
                                <input type="checkbox" id="VAR_DELETE" value="VAR_DELETE" checked />
                                <label for="VAR_DELETE">Delete</label>
                            </li>
                            <li>
                                <input type="checkbox" id="VAR_RENAME" value="VAR_RENAME" checked />
                                <label for="VAR_RENAME">Rename</label>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
            <div class="github-plugin-modal-button-pane">
                <input type="button" class="github-plugin-modal-button" value="Cancel" onclick="hideDialog()" />
                <input type="button" class="github-plugin-modal-button" value="Ok" onclick="hideDialog()" />
            </div>
        </div>
  `;
  document.body.appendChild(modalDialog);
  initDialog();
  modalDialog.style.display = "block";
}

function hideDialog() {
  let dialog = document.getElementById('github-plugin-modal');
  dialog.style.display = "none";
  document.body.removeChild(dialog);
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
      const workspaceXML = _Blockly.Xml.domToPrettyText(workspaceDOM);

      let contentString = btoa(workspaceXML);

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

function gitHubSetupItem() {
  const gitHubSetupItem = {
    displayText: 'GitHub Setup',
    preconditionFn: function (scope) {
      return 'enabled';
    },
    callback: setupRepository,
    scopeType: _Blockly.ContextMenuRegistry.ScopeType.WORKSPACE,
    id: 'gitHubSetupItem',
    weight: 180
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
    weight: 181
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
    weight: 182
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