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
    pub project_id: u64,
    pub tracker: String,
    pub assignee: Option<String>,
    pub assignee_id: Option<u64>,
    pub created_at: String,
    pub updated_at: String,
    pub url: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NamedValue {
    pub id: u64,
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
    #[serde(default)]
    pub assigned_to: Option<NamedValue>,
    pub created_on: String,
    pub updated_on: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TicketFilter {
    AssignedToMe,
    WatchedByMe,
    CreatedByMe,
    AllOpen,
}

#[derive(Debug, Deserialize)]
struct RedmineIssuesResponse {
    issues: Vec<RedmineIssue>,
    total_count: u64,
    offset: u64,
    limit: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IssueStatus {
    pub id: u64,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RedmineProject {
    pub id: u64,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RedmineTracker {
    pub id: u64,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct IssuePriority {
    pub id: u64,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RedmineUser {
    pub id: u64,
    pub name: String,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NewTicket {
    pub subject: String,
    pub project_id: u64,
    pub tracker_id: u64,
    pub priority_id: Option<u64>,
    pub status_id: Option<u64>,
    pub assigned_to_id: Option<u64>,
    pub description: Option<String>,
    #[serde(default)]
    pub attachments: Vec<NewTicketAttachment>,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NewTicketAttachment {
    pub filename: String,
    pub content_type: String,
    pub content: Vec<u8>,
}

#[derive(Debug, Deserialize)]
struct IssueStatusesResponse {
    issue_statuses: Vec<IssueStatus>,
}

#[derive(Debug, Deserialize)]
struct ProjectsResponse {
    projects: Vec<RedmineProject>,
    total_count: u64,
    offset: u64,
    limit: u64,
}

#[derive(Debug, Deserialize)]
struct TrackersResponse {
    trackers: Vec<RedmineTracker>,
}

#[derive(Debug, Deserialize)]
struct IssuePrioritiesResponse {
    issue_priorities: Vec<IssuePriority>,
}

#[derive(Debug, Deserialize)]
struct MembershipsResponse {
    memberships: Vec<ProjectMembership>,
}

#[derive(Debug, Deserialize)]
struct ProjectMembership {
    user: Option<RedmineUser>,
}

#[derive(Debug, Serialize)]
struct StatusUpdateIssue {
    status_id: u64,
}

#[derive(Debug, Serialize)]
struct AssigneeUpdateIssue {
    assigned_to_id: u64,
}

#[derive(Debug, Serialize)]
struct CommentUpdateIssue {
    notes: String,
    #[serde(skip_serializing_if = "is_false")]
    private_notes: bool,
}

#[derive(Debug, Serialize)]
struct CreateIssue {
    subject: String,
    project_id: u64,
    tracker_id: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    priority_id: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    status_id: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    assigned_to_id: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    uploads: Option<Vec<CreateIssueUpload>>,
}

#[derive(Debug, Serialize)]
struct CreateIssueUpload {
    token: String,
    filename: String,
    content_type: String,
}

#[derive(Debug, Deserialize)]
struct UploadResponse {
    upload: UploadedFile,
}

#[derive(Debug, Deserialize)]
struct UploadedFile {
    token: String,
}

#[derive(Debug, Serialize)]
struct UpdateIssueBody<T> {
    issue: T,
}

fn is_false(value: &bool) -> bool {
    !value
}

pub fn normalize_issue(base_url: &str, issue: RedmineIssue) -> Ticket {
    let base_url = base_url.trim_end_matches('/');
    Ticket {
        id: issue.id,
        subject: issue.subject,
        status: issue.status.name,
        priority: issue.priority.name,
        project: issue.project.name,
        project_id: issue.project.id,
        tracker: issue.tracker.name,
        assignee: issue.assigned_to.as_ref().map(|assignee| assignee.name.clone()),
        assignee_id: issue.assigned_to.map(|assignee| assignee.id),
        created_at: issue.created_on,
        updated_at: issue.updated_on,
        url: format!("{base_url}/issues/{}", issue.id),
    }
}

pub fn open_tickets_url(base_url: &str, filter: TicketFilter, offset: u64) -> String {
    let filter_query = match filter {
        TicketFilter::AssignedToMe => "status_id=open&assigned_to_id=me",
        TicketFilter::WatchedByMe => "status_id=open&watcher_id=me",
        TicketFilter::CreatedByMe => "status_id=open&author_id=me",
        TicketFilter::AllOpen => "status_id=open",
    };

    format!(
        "{}/issues.json?{filter_query}&limit=100&offset={offset}",
        base_url.trim_end_matches('/')
    )
}

pub fn issue_update_url(base_url: &str, issue_id: u64) -> String {
    format!("{}/issues/{issue_id}.json", base_url.trim_end_matches('/'))
}

pub fn issue_create_url(base_url: &str) -> String {
    format!("{}/issues.json", base_url.trim_end_matches('/'))
}

pub fn upload_url(base_url: &str, filename: &str) -> String {
    let encoded_filename: String =
        url::form_urlencoded::byte_serialize(filename.as_bytes()).collect();
    format!(
        "{}/uploads.json?filename={encoded_filename}",
        base_url.trim_end_matches('/')
    )
}

pub fn projects_url(base_url: &str, offset: u64) -> String {
    format!(
        "{}/projects.json?limit=100&offset={offset}",
        base_url.trim_end_matches('/')
    )
}

fn has_more_project_pages(response: &ProjectsResponse) -> bool {
    response.offset + response.limit < response.total_count
}

fn has_more_issue_pages(response: &RedmineIssuesResponse) -> bool {
    response.offset + response.limit < response.total_count
}

pub fn trackers_url(base_url: &str) -> String {
    format!("{}/trackers.json", base_url.trim_end_matches('/'))
}

pub fn issue_priorities_url(base_url: &str) -> String {
    format!(
        "{}/enumerations/issue_priorities.json",
        base_url.trim_end_matches('/')
    )
}

pub fn project_memberships_url(base_url: &str, project_id: u64) -> String {
    format!(
        "{}/projects/{project_id}/memberships.json?limit=100",
        base_url.trim_end_matches('/'),
    )
}

pub fn validate_comment(comment: &str) -> Result<(), String> {
    if comment.trim().is_empty() {
        return Err("Comment must not be empty".to_string());
    }

    Ok(())
}

pub fn validate_new_ticket(ticket: &NewTicket) -> Result<(), String> {
    if ticket.subject.trim().is_empty() {
        return Err("Ticket subject must not be empty".to_string());
    }

    if ticket.project_id == 0 {
        return Err("Ticket project must be positive".to_string());
    }

    if ticket.tracker_id == 0 {
        return Err("Ticket tracker must be positive".to_string());
    }

    if ticket
        .attachments
        .iter()
        .any(|attachment| attachment.filename.trim().is_empty())
    {
        return Err("Ticket attachment filename must not be empty".to_string());
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

async fn fetch_open_tickets_with_filter(
    settings: RedmineSettings,
    filter: TicketFilter,
) -> Result<Vec<Ticket>, String> {
    settings.validate()?;

    let client = redmine_client();
    let mut offset = 0;
    let mut tickets = Vec::new();

    loop {
        let request_url = open_tickets_url(&settings.base_url, filter, offset);

        let response = client
            .get(request_url)
            .header("X-Redmine-API-Key", &settings.api_key)
            .send()
            .await
            .map_err(|_| "Network failure while contacting Redmine".to_string())?;

        map_redmine_response_status(response.status())?;

        let parsed = response
            .json::<RedmineIssuesResponse>()
            .await
            .map_err(|_| "Redmine returned an unexpected response".to_string())?;

        offset = parsed.offset + parsed.limit;
        let has_more_pages = has_more_issue_pages(&parsed);
        tickets.extend(
            parsed
                .issues
                .into_iter()
                .map(|issue| normalize_issue(&settings.base_url, issue)),
        );

        if !has_more_pages {
            break;
        }
    }

    Ok(tickets)
}

#[tauri::command]
pub async fn fetch_my_open_tickets(settings: RedmineSettings) -> Result<Vec<Ticket>, String> {
    fetch_open_tickets_with_filter(settings, TicketFilter::AssignedToMe).await
}

#[tauri::command]
pub async fn fetch_watched_open_tickets(settings: RedmineSettings) -> Result<Vec<Ticket>, String> {
    fetch_open_tickets_with_filter(settings, TicketFilter::WatchedByMe).await
}

#[tauri::command]
pub async fn fetch_created_open_tickets(settings: RedmineSettings) -> Result<Vec<Ticket>, String> {
    fetch_open_tickets_with_filter(settings, TicketFilter::CreatedByMe).await
}

#[tauri::command]
pub async fn fetch_open_tickets(settings: RedmineSettings) -> Result<Vec<Ticket>, String> {
    fetch_open_tickets_with_filter(settings, TicketFilter::AllOpen).await
}

#[tauri::command]
pub async fn fetch_tickets(settings: RedmineSettings) -> Result<Vec<Ticket>, String> {
    fetch_my_open_tickets(settings).await
}

#[tauri::command]
pub async fn create_ticket(settings: RedmineSettings, ticket: NewTicket) -> Result<(), String> {
    settings.validate()?;
    validate_new_ticket(&ticket)?;
    let client = redmine_client();

    let description = ticket.description.and_then(|value| {
        let trimmed_value = value.trim().to_string();
        if trimmed_value.is_empty() {
            None
        } else {
            Some(trimmed_value)
        }
    });
    let mut uploads = Vec::new();

    for attachment in &ticket.attachments {
        let response = client
            .post(upload_url(&settings.base_url, attachment.filename.trim()))
            .header("X-Redmine-API-Key", &settings.api_key)
            .header("Content-Type", "application/octet-stream")
            .body(attachment.content.clone())
            .send()
            .await
            .map_err(|_| "Network failure while uploading Redmine attachment".to_string())?;

        map_redmine_response_status(response.status())?;

        let parsed = response
            .json::<UploadResponse>()
            .await
            .map_err(|_| "Redmine returned an unexpected response".to_string())?;

        uploads.push(CreateIssueUpload {
            token: parsed.upload.token,
            filename: attachment.filename.trim().to_string(),
            content_type: attachment.content_type.trim().to_string(),
        });
    }

    let response = client
        .post(issue_create_url(&settings.base_url))
        .header("X-Redmine-API-Key", settings.api_key)
        .json(&UpdateIssueBody {
            issue: CreateIssue {
                subject: ticket.subject.trim().to_string(),
                project_id: ticket.project_id,
                tracker_id: ticket.tracker_id,
                priority_id: ticket.priority_id,
                status_id: ticket.status_id,
                assigned_to_id: ticket.assigned_to_id,
                description,
                uploads: if uploads.is_empty() {
                    None
                } else {
                    Some(uploads)
                },
            },
        })
        .send()
        .await
        .map_err(|_| "Network failure while creating Redmine ticket".to_string())?;

    map_redmine_response_status(response.status())
}

#[tauri::command]
pub async fn fetch_issue_statuses(settings: RedmineSettings) -> Result<Vec<IssueStatus>, String> {
    settings.validate()?;

    let request_url = format!(
        "{}/issue_statuses.json",
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
        .json::<IssueStatusesResponse>()
        .await
        .map_err(|_| "Redmine returned an unexpected response".to_string())?;

    Ok(parsed.issue_statuses)
}

#[tauri::command]
pub async fn fetch_projects(settings: RedmineSettings) -> Result<Vec<RedmineProject>, String> {
    settings.validate()?;

    let client = redmine_client();
    let mut offset = 0;
    let mut projects = Vec::new();

    loop {
        let response = client
            .get(projects_url(&settings.base_url, offset))
            .header("X-Redmine-API-Key", &settings.api_key)
            .send()
            .await
            .map_err(|_| "Network failure while contacting Redmine".to_string())?;

        map_redmine_response_status(response.status())?;

        let parsed = response
            .json::<ProjectsResponse>()
            .await
            .map_err(|_| "Redmine returned an unexpected response".to_string())?;

        offset = parsed.offset + parsed.limit;
        let has_more_pages = has_more_project_pages(&parsed);
        projects.extend(parsed.projects);

        if !has_more_pages {
            break;
        }
    }

    Ok(projects)
}

#[tauri::command]
pub async fn fetch_trackers(settings: RedmineSettings) -> Result<Vec<RedmineTracker>, String> {
    settings.validate()?;

    let response = redmine_client()
        .get(trackers_url(&settings.base_url))
        .header("X-Redmine-API-Key", settings.api_key)
        .send()
        .await
        .map_err(|_| "Network failure while contacting Redmine".to_string())?;

    map_redmine_response_status(response.status())?;

    let parsed = response
        .json::<TrackersResponse>()
        .await
        .map_err(|_| "Redmine returned an unexpected response".to_string())?;

    Ok(parsed.trackers)
}

#[tauri::command]
pub async fn fetch_issue_priorities(
    settings: RedmineSettings,
) -> Result<Vec<IssuePriority>, String> {
    settings.validate()?;

    let response = redmine_client()
        .get(issue_priorities_url(&settings.base_url))
        .header("X-Redmine-API-Key", settings.api_key)
        .send()
        .await
        .map_err(|_| "Network failure while contacting Redmine".to_string())?;

    map_redmine_response_status(response.status())?;

    let parsed = response
        .json::<IssuePrioritiesResponse>()
        .await
        .map_err(|_| "Redmine returned an unexpected response".to_string())?;

    Ok(parsed.issue_priorities)
}

#[tauri::command]
pub async fn fetch_assignable_users(
    settings: RedmineSettings,
    project_id: u64,
) -> Result<Vec<RedmineUser>, String> {
    settings.validate()?;

    let response = redmine_client()
        .get(project_memberships_url(&settings.base_url, project_id))
        .header("X-Redmine-API-Key", settings.api_key)
        .send()
        .await
        .map_err(|_| "Network failure while contacting Redmine".to_string())?;

    map_redmine_response_status(response.status())?;

    let parsed = response
        .json::<MembershipsResponse>()
        .await
        .map_err(|_| "Redmine returned an unexpected response".to_string())?;

    Ok(parsed
        .memberships
        .into_iter()
        .filter_map(|membership| membership.user)
        .collect())
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
pub async fn assign_ticket(
    settings: RedmineSettings,
    ticket_id: u64,
    user_id: u64,
) -> Result<(), String> {
    settings.validate()?;

    let response = redmine_client()
        .put(issue_update_url(&settings.base_url, ticket_id))
        .header("X-Redmine-API-Key", settings.api_key)
        .json(&UpdateIssueBody {
            issue: AssigneeUpdateIssue {
                assigned_to_id: user_id,
            },
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
    private_notes: bool,
) -> Result<(), String> {
    settings.validate()?;
    validate_comment(&comment)?;

    let response = redmine_client()
        .put(issue_update_url(&settings.base_url, ticket_id))
        .header("X-Redmine-API-Key", settings.api_key)
        .json(&UpdateIssueBody {
            issue: CommentUpdateIssue {
                notes: comment.trim().to_string(),
                private_notes,
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
                id: 1,
                name: "New".to_string(),
            },
            priority: NamedValue {
                id: 4,
                name: "Normal".to_string(),
            },
            project: NamedValue {
                id: 12,
                name: "Desktop".to_string(),
            },
            tracker: NamedValue {
                id: 2,
                name: "Bug".to_string(),
            },
            assigned_to: None,
            created_on: "2026-08-09T08:00:00Z".to_string(),
            updated_on: "2026-08-10T08:00:00Z".to_string(),
        };

        let ticket = normalize_issue("https://redmine.example.com/", issue);

        assert_eq!(ticket.id, 42);
        assert_eq!(ticket.project_id, 12);
        assert_eq!(ticket.created_at, "2026-08-09T08:00:00Z");
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
    fn builds_open_ticket_urls_for_each_ticket_view() {
        assert_eq!(
            open_tickets_url("https://redmine.example.com/", TicketFilter::AssignedToMe, 0),
            "https://redmine.example.com/issues.json?status_id=open&assigned_to_id=me&limit=100&offset=0"
        );
        assert_eq!(
            open_tickets_url("https://redmine.example.com/", TicketFilter::WatchedByMe, 100),
            "https://redmine.example.com/issues.json?status_id=open&watcher_id=me&limit=100&offset=100"
        );
        assert_eq!(
            open_tickets_url("https://redmine.example.com/", TicketFilter::CreatedByMe, 200),
            "https://redmine.example.com/issues.json?status_id=open&author_id=me&limit=100&offset=200"
        );
        assert_eq!(
            open_tickets_url("https://redmine.example.com/", TicketFilter::AllOpen, 300),
            "https://redmine.example.com/issues.json?status_id=open&limit=100&offset=300"
        );
    }

    #[test]
    fn detects_more_issue_pages() {
        let first_page = RedmineIssuesResponse {
            issues: vec![],
            total_count: 250,
            offset: 0,
            limit: 100,
        };
        let last_page = RedmineIssuesResponse {
            issues: vec![],
            total_count: 250,
            offset: 200,
            limit: 100,
        };

        assert!(has_more_issue_pages(&first_page));
        assert!(!has_more_issue_pages(&last_page));
    }

    #[test]
    fn normalizes_optional_assignee_into_ticket() {
        let issue = RedmineIssue {
            id: 43,
            subject: "Fix assignee summary".to_string(),
            status: NamedValue {
                id: 1,
                name: "New".to_string(),
            },
            priority: NamedValue {
                id: 4,
                name: "Normal".to_string(),
            },
            project: NamedValue {
                id: 12,
                name: "Desktop".to_string(),
            },
            tracker: NamedValue {
                id: 2,
                name: "Bug".to_string(),
            },
            assigned_to: Some(NamedValue {
                id: 7,
                name: "Mina Meyer".to_string(),
            }),
            created_on: "2026-08-09T08:00:00Z".to_string(),
            updated_on: "2026-08-10T08:00:00Z".to_string(),
        };

        let ticket = normalize_issue("https://redmine.example.com/", issue);

        assert_eq!(ticket.assignee, Some("Mina Meyer".to_string()));
        assert_eq!(ticket.assignee_id, Some(7));
    }

    #[test]
    fn rejects_blank_ticket_comment() {
        assert_eq!(
            validate_comment("   ").unwrap_err(),
            "Comment must not be empty"
        );
    }

    #[test]
    fn serializes_private_ticket_comment_update() {
        let body = UpdateIssueBody {
            issue: CommentUpdateIssue {
                notes: "Internal note".to_string(),
                private_notes: true,
            },
        };

        assert_eq!(
            serde_json::to_value(body).unwrap(),
            serde_json::json!({
                "issue": {
                    "notes": "Internal note",
                    "private_notes": true
                }
            })
        );
    }

    #[test]
    fn omits_public_ticket_comment_private_flag() {
        let body = UpdateIssueBody {
            issue: CommentUpdateIssue {
                notes: "Public note".to_string(),
                private_notes: false,
            },
        };

        assert_eq!(
            serde_json::to_value(body).unwrap(),
            serde_json::json!({
                "issue": {
                    "notes": "Public note"
                }
            })
        );
    }

    #[test]
    fn builds_project_memberships_url() {
        assert_eq!(
            project_memberships_url("https://redmine.example.com/", 12),
            "https://redmine.example.com/projects/12/memberships.json?limit=100"
        );
    }

    #[test]
    fn builds_issue_create_url_without_duplicate_slashes() {
        assert_eq!(
            issue_create_url("https://redmine.example.com/"),
            "https://redmine.example.com/issues.json"
        );
    }

    #[test]
    fn builds_projects_url() {
        assert_eq!(
            projects_url("https://redmine.example.com/", 100),
            "https://redmine.example.com/projects.json?limit=100&offset=100"
        );
    }

    #[test]
    fn detects_more_project_pages() {
        let response = ProjectsResponse {
            projects: vec![RedmineProject {
                id: 112,
                name: "Stadtwerke Borken/Westf. GmbH".to_string(),
            }],
            total_count: 125,
            offset: 100,
            limit: 100,
        };

        assert!(!has_more_project_pages(&response));

        let first_page = ProjectsResponse {
            projects: vec![],
            total_count: 125,
            offset: 0,
            limit: 100,
        };

        assert!(has_more_project_pages(&first_page));
    }

    #[test]
    fn builds_trackers_url() {
        assert_eq!(
            trackers_url("https://redmine.example.com/"),
            "https://redmine.example.com/trackers.json"
        );
    }

    #[test]
    fn builds_issue_priorities_url() {
        assert_eq!(
            issue_priorities_url("https://redmine.example.com/"),
            "https://redmine.example.com/enumerations/issue_priorities.json"
        );
    }

    #[test]
    fn rejects_ticket_without_subject() {
        let ticket = NewTicket {
            subject: "   ".to_string(),
            project_id: 12,
            tracker_id: 2,
            priority_id: Some(4),
            status_id: Some(1),
            assigned_to_id: None,
            description: None,
            attachments: vec![],
        };

        assert_eq!(
            validate_new_ticket(&ticket).unwrap_err(),
            "Ticket subject must not be empty"
        );
    }

    #[test]
    fn builds_upload_url_with_encoded_filename() {
        assert_eq!(
            upload_url("https://redmine.example.com/", "screen shot.png"),
            "https://redmine.example.com/uploads.json?filename=screen+shot.png"
        );
    }

    #[test]
    fn rejects_ticket_attachment_without_filename() {
        let ticket = NewTicket {
            subject: "Fix sidebar".to_string(),
            project_id: 12,
            tracker_id: 2,
            priority_id: Some(4),
            status_id: Some(1),
            assigned_to_id: None,
            description: None,
            attachments: vec![NewTicketAttachment {
                filename: "   ".to_string(),
                content_type: "image/png".to_string(),
                content: vec![1, 2, 3],
            }],
        };

        assert_eq!(
            validate_new_ticket(&ticket).unwrap_err(),
            "Ticket attachment filename must not be empty"
        );
    }
}
