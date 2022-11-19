#!/bin/bash

# get first argument
vault=$1

# check if path exists
if [ ! -d "$vault" ]; then
    echo "Vault does not exist, did you change the path in package.json?"
    exit 1  
fi

plugin_path="$1/.obsidian/plugins/obsidian-note-linker"

# create plugin directory if it does not exist

if [ ! -d "$plugin_path" ]; then
    echo "Creating plugin directory in $vault"
    mkdir -p "$plugin_path"
fi

# remove all files inside of the directory
echo "Removing old plugin files in $vault"
rm -rf "${plugin_path:?}"/*


# copy ./manifest.json, ./styles.css and ./main.js to ~/Desktop/YouTube/.obsidian/plugins/obsidian-note-linker/

echo "Copying new plugin files to $vault"
cp ./manifest.json "$plugin_path"
cp ./styles.css "$plugin_path"
cp ./main.js "$plugin_path"
touch "$plugin_path"/.hotreload

echo "Done"