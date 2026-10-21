# Attributions

StrokeSense AI Lab is MIT licensed (see [LICENSE](LICENSE)). It builds on the
third-party software and assets below. License texts are available in each
project's own repository and in the installed packages under `node_modules`.

## Runtime and libraries

- **React and React DOM** (MIT License, Meta Platforms, Inc. and affiliates)
  https://react.dev
- **Vite** (MIT License, Evan You and contributors)
  https://vite.dev
- **lucide-react** (ISC License, Lucide contributors)
  https://lucide.dev

## Computer vision

- **MediaPipe** (Apache License 2.0, Copyright Google LLC)
  Used via `@mediapipe/tasks-vision` for face, pose, and hand landmark
  detection that runs locally in the browser. The WASM assets are self-hosted
  from `public/vision` (see `scripts/copy-vision-assets.mjs`); the model
  files are self-hosted as well and pinned to the package version.
  https://developers.google.com/mediapipe

## 3D (planned, not yet bundled)

- **Three.js** (MIT License, Three.js contributors)
  Planned for the 3D brain workspace reused by the Localization Challenge.
  This entry is recorded ahead of use so attribution is in place before the
  dependency lands.
  https://threejs.org

## Fonts (self-hosted via Fontsource)

- **DM Sans** (SIL Open Font License 1.1)
  https://fonts.google.com/specimen/DM+Sans
- **Manrope** (SIL Open Font License 1.1)
  https://fonts.google.com/specimen/Manrope

## Educational sources

Feature content and curated concepts reference public materials from the
American Heart Association / American Stroke Association, the National
Institute of Neurological Disorders and Stroke (NINDS), the U.S. Centers for
Disease Control and Prevention (CDC), and the Indonesian Ministry of Health
(Kemenkes). Source links in the app are supporting resources; they are not
evidence that generated statements are verified, and they do not imply
endorsement of this project.
