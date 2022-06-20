const pluginID = "bf2042-portal-github-plugin";
const plugin = BF2042Portal.Plugins.getPlugin(pluginID);
const userAgent = plugin.manifest.id + "/v" + plugin.manifest.version;
let octokit;

let gitHubPluginData = {
  experiences: [
    {
      playgroundId: "",
      personalAccessToken: "",
      repositoryName: "",
      workspacePath: "workspace.xml",
      auth: {}
    }
  ]
}

function loadPluginData() {
  let loadedData = localStorage.getItem(pluginID);
  console.log("GitHubPlugin - loaded plugin data: %s", loadedData);
  loadedData = JSON.parse(loadedData);
  if (!loadedData || !loadedData.experiences[0].playgroundId == "") {
    alert("Failed to load local GitHub plugin data!");
  } else {
    gitHubPluginData = loadedData;
  }
}

function storePluginData() {
  let pluginDataString = JSON.stringify(gitHubPluginData);
  localStorage.setItem(pluginID, pluginDataString);
  console.log("GitHubPlugin - storing plugin data: %s", pluginDataString);
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

function bailOut(error) {
  alert("There was an error loading the GitHub Plugin!");
}

function highlightSaveBtn() {
  let saveBtn = document.querySelector('[aria-label="save button"]');
  if (!saveBtn) {
    console.log("GitHub Plugin: Could not highlight save-button");
  } else {
    saveBtn.style.backgroundColor = "red";
    saveBtn.onclick = gitHubCommit;
  }
}

async function initGitHubPlugin() {
  octokitModule = await import("https://cdn.skypack.dev/octokit");
  loadPluginData();
  //_Blockly.getMainWorkspace().addChangeListener(highlightSaveBtn);
  let observer = new MutationObserver(highlightSaveBtn);
  observer.observe(document.querySelector(".action-button-group"), {childList: true});
  highlightSaveBtn();
}

async function setupRepository() {
  let personalAccessToken;
  while (!personalAccessToken || personalAccessToken == "") {
    personalAccessToken = prompt("Please enter your GitHub personal access token:");
  }

  let repository;
  while (!repository || repository == "") {
    repository = prompt("Please enter the repository name to be used:");
  }

  octokit = new octokitModule.Octokit({
    auth: personalAccessToken,
    userAgent: userAgent
  });

  let authResult = await octokit.rest.users.getAuthenticated();
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
    })
  } else {
    pluginDataForPlayground.auth = authResult.data;
    pluginDataForPlayground.personalAccessToken = personalAccessToken;
    pluginDataForPlayground.repositoryName = repository;
  }

  storePluginData();
}

async function gitHubPull() {
  if (!isRepoDefined()) {
    setupRepository();
  }
  let pluginDataForPlayground = getPluginDataForPlayground(getPlaygroundID());
  if (confirm("Do you really want to reset this workspace to the latest commit of '" + pluginDataForPlayground.repositoryName + "'?")) {
    _Blockly.getMainWorkspace().clear();

    try {
      octokit = new octokitModule.Octokit({
        auth: pluginDataForPlayground.personalAccessToken,
        userAgent: userAgent
      });
      let workspaceResult = await octokit.rest.repos.getContent({
        mediaType: {
          format: "raw",
        },
        owner: pluginDataForPlayground.auth.login,
        repo: pluginDataForPlayground.repositoryName,
        path: pluginDataForPlayground.workspacePath,
      });
      console.log(JSON.stringify(workspaceResult));

      if (!load(workspaceResult.data)) {
        alert("Failed to import workspace!");
      }
    }
    catch (e) {
      alert("Failed to import workspace!");
    }
  }
}

async function gitHubCommit() {
  if (!isRepoDefined()) {
    setupRepository();
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

  let commitMessage = prompt("Enter commit message:");
  if (commitMessage && !commitMessage == "") {
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
      if(workspaceFile){
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
          alert("Failed to commit!\n"+JSON.stringify(exc));
        });
      }else{
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
          alert("Failed to commit!\n"+JSON.stringify(exc));
        });
      }
    }).catch((e) => {
      console.error(e);
      alert("Failed to commit!\n"+JSON.stringify(e));
    });
  }
}

function isRepoDefined() {
  if (!getPluginDataForPlayground(getPlaygroundID())) {
    return false;
  }
  return true;
}


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

initGitHubPlugin();
_Blockly.ContextMenuRegistry.registry.register(gitHubSetupItem);
_Blockly.ContextMenuRegistry.registry.register(gitHubPullItem);
_Blockly.ContextMenuRegistry.registry.register(gitHubCommitItem);