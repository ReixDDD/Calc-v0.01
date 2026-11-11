import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.dirname(__filename);
const isWindows = process.platform === 'win32';

function loadDotEnv(dotenvPath) {
  if (!fs.existsSync(dotenvPath)) return;
  try {
    const content = fs.readFileSync(dotenvPath, 'utf-8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || !line.includes('=')) continue;
      const eqIdx = line.indexOf('=');
      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      if (
        val.length >= 2 &&
        val[0] === val[val.length - 1] &&
        (val[0] === '"' || val[0] === "'")
      ) {
        val = val.slice(1, -1);
      }
      if (key && val !== '' && process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
  } catch {
    // ignore .env read errors
  }
}

loadDotEnv(path.join(rootDir, '.env'));

function findPythonCommand() {
  const candidates = isWindows ? ['python', 'python3', 'py'] : ['python3', 'python'];
  for (const cmd of candidates) {
    const res = spawnSync(cmd, ['--version'], { stdio: 'ignore', shell: false });
    if (!res.error && res.status === 0) {
      return cmd;
    }
  }
  return isWindows ? 'python' : 'python3';
}

function ensureBackendDependencies(pythonCmd) {
  const requiredImports = 'import flask, flask_cors, pymongo, argon2, waitress';
  const check = spawnSync(pythonCmd, ['-c', requiredImports], {
    cwd: rootDir,
    stdio: 'ignore',
  });

  if (check.status === 0) {
    return;
  }

  console.log('[dev] Installing Python backend dependencies from backend/requirements.txt...');
  const reqPath = path.join(rootDir, 'backend', 'requirements.txt');

  // Try standard pip install via python -m pip
  let installRes = spawnSync(pythonCmd, ['-m', 'pip', 'install', '-r', reqPath], {
    cwd: rootDir,
    stdio: 'ignore',
  });

  // On Linux environments with PEP 668 externally-managed-environment
  if (installRes.status !== 0 && !isWindows) {
    installRes = spawnSync(
      pythonCmd,
      ['-m', 'pip', 'install', '--break-system-packages', '-r', reqPath],
      {
        cwd: rootDir,
        stdio: 'ignore',
      }
    );
  }

  // Fallback to direct pip / pip3 executable if python -m pip is unavailable
  if (installRes.status !== 0) {
    const pipCmd = isWindows ? 'pip' : 'pip3';
    installRes = spawnSync(pipCmd, ['install', '-r', reqPath], {
      cwd: rootDir,
      stdio: 'ignore',
      shell: isWindows,
    });
  }

  const verifyAfterPip = spawnSync(pythonCmd, ['-c', requiredImports], {
    cwd: rootDir,
    stdio: 'ignore',
  });

  // Fallback for minimalist Linux x86_64 CPython 3.10 containers without pip:
  // strictly pinned wheels with mandatory SHA-256 digest verification and ZipSlip protection
  if (verifyAfterPip.status !== 0 && !isWindows) {
    console.log('[dev] Bootstrapping pinned Python wheels with SHA-256 verification...');
    const bootstrapScript = `
import hashlib, os, platform, site, sys, tempfile, urllib.request, zipfile

if sys.version_info[:2] != (3, 10) or platform.machine() != "x86_64":
    raise SystemExit("Pinned wheel bootstrap requires CPython 3.10 on x86_64; install pip instead.")

PINNED_WHEELS = [
    ("blinker-1.9.0-py3-none-any.whl", "ba0efaa9080b619ff2f3459d1d500c57bddea4a6b424b60a91141db6fd2f08bc", "https://files.pythonhosted.org/packages/10/cb/f2ad4230dc2eb1a74edf38f1a38b9b52277f75bef262d8908e60d957e13c/blinker-1.9.0-py3-none-any.whl"),
    ("click-8.1.8-py3-none-any.whl", "63c132bbbed01578a06712a2d1f497bb62d9c1c0d329b7903a866228027263b2", "https://files.pythonhosted.org/packages/7e/d4/7ebdbd03970677812aac39c869717059dbb71a4cfc033ca6e5221787892c/click-8.1.8-py3-none-any.whl"),
    ("itsdangerous-2.2.0-py3-none-any.whl", "c6242fc49e35958c8b15141343aa660db5fc54d4f13a1db01a3f5891b98700ef", "https://files.pythonhosted.org/packages/04/96/92447566d16df59b2a776c0fb82dbc4d9e07cd95062562af01e408583fc4/itsdangerous-2.2.0-py3-none-any.whl"),
    ("MarkupSafe-3.0.2-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl", "bbcb445fa71794da8f178f0f6d66789a28d7319071af7a496d4d507ed566270d", "https://files.pythonhosted.org/packages/22/35/137da042dfb4720b638d2937c38a9c2df83fe32d20e8c8f3185dbfef05f7/MarkupSafe-3.0.2-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl"),
    ("jinja2-3.1.5-py3-none-any.whl", "aba0f4dc9ed8013c424088f68a5c226f7d6097ed89b246d7749c2ec4175c6adb", "https://files.pythonhosted.org/packages/bd/0f/2ba5fbcd631e3e88689309dbe978c5769e883e4b84ebfe7da30b43275c5a/jinja2-3.1.5-py3-none-any.whl"),
    ("werkzeug-3.1.3-py3-none-any.whl", "54b78bf3716d19a65be4fceccc0d1d7b89e608834989dfae50ea87564639213e", "https://files.pythonhosted.org/packages/52/24/ab44c871b0f07f491e5d2ad12c9bd7358e527510618cb1b803a88e986db1/werkzeug-3.1.3-py3-none-any.whl"),
    ("flask-3.0.3-py3-none-any.whl", "34e815dfaa43340d1d15a5c3a02b8476004037eb4840b34910c6e21679d288f3", "https://files.pythonhosted.org/packages/61/80/ffe1da13ad9300f87c93af113edd0638c75138c42a0994becfacac078c06/flask-3.0.3-py3-none-any.whl"),
    ("Flask_Cors-4.0.1-py2.py3-none-any.whl", "f2a704e4458665580c074b714c4627dd5a306b333deb9074d0b1794dfa2fb677", "https://files.pythonhosted.org/packages/8b/52/2aa6285f104616f73ee1ad7905a16b2b35af0143034ad0cf7b64bcba715c/Flask_Cors-4.0.1-py2.py3-none-any.whl"),
    ("dnspython-2.7.0-py3-none-any.whl", "b4c34b7d10b51bcc3a5071e7b8dee77939f1e878477eeecc965e9835f63c6c86", "https://files.pythonhosted.org/packages/68/1b/e0a87d256e40e8c888847551b20a017a6b98139178505dc7ffb96f04e954/dnspython-2.7.0-py3-none-any.whl"),
    ("pymongo-4.15.3-cp310-cp310-manylinux2014_x86_64.manylinux_2_17_x86_64.manylinux_2_28_x86_64.whl", "45aebbd369ca79b7c46eaea5b04d2e4afca4eda117b68965a07a9da05d774e4d", "https://files.pythonhosted.org/packages/23/47/763945c63690d5c1a54d1d2ace352ba150b9e49a5cfdf44fb237e092e604/pymongo-4.15.3-cp310-cp310-manylinux2014_x86_64.manylinux_2_17_x86_64.manylinux_2_28_x86_64.whl"),
    ("pycparser-2.22-py3-none-any.whl", "c3702b6d3dd8c7abc1afa565d7e63d53a1d0bd86cdc24edd75470f4de499cfcc", "https://files.pythonhosted.org/packages/13/a3/a812df4e2dd5696d1f351d58b8fe16a405b234ad2886a0dab9183fb78109/pycparser-2.22-py3-none-any.whl"),
    ("cffi-1.17.1-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl", "2bb1a08b8008b281856e5971307cc386a8e9c5b625ac297e853d36da6efe9c17", "https://files.pythonhosted.org/packages/8d/fb/4da72871d177d63649ac449aec2e8a29efe0274035880c7af59101ca2232/cffi-1.17.1-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl"),
    ("argon2_cffi_bindings-21.2.0-cp36-abi3-manylinux_2_17_x86_64.manylinux2014_x86_64.whl", "b746dba803a79238e925d9046a63aa26bf86ab2a2fe74ce6b009a1c3f5c8f2ae", "https://files.pythonhosted.org/packages/ec/f7/378254e6dd7ae6f31fe40c8649eea7d4832a42243acaf0f1fff9083b2bed/argon2_cffi_bindings-21.2.0-cp36-abi3-manylinux_2_17_x86_64.manylinux2014_x86_64.whl"),
    ("argon2_cffi-23.1.0-py3-none-any.whl", "c670642b78ba29641818ab2e68bd4e6a78ba53b7eff7b4c3815ae16abf91c7ea", "https://files.pythonhosted.org/packages/a4/6a/e8a041599e78b6b3752da48000b14c8d1e8a04ded09c88c714ba047f34f5/argon2_cffi-23.1.0-py3-none-any.whl"),
    ("packaging-24.2-py3-none-any.whl", "09abb1bccd265c01f4a3aa3f7a7db064b36514d2cba19a2f694fe6150451a759", "https://files.pythonhosted.org/packages/88/ef/eb23f262cca3c0c4eb7ab1933c3b1f03d021f2c48f54763065b6f0e321be/packaging-24.2-py3-none-any.whl"),
    ("gunicorn-23.0.0-py3-none-any.whl", "ec400d38950de4dfd418cff8328b2c8faed0edb0d517d3394e457c317908ca4d", "https://files.pythonhosted.org/packages/cb/7d/6dac2a6e1eba33ee43f318edbed4ff29151a49b5d37f080aad1e6469bca4/gunicorn-23.0.0-py3-none-any.whl"),
    ("waitress-3.0.2-py3-none-any.whl", "c56d67fd6e87c2ee598b76abdd4e96cfad1f24cacdea5078d382b1f9d7b5ed2e", "https://files.pythonhosted.org/packages/8d/57/a27182528c90ef38d82b636a11f606b0cbb0e17588ed205435f8affe3368/waitress-3.0.2-py3-none-any.whl"),
]

site_dirs = [p for p in site.getsitepackages() if os.path.isdir(p) and os.access(p, os.W_OK)]
target_dir = os.path.realpath(site_dirs[0] if site_dirs else site.getusersitepackages())
os.makedirs(target_dir, exist_ok=True)

for filename, expected_sha256, wheel_url in PINNED_WHEELS:
    if not wheel_url.startswith("https://files.pythonhosted.org/"):
        raise RuntimeError(f"Untrusted wheel host for {filename}")
    with urllib.request.urlopen(wheel_url, timeout=30) as resp:
        payload = resp.read()
    actual_sha256 = hashlib.sha256(payload).hexdigest()
    if actual_sha256 != expected_sha256:
        raise RuntimeError(f"SHA-256 mismatch for {filename}: expected {expected_sha256}, got {actual_sha256}")
    with tempfile.NamedTemporaryFile(suffix=".whl", delete=False) as tmp:
        tmp.write(payload)
        tmp_path = tmp.name
    try:
        with zipfile.ZipFile(tmp_path, "r") as zf:
            for member in zf.infolist():
                dest_path = os.path.realpath(os.path.join(target_dir, member.filename))
                if dest_path != target_dir and not dest_path.startswith(target_dir + os.sep):
                    raise RuntimeError(f"Unsafe archive path in {filename}: {member.filename}")
            zf.extractall(target_dir)
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
`;
    const bootRes = spawnSync(pythonCmd, ['-c', bootstrapScript], {
      cwd: rootDir,
      stdio: 'inherit',
    });
    if (bootRes.status !== 0) {
      process.exit(1);
    }
  }

  const finalCheck = spawnSync(pythonCmd, ['-c', requiredImports], {
    cwd: rootDir,
    stdio: 'ignore',
  });
  if (finalCheck.status !== 0) {
    console.error(
      '[dev] Failed to verify required Python packages. Install dependencies manually via: pip install -r backend/requirements.txt'
    );
    process.exit(1);
  }
}

function waitForBackendPort(port, host = '127.0.0.1', timeoutMs = 10000) {
  const start = Date.now();
  return new Promise((resolve) => {
    const tryConnect = () => {
      const socket = new net.Socket();
      socket.setTimeout(400);
      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });
      const onFail = () => {
        socket.destroy();
        if (Date.now() - start >= timeoutMs) {
          resolve(false);
        } else {
          setTimeout(tryConnect, 150);
        }
      };
      socket.once('error', onFail);
      socket.once('timeout', onFail);
      socket.connect(port, host);
    };
    tryConnect();
  });
}

