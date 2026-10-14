# SONRI dataset metadata audit — 14 October 2026

Authorized connected Drive discovery observed 3,521 unique files: 3,340 JPEG, 150 HEIF, 30 PNG and one QuickTime video; thus 3,520 image files. Forty folders were observed (34 first level plus six archive children); 25 direct folder listings contained zero files. Folder membership may overlap and must not be summed as independent images.

Two archive listings hit the connector's 1,000-item cap. Additional paginated image searches were merged by file ID. The complete dataset total is **not certified** because of listing caps and connector filter behavior. This is an observed snapshot, not a complete census.

No image bytes were downloaded or inspected. Pixel quality, dimensions, hashes, exact/near duplicates, patient grouping and clinical labels remain unassessed. Training-eligible observed files: zero. Private source IDs are retained only in the local protected inventory, outside Git; patient names are excluded. Public summary contains only aggregate MIME counts and sanitized category labels.

The read-only inventory CLI supports recursive Drive API pagination with incomplete-search/cycle guards. It requires separately supplied authorized connection credentials and private output path; no credentials are embedded. Connector discovery succeeded; CLI live access was not claimed.
