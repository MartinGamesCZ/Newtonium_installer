use std::{
    collections::HashMap,
    env::{self, current_dir},
    fs,
    os::unix::process::CommandExt,
    path::PathBuf,
    process::Command,
};

use karen::RunningAs;
use mime_guess::MimeGuess;
use serde_json::Value;
use tao::{
    event::{ElementState, Event, MouseButton, WindowEvent},
    event_loop::{ControlFlow, EventLoop},
    window::WindowBuilder,
};
use wry::{
    http::{header::CONTENT_TYPE, Request, Response},
    WebViewBuilder,
};

const CFG_LINUX_PATH_APPLICATIONS: &str = "/usr/share/applications";

fn main() -> wry::Result<()> {
    let cfg = load_config().unwrap();
    let installer_cfg = cfg.get("installer").unwrap().as_object().unwrap().clone();
    let app_cfg = cfg.get("app").unwrap().as_object().unwrap().clone();
    let c_app_cfg = app_cfg.clone();

    let event_loop = EventLoop::new();
    let window = WindowBuilder::new()
        .with_title(installer_cfg.get("title").unwrap().as_str().unwrap())
        .build(&event_loop)
        .unwrap();

    #[cfg(any(
        target_os = "windows",
        target_os = "macos",
        target_os = "ios",
        target_os = "android"
    ))]
    let builder = WebViewBuilder::new(&window);

    #[cfg(not(any(
        target_os = "windows",
        target_os = "macos",
        target_os = "ios",
        target_os = "android"
    )))]
    let builder = {
        use tao::platform::unix::WindowExtUnix;
        use wry::WebViewBuilderExtUnix;
        let vbox = window.default_vbox().unwrap();
        WebViewBuilder::new_gtk(vbox)
    };

    let (tx, rx) = std::sync::mpsc::channel();

    let _webview = builder
        .with_url(match env::var("NEWTONIUM_DEV") {
            Ok(_) => "http://localhost:3000",
            Err(_) => "nai://localhost",
        })
        .with_custom_protocol("nai".into(), move |req| match get_proto_response(req) {
            Ok(r) => r.map(Into::into),
            Err(e) => Response::builder()
                .header(CONTENT_TYPE, "text/plain")
                .status(500)
                .body(e.to_string().as_bytes().to_vec())
                .unwrap()
                .map(Into::into),
        })
        .with_devtools(true)
        .with_ipc_handler(move |msg| {
            let data = msg.body();
            let splitted: Vec<_> = data.split(";").collect();

            let action = splitted.get(0).unwrap();
            let json = splitted.get(1).unwrap();

            let m: HashMap<String, Value> = serde_json::from_str(json).unwrap();

            match action {
                &"install" => {
                    println!("Installing: {:?}", m.get("location").unwrap());

                    tx.send("progress;.".to_string()).unwrap();

                    let desktop_file = generate_desktop_file(
                        app_cfg.get("name").unwrap().as_str().unwrap(),
                        PathBuf::new()
                            .join(m.get("location").unwrap().as_str().unwrap().to_string())
                            .join(app_cfg.get("icon").unwrap().as_str().unwrap())
                            .to_str()
                            .unwrap()
                            .to_string(),
                        m.get("location").unwrap().as_str().unwrap().to_string(),
                    );

                    fs::write(
                        current_dir().unwrap().join(
                            app_cfg
                                .get("package_name")
                                .unwrap()
                                .as_str()
                                .unwrap()
                                .to_owned()
                                + ".desktop",
                        ),
                        desktop_file,
                    )
                    .unwrap();

                    let output = std::process::Command::new("pkexec")
                        .arg("sh")
                        .arg("-c")
                        .arg(
                            "mkdir -p ".to_owned()
                                + m.get("location").unwrap().as_str().unwrap()
                                + " && "
                                + "cp "
                                + current_dir()
                                    .unwrap()
                                    .join(
                                        app_cfg
                                            .get("package_name")
                                            .unwrap()
                                            .as_str()
                                            .unwrap()
                                            .to_owned()
                                            + ".desktop",
                                    )
                                    .to_str()
                                    .unwrap()
                                + " "
                                + CFG_LINUX_PATH_APPLICATIONS
                                + " && cp "
                                + current_dir()
                                    .unwrap()
                                    .join(app_cfg.get("icon").unwrap().as_str().unwrap())
                                    .to_str()
                                    .unwrap()
                                + " "
                                + PathBuf::new()
                                    .join(m.get("location").unwrap().as_str().unwrap())
                                    .join(app_cfg.get("icon").unwrap().as_str().unwrap())
                                    .to_str()
                                    .unwrap()
                                + " && chmod +x "
                                + PathBuf::new()
                                    .join(m.get("location").unwrap().as_str().unwrap())
                                    .join(app_cfg.get("icon").unwrap().as_str().unwrap())
                                    .to_str()
                                    .unwrap()
                                + " && "
                                + "cp "
                                + current_dir().unwrap().join("*").to_str().unwrap()
                                + " "
                                + m.get("location").unwrap().as_str().unwrap()
                                + "/ -r",
                        )
                        .output()
                        .expect("Nezdařilo se spustit pkexec");

                    if output.status.success() {
                        let _ = tx
                            .send("OK;".to_owned() + &String::from_utf8_lossy(&output.stdout))
                            .unwrap();
                    } else {
                        let _ = tx
                            .send("ERR;".to_owned() + &String::from_utf8_lossy(&output.stderr))
                            .unwrap();
                    }
                }
                &"launch" => {
                    let _ = Command::new("./newtonium_binaries/runner")
                        .current_dir(m.get("location").unwrap().as_str().unwrap())
                        .env(
                            "NEWTONIUM_ROOT",
                            m.get("location").unwrap().as_str().unwrap(),
                        )
                        .env("NEWTONIUM_BUN", "newtonium_binaries/bun")
                        .env("NEWTONIUM_ENTRYPOINT", "index.js")
                        .spawn()
                        .expect("Failed to start runner");

                    std::process::exit(0);
                }
                &"close" => {
                    std::process::exit(0);
                }
                _ => {}
            }
        })
        .with_drag_drop_handler(|e| {
            match e {
                wry::DragDropEvent::Enter { paths, position } => {
                    println!("DragEnter: {position:?} {paths:?} ")
                }
                wry::DragDropEvent::Over { position } => println!("DragOver: {position:?} "),
                wry::DragDropEvent::Drop { paths, position } => {
                    println!("DragDrop: {position:?} {paths:?} ")
                }
                wry::DragDropEvent::Leave => println!("DragLeave"),
                _ => {}
            }

            true
        })
        .with_initialization_script(
            format!(
                r#"
window.nai = {{
  title: `{}`,
  default_location: `{}`,
  icon: `{}`
}}"#,
                installer_cfg.get("title").unwrap().as_str().unwrap(),
                PathBuf::new()
                    .join("/usr/local")
                    .join(
                        c_app_cfg
                            .get("package_name")
                            .unwrap()
                            .as_str()
                            .unwrap()
                            .clone()
                    )
                    .to_str()
                    .unwrap(),
                current_dir()
                    .unwrap()
                    .join(c_app_cfg.get("icon").unwrap().as_str().unwrap().clone())
                    .to_str()
                    .unwrap()
            )
            .as_str(),
        )
        .build()?;

    event_loop.run(move |event, _, control_flow| {
        if let Ok(command) = rx.try_recv() {
            let splitted: Vec<_> = command.split(";").collect();

            println!("Command: {:?}", splitted);

            let _ = match splitted.get(0).unwrap() {
                &"OK" => _webview.evaluate_script("window.setStatus({type: 'ok', data: ''});"),
                &"ERR" => _webview.evaluate_script(
                    format!(
                        "window.setStatus({{type: 'err', data: `{}`}});",
                        splitted.get(1).unwrap()
                    )
                    .as_str(),
                ),
                _ => _webview.evaluate_script("window.setStatus({type: 'unknown', data: ''});"),
            };

            return;
        }

        match event {
            Event::WindowEvent { event, .. } => match event {
                WindowEvent::CloseRequested => *control_flow = ControlFlow::Exit,
                WindowEvent::MouseInput {
                    state: ElementState::Pressed,
                    button: MouseButton::Left,
                    ..
                } => window.drag_window().unwrap(),

                _ => (),
            },
            _ => (),
        }
    });
}

