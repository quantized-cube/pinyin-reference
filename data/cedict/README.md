# Pinned CC-CEDICT source

The `.txt.gz` snapshot is the original, unmodified CC-CEDICT download from MDBG.
`source.json` records its source URL, retrieval date, license and compressed-file
SHA-256. The filename includes that hash. It is kept in Git so a fresh checkout
can reproduce the example catalog without a local cache or a network connection.
The build does not copy this directory into the website.

Authors: CC-CEDICT contributors; CEDICT founder Paul Andrew Denisowski.
Publisher: [MDBG](https://www.mdbg.net/chinese/dictionary?page=cc-cedict).
License: [Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/).
Original attribution and license notices are also retained inside the snapshot.

`npm run data:refresh` uses this pinned input and validates the generated output.
`npm run data:check` verifies reproduction without rewriting the catalog.
Only `npm run data:update` downloads the latest source and changes the pin.
Review and commit the new snapshot, manifest and generated examples together.
Previous snapshots remain recoverable from Git history.
