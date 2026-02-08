#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
#[cfg(target_os = "windows")]
use winreg::enums::*;
#[cfg(target_os = "windows")]
use winreg::RegKey;
use tauri::{
    image::Image,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, WebviewUrl, WebviewWindowBuilder,
    WindowEvent,
};

/// 托盘菜单位置数据
#[derive(Clone, Serialize)]
struct TrayMenuPosition {
    x: i32,
    y: i32,
}

/// 显示主窗口
fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        // 确保窗口可见
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// 确保托盘菜单窗口已创建（常驻隐藏，避免首次展示闪白）
fn ensure_tray_menu_window(app: &AppHandle) {
    if app.get_webview_window("tray-menu").is_some() {
        return;
    }

    // 初次创建时隐藏窗口，让 WebView 在后台完成初始渲染
    // 之后右键仅 reposition + show，不再每次重建窗口。
    let _ = WebviewWindowBuilder::new(
        app,
        "tray-menu",
        WebviewUrl::App("/tray-menu".into()),
    )
    .title("托盘菜单")
    .inner_size(236.0, 244.0)
    .decorations(false)
    .resizable(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .transparent(true)
    .shadow(false) // 禁用阴影以支持透明
    .visible(false) // 关键：初始隐藏，避免首次弹出露出白底
    .focused(false)
    .build();
}

/// 显示托盘菜单窗口
fn show_tray_menu(app: &AppHandle, x: i32, y: i32) {
    // 菜单窗口尺寸
    // 适当缩小整体体积，并确保内容不触发滚动条
    const MENU_WIDTH: f64 = 236.0;
    const MENU_HEIGHT: f64 = 244.0;
    const MARGIN: f64 = 8.0;

    // 确保窗口存在（常驻隐藏）
    ensure_tray_menu_window(app);

    // 获取点击位置所在的显示器信息
    let mut screen_width: f64 = 1920.0;
    let mut screen_height: f64 = 1080.0;
    let mut screen_x: f64 = 0.0;
    let mut screen_y: f64 = 0.0;
    
    if let Ok(monitors) = app.available_monitors() {
        for monitor in monitors {
            let pos = monitor.position();
            let size = monitor.size();
            let mon_x = pos.x as f64;
            let mon_y = pos.y as f64;
            let mon_w = size.width as f64;
            let mon_h = size.height as f64;
            
            // 检查点击位置是否在此显示器范围内
            if (x as f64) >= mon_x && (x as f64) < mon_x + mon_w 
                && (y as f64) >= mon_y && (y as f64) < mon_y + mon_h {
                screen_width = mon_w;
                screen_height = mon_h;
                screen_x = mon_x;
                screen_y = mon_y;
                break;
            }
        }
    }

    // 计算菜单位置（默认在托盘图标上方居中）
    let mut menu_x = (x as f64) - MENU_WIDTH / 2.0;
    let mut menu_y = (y as f64) - MENU_HEIGHT - MARGIN;

    // 确保菜单不超出屏幕右边界
    if menu_x + MENU_WIDTH > screen_x + screen_width - MARGIN {
        menu_x = screen_x + screen_width - MENU_WIDTH - MARGIN;
    }
    // 确保菜单不超出屏幕左边界
    if menu_x < screen_x + MARGIN {
        menu_x = screen_x + MARGIN;
    }
    // 如果上方空间不足，显示在托盘图标下方
    if menu_y < screen_y + MARGIN {
        menu_y = (y as f64) + MARGIN;
    }
    // 确保菜单不超出屏幕下边界
    if menu_y + MENU_HEIGHT > screen_y + screen_height - MARGIN {
        menu_y = screen_y + screen_height - MENU_HEIGHT - MARGIN;
    }

    // 展示/定位窗口（不重建，避免白框闪烁）
    if let Some(window) = app.get_webview_window("tray-menu") {
        // 右键再次点击：行为更贴近原生（可视时直接收起）
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
            return;
        }

        let _ = window.set_size(LogicalSize::new(MENU_WIDTH, MENU_HEIGHT));
        let _ = window.set_position(LogicalPosition::new(menu_x, menu_y));
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.emit("tray-menu-position", TrayMenuPosition { x, y });
    }
}

/// 隐藏托盘菜单窗口
fn hide_tray_menu(app: &AppHandle) {
    if let Some(menu_window) = app.get_webview_window("tray-menu") {
        let _ = menu_window.hide();
    }
}

/// Tauri 命令：关闭托盘菜单
#[tauri::command]
fn close_tray_menu(app: AppHandle) {
    hide_tray_menu(&app);
}

/// Tauri 命令：显示主窗口
#[tauri::command]
fn show_main_window_cmd(app: AppHandle) {
    show_main_window(&app);
}

/// Tauri 命令：让主窗口跳转到指定路由（用于托盘菜单等子窗口）
#[tauri::command]
fn navigate_main(app: AppHandle, path: String) {
    // 确保主窗口可见并聚焦
    show_main_window(&app);
    if let Some(window) = app.get_webview_window("main") {
        // 发送导航事件到主窗口（前端在 MainLayout 中监听）
        let _ = window.emit("efgh:navigate", serde_json::json!({ "path": path, "replace": true }));
    }
}

