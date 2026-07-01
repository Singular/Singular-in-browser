# Browser UI dependencies

The workbench expects pinned local copies of xterm, xterm-fit, xterm-pty, and
KaTeX here.
They are intentionally not committed here. Fetch them with:

```bash
bash web-workbench/scripts/fetch-web-deps.sh
```

Expected generated files:

```text
public/vendor/xterm/xterm.css
public/vendor/xterm/xterm.js
public/vendor/xterm/addon-fit.js
public/vendor/xterm-pty/index.mjs
public/vendor/xterm-pty/workerTools.js
public/vendor/katex/katex.min.css
public/vendor/katex/katex.min.js
public/vendor/katex/fonts/
public/vendor/versions.json
```
