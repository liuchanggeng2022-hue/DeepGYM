use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let migrations = vec![Migration {
    version: 1,
    description: "create_workout_tables",
    sql: include_str!("../migrations/0001_workouts.sql"),
    kind: MigrationKind::Up,
  }];

  tauri::Builder::default()
    .plugin(
      tauri_plugin_sql::Builder::default()
        .add_migrations("sqlite:deepgym.db", migrations)
        .build(),
    )
    .run(tauri::generate_context!())
    .expect("DeepGYM failed to start");
}
