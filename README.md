# Mermaid Version for Obsidian

![Buffering](https://img.shields.io/badge/buffering-99%25-fff?style=flat&logo=youtube&logoColor=FFFFFF&label=buffering&labelColor=5B595C&color=78DCE8) ![Frog Mode](https://img.shields.io/badge/frog%20mode-ribbit-fff?style=flat&logo=duolingo&logoColor=FFFFFF&label=frog%20mode&labelColor=5B595C&color=5C7CFA) ![Recycle Bin](https://img.shields.io/badge/recycle%20bin-maybe%20important-fff?style=flat&logo=windows95&logoColor=FFFFFF&label=recycle%20bin&labelColor=5B595C&color=FC9867) ![Keyboard](https://img.shields.io/badge/keyboard-crumb%20collector-fff?style=flat&logo=razer&logoColor=FFFFFF&label=keyboard&labelColor=5B595C&color=FC9867) ![Help](https://img.shields.io/badge/help-did%20you%20try%20rebooting-fff?style=flat&logo=helpdeskz&logoColor=FFFFFF&label=help&labelColor=5B595C&color=AB9DF2) ![Internet Points](https://img.shields.io/badge/internet%20points-worthless%20and%20priceless-fff?style=flat&logo=reddit&logoColor=FFFFFF&label=internet%20points&labelColor=5B595C&color=FF6188) ![Encryption](https://img.shields.io/badge/encryption-ROT13-fff?style=flat&logo=letsencrypt&logoColor=FFFFFF&label=encryption&labelColor=5B595C&color=5C7CFA) ![Alignment](https://img.shields.io/badge/alignment-chaotic%20neutral-fff?style=flat&logo=dungeonsanddragons&logoColor=FFFFFF&label=alignment&labelColor=5B595C&color=78DCE8) ![Password](https://img.shields.io/badge/password-password123-fff?style=flat&logo=1password&logoColor=FFFFFF&label=password&labelColor=5B595C&color=A9DC76)

<p align="center">
  <img src="assets/header.svg" width="600" />
</p>

An Obsidian plugin that enhances Mermaid diagram rendering with custom version loading, automatic sizing, and PNG export.

## Features

### Custom Mermaid Version

Load a newer version of Mermaid.js from CDN to access the latest diagram types and features that may not be available in Obsidian's bundled version.

- Quick presets for common versions (Latest 11.x, 11.12.3, 11.4.1)
- Custom CDN URL support (jsDelivr, unpkg, cdnjs)
- Live "Load & Re-render" button for testing without restart

### Auto-Sizing

Automatically adjusts Mermaid diagram dimensions based on their content width:

- **Wide diagrams** get horizontal scrolling while maintaining their natural size
- **Small diagrams** fit to the container without stretching
- Optional maximum width cap with preset buttons (600px, 800px, 1000px, 1200px)
- Optional centering for diagrams that fit within the container
- Automatically re-evaluates on window/pane resize
- Print-friendly: scales wide diagrams to fit page width
- Works in both reading and live preview modes

### PNG Export

Hover over any Mermaid diagram to reveal a download button for PNG export.

- 2x resolution for crisp output
- Theme-aware rendering (light/dark mode)
- Uses native share sheet on supported platforms, falls back to download

## Installation

### Obsidian Community Plugin (pending)

This plugin has been submitted for review to the Obsidian community plugin directory. Once approved, you will be able to install it directly from **Settings > Community plugins > Browse** by searching for "Mermaid Version".

### Using BRAT

You can install this plugin right now using the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin:

1. Install BRAT from **Settings > Community plugins > Browse** (search for "BRAT" by TfTHacker)
2. Open the BRAT settings
3. Under the **Beta plugins** section, click **Add beta plugin**

   ![BRAT beta plugin list](assets/brat_example_beta_plugin_list.png)

4. In the overlay, enter this plugin's repository: `https://github.com/saltyfireball/obsidian-mermaid-version` (or just `saltyfireball/obsidian-mermaid-version`)

   ![BRAT add beta plugin](assets/brat_example_beta_modal.png)

5. Leave the version set to latest

   ![BRAT beta plugin filled](assets/brat_example_beta_modal_filled.png)

6. Click **Add plugin**

### Manual

1. Download the latest release from the [Releases](https://github.com/saltyfireball/obsidian-mermaid-version/releases) page
2. Copy `main.js`, `manifest.json`, and `styles.css` into your vault's `.obsidian/plugins/mermaid-version/` directory
3. Enable the plugin in **Settings > Community plugins**

## Settings

| Option                 | Description                              |
| ---------------------- | ---------------------------------------- |
| Enable plugin          | Master toggle (requires restart)         |
| Custom Mermaid version | Load a newer Mermaid.js from CDN         |
| Mermaid CDN URL        | URL to the mermaid.min.js file           |
| Auto-sizing            | Automatically fit or scroll diagrams     |
| Maximum width          | Cap the rendered width of wide diagrams  |
| Center diagrams        | Center smaller diagrams in the container |
| Export button          | Show PNG download button on hover        |

## License

MIT