fn generate_desktop_file(name: &str, icon: String, location: String) -> String {
    format!(
        r#"[Desktop Entry]
Name={}
Exec=bash -ic "cd {}; NEWTONIUM_ROOT=. NEWTONIUM_BUN=newtonium_binaries/bun NEWTONIUM_ENTRYPOINT=index.js ./newtonium_binaries/runner"
Icon={}
Type=Application
Categories=Development"#,
        name, location, icon
    )
}

fn get_proto_response(
    request: Request<Vec<u8>>,
) -> Result<Response<Vec<u8>>, Box<dyn std::error::Error>> {
    let path = request.uri().path();

    let is_res = request
        .uri()
        .host()
        .unwrap()
        .to_string()
        .split("nai_res")
        .count()
        > 1;

    let root = PathBuf::from(if is_res { "/" } else { "installer_view" });

    let path = if path == "/" {
        "index.html"
    } else {
        &path[1..]
    };

    println!("Path: {}", root.join(path).to_str().unwrap());

    let content = std::fs::read(std::fs::canonicalize(root.join(path))?)?;

    println!("Serving: {}", path);

    let mimetype = MimeGuess::from_path(root.join(path))
        .first_or_octet_stream()
        .essence_str()
        .to_string();

    println!("Mimetype: {}", mimetype);

    Response::builder()
        .header(CONTENT_TYPE, mimetype)
        .body(content)
        .map_err(Into::into)
}

fn load_config() -> Result<HashMap<String, Value>, String> {
    let config = fs::read_to_string("newtonium.config.json").unwrap();
    let m: HashMap<String, Value> = serde_json::from_str(&config).unwrap();

    Ok::<HashMap<String, Value>, String>(m)
}
