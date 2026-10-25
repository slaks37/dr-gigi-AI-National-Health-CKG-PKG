# Oral classifier — private artifact verification

On 2026-10-24 (Asia/Jakarta), the explicitly authorized [Kaggle Keras/default version 1 artifact](https://www.kaggle.com/models/abdelhameednasr/oral-disease-trained-model/Keras/default/1) was downloaded from the public versioned API endpoint into a private directory outside application Git. Public model-instance metadata declares **CC BY 4.0**. This grant does not resolve the separate training dataset's **Unknown** license, source-code license, patient-grouping or class-order provenance.

| Observed artifact | Result |
| --- | --- |
| Download | Versioned endpoint `/api/v1/models/abdelhameednasr/oral-disease-trained-model/keras/default/1/download`; no provider API key or dataset image access |
| Archive | 44,871,325 bytes; SHA-256 `e805c059878ca123dd3f41cc8d9d314032ffec5ee97b423e918078f6ba7a2ae0` |
| HDF5 checkpoint | `best_pretrained_EfficientNetB0_model.h5`; 49,339,888 bytes; SHA-256 `4d4735b624affe6c6fda4b9033eee02bd728b4b188b59e6c5ceb200ebb1073c3` |
| Published upstream SHA-256 | Not supplied by inspected metadata; both hashes above are **local observations**, not publisher attestations |
| Archive controls | Download bounded to 100 MB; absolute/traversal names, symlinks and hardlinks rejected; total regular-file bytes bounded; extracted only exact expected HDF5 basename |
| Storage | Private folder outside application repository; outer workspace `/private-research-models/` ignored; private directory mode 0700 and checkpoint/archive mode 0600 |
| Data-only inspection | [Inspection report](additional-model-oral-hdf5-inspection.json), [artifact provenance](additional-model-oral-artifact-provenance.json) |
| Runtime / clinical evaluation | **NOT RUN / NOT OPERATIONAL**; no clinical capability established |

The HDF5 attributes identify Keras **3.13.2**, TensorFlow backend, a float32 input `[null,224,224,3]`, and a six-unit softmax output named `pred`. The graph contains internal 1/255 Rescaling, Normalization and channel-wise Rescaling. No class-name/id2label attribute binds the six outputs to the source's displayed names. That semantic mapping stays **UNVERIFIED**.

One Lambda layer, `lambda_6`, refers to a named `preprocess_input` function; no inline Lambda bytecode was found in the parsed configuration. This is still an explicit runtime admission blocker: no whole-model HDF5 loader was invoked. The [official Keras loading documentation](https://keras.io/api/models/model_saving_apis/model_saving_and_loading/) limits `safe_mode` protection to the Keras v3 format, so passing `safe_mode=True` to legacy HDF5 is insufficient. Do not solve compatibility by setting `safe_mode=False` or trusting arbitrary serialized custom functions.

Safe follow-up requires a reviewed compatible exporter or an explicitly constructed architecture with data-only weight loading, known preprocessing equivalence, dependency lock and negative contract tests. Any derived export must retain parent artifact hash, conversion code/version, exact tensor mapping and output equivalence evidence. That conversion was not attempted in this run; the current inference service/registry remains unchanged.

Reproduce the static inspection using a separate environment, substituting the private checkpoint location:

```sh
python3 -m venv /tmp/sonri-hdf5-inspection-venv
/tmp/sonri-hdf5-inspection-venv/bin/python -m pip install h5py==3.15.1 numpy==2.5.4
/tmp/sonri-hdf5-inspection-venv/bin/python -B scripts/model-readiness-inspect-h5.py \
  /private/location/best_pretrained_EfficientNetB0_model.h5 \
  --expected-sha256 4d4735b624affe6c6fda4b9033eee02bd728b4b188b59e6c5ceb200ebb1073c3 \
  --output /tmp/sonri-hdf5-inspection.json
```

The tool verifies the reviewed hash before opening HDF5, reads JSON attributes only and emits a compact graph summary. It performs no network operation, TensorFlow import, inference, training or diagnosis. A different artifact must undergo a new provenance review; changing the expected hash is not approval.
