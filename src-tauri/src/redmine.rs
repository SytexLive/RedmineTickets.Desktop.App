use serde::{Deserialize, Serialize};

use crate::settings::RedmineSettings;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Ticket {
    pub id: u64,
    pub subject: String,
    pub status: String,
    pub priority: String,
    pub project: String,
    pub tracker: String,
    pub updated_at: String,
    pub url: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NamedValue {
    pub name: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RedmineIssue {
    pub id: u64,
    pub subject: String,
    pub status: NamedValue,
    pub priority: NamedValue,
    pub project: NamedValue,
    pub tracker: NamedValue,
    pub updated_on: String,
}

#[derive(Debug, Deserialize)]
struct RedmineIssuesResponse {
    issues: Vec<RedmineIssue>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IssueStatus {
    pub id: u64,
    pub name: String,
}

#[derive(Debug, Deserialize)]
struct IssueStatusesResponse {
    issue_statuses: Vec<IssueStatus>,
}

#[derive(Debug, Serialize)]
struct StatusUpdateIssue {
    status_id: u64,
}

#[derive(Debug, Serialize)]
struct CommentUpdateIssue {
    notes: String,
}

#[derive(Debug, Serialize)]
struct UpdateIssueBody<T> {
    issue: T,
}

pub fn normalize_issue(base_url: &str, issue: RedmineIssue) -> Ticket {
    let base_url = base_url.trim_end_matches('/');
    Ticket {
        id: issue.id,
        subject: issue.subject,
        status: issue.status.name,
        priority: issue.priority.name,
        project: issue.project.name,
        tracker: issue.tracker.name,
        updated_at: issue.updated_on,
        url: format!("{base_url}/issues/{}", issue.id),
    }
}

pub fn issue_update_url(base_url: &str, issue_id: u64) -> String {
    format!("{}/issues/{issue_id}.json", base_url.trim_end_matches('/'))
}

pub fn validate_comment(comment: &str) -> Result<(), String> {
    if comment.trim().is_empty() {
        return Err("Comment must not be empty".to_string());
    }

    Ok(())
}

fn redmine_client() -> reqwest::Client {
    reqwest::Client::new()
}

fn map_redmine_response_status(status: reqwest::StatusCode) -> Result<(), String> {
    if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
        return Err("Redmine authentication failed".to_string());
    }

    if !status.is_success() {
        return Err(format!("Redmine returned HTTP {status}"));
    }

    Ok(())
}

#[tauri::command]
pub async fn fetch_tickets(settings: RedmineSettings) -> Result<Vec<Ticket>, String> {
    settings.validate()?;

    let request_url = format!(
        "{}/issues.json?assigned_to_id=me&status_id=open",
        settings.base_url.trim_end_matches('/')
    );

    let response = redmine_client()
        .get(request_url)
        .header("X-Redmine-API-Key", settings.api_key)
        .send()
        .await
        .map_err(|_| "Network failure while contacting Redmine".to_string())?;

    map_redmine_response_status(response.status())?;

    let parsed = response
        .json::<RedmineIssuesResponse>()
        .await
        .map_err(|_| "Redmine returned an unexpected response".to_string())?;

    Ok(parsed
        .issues
        .into_iter()
        .map(|issue| normalize_issue(&settings.base_url, issue))
        .collect())
}

#[tauri::command]
pub async fn fetch_issue_statuses(settings: RedmineSettings) -> Result<Vec<IssueStatus>, String> {
    settings.validate()?;

    let request_url = format!("{}/issue_statuses.json", settings.base_url.trim_end_matches('/'));
    let response = redmine_client()
        .get(request_url)
        .header("X-Redmine-API-Key", settings.api_key)
        .send()
        .await
        .map_err(|_| "Network failure while contacting Redmine".to_string())?;

    map_redmine_response_status(response.status())?;

    let parsed = response
        .json::<IssueStatusesResponse>()
        .await
        .map_err(|_| "Redmine returned an unexpected response".to_string())?;

    Ok(parsed.issue_statuses)
}

#[tauri::command]
pub async fn update_ticket_status(
    settings: RedmineSettings,
    ticket_id: u64,
    status_id: u64,
) -> Result<(), String> {
    settings.validate()?;

    let response = redmine_client()
        .put(issue_update_url(&settings.base_url, ticket_id))
        .header("X-Redmine-API-Key", settings.api_key)
        .json(&UpdateIssueBody {
            issue: StatusUpdateIssue { status_id },
        })
        .send()
        .await
        .map_err(|_| "Network failure while updating Redmine ticket".to_string())?;

    map_redmine_response_status(response.status())
}

#[tauri::command]
pub async fn add_ticket_comment(
    settings: RedmineSettings,
    ticket_id: u64,
    comment: String,
) -> Result<(), String> {
    settings.validate()?;
    validate_comment(&comment)?;

    let response = redmine_client()
        .put(issue_update_url(&settings.base_url, ticket_id))
        .header("X-Redmine-API-Key", settings.api_key)
        .json(&UpdateIssueBody {
            issue: CommentUpdateIssue {
                notes: comment.trim().to_string(),
            },
        })
        .send()
        .await
        .map_err(|_| "Network failure while updating Redmine ticket".to_string())?;

    map_redmine_response_status(response.status())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_redmine_issue_into_ticket() {
        let issue = RedmineIssue {
            id: 42,
            subject: "Fix sidebar".to_string(),
            status: NamedValue {
                name: "New".to_string(),
            },
            priority: NamedValue {
                name: "Normal".to_string(),
            },
            project: NamedValue {
                name: "Desktop".to_string(),
            },
            tracker: NamedValue {
                name: "Bug".to_string(),
            },
            updated_on: "2026-08-10T08:00:00Z".to_string(),
        };

        let ticket = normalize_issue("https://redmine.example.com/", issue);

        assert_eq!(ticket.id, 42);
        assert_eq!(ticket.url, "https://redmine.example.com/issues/42");
    }

    #[test]
    fn builds_issue_update_url_without_duplicate_slashes() {
        assert_eq!(
            issue_update_url("https://redmine.example.com/", 42),
            "https://redmine.example.com/issues/42.json"
        );
    }

    #[test]
    fn rejects_blank_ticket_comment() {
        assert_eq!(
            validate_comment("   ").unwrap_err(),
            "Comment must not be empty"
        );
    }
}
