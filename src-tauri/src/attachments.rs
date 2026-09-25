use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AttachmentFile {
    filename: String,
    content_type: String,
    content: Vec<u8>,
}

fn content_type_for_path(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("pdf") => "application/pdf",
        Some("doc") => "application/msword",
        Some("docx") => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        Some("xls") => "application/vnd.ms-excel",
        Some("xlsx") => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        Some("ppt") => "application/vnd.ms-powerpoint",
        Some("pptx") => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        Some("csv") => "text/csv",
        Some("json") => "application/json",
        Some("log") | Some("txt") => "text/plain",
        Some("xml") => "application/xml",
        Some("gif") => "image/gif",
        Some("jpeg") | Some("jpg") => "image/jpeg",
        Some("png") => "image/png",
        Some("svg") => "image/svg+xml",
        Some("webp") => "image/webp",
        Some("zip") => "application/zip",
        _ => "application/octet-stream",
    }
}

fn read_attachment_files_impl(paths: Vec<String>) -> Result<Vec<AttachmentFile>, String> {
    paths
        .into_iter()
        .map(PathBuf::from)
        .map(|path| {
            let filename = path
                .file_name()
                .and_then(|filename| filename.to_str())
                .ok_or_else(|| "Could not determine attachment filename".to_string())?
                .to_string();
            let content =
                fs::read(&path).map_err(|_| format!("Could not read attachment {filename}"))?;

            Ok(AttachmentFile {
                filename,
                content_type: content_type_for_path(&path).to_string(),
                content,
            })
        })
        .collect()
}

#[tauri::command]
pub fn read_attachment_files(paths: Vec<String>) -> Result<Vec<AttachmentFile>, String> {
    read_attachment_files_impl(paths)
}

#[cfg(test)]
mod tests {
    use super::{content_type_for_path, read_attachment_files_impl, AttachmentFile};
    use std::fs;
    use std::path::Path;

    #[test]
    fn detects_pdf_and_docx_content_types() {
        assert_eq!(
            content_type_for_path(Path::new("report.pdf")),
            "application/pdf"
        );
        assert_eq!(
            content_type_for_path(Path::new("spec.docx")),
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        );
        assert_eq!(
            content_type_for_path(Path::new("archive.unknown")),
            "application/octet-stream"
        );
    }

    #[test]
    fn reads_dropped_file_content() {
        let path = std::env::temp_dir().join(format!(
            "redmine-tickets-attachment-{}-report.pdf",
            std::process::id()
        ));
        fs::write(&path, [1, 2, 3]).unwrap();

        let result = read_attachment_files_impl(vec![path.to_string_lossy().to_string()]);

        fs::remove_file(&path).unwrap();
        assert_eq!(
            result.unwrap(),
            vec![AttachmentFile {
                filename: path.file_name().unwrap().to_string_lossy().to_string(),
                content_type: "application/pdf".to_string(),
                content: vec![1, 2, 3],
            }]
        );
    }
}
