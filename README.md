# Mermaid Version for Obsidian

![works on my machine](https://img.shields.io/badge/worksonmymachien-on%20my%20machine-fff?style=flat&logo=apple&logoColor=FFFFFF&logoSize=FF6188&label=works&labelColor=5B595C&color=A9DC76) ![MySpace](https://img.shields.io/badge/myspace-42%20online-fff?style=flat&logo=myspace&logoColor=FFFFFF&logoSize=FF6188&label=My%20Space&labelColor=5B595C&color=5C7CFA) ![All Your Base](https://img.shields.io/badge/all%20your%20base-are%20belong%20to%20us-fff?style=flat&logo=retroarch&label=all%20your%20base&labelColor=5B595C&color=78DCE8) ![Neopets](https://img.shields.io/badge/neopets-starving-fff?style=flat&logo=paw&label=neopet&labelColor=5B595C&color=FFD866) ![ICQ](https://img.shields.io/badge/icq-uh%20oh!-fff?style=flat&logo=wechat&label=ICQ&labelColor=5B595C&color=78DCE8) ![Bees](https://img.shields.io/badge/bees-approximately%20seven-fff?style=flat&logo=honeybadger&logoColor=FFFFFF&label=bees&labelColor=5B595C&color=FFD866) ![Winamp](https://img.shields.io/badge/winamp-it%20really%20whips-fff?style=flat&logo=musicbrainz&label=winamp&labelColor=5B595C&color=A9DC76) ![Bees 2](https://img.shields.io/badge/bees-still%20approximately%20seven-fff?style=flat&logo=honey&label=bees&labelColor=5B595C&color=FFD866) ![Printer](https://img.shields.io/badge/printer-offline-fff?style=flat&logo=hp&label=printer&labelColor=5B595C&color=FF6188) ![Best Viewed In](https://img.shields.io/badge/best%20viewed%20in-IE6-fff?style=flat&logo=internetexplorer&label=browser&labelColor=5B595C&color=78DCE8) ![YouTube](https://img.shields.io/badge/youtube-240p-fff?style=flat&logo=youtube&label=quality&labelColor=5B595C&color=FF6188)

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

### From Obsidian Community Plugins

**May not be approved yet**

1. Open Settings > Community Plugins
2. Search for "Mermaid Version"
3. Click Install, then Enable

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release
2. Create a folder `mermaid-version` in your vault's `.obsidian/plugins/` directory
3. Copy the downloaded files into the folder
4. Enable the plugin in Settings > Community Plugins

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