/// Tauri 命令：退出应用
#[tauri::command]
fn quit_app(app: AppHandle) {
    // 发送退出事件到主窗口
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.emit("tray-quit", ());
    }
    // 关闭托盘菜单
    hide_tray_menu(&app);
    // 延迟退出
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(100));
        std::process::exit(0);
    });
}

/// Tauri 命令：切换同步状态
#[tauri::command]
fn toggle_sync(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.emit("tray-toggle-sync", ());
    }
}

/// Tauri 命令：设置自动同步开关（避免“反向 toggle”导致状态不同步）
#[tauri::command]
fn set_auto_sync(app: AppHandle, enabled: bool) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.emit(
            "tray-set-auto-sync",
            serde_json::json!({ "enabled": enabled }),
        );
    }
}

/// Tauri 命令：准备数据库路径
///
/// 在 Rust 端完成所有文件系统操作（不受前端 FS 插件 scope 限制）：
/// 1. 在 exe 所在目录下创建 userdata/ 文件夹
/// 2. 如果新位置没有数据库，尝试从旧版默认位置（$APPDATA/<identifier>/）复制
/// 3. 返回完整的 sqlite: 连接字符串
#[tauri::command]
fn prepare_db_path(app: AppHandle) -> Result<String, String> {
    // —— 定位 exe 目录并构建目标路径 ——
    let exe_dir = std::env::current_exe()
        .map_err(|e| format!("获取 exe 路径失败: {}", e))?
        .parent()
        .ok_or_else(|| "无法获取 exe 所在目录".to_string())?
        .to_path_buf();

    let userdata_dir = exe_dir.join("userdata");
    let new_db = userdata_dir.join("efgacha.db");

    // —— 确保 userdata 目录存在 ——
    if !userdata_dir.exists() {
        std::fs::create_dir_all(&userdata_dir)
            .map_err(|e| format!("创建 userdata 目录失败: {}", e))?;
    }

    // —— 旧版数据自动迁移 ——
    // 旧版数据库存放在 Tauri 默认的 app_config_dir（$APPDATA/<identifier>/efgacha.db）。
    // 仅当新位置尚无数据库时才尝试迁移，防止覆盖已有数据。
    // 使用「复制」而非「移动」，旧文件保留作为安全备份。
    if !new_db.exists() {
        if let Ok(old_dir) = app.path().app_config_dir() {
            let old_db = old_dir.join("efgacha.db");
            if old_db.exists() {
                match std::fs::copy(&old_db, &new_db) {
                    Ok(bytes) => {
                        eprintln!(
                            "[db] 已从旧路径迁移数据库 ({} bytes): {:?} -> {:?}",
                            bytes, old_db, new_db
                        );
                    }
                    Err(e) => {
                        // 迁移失败不阻塞启动，程序会在新路径创建空数据库
                        eprintln!("[db] 数据库迁移失败: {}", e);
                    }
                }
            }
        }
    }

    // —— 返回 sqlite: 连接字符串 ——
    let db_path = new_db
        .to_str()
        .ok_or_else(|| "数据库路径编码无效".to_string())?;

    Ok(format!("sqlite:{}", db_path))
}

/// Tauri 命令：检测是否为便携版（通过注册表判断）
#[cfg(target_os = "windows")]
#[tauri::command]
fn is_portable() -> bool {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    hkcu.open_subkey(r"Software\Microsoft\Windows\CurrentVersion\Uninstall\com.efgachahelper.dev")
        .is_err()
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
fn is_portable() -> bool {
    true
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            close_tray_menu,
            show_main_window_cmd,
            navigate_main,
            quit_app,
            toggle_sync,
            set_auto_sync,
            prepare_db_path,
            is_portable
        ])
        .setup(|app| {
            // 加载托盘图标
            let icon = Image::from_path("icons/icon.png")
                .or_else(|_| Image::from_path("icons/32x32.png"))
                .unwrap_or_else(|_| {
                    // 如果找不到图标文件，使用默认图标
                    app.default_window_icon().cloned().unwrap()
                });

            // 创建托盘图标（不使用原生菜单）
            let _tray = TrayIconBuilder::new()
                .icon(icon)
                .tooltip("终末地抽卡助手")
                .menu_on_left_click(false)
                .on_tray_icon_event(|tray, event| {
                    match event {
                        TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } => {
                            hide_tray_menu(tray.app_handle());
                            show_main_window(tray.app_handle());
                        }
                        TrayIconEvent::Click {
                            button: MouseButton::Right,
                            button_state: MouseButtonState::Up,
                            position,
                            ..
                        } => {
                            show_tray_menu(
                                tray.app_handle(),
                                position.x as i32,
                                position.y as i32,
                            );
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            // 预创建托盘菜单窗口（隐藏），避免首次弹出闪白
            let app_handle = app.handle().clone();
            ensure_tray_menu_window(&app_handle);

            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                WindowEvent::CloseRequested { api, .. } => {
                    let label = window.label();
                    if label == "main" {
                        // 主窗口：阻止默认关闭行为
                        api.prevent_close();
                        let _ = window.emit("window-close-requested", ());
                    }
                    // 托盘菜单窗口：允许正常关闭
                }
                WindowEvent::Focused(focused) => {
                    // 托盘菜单窗口失去焦点时自动隐藏（不要 close，避免下次重建闪白）
                    if !focused && window.label() == "tray-menu" {
                        let _ = window.hide();
                    }
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("启动 Tauri 应用失败");
}

