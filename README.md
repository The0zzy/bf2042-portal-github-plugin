# bf2042-portal-github-plugin

## About
This is a plugin for the [Battlefield Portal Browser Extension](https://github.com/LennardF1989/BF2042-Portal-Extensions) which adds the feature to pull/push your portal experience changes to GitHub repositories.
The plugin utilizes the [GutHub REST API](https://docs.github.com/en/rest) with the [Octokit Javascript library](https://github.com/octokit/octokit.js) by using GitHub Personal Access Tokens.

## Install

1. Install the [Battlefield Portal Browser Extension](https://github.com/LennardF1989/BF2042-Portal-Extensions)
    - Chrome: https://chrome.google.com/webstore/detail/bf2042-portal-extensions/ojegdnmadhmgfijhiibianlhbkepdhlj
    - Firefox: https://addons.mozilla.org/en-US/firefox/addon/bf2042-portal-extensions/
2. Pin the extension to be able to click on it
3. Click on the extension icon > `Options`
4. Click on `Add plugin` and enter the following url

```txt
https://roflkartoffelde.github.io/bf2042-portal-github-plugin/manifest.json
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

The plugin stores your rules as a formatted `workspace.xml` file in the root folder of your repository.
You can define a repository and according login data per Portal Experience (based on "playgroundId").
The information will be stored in the browser filesystem in the context of the Battlefield Portal domain.