# GitHub Pages deployment

The workflow in `.github/workflows/deploy.yml` runs the generator tests on pull requests and pushes to `master`. A successful push to `master` publishes the static app. The Pages artifact contains only `index.html`, `styles.css`, `app.js`, and `generator.mjs`.

## One-time repository setup

In the GitHub repository, open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**. The workflow does not enable this repository setting automatically.

After the workflow is committed and pushed to `master`, follow its run in the **Actions** tab. The expected site address for this repository is `https://radaelilucca.github.io/roomshape-sims/`.
