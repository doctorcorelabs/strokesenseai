# MediaPipe model files

The rebuild loads MediaPipe Tasks Vision models from this site's own
origin, never from a CDN at runtime. The `.task` files live in
`public/models/` (served as `/models/<file>.task`) and the WASM fileset
lives in `public/mediapipe/wasm` (copied from the installed
`@mediapipe/tasks-vision` package, version 1.1.1).

All three models are the official float16 builds published by Google at
`storage.googleapis.com/mediapipe-models`. License: Apache 2.0, the same
as the MediaPipe framework.

## Downloaded files (verified 22 October 2026)

| Kind | File | Bytes | SHA-256 |
| --- | --- | --- | --- |
| face | `face_landmarker.task` | 3758596 | `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff` |
| pose | `pose_landmarker_lite.task` | 5777746 | `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a` |
| hand | `hand_landmarker.task` | 7819105 | `fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1` |

Source URLs:

- face: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`
- pose: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`
- hand: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`

## WASM fileset

Copied from `node_modules/@mediapipe/tasks-vision/wasm` into
`public/mediapipe/wasm` (about 39 MB on disk across the SIMD, module, and
no-SIMD variants; the browser downloads only the variant it needs). The
engine points `FilesetResolver.forVisionTasks` at `/mediapipe/wasm`.

## If a model file is missing at runtime

The engine checks nothing in advance and invents nothing. A missing or
unreadable model file makes `getLandmarker` reject with a
`ModelLoadError`, and the feature using it must show its cannot-analyze
state with that reason. There is no synthetic fallback and no CDN retry.