const pythonCmd = findPythonCommand();
ensureBackendDependencies(pythonCmd);

const backendScript = path.join(rootDir, 'backend', 'app.py');
const backendEnv = {
  ...process.env,
  AUTH_SECRET_KEY:
    process.env.AUTH_SECRET_KEY && process.env.AUTH_SECRET_KEY.trim().length >= 32
      ? process.env.AUTH_SECRET_KEY
      : 'local-development-secret-with-at-least-32-characters',
  PRINT_CALC_SEED_DEFAULT_USERS: process.env.PRINT_CALC_SEED_DEFAULT_USERS || '1',
};

const backendProc = spawn(pythonCmd, [backendScript], {
  cwd: rootDir,
  stdio: 'inherit',
  env: backendEnv,
});

backendProc.on('error', (err) => {
  console.error(`[dev] Failed to start Python backend (${pythonCmd}):`, err.message);
});

await waitForBackendPort(5000, '127.0.0.1', 10000);

const viteBin = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');
const viteHost = process.env.PRINT_CALC_DEV_HOST || '0.0.0.0';
const viteProc = spawn(process.execPath, [viteBin, '--port=3000', `--host=${viteHost}`], {
  cwd: rootDir,
  stdio: 'inherit',
});

let shuttingDown = false;

function cleanup() {
  if (shuttingDown) return;
  shuttingDown = true;

  if (backendProc && !backendProc.killed) {
    try {
      backendProc.kill('SIGTERM');
    } catch {
      // ignore
    }
  }
  if (viteProc && !viteProc.killed) {
    try {
      viteProc.kill('SIGTERM');
    } catch {
      // ignore
    }
  }
}

process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});

process.on('exit', () => {
  cleanup();
});

viteProc.on('exit', (code) => {
  cleanup();
  process.exit(code ?? 0);
});
