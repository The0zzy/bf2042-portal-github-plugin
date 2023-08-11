# BF2042 Portal GitHub Plugin

## About

This is a plugin for the [Battlefield Portal Browser Extension](https://github.com/LennardF1989/BF2042-Portal-Extensions) which adds the feature to pull/push your portal experience changes to GitHub repositories.
This plugin is also aiming to enable editing on a Battlefield Portal experience as a team, by utilizing feature branches and merging them.
The plugin utilizes the [GutHub REST API](https://docs.github.com/en/rest) with the [Octokit Javascript library](https://github.com/octokit/octokit.js) by using GitHub Personal Access Tokens.

## Install

1. Install the [Battlefield Portal Browser Extension](https://github.com/LennardF1989/BF2042-Portal-Extensions)
   - Chrome: https://chrome.google.com/webstore/detail/bf2042-portal-extensions/ojegdnmadhmgfijhiibianlhbkepdhlj
   - Firefox: https://addons.mozilla.org/en-US/firefox/addon/bf2042-portal-extensions/
2. Pin the extension to be able to click on it
3. Click on the extension icon and a popup should appear
4. Click on `official extension manifest` in the text to automatically fill the "Manifest URL" and "Version" input.
5. Click confirm
6. Reload any Rules Editor Page and right-click in the Workspace
7. A context menu should appear which shows an `Options >` item (if not, reload the page again and check that the Portal browser extension is active)
8. Click on `Options >` and then `Plugin Manager`
9. In the Plugin Manager click on `Add Plugin` on the top-right corner
10. Enter the **Plugin Manifest URL** below and click `Review`, then click `Confirm` after seeing the sourcecode of the plugin.
11. After the plugin was added to the list of plugins, you need to reload the rules editor page in order to activate it

**Plugin manifest.json URL**
```txt
https://the0zzy.github.io/bf2042-portal-github-plugin/manifest.json
```

## How to use

1. [Create a GitHub Personal Access Token](https://github.com/settings/tokens) as described [here](https://docs.github.com/en/articles/creating-an-access-token-for-command-line-use).
2. Create a new repository and initialize it
3. Open the rule editor in one of your portal experiences
4. Open the context menu by right-clicking in the workspace area (not on a block)
5. If the plugin was initialized correctly, you should see some `GitHub...` menu items at the bottom.
6. Click on `GitHub Setup` to connect your repository of _step 2_ with this experience.
7. Enter your personal access token of _step 1_
8. Enter the repository name of _step 2_

If everything was successfull, the options for `GitHub Pull` and `GitHub Commit` should become available in the context menu.

When leaving the commit message blank, the plugin will generate a commit message out of the undo stack in the workspace.

The plugin stores your rules as a formatted `workspace.json` file in the root folder of your repository.
You can define a repository and according login data per Portal Experience (based on "playgroundId").
The information will be stored in the browser filesystem in the context of the Battlefield Portal domain.

# How to co-edit/contribute on a Battlefield Portal experience

-- THIS TOPIC IS WORK IN PROGRESS --

This plugin is also aiming to enable editing on a Battlefield Portal experience as a team, by utilizing feature branches and merging them.

## How to - For the experience/repository owner

### A - GitHub Account and Repository

1. [Create a GitHub account](https://github.com/signup)
1. [Create a GitHub Personal Access Token](https://github.com/settings/tokens) as described [here](https://docs.github.com/en/articles/creating-an-access-token-for-command-line-use).
1. create a [new (public) repository](https://github.com/new) at GitHub with the online guide and initialize it with a readme etc.

### B - Install Browser Plugin

1. Install the [Battlefield Portal Browser Extension](https://github.com/LennardF1989/BF2042-Portal-Extensions)
   - Chrome: https://chrome.google.com/webstore/detail/bf2042-portal-extensions/ojegdnmadhmgfijhiibianlhbkepdhlj
   - Firefox: https://addons.mozilla.org/en-US/firefox/addon/bf2042-portal-extensions/
1. Pin the extension to be able to click on it
1. Click on the extension icon > `Options`
1. Click on `Add plugin` and enter the following url

```txt
https://the0zzy.github.io/bf2042-portal-github-plugin/manifest.json
```

### C - Setup/Commit Portal Experience

1. Create or open a portal experience of your own at the rule/logic editor pane at [portal.battlefield.com](https://portal.battlefield.com)
1. Open the context menu by right-clicking in the workspace area (not on a block)
1. If the plugin was initialized correctly, you should see some `GitHub...` menu items at the bottom.
1. Click on `GitHub Setup` to connect your repository with this experience.
1. Enter your personal access token and tab to another field in the setup dialog (this will trigger the GitHub login in the background)
1. Select the desired repository and select the "main" branch
1. Select your desired options of how the plugin should work within this experience ("Commit on Save" is recommend)
1. Now you can do a first commit of your experience by opening the context menu again and select `GitHub Commit`

### D - Create "Issues" to work on

1. Within the [issues tab](https://github.com/issues) of your repository you can create issues/To-Dos, which should be implementable as isolated as possible.
1. in an issue you can create a specific branch for developing/working on it, so that your "main" branch stays clean and stable

## How to - For contributors of an experience

### A - Prerequisites

1. [Create a GitHub account](https://github.com/signup)
1. [Create a GitHub Personal Access Token](https://github.com/settings/tokens) as described [here](https://docs.github.com/en/articles/creating-an-access-token-for-command-line-use).
1. Install the [Battlefield Portal Browser Extension](https://github.com/LennardF1989/BF2042-Portal-Extensions)
   - Chrome: https://chrome.google.com/webstore/detail/bf2042-portal-extensions/ojegdnmadhmgfijhiibianlhbkepdhlj
   - Firefox: https://addons.mozilla.org/en-US/firefox/addon/bf2042-portal-extensions/
1. Pin the extension to be able to click on it
1. Click on the extension icon > `Options`
1. Click on `Add plugin` and enter the following url

```txt
https://the0zzy.github.io/bf2042-portal-github-plugin/manifest.json
```
