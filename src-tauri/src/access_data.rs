//! SQLite still uses the existing SQL plugin for connection setup and migrations.
//! Its unrestricted query IPC is disabled; these commands enforce Rust access.
use rusqlite::{
    Connection, OpenFlags,
    types::{Value, ValueRef},
};
use serde_json::{Value as Json, json};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;

fn connect(app: &tauri::AppHandle, db: &str) -> Result<Connection, String> {
    let name = db
        .strip_prefix("sqlite:")
        .ok_or("Only SQLite is supported")?;
    let path = app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?
        .join(name);
    let conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_WRITE)
        .map_err(|e| e.to_string())?;
    conn.busy_timeout(std::time::Duration::from_secs(5))
        .map_err(|e| e.to_string())?;
    conn.pragma_update(None, "foreign_keys", true)
        .map_err(|e| e.to_string())?;
    Ok(conn)
}
fn values(input: Vec<Json>) -> Result<Vec<Value>, String> {
    input
        .into_iter()
        .map(|v| {
            Ok(match v {
                Json::Null => Value::Null,
                Json::Bool(b) => Value::Integer(b as i64),
                Json::Number(n) => {
                    if let Some(i) = n.as_i64() {
                        Value::Integer(i)
                    } else {
                        Value::Real(n.as_f64().ok_or("Invalid number")?)
                    }
                }
                Json::String(s) => Value::Text(s),
                _ => return Err("Unsupported SQL value".into()),
            })
        })
        .collect()
}
// SQLx resolves $N by numeric suffix, even when $2 appears before $1.
// rusqlite's positional binding does not, so preserve that contract explicitly.
fn bind(stmt: &mut rusqlite::Statement<'_>, input: Vec<Json>) -> Result<(), String> {
    let params = values(input)?;
    for ordinal in 1..=stmt.parameter_count() {
        let index = stmt
            .parameter_name(ordinal)
            .and_then(|name| name.strip_prefix('$').or_else(|| name.strip_prefix('?')))
            .and_then(|name| name.parse::<usize>().ok())
            .unwrap_or(ordinal);
        let value = params
            .get(index.checked_sub(1).ok_or("Invalid parameter")?)
            .ok_or("Missing SQL parameter")?;
        stmt.raw_bind_parameter(ordinal, value)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
fn select(conn: &Connection, query: &str, input: Vec<Json>) -> Result<Vec<Json>, String> {
    let mut stmt = conn.prepare(query).map_err(|e| e.to_string())?;
    if !stmt.readonly() {
        return Err("Use db_execute for writes.".into());
    }
    let names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
    bind(&mut stmt, input)?;
    let rows = stmt.raw_query().mapped(|row| {
        let mut object = serde_json::Map::new();
        for (i, name) in names.iter().enumerate() {
            let value = match row.get_ref(i)? {
                ValueRef::Null => Json::Null,
                ValueRef::Integer(n) => json!(n),
                ValueRef::Real(n) => json!(n),
                ValueRef::Text(s) => json!(String::from_utf8_lossy(s)),
                ValueRef::Blob(b) => json!(b),
            };
            object.insert(name.clone(), value);
        }
        Ok(Json::Object(object))
    });
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub async fn db_select(
    app: tauri::AppHandle,
    db: String,
    query: String,
    values: Vec<Json>,
) -> Result<Vec<Json>, String> {
    crate::access::require()?;
    tauri::async_runtime::spawn_blocking(move || {
        crate::access::require()?;
        let result = select(&connect(&app, &db)?, &query, values)?;
        crate::access::require()?;
        Ok(result)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn db_execute(
    app: tauri::AppHandle,
    db: String,
    query: String,
    values: Vec<Json>,
) -> Result<Json, String> {
    crate::access::require()?;
    tauri::async_runtime::spawn_blocking(move || {
        let mut conn = connect(&app, &db)?;
        let transaction = conn.transaction().map_err(|e| e.to_string())?;
        crate::access::require()?;
        let affected = {
            let mut stmt = transaction.prepare(&query).map_err(|e| e.to_string())?;
            bind(&mut stmt, values)?;
            stmt.raw_execute().map_err(|e| e.to_string())?
        };
        crate::access::require()?;
        let result =
            json!({"rowsAffected": affected, "lastInsertId": transaction.last_insert_rowid()});
        transaction.commit().map_err(|e| e.to_string())?;
        Ok(result)
    })
    .await
    .map_err(|e| e.to_string())?
}
const TABLES: &[&str] = &[
    "notes",
    "reminders",
    "events",
    "conversations",
    "conversation_messages",
    "event_alerts",
    "scripture_reflections",
    "faith_goals",
    "faith_checkins",
    "faith_reminder_state",
];
#[tauri::command]
pub async fn access_export_data(app: tauri::AppHandle, preferences: Json) -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let file = app
            .dialog()
            .file()
            .set_file_name("NEAR-personal-data.json")
            .add_filter("JSON", &["json"])
            .blocking_save_file();
        let Some(file) = file else {
            return Ok(false);
        };
        let mut data = serde_json::Map::new();
        let path = app
            .path()
            .app_config_dir()
            .map_err(|e| e.to_string())?
            .join("near.db");
        if path.exists() {
            let mut conn = connect(&app, "sqlite:near.db")?;
            let transaction = conn.transaction().map_err(|e| e.to_string())?;
            for table in TABLES {
                let exists: bool = transaction
                    .query_row(
                        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name=?1)",
                        [table],
                        |r| r.get(0),
                    )
                    .map_err(|e| e.to_string())?;
                if exists {
                    data.insert(
                        table.to_string(),
                        json!(select(
                            &transaction,
                            &format!("SELECT * FROM {table}"),
                            vec![]
                        )?),
                    );
                }
            }
        }
        let output =
            json!({"format": "near-personal-data-v1", "tables": data, "preferences": preferences});
        let path = file.into_path().map_err(|e| e.to_string())?;
        std::fs::write(
            path,
            serde_json::to_vec_pretty(&output).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;
        Ok(true)
    })
    .await
    .map_err(|e| e.to_string())?
}
fn purge(conn: &mut Connection) -> Result<(), String> {
    conn.pragma_update(None, "secure_delete", true)
        .map_err(|e| e.to_string())?;
    let transaction = conn.transaction().map_err(|e| e.to_string())?;
    for table in TABLES.iter().rev() {
        let exists: bool = transaction
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name=?1)",
                [table],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?;
        if exists {
            transaction
                .execute(&format!("DELETE FROM {table}"), [])
                .map_err(|e| e.to_string())?;
        }
    }
    transaction.commit().map_err(|e| e.to_string())?;
    conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE); VACUUM;")
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn access_delete_data(app: tauri::AppHandle) -> Result<(), String> {
    // Deliberately preserve the preview credential and server activation record.
    tauri::async_runtime::spawn_blocking(move || {
        let path = app
            .path()
            .app_config_dir()
            .map_err(|e| e.to_string())?
            .join("near.db");
        if path.exists() {
            let mut conn = connect(&app, "sqlite:near.db")?;
            purge(&mut conn)?;
        }
        crate::delete_credentials()?;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn preserves_sqlx_numbered_parameter_order_and_json_types() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("CREATE TABLE notes(id INTEGER PRIMARY KEY,title TEXT,content TEXT); INSERT INTO notes VALUES(1,'old','keep');").unwrap();
        let mut stmt = conn
            .prepare("UPDATE notes SET title=$2 WHERE id=$1")
            .unwrap();
        bind(&mut stmt, vec![json!(1), json!("A prayer's hope")]).unwrap();
        stmt.raw_execute().unwrap();
        let rows = select(&conn, "SELECT * FROM notes WHERE id=$1", vec![json!(1)]).unwrap();
        assert_eq!(
            rows[0],
            json!({"id":1,"title":"A prayer's hope","content":"keep"})
        );
        let rows = select(
            &conn,
            "SELECT $2 AS second, $1 AS first, $2 AS repeated",
            vec![Json::Null, json!(2.5)],
        )
        .unwrap();
        assert_eq!(rows[0], json!({"second":2.5,"first":null,"repeated":2.5}));
    }
    #[test]
    fn export_and_purge_preserve_schema_and_remove_personal_rows() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.pragma_update(None, "foreign_keys", true).unwrap();
        for migration in [include_str!("../migrations/0001_initial.sql")] {
            conn.execute_batch(migration).unwrap();
        }
        conn.execute_batch("INSERT INTO notes(title,content) VALUES('Prayer','Private words'); INSERT INTO reminders(title,due_at) VALUES('Sunday','2026-12-01'); INSERT INTO events(title,starts_at) VALUES('Church','2026-12-01');").unwrap();
        let exported = select(&conn, "SELECT * FROM notes", vec![]).unwrap();
        assert_eq!(exported[0]["content"], "Private words");
        purge(&mut conn).unwrap();
        assert!(
            select(&conn, "SELECT * FROM notes", vec![])
                .unwrap()
                .is_empty()
        );
        assert!(
            select(&conn, "SELECT * FROM reminders", vec![])
                .unwrap()
                .is_empty()
        );
        assert_eq!(exported[0]["content"], "Private words");
        conn.execute("INSERT INTO notes(title) VALUES('After deletion')", [])
            .unwrap();
    }
}
