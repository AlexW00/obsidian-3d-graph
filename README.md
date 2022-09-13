## Obsidian 3D Graph

A 3D Graph for Obsidian

### Showcase:

![showcase](docs/res/showcase.gif)

### ⬇️ Installation

This plugin is not in the [official community plugin list](https://obsidian.md/plugins) yet, so it can't be installed via the
built-in plugin manager. However, there are other ways to install it:

<details>
    <summary>Install via Plugins Galore (super easy)</summary>
        <ol>
            <li>
                Install the <a href="https://obsidian.md/plugins?id=plugins-galore">Plugin Galore</a> Obsidian plugin, which allows loading unofficial plugins.
            </li>
            <li>
            Follow the instructions on the <a href="https://github.com/plugins-galore/obsidian-plugins-galore#adding-a-plugin">Plugins Galore GitHub</a> to install Note Linker.
            </li>
        </ol>
    </details>
<details>
    <summary>Manual installation (easy)</summary>
        <ol>
            <li>
                Download the plugin (zip file) from <a href="https://github.com/AlexW00/obsidian-3d-graph/releases/latest"> here</a>.
            </li>
            <li>
                <span>
                Extract the contents of the zip file into your Obsidian plugins folder. <br>
                    <ul>
                        <li>
                        The folder is located at <code>MyVault/.obsidian/plugins</code>.
                        </li>
                        <li>
                        It can also be found by opening <code>Obsidian > settings > community plugins > installed plugins > small folder icon on the right side </code>.
                        </li>
                    </ul> 
                </span>            
            </li>
            <li>
            Enable the plugin by going to <code>Obsidian > settings > community plugins > installed plugins</code> and activating the toggle under "Note Linker" (you may need to re-open Obsidian to see the toggle).
            </li>
        </ol>
</details>

### 👨‍💻 Development

The plugin is written in TypeScript and uses D3.js for the graph rendering.
For more information please, check the [dev docs](docs/dev-docs.md).
