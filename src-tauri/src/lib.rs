use tauri_plugin_sql::{Migration, MigrationKind};

const KEYRING_SERVICE: &str = "com.deepgym.desktop";

#[tauri::command]
fn credential_get(key: String) -> Result<Option<String>, String> {
  let entry = keyring::Entry::new(KEYRING_SERVICE, &key).map_err(|error| error.to_string())?;
  match entry.get_password() {
    Ok(value) => Ok(Some(value)),
    Err(keyring::Error::NoEntry) => Ok(None),
    Err(error) => Err(error.to_string()),
  }
}

#[tauri::command]
fn credential_set(key: String, value: String) -> Result<(), String> {
  let entry = keyring::Entry::new(KEYRING_SERVICE, &key).map_err(|error| error.to_string())?;
  entry.set_password(&value).map_err(|error| error.to_string())
}

#[tauri::command]
fn credential_delete(key: String) -> Result<(), String> {
  let entry = keyring::Entry::new(KEYRING_SERVICE, &key).map_err(|error| error.to_string())?;
  match entry.delete_credential() {
    Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
    Err(error) => Err(error.to_string()),
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let migrations = vec![
    Migration {
      version: 1,
      description: "create_workout_tables",
      sql: include_str!("../migrations/0001_workouts.sql"),
      kind: MigrationKind::Up,
    },
    Migration {
      version: 2,
      description: "add_account_sync",
      sql: include_str!("../migrations/0002_account_sync.sql"),
      kind: MigrationKind::Up,
    },
  ];

  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![credential_get, credential_set, credential_delete])
    .plugin(
      tauri_plugin_sql::Builder::default()
        .add_migrations("sqlite:deepgym.db", migrations)
        .build(),
    )
    .run(tauri::generate_context!())
    .expect("DeepGYM failed to start");
}
