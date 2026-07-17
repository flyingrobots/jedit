use std::env;
use std::io::{self, BufRead, Write};
use std::path::PathBuf;

use jedit_echo_host::host::JeditEchoHost;
use jedit_echo_host::protocol::{HostRequest, HostResponse};

const WAL_DIR_ENV: &str = "JEDIT_ECHO_WAL_DIR";
const DEFAULT_WAL_DIR: &str = ".jedit/echo-wal";

fn main() -> anyhow::Result<()> {
    let wal_root = env::var_os(WAL_DIR_ENV)
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(DEFAULT_WAL_DIR));
    let mut host = JeditEchoHost::open(&wal_root)?;
    let stdin = io::stdin();
    let mut stdout = io::BufWriter::new(io::stdout().lock());
    for line in stdin.lock().lines() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }
        let response = match serde_json::from_str::<HostRequest>(&line) {
            Ok(request) => host.handle(request),
            Err(error) => HostResponse::Obstructed {
                request_id: 0,
                code: "invalid-protocol-request".to_owned(),
                message: error.to_string(),
            },
        };
        serde_json::to_writer(&mut stdout, &response)?;
        stdout.write_all(b"\n")?;
        stdout.flush()?;
    }
    Ok(())
}
