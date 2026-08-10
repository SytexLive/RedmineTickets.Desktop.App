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

#[tauri::command]
pub async fn fetch_tickets(settings: RedmineSettings) -> Result<Vec<Ticket>, String> {
    settings.validate()?;

    let request_url = format!(
        "{}/issues.json?assigned_to_id=me&status_id=open",
        settings.base_url.trim_end_matches('/')
    );

    let response = reqwest::Client::new()
        .get(request_url)
        .header("X-Redmine-API-Key", settings.api_key)
        .send()
        .await
        .map_err(|_| "Network failure while contacting Redmine".to_string())?;

    if response.status() == reqwest::StatusCode::UNAUTHORIZED
        || response.status() == reqwest::StatusCode::FORBIDDEN
    {
        return Err("Redmine authentication failed".to_string());
    }

    if !response.status().is_success() {
        return Err(format!("Redmine returned HTTP {}", response.status()));
    }

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
}
