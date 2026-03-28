# Example: File Upload

## Scenario 1: User provides file path explicitly

User: "Upload my resume to the job application form"

Decision Path (adapt ref/mcpId based on snapshot mode):
```
1. browser_snapshot()  # find file input identifier
2. browser_click(element=<file-input-identifier>)
3. browser_file_upload(paths=["/absolute/path/resume.pdf"])
4. browser_wait_for(time=2)
5. browser_snapshot()  # verify upload success
```

## Scenario 2: User sends an attachment (image/PDF/file)

When the user sends an attachment along with their message, the system automatically includes attachment metadata in the message content:

```
[附件信息 - 可用于文件操作的本地路径]
- 文件名: screenshot.png, 本地路径: D:\uploads\abc123.png, 类型: image/png
```

**CRITICAL: Extract the local path from this metadata and use it directly with browser_file_upload.**

User: "Upload this image to the website" (with image attachment)

Decision Path:
```
1. Extract local path from attachment metadata: D:\uploads\abc123.png
2. browser_snapshot()  # find file input or upload button
3. browser_click(element=<upload-button-identifier>)  # if there's a visible button
4. browser_file_upload(paths=["D:\uploads\abc123.png"])  # use exact path from metadata
5. browser_wait_for(time=2)
6. browser_snapshot()  # verify upload success
```

**WRONG approaches (DO NOT use):**
- ❌ Using `browser_run_code` / `page.evaluate` to read the file — browser sandbox has NO access to local filesystem
- ❌ Using `read_file` to read the image and re-encode it — unnecessary and fragile
- ❌ Copying the file to another directory first — the original path is already accessible
- ❌ Trying to convert base64 data back to a file — the file already exists on disk

**CORRECT approach:**
- ✅ Extract the local path from "[附件信息 - 可用于文件操作的本地路径]" section
- ✅ Use `browser_file_upload(paths=["<extracted-path>"])` directly

## Finding the file input element

Some websites hide the actual `<input type="file">` element and show a styled button instead:

```html
<!-- Hidden file input -->
<input type="file" id="fileInput" style="display:none" mcpId="42">
<!-- Visible styled button -->
<button onclick="document.getElementById('fileInput').click()" mcpId="41">Choose File</button>
```

In this case:
1. Click the visible button first: `browser_click(mcpId=41)`
2. Then call `browser_file_upload(paths=["..."])` — it will find the hidden input automatically

See `guides/snapshot-modes.md` for ref vs mcpId usage.
