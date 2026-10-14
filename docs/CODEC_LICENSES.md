# Image codec dependencies

HEIC decoding uses heic-decode 2.1.0 (ISC) and libheif-js (LGPL-3.0) in external Node worker threads. Keep upstream copyright/license notices and LGPL obligations in deployment distributions; permit replacement of the external decoder module and make its corresponding source available as required. This project does not claim legal review of a production distribution.

Sources: https://github.com/catdad-experiments/heic-decode and https://github.com/catdad-experiments/libheif-js . Package versions are frozen in package-lock.json. No library source was copied into the application. The generated test image is synthetic.

HEIF processing is capped at 3 MB compressed, 12 million decoded pixels, a single frame, two active workers per process and a 10-second worker deadline. Multi-frame/oversized/unsupported files fail safely. Validate target deployment memory, file tracing and phone-orientation behavior before production; the server bundle explicitly traces external decoder assets. These are operational safeguards, not clinical validation.
