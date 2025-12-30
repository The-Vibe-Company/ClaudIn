#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Start the Node.js server when the app starts
            let app_handle = app.handle().clone();
            
            std::thread::spawn(move || {
                start_server(&app_handle);
            });
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn start_server(app: &tauri::AppHandle) {
    use tauri_plugin_shell::ShellExt;
    
    // Get the path to the server directory
    // In development, we use the workspace path
    // In production, we'd bundle the server
    let server_script = if cfg!(debug_assertions) {
        std::env::current_dir()
            .unwrap()
            .parent()
            .unwrap()
            .parent()
            .unwrap()
            .join("server")
            .join("src")
            .join("index.ts")
    } else {
        // Production: bundled server (TODO: implement bundling)
        std::env::current_dir()
            .unwrap()
            .join("server")
            .join("index.js")
    };

    println!("Starting server from: {:?}", server_script);

    // Use tsx to run TypeScript directly in development
    let result = app
        .shell()
        .command("npx")
        .args(["tsx", server_script.to_str().unwrap()])
        .spawn();

    match result {
        Ok((_rx, child)) => {
            println!("Server started with PID: {:?}", child.pid());
        }
        Err(e) => {
            eprintln!("Failed to start server: {}", e);
        }
    }
}
