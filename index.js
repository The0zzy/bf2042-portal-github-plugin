(function () {
  const pluginId = "bf2042-portal-github-plugin";

  const defaultExperienceData = {
    playgroundId: "",
    personalAccessToken: "",
    repository: { name: "", owner: "", branch: "", full_name: "" },
    workspacePath: "workspace.json",
    auth: {},
    commitOnSave: false,
    autoCommit: false,
    autoCommitCount: 30,
    autoCommitEvents: [],
  };

  const getCircularJsonReplacer = () => {
    const seen = new WeakSet();
    return (key, value) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) {
          return;
        }
        seen.add(value);
      }
      return value;
    };
  };

  const plugin = BF2042Portal.Plugins.getPlugin(pluginId);

  let userAgent = plugin.manifest.id + "/" + plugin.manifest.version,
    octokit,
    octokitModule,
    gitHubPluginData = {
      experiences: [defaultExperienceData],
      version: plugin.manifest.version,
    },
    changeStack = [],
    showLoadingPopupLoaded = false;

  function loadPluginData() {
    let loadedData = localStorage.getItem(pluginId);
    if (loadedData != null) {
      loadedData = JSON.parse(loadedData);
      if (!loadedData || !loadedData.version === plugin.manifest.version) {
        throw "Invalid or outdated plugin data retrieved from storage!";
      } else {
        gitHubPluginData = loadedData;
      }
    }
  }

  function storePluginData() {
    let pluginDataString = JSON.stringify(gitHubPluginData);
    localStorage.setItem(pluginId, pluginDataString);
    logInfo("stored plugin data");
  }

  function getPlaygroundID() {
    const params = new URLSearchParams(window.location.search);
    if (params.has("playgroundId")) {
      return params.get("playgroundId");
    }
    return "";
  }

  function getPluginDataForPlayground(playgroundId) {
    pluginData = gitHubPluginData.experiences.find(
      (el) => el.playgroundId === playgroundId
    );
    if (!pluginData) {
      pluginData = JSON.parse(JSON.stringify(defaultExperienceData));
      pluginData.playgroundId = playgroundId;
      gitHubPluginData.experiences.push(pluginData);
    }
    return pluginData;
  }

  function getFormattedWorkspaceJSON() {
    const workspace = _Blockly.getMainWorkspace();
    const jsonWorkspace = _Blockly.serialization.workspaces.save(workspace);
    return JSON.stringify(jsonWorkspace, null, 2);
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

  function exportWorkspaceJSON() {
    const workspaceXML = getFormattedWorkspaceJSON();
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(
      workspaceXML
    )}`;
    downloadFile(dataUri, "workspace.json");
  }

  function importFormattedXMLFile() {
    if (
      confirm(
        "WARNING:\nThis will remove all contents from the workspace and load the contents of the specified file.\n\nDo you wish to continue?"
      )
    ) {
      const inputElement = document.createElement("input");
      inputElement.setAttribute("type", "file");
      inputElement.setAttribute("accept", ".xml");
      inputElement.style.display = "none";

      inputElement.addEventListener("change", function () {
        if (!inputElement.files || inputElement.files.length === 0) {
          return;
        }

        const fileReader = new FileReader();
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
        };

        fileReader.readAsText(inputElement.files[0]);
      });

      document.body.appendChild(inputElement);
      inputElement.click();
      document.body.removeChild(inputElement);
    }
  }

  function importWorkspaceJSON() {
    if (
      confirm(
        "WARNING:\nThis will remove all contents from the workspace and load the contents of the specified file.\n\nDo you wish to continue?"
      )
    ) {
      const inputElement = document.createElement("input");
      inputElement.setAttribute("type", "file");
      inputElement.setAttribute("accept", ".json");
      inputElement.style.display = "none";

      inputElement.addEventListener("change", function () {
        if (!inputElement.files || inputElement.files.length === 0) {
          return;
        }

        const fileReader = new FileReader();
        fileReader.onload = function (e) {
          _Blockly.getMainWorkspace().clear();
          try {
            const loadData = e.target.result;
            try {
              loadWorkspaceJSON(JSON.parse(loadData));
            } catch (exception) {
              logError("Failed to import workspace!\n", exception);
              alert("Failed to import workspace!\n" + exception);
            }
          } catch (exception) {
            logError("Failed to import workspace!\n", exception);
            alert("Failed to import workspace!\n" + exception);
          }
        };

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
      _Blockly.Xml.domToWorkspace(
        _Blockly.Xml.textToDom(data ? data : "<xml />"),
        workspace
      );
      return true;
    } catch (e) {
      BF2042Portal.Shared.logError("Failed to load workspace!", e);
    }

    return false;
  }

  function loadWorkspaceJSON(workspaceJSON) {
    _Blockly.serialization.workspaces.load(
      workspaceJSON,
      _Blockly.getMainWorkspace()
    );
  }

  function highlightSaveBtn() {
    let saveBtn = document.querySelector('[aria-label="save button"]');
    if (getPluginDataForPlayground(getPlaygroundID()).commitOnSave) {
      saveBtn.style.backgroundColor = "#26ffdf";
    } else {
      saveBtn.style.backgroundColor = "";
    }
    saveBtn.onmouseup = saveBtnClicked;
  }

  function githubSaveBtnClicked(event) {
    if (event.button === 0 && isRepoDefined()) {
      gitHubCommit();
    }
  }

  function saveBtnClicked(event) {
    if (
      event.button === 0 &&
      getPluginDataForPlayground(getPlaygroundID()).commitOnSave
    ) {
      gitHubCommit();
    }
  }

  function onWorkspaceChange(changeEvent) {
    try {
      let saveBtn = document.querySelector('[aria-label="save button"]');
      if (saveBtn) {
        highlightSaveBtn();
      }

      let actionButtons = document.querySelector("div.action-button-group");
      if (actionButtons) {
        let githubSaveButton = document.querySelector("#githubSaveButton");
        if (!githubSaveButton) {
          githubSaveButton = document.createElement("button");
          githubSaveButton.id = "githubSaveButton";
          githubSaveButton.type = "button";
          githubSaveButton.title = "GitHub Commit";
          githubSaveButton.style.width = "40px";
          githubSaveButton.style.height = "40px";
          githubSaveButton.style.backgroundColor = "#fff";
          githubSaveButton.style.border = "none";
          githubSaveButton.style.cursor = "pointer";
          githubSaveButton.style.padding = "4px";

          let githubSaveImage = document.createElement("img");
          githubSaveImage.src = plugin.getUrl("/resources/github-mark-up.png");
          githubSaveImage.width = "32";
          githubSaveImage.height = "32";

          githubSaveButton.appendChild(githubSaveImage);
          githubSaveButton.addEventListener("click", githubSaveBtnClicked);
          actionButtons.appendChild(githubSaveButton);
        }
        if (saveBtn && isRepoDefined()) {
          $(githubSaveButton).show();
        } else {
          $(githubSaveButton).hide();
        }
      }
    } catch (e) {
      logError("Could not add and highlight save button.");
    }

    let pluginData = getPluginDataForPlayground(getPlaygroundID());
    if (pluginData.autoCommit) {
      if (
        (changeEvent.type === _Blockly.Events.BLOCK_CHANGE &&
          pluginData.autoCommitEvents.includes("BLOCK_CHANGE")) ||
        (changeEvent.type === _Blockly.Events.BLOCK_CREATE &&
          pluginData.autoCommitEvents.includes("BLOCK_CREATE")) ||
        (changeEvent.type === _Blockly.Events.BLOCK_DELETE &&
          pluginData.autoCommitEvents.includes("BLOCK_DELETE")) ||
        (changeEvent.type === _Blockly.Events.BLOCK_DRAG &&
          pluginData.autoCommitEvents.includes("BLOCK_DRAG")) ||
        (changeEvent.type === _Blockly.Events.BLOCK_MOVE &&
          pluginData.autoCommitEvents.includes("BLOCK_MOVE")) ||
        (changeEvent.type === _Blockly.Events.COMMENT_CHANGE &&
          pluginData.autoCommitEvents.includes("COMMENT_CHANGE")) ||
        (changeEvent.type === _Blockly.Events.COMMENT_CREATE &&
          pluginData.autoCommitEvents.includes("COMMENT_CREATE")) ||
        (changeEvent.type === _Blockly.Events.COMMENT_DELETE &&
          pluginData.autoCommitEvents.includes("COMMENT_DELETE")) ||
        (changeEvent.type === _Blockly.Events.COMMENT_MOVE &&
          pluginData.autoCommitEvents.includes("COMMENT_MOVE")) ||
        (changeEvent.type === _Blockly.Events.VAR_CREATE &&
          pluginData.autoCommitEvents.includes("VAR_CREATE")) ||
        (changeEvent.type === _Blockly.Events.VAR_DELETE &&
          pluginData.autoCommitEvents.includes("VAR_DELETE")) ||
        (changeEvent.type === _Blockly.Events.VAR_RENAME &&
          pluginData.autoCommitEvents.includes("VAR_RENAME"))
      ) {
        changeStack.push(changeEvent);
        if (changeStack.length >= pluginData.autoCommitCount) {
          autoCommit();
        }
      }
    }
  }

  function autoCommit() {
    let commitMessage = "auto-commit from portal website\n\nChanges:";
    changeStack.forEach((element) => {
      commitMessage +=
        "\n" + JSON.stringify(element.toJson(), getCircularJsonReplacer());
    });
    changeStack = [];
    gitHubCommit(commitMessage);
  }

  function showLoadingPopup(message) {
    if (!message) {
      return;
    }
    if (!showLoadingPopupLoaded) {
      loadingStylesheet = document.createElement("link");
      loadingStylesheet.setAttribute("rel", "stylesheet");
      loadingStylesheet.setAttribute(
        "href",
        plugin.getUrl("/resources/loadingPopup.css")
      );
      document.head.appendChild(loadingStylesheet);
      showLoadingPopupLoaded = true;
    }
    let loaderPopup = document.getElementById("github_loader_popup");
    if (loaderPopup) {
      loaderPopup.innerText = message;
    } else {
      loaderPopup = document.createElement("div");
      loaderPopup.setAttribute("class", "github_loader_popup");
      loaderPopup.setAttribute("id", "github_loader_popup");
      loaderPopup.innerHTML = `<table><tr><td id="github_loader_popup_status" class="github_plugin_loader"></td><td id="github_loader_popup_text">${message}</td></tr></table>`;
      document.body.appendChild(loaderPopup);
    }

    loaderPopup.style.display = "block";
  }

  async function loadOctokitModule() {
    showLoadingPopup("Loading GitHub Octokit Module...");
    octokitModule = await import("https://cdn.skypack.dev/@octokit/rest");
  }

  function hideLoadingPopup() {
    document.querySelector("#github_loader_popup").style.display = "none";
  }

  function hideSetupDialog() {
    document.querySelector("#dialogBackdrop").style.display = "none";
  }

  function onModalClick(event) {
    if (event.target === document.getElementById("dialogBackdrop")) {
      hideSetupDialog();
    }
  }

  function autoCommitChanged() {
    let autoCommitElement = document.getElementById(
      "github_plugin_modal_autocommit"
    );
    if (autoCommitElement) {
      if (!autoCommitElement.checked) {
        document.querySelector(
          "#github_plugin_modal_autocommit_options"
        ).style.display = "none";
      } else {
        document.querySelector(
          "#github_plugin_modal_autocommit_options"
        ).style.display = "block";
      }
    }
  }

  function toggleChangeEventsDisplay() {
    let autoCommitEventsPanel = document.getElementById(
      "github_plugin_autocommit_events"
    );
    let collapsibleSymbold = document.getElementById(
      "github_plugin_collapsible_symbol"
    );
    if (
      autoCommitEventsPanel.style.display === "none" ||
      autoCommitEventsPanel.style.display === ""
    ) {
      autoCommitEventsPanel.style.display = "block";
      collapsibleSymbold.innerHTML = "&#8722;";
    } else {
      autoCommitEventsPanel.style.display = "none";
      collapsibleSymbold.innerHTML = "&#43;";
    }
  }

  function showSetupDialog() {
    showDialog(plugin.getUrl("resources/setupDialog.html"), initSetupDialog);
  }

  function initSetupDialog() {
    const setupForm = document.forms.githubSetup;
    if (setupForm) {
      let pluginData = getPluginDataForPlayground(getPlaygroundID());

      setupForm.pat.value = pluginData.personalAccessToken;
      let statusIndicatorPat = document.getElementById("status_indicator_pat");
      statusIndicatorPat.innerHTML = "&#8635;";
      statusIndicatorPat.style.color = "#26ffdf";
      statusIndicatorPat.style.cursor = "pointer";
      setupForm.list_org_repo.checked = pluginData.list_org_repo;
      setupForm.repository.value = pluginData.repository.full_name;
      setupForm.repository.innerHTML =
        '<option value="' +
        pluginData.repository.owner +
        ";" +
        pluginData.repository.name +
        ";" +
        pluginData.repository.full_name +
        '">' +
        pluginData.repository.full_name +
        "</option>";
      setupForm.repository.disabled = true;
      setupForm.branch.value = pluginData.repository.branch;
      setupForm.branch.innerHTML =
        '<option value="' +
        pluginData.repository.branch +
        '">' +
        pluginData.repository.branch +
        "</option>";
      setupForm.branch.disabled = true;
      setupForm.commitOnSave.checked = pluginData.commitOnSave;
      setupForm.autoCommit.checked = pluginData.autoCommit;
      setupForm.autoCommitCount.value = pluginData.autoCommitCount;
      document.getElementById("BLOCK_ALL").checked = false;
      document.getElementById("COMMENT_ALL").checked = false;
      document.getElementById("VAR_ALL").checked = false;
      document.querySelectorAll(".blockEvent").forEach((element) => {
        element.checked = false;
      });
      document.querySelectorAll(".commentEvent").forEach((element) => {
        element.checked = false;
      });
      document.querySelectorAll(".varEvent").forEach((element) => {
        element.checked = false;
      });
      pluginData.autoCommitEvents.forEach((element) => {
        document.getElementById(element).checked = true;
        if (element.startsWith("BLOCK")) {
          document.getElementById("BLOCK_ALL").checked = true;
        } else if (element.startsWith("COMMENT")) {
          document.getElementById("COMMENT_ALL").checked = true;
        } else if (element.startsWith("VAR")) {
          document.getElementById("VAR_ALL").checked = true;
        }
      });
      document
        .getElementById("dialogBackdrop")
        .addEventListener("click", onModalClick);
      document
        .getElementById("gh_setup_close")
        .addEventListener("click", hideSetupDialog);
      document
        .getElementById("github_plugin_modal_pat")
        .addEventListener("blur", patChanged);
      document
        .getElementById("status_indicator_pat")
        .addEventListener("click", patChanged);
      document
        .getElementById("github_plugin_modal_autocommit")
        .addEventListener("change", autoCommitChanged);
      document
        .getElementById("github_plugin_modal_collapsible_events")
        .addEventListener("click", toggleChangeEventsDisplay);
      document
        .getElementById("BLOCK_ALL")
        .addEventListener("change", toggleBlockEvents);
      document
        .getElementById("COMMENT_ALL")
        .addEventListener("change", toggleCommentEvents);
      document
        .getElementById("VAR_ALL")
        .addEventListener("change", toggleVarEvents);
      document
        .getElementById("gh_setup_cancel_button")
        .addEventListener("click", hideSetupDialog);
      document
        .getElementById("gh_setup_ok_button")
        .addEventListener("click", setupDialogConfirmed);
      autoCommitChanged();
    }
  }

  function setStatusIndicatorLoading(indicatorElement) {
    indicatorElement.innerHTML = "";
    indicatorElement.removeAttribute("class");
    indicatorElement.removeAttribute("style");
    indicatorElement.setAttribute("class", "github_plugin_loader");
    indicatorElement.removeEventListener(
      "click",
      document.forms.githubSetup.pat.onblur
    );
  }

  function setStatusIndicatorFailure(indicatorElement) {
    indicatorElement.innerHTML = "";
    indicatorElement.removeAttribute("class");
    indicatorElement.removeAttribute("style");
    indicatorElement.setAttribute(
      "style",
      "color:#f00; display: inline-block;"
    );
    indicatorElement.removeEventListener(
      "click",
      document.forms.githubSetup.pat.onblur
    );
    indicatorElement.innerHTML = "&cross;";
  }

  function setStatusIndicatorSuccess(indicatorElement) {
    indicatorElement.innerHTML = "";
    indicatorElement.removeAttribute("class");
    indicatorElement.removeAttribute("style");
    indicatorElement.setAttribute(
      "style",
      "color:#26ffdf; display: inline-block;"
    );
    indicatorElement.removeEventListener(
      "click",
      document.forms.githubSetup.pat.onblur
    );
    indicatorElement.innerHTML = "&check;";
  }

  function patChanged() {
    let personalAccessToken = document.forms.githubSetup.pat.value;
    if (!personalAccessToken || personalAccessToken.length === 0) {
      return;
    }
    setStatusIndicatorLoading(document.getElementById("status_indicator_pat"));
    octokit = new octokitModule.Octokit({
      auth: personalAccessToken,
      userAgent: userAgent,
    });

    octokit.rest.users
      .getAuthenticated()
      .then((authResult) => {
        logInfo(JSON.stringify(authResult));
        logInfo("Logged in to GitHub: %s", authResult.data.login);
        document.forms.githubSetup.user.value = authResult.data.login;
        setStatusIndicatorSuccess(
          document.getElementById("status_indicator_pat")
        );
        getRepos();
      })
      .catch((exc) => {
        logError(exc);
        setStatusIndicatorFailure(
          document.getElementById("status_indicator_pat")
        );
      });
  }

  function getRepos() {
    setStatusIndicatorLoading(
      document.getElementById("status_indicator_repository")
    );
    let apiEndPoint = "/user/repos";

    if (!document.getElementById("list_org_repo").checked) {
      apiEndPoint += "?affiliation=owner";
    }
    octokit
      .request(`GET ${apiEndPoint}`, {})
      .then((repoResult) => {
        setStatusIndicatorSuccess(
          document.getElementById("status_indicator_repository")
        );
        document.forms.githubSetup.repository.innerHTML = "";
        let repoOption = document.createElement("option");
        repoOption.setAttribute("value", "select");
        repoOption.innerHTML = "Please select...";
        document.forms.githubSetup.repository.appendChild(repoOption);
        repoResult.data.forEach((repo) => {
          repoOption = document.createElement("option");
          repoOption.setAttribute(
            "value",
            repo.owner.login + ";" + repo.name + ";" + repo.full_name
          );
          repoOption.innerHTML = repo.full_name;
          document.forms.githubSetup.repository.appendChild(repoOption);
        });
        document.forms.githubSetup.repository.disabled = false;
        document.forms.githubSetup.repository.addEventListener(
          "change",
          getBranches
        );
      })
      .catch((exc) => {
        setStatusIndicatorFailure(
          document.getElementById("status_indicator_repository")
        );
      });
  }

  function getBranches() {
    setStatusIndicatorLoading(
      document.getElementById("status_indicator_branch")
    );
    octokit
      .request("GET /repos/{owner}/{repo}/branches", {
        owner: document.forms.githubSetup.repository.value.split(";", 1)[0],
        repo: document.forms.githubSetup.repository.value.split(";", 2)[1],
      })
      .then((branchResult) => {
        setStatusIndicatorSuccess(
          document.getElementById("status_indicator_branch")
        );
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
      })
      .catch((exc) => {
        logError(exc);
        setStatusIndicatorFailure(
          document.getElementById("status_indicator_branch")
        );
      });
  }

  function isSetupDataValid() {
    let githubSetup = document.forms.githubSetup;
    if (!githubSetup.pat.value || !githubSetup.pat.value.length > 0) {
      return false;
    }
    if (
      githubSetup.repository.value &&
      githubSetup.repository.value.length > 0
    ) {
      let repoDetails = githubSetup.repository.value.split(";");
      if (!(repoDetails.length === 3)) {
        return false;
      }
    } else {
      return false;
    }
    if (
      !githubSetup.branch.value ||
      !githubSetup.branch.value.length > 0 ||
      githubSetup.branch.value === "select"
    ) {
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
      pluginData.list_org_repo = githubSetup.list_org_repo.checked;
      pluginData.repository.owner = repoDetails[0];
      pluginData.repository.name = repoDetails[1];
      pluginData.repository.full_name = repoDetails[2];
      pluginData.repository.branch = githubSetup.branch.value;
      pluginData.commitOnSave = githubSetup.commitOnSave.checked;
      pluginData.autoCommit = githubSetup.autoCommit.checked;
      if (pluginData.autoCommit) {
        pluginData.autoCommitCount = githubSetup.autoCommitCount.value;
        pluginData.autoCommitEvents = [];
        document.querySelectorAll(".blockEvent").forEach((element) => {
          if (element.checked) {
            pluginData.autoCommitEvents.push(element.value);
          }
        });
        document.querySelectorAll(".commentEvent").forEach((element) => {
          if (element.checked) {
            pluginData.autoCommitEvents.push(element.value);
          }
        });
        document.querySelectorAll(".varEvent").forEach((element) => {
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
      let pluginDataForPlayground = getPluginDataForPlayground(
        getPlaygroundID()
      );
      if (
        confirm(
          "Do you really want to reset this workspace to the latest commit of '" +
            pluginDataForPlayground.repository.name +
            "' on branch '" +
            pluginDataForPlayground.repository.branch +
            "'?"
        )
      ) {
        try {
          octokit = new octokitModule.Octokit({
            auth: pluginDataForPlayground.personalAccessToken,
            userAgent: userAgent,
          });
          octokit.rest.repos
            .getContent({
              mediaType: {
                format: "raw",
              },
              owner: pluginDataForPlayground.repository.owner,
              repo: pluginDataForPlayground.repository.name,
              path: pluginDataForPlayground.workspacePath,
              ref: pluginDataForPlayground.repository.branch,
            })
            .then((workspaceResult) => {
              logInfo(JSON.stringify(workspaceResult));
              _Blockly.getMainWorkspace().clear();
              try {
                loadWorkspaceJSON(JSON.parse(workspaceResult.data));
              } catch (error) {
                alert("Failed to import workspace!");
              }
            })
            .catch((exc) => {
              logError(exc);
              alert("Couldn't load latest workspace from repository!");
            });
        } catch (e) {
          logError(e);
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
      }
      if (commitMessage != null) {
        showLoadingPopup("Committing...");
        if (commitMessage.trim() === "") {
          commitMessage = "auto-commit from portal website\n\nChanges:";
          _Blockly
            .getMainWorkspace()
            .getUndoStack()
            .forEach((element) => {
              commitMessage += "\n" + JSON.stringify(element.toJson());
            });
        }
        let pluginDataForPlayground = getPluginDataForPlayground(
          getPlaygroundID()
        );

        let contentString = btoa(getFormattedWorkspaceJSON());

        octokit = new octokitModule.Octokit({
          auth: pluginDataForPlayground.personalAccessToken,
          userAgent: userAgent,
        });

        octokit.rest.repos
          .getContent({
            owner: pluginDataForPlayground.repository.owner,
            repo: pluginDataForPlayground.repository.name,
            ref: pluginDataForPlayground.repository.branch,
          })
          .then((result) => {
            logInfo(JSON.stringify(result));
            let workspaceFile = null;
            result.data.forEach((element) => {
              if (
                element.path === pluginDataForPlayground.workspacePath &&
                element.type === "file"
              ) {
                workspaceFile = element;
              }
            });
            if (workspaceFile) {
              octokit.rest.repos
                .createOrUpdateFileContents({
                  owner: pluginDataForPlayground.repository.owner,
                  repo: pluginDataForPlayground.repository.name,
                  path: pluginDataForPlayground.workspacePath,
                  branch: pluginDataForPlayground.repository.branch,
                  message: commitMessage,
                  content: contentString,
                  sha: workspaceFile.sha,
                })
                .then((result1) => {
                  let updateResultText = JSON.stringify(result1);
                  logInfo("Commit Result: " + updateResultText);
                  //alert("Commited: " + result1.data.commit.sha);
                  showLoadingPopup("Commited: " + result1.data.commit.sha);
                  setTimeout(hideLoadingPopup, 1500);
                })
                .catch((exc) => {
                  logError(exc);
                  alert("Failed to commit!\n" + JSON.stringify(exc));
                  setTimeout(hideLoadingPopup, 1500);
                });
            } else {
              octokit.rest.repos
                .createOrUpdateFileContents({
                  owner: pluginDataForPlayground.repository.owner,
                  repo: pluginDataForPlayground.repository.name,
                  path: pluginDataForPlayground.workspacePath,
                  branch: pluginDataForPlayground.repository.branch,
                  message: commitMessage,
                  content: contentString,
                })
                .then((result1) => {
                  let updateResultText = JSON.stringify(result1);
                  logInfo("Update Result: " + updateResultText);
                  //alert("Commited: " + result1.data.commit.sha);
                  showLoadingPopup("Commited: " + result1.data.commit.sha);
                  setTimeout(hideLoadingPopup, 1500);
                })
                .catch((exc) => {
                  logError(exc);
                  alert("Failed to commit!\n" + JSON.stringify(exc));
                  setTimeout(hideLoadingPopup, 1500);
                });
            }
          })
          .catch((e) => {
            logError(e);
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

  function showDialog(dialogUrl, initFn) {
    try {
      fetch(dialogUrl)
        .then((response) => {
          if (!response.ok) {
            logError(
              "Did not receive proper response for manage dialog url '" +
                url +
                "'"
            );
          } else {
            response
              .text()
              .then((data) => {
                logInfo("Retrieved following dialog data:\n", data);
                let dialogDoc = new DOMParser().parseFromString(
                  data,
                  "text/html"
                );
                let dialogBackdrop = dialogDoc.getElementById("dialogBackdrop");
                let styleLink = dialogDoc.head.querySelector("link");
                styleLink.setAttribute(
                  "href",
                  plugin.getUrl(styleLink.getAttribute("href"))
                );
                document.head.appendChild(styleLink);
                let existingBackdrop = document.getElementById(
                  "dialogBackdrop"
                );
                if (existingBackdrop) {
                  document.body.removeChild(existingBackdrop);
                }
                document.body.appendChild(dialogBackdrop);
                initFn();
              })
              .catch((reason) => {
                logError(
                  "Couldn't parse response data for dialog url '" +
                    dialogUrl +
                    "'\n" +
                    reason
                );
              });
          }
        })
        .catch((reason) => {
          logError("Couldn't fetch dialog url '" + dialogUrl + "'\n" + reason);
        });
    } catch (e) {
      logError("Failed to open dialog!", e);
      alert("Failed to open dialog!\nCheck console for details.");
    }
  }

  function getLogPrefix(messageType) {
    return "[" + pluginId + "] [" + messageType + "] - ";
  }

  function logInfo(message, data) {
    console.info(getLogPrefix("INFO") + message, data);
  }

  function logWarning(message, data) {
    console.warn(getLogPrefix("WARNING") + message, data);
  }

  function logError(message, data) {
    console.error(getLogPrefix("ERROR") + message, data);
  }

  const gitHubExportItem = {
    displayText: "Export Workspace",
    preconditionFn: () => "enabled",
    callback: exportWorkspaceJSON,
    scopeType: _Blockly.ContextMenuRegistry.ScopeType.WORKSPACE,
    id: "gitHubExportItem",
    weight: 180,
  };

  const gitHubImportItem = {
    displayText: "Import Workspace",
    preconditionFn: () => "enabled",
    callback: importWorkspaceJSON,
    scopeType: _Blockly.ContextMenuRegistry.ScopeType.WORKSPACE,
    id: "gitHubImportItem",
    weight: 181,
  };

  const gitHubImportItemXML = {
    displayText: "Import XML (legacy)",
    preconditionFn: () => "enabled",
    callback: importFormattedXMLFile,
    scopeType: _Blockly.ContextMenuRegistry.ScopeType.WORKSPACE,
    id: "gitHubImportItemXML",
    weight: 182,
  };

  const gitHubSetupItem = {
    displayText: "GitHub Setup",
    preconditionFn: () => "enabled",
    callback: showSetupDialog,
    scopeType: _Blockly.ContextMenuRegistry.ScopeType.WORKSPACE,
    id: "gitHubSetupItem",
    weight: 183,
  };

  const gitHubPullItem = {
    displayText: "GitHub Pull",
    preconditionFn: function (scope) {
      if (isRepoDefined()) {
        return "enabled";
      }
      return "disabled";
    },
    callback: gitHubPull,
    scopeType: _Blockly.ContextMenuRegistry.ScopeType.WORKSPACE,
    id: "gitHubPullItem",
    weight: 184,
  };

  const gitHubCommitItem = {
    displayText: "GitHub Commit+Push",
    preconditionFn: function (scope) {
      if (isRepoDefined()) {
        return "enabled";
      }
      return "disabled";
    },
    callback: function () {
      gitHubCommit(null);
    },
    scopeType: _Blockly.ContextMenuRegistry.ScopeType.WORKSPACE,
    id: "gitHubCommitItem",
    weight: 185,
  };

  const githubMenu = plugin.createMenu(
    "githubMenu",
    "GitHub",
    _Blockly.ContextMenuRegistry.ScopeType.WORKSPACE
  );
  githubMenu.weight = 99;
  githubMenu.options = [
    "items.gitHubExportItem",
    "items.gitHubImportItem",
    "items.gitHubImportItemXML",
    "items.gitHubSetupItem",
    "items.gitHubPullItem",
    "items.gitHubCommitItem",
  ];

  plugin.initializeWorkspace = function () {
    loadOctokitModule()
      .then((result) => {
        try {
          showLoadingPopup("Initialize change listener...");
          logInfo("Initialize change listener for workspace...");
          _Blockly.getMainWorkspace().addChangeListener(onWorkspaceChange);
          logInfo("Initialized change listener for workspace.");
        } catch (error) {
          logError(
            "Could not register change listener for blockly workspace.\n",
            error
          );
          alert(
            "Could not register change listener for blockly workspace.\n",
            error
          );
        } finally {
          hideLoadingPopup();
        }

        try {
          showLoadingPopup("Loading storage data...");
          logInfo("Loading storage data...");
          loadPluginData();
          logInfo(
            "Retrieved data for " +
              gitHubPluginData.experiences.length +
              " experience(s) from storage."
          );
        } catch (error) {
          logError("Couldn't load storage data:\n", error);
          alert("Couldn't load storage data:\n" + error);
        } finally {
          hideLoadingPopup();
        }
        try {
          showLoadingPopup("Register menu items...");
          logInfo("Register menu items...");
          plugin.registerItem(gitHubImportItem);
          plugin.registerItem(gitHubImportItemXML);
          plugin.registerItem(gitHubExportItem);
          plugin.registerItem(gitHubSetupItem);
          plugin.registerItem(gitHubPullItem);
          plugin.registerItem(gitHubCommitItem);
          plugin.registerMenu(githubMenu);
          _Blockly.ContextMenuRegistry.registry.register(githubMenu);
        } catch (exception) {
          logError("Couldn't register blockly menu items\n", exception);
          alert("Couldn't register blockly menu items\n" + exception);
        } finally {
          hideLoadingPopup();
        }
        logInfo("GitHub Plugin initialization finished.");
      })
      .catch((exception) => {
        logError("Couldn't load octokit module:\n", exception);
        hideLoadingPopup();
        alert("GitHub Plugin initialization failed!\n" + exception);

        try {
          showLoadingPopup("Initialize change listener...");
          logInfo("Initialize change listener for workspace...");
          _Blockly.getMainWorkspace().addChangeListener(onWorkspaceChange);
          logInfo("Initialized change listener for workspace.");
        } catch (error) {
          logError(
            "Could not register change listener for blockly workspace.\n",
            error
          );
          alert(
            "Could not register change listener for blockly workspace.\n",
            error
          );
        } finally {
          hideLoadingPopup();
        }

        try {
          showLoadingPopup("Loading storage data...");
          logInfo("Loading storage data...");
          loadPluginData();
          logInfo(
            "Retrieved data for " +
              gitHubPluginData.experiences.length +
              " experience(s) from storage."
          );
        } catch (error) {
          logError("Couldn't load storage data:\n", error);
          alert("Couldn't load storage data:\n" + error);
        } finally {
          hideLoadingPopup();
        }
        try {
          showLoadingPopup("Register menu items...");
          logInfo("Register menu items...");
          plugin.registerItem(gitHubImportItem);
          plugin.registerItem(gitHubImportItemXML);
          plugin.registerItem(gitHubExportItem);
          plugin.registerItem(gitHubSetupItem);
          plugin.registerItem(gitHubPullItem);
          plugin.registerItem(gitHubCommitItem);
          plugin.registerMenu(githubMenu);
          _Blockly.ContextMenuRegistry.registry.register(githubMenu);
        } catch (exception) {
          logError("Couldn't register blockly menu items\n", exception);
          alert("Couldn't register blockly menu items\n" + exception);
        } finally {
          hideLoadingPopup();
        }
        logInfo("GitHub Plugin initialization finished.");
      });
  };
})();
