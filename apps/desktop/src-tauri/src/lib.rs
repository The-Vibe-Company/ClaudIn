use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[tauri::command]
fn get_extension_path() -> Result<String, String> {
    let extension_dir = get_extension_dir()?;
    Ok(extension_dir.to_string_lossy().to_string())
}

#[tauri::command]
fn is_extension_extracted() -> Result<bool, String> {
    let extension_dir = get_extension_dir()?;
    let manifest_path = extension_dir.join("manifest.json");
    Ok(manifest_path.exists())
}

#[tauri::command]
fn extract_extension(app_handle: tauri::AppHandle) -> Result<String, String> {
    let extension_dir = get_extension_dir()?;
    
    if !extension_dir.exists() {
        fs::create_dir_all(&extension_dir).map_err(|e| e.to_string())?;
    }
    
    let resource_path = app_handle
        .path()
        .resource_dir()
        .map_err(|e: tauri::Error| e.to_string())?
        .join("extension");
    
    if resource_path.exists() {
        copy_dir_recursive(&resource_path, &extension_dir)?;
    }
    
    Ok(extension_dir.to_string_lossy().to_string())
}

#[tauri::command]
fn open_extension_folder() -> Result<(), String> {
    let extension_dir = get_extension_dir()?;
    
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&extension_dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&extension_dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&extension_dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[tauri::command]
fn open_chrome_extensions() -> Result<(), String> {
    let url = "chrome://extensions";
    
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-a", "Google Chrome", url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "chrome", url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("google-chrome")
            .arg(url)
            .spawn()
            .or_else(|_| {
                std::process::Command::new("chromium-browser")
                    .arg(url)
                    .spawn()
            })
            .map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[tauri::command]
fn mark_setup_complete() -> Result<(), String> {
    let config_dir = dirs::config_dir()
        .ok_or("Could not find config directory")?
        .join("claudin");
    
    fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    
    let setup_file = config_dir.join(".setup_complete");
    fs::write(&setup_file, "1").map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
fn is_setup_complete() -> Result<bool, String> {
    let config_dir = dirs::config_dir()
        .ok_or("Could not find config directory")?
        .join("claudin");
    
    let setup_file = config_dir.join(".setup_complete");
    Ok(setup_file.exists())
}

fn get_extension_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    Ok(home.join("ClaudIn").join("extension"))
}

fn copy_dir_recursive(src: &PathBuf, dst: &PathBuf) -> Result<(), String> {
    if !dst.exists() {
        fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    }
    
    for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let dest_path = dst.join(entry.file_name());
        
        if path.is_dir() {
            copy_dir_recursive(&path, &dest_path)?;
        } else {
            fs::copy(&path, &dest_path).map_err(|e| e.to_string())?;
        }
    }
    
    Ok(())
}

fn start_server(app: &tauri::AppHandle) {
    use tauri_plugin_shell::ShellExt;
    
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
        std::env::current_dir()
            .unwrap()
            .join("server")
            .join("index.js")
    };

    println!("Starting server from: {:?}", server_script);

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            get_extension_path,
            is_extension_extracted,
            extract_extension,
            open_extension_folder,
            open_chrome_extensions,
            mark_setup_complete,
            is_setup_complete,
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();
            
            std::thread::spawn(move || {
                start_server(&app_handle);
            });
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
