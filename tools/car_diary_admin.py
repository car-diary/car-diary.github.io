from __future__ import annotations

import importlib.util
import io
import json
import re
import shutil
import subprocess
import sys
import threading
import time
import traceback
import urllib.error
import urllib.request
import webbrowser
from contextlib import redirect_stderr, redirect_stdout
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from queue import Empty, Queue
import tkinter as tk
from tkinter import END, StringVar, Tk, messagebox, ttk

sys.dont_write_bytecode = True


def resolve_root_dir() -> Path:
    candidates: list[Path] = []
    if getattr(sys, "frozen", False):
        candidates.append(Path(sys.executable).resolve().parent)
    candidates.append(Path(__file__).resolve().parents[1])
    candidates.append(Path.cwd())

    for candidate in candidates:
        if (
            (candidate / "tools" / "build_allowed_users.py").exists()
            and (candidate / "public").exists()
        ):
            return candidate

    return candidates[0]


ROOT_DIR = resolve_root_dir()
SOURCE_PATH = ROOT_DIR / "tools" / "allowed_vehicle_ids.txt"
BUILD_SCRIPT = ROOT_DIR / "tools" / "build_allowed_users.py"
ALLOWED_USERS_PATH = ROOT_DIR / "public" / "data" / "allowed_users.json"
ALLOWED_USERS_META_PATH = ROOT_DIR / "public" / "data" / "allowed_users.meta.json"
USER_ROOT = ROOT_DIR / "public" / "repository-data" / "users"
PAGES_URL = "https://car-diary.github.io/"
REPO_ACTIONS_API = (
    "https://api.github.com/repos/car-diary/car-diary.github.io/actions/runs"
)
VEHICLE_ID_PATTERN = re.compile(r"^\d{2,3}[\uAC00-\uD7A3]\d{4}$")
UTF8 = "utf-8"
NO_WINDOW = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0


@dataclass
class VehicleRow:
    vehicle_id: str
    has_data_dir: bool


def utc_now() -> str:
    return (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def validate_vehicle_id(value: str) -> str | None:
    normalized = value.strip()
    if not normalized:
        return "차량번호를 입력하세요."
    if not VEHICLE_ID_PATTERN.fullmatch(normalized):
        return "차량번호 형식이 올바르지 않습니다."
    return None


def ensure_source_file() -> None:
    if SOURCE_PATH.exists():
        return

    SOURCE_PATH.parent.mkdir(parents=True, exist_ok=True)
    SOURCE_PATH.write_text(
        "# allowed vehicle ids\n68보0632\n",
        encoding=UTF8,
    )


def read_vehicle_ids_from_source() -> list[str]:
    ensure_source_file()
    vehicle_ids: list[str] = []
    for raw_line in SOURCE_PATH.read_text(encoding=UTF8).splitlines():
        stripped = raw_line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        vehicle_ids.append(stripped)
    return vehicle_ids


def append_vehicle_id(vehicle_id: str) -> bool:
    ensure_source_file()
    existing_ids = read_vehicle_ids_from_source()
    if vehicle_id in existing_ids:
        return False

    content = SOURCE_PATH.read_text(encoding=UTF8)
    suffix = "" if content.endswith(("\n", "\r")) or not content else "\n"
    SOURCE_PATH.write_text(f"{content}{suffix}{vehicle_id}\n", encoding=UTF8)
    return True


def remove_vehicle_id(vehicle_id: str) -> bool:
    ensure_source_file()
    remaining_lines: list[str] = []
    removed = False

    for raw_line in SOURCE_PATH.read_text(encoding=UTF8).splitlines():
        stripped = raw_line.strip()
        if stripped and not stripped.startswith("#") and stripped == vehicle_id:
            removed = True
            continue
        remaining_lines.append(raw_line)

    if not removed:
        return False

    next_content = "\n".join(remaining_lines).rstrip()
    SOURCE_PATH.write_text(
        f"{next_content}\n" if next_content else "",
        encoding=UTF8,
    )
    return True


def load_allowed_user_ids_from_json_file() -> set[str]:
    if not ALLOWED_USERS_PATH.exists():
        return set()

    payload = json.loads(ALLOWED_USERS_PATH.read_text(encoding=UTF8))
    return {
        str(entry.get("vehicleId", "")).strip()
        for entry in payload
        if str(entry.get("vehicleId", "")).strip()
    }


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding=UTF8,
    )


def calculate_storage_summary(vehicle_id: str, user_dir: Path) -> dict[str, object]:
    tracked_files = [
        ("profile.json", "json"),
        ("odometer-history.json", "json"),
        ("maintenance-records.json", "json"),
        ("scheduled-maintenance.json", "json"),
    ]
    file_breakdown: list[dict[str, object]] = []
    total_bytes = 0

    for file_name, kind in tracked_files:
        file_path = user_dir / file_name
        file_bytes = file_path.stat().st_size if file_path.exists() else 0
        total_bytes += file_bytes
        file_breakdown.append(
            {
                "path": file_name,
                "bytes": file_bytes,
                "kind": kind,
            }
        )

    return {
        "vehicleId": vehicle_id,
        "limitBytes": 300 * 1024 * 1024,
        "usedBytes": total_bytes,
        "jsonBytes": total_bytes,
        "attachmentBytes": 0,
        "percentUsed": round((total_bytes / (300 * 1024 * 1024)) * 100, 4),
        "fileBreakdown": file_breakdown,
        "updatedAt": utc_now(),
    }


def ensure_user_bundle(vehicle_id: str) -> bool:
    user_dir = USER_ROOT / vehicle_id
    created = False

    if not user_dir.exists():
        user_dir.mkdir(parents=True, exist_ok=True)
        created = True

    now = utc_now()
    profile_path = user_dir / "profile.json"
    odometer_path = user_dir / "odometer-history.json"
    records_path = user_dir / "maintenance-records.json"
    schedule_path = user_dir / "scheduled-maintenance.json"
    storage_path = user_dir / "storage-summary.json"

    if not profile_path.exists():
        write_json(
            profile_path,
            {
                "vehicleId": vehicle_id,
                "nickname": vehicle_id,
                "manufacturer": "",
                "modelName": "차량 정보 미입력",
                "trim": "",
                "modelYear": datetime.now().year,
                "fuelType": "미입력",
                "purchaseDate": None,
                "currentOdometerKm": 0,
                "createdAt": now,
                "updatedAt": now,
                "notes": "",
            },
        )
        created = True

    if not odometer_path.exists():
        write_json(
            odometer_path,
            {
                "vehicleId": vehicle_id,
                "currentOdometerKm": 0,
                "entries": [],
                "updatedAt": now,
            },
        )
        created = True

    if not records_path.exists():
        write_json(
            records_path,
            {
                "vehicleId": vehicle_id,
                "records": [],
                "updatedAt": now,
            },
        )
        created = True

    if not schedule_path.exists():
        write_json(
            schedule_path,
            {
                "vehicleId": vehicle_id,
                "items": [],
                "updatedAt": now,
            },
        )
        created = True

    if created or not storage_path.exists():
        write_json(storage_path, calculate_storage_summary(vehicle_id, user_dir))

    return created


def delete_user_bundle(vehicle_id: str) -> bool:
    user_dir = USER_ROOT / vehicle_id
    if not user_dir.exists():
        return False

    resolved_root = USER_ROOT.resolve()
    resolved_dir = user_dir.resolve()
    if resolved_dir.parent != resolved_root:
        raise RuntimeError(f"삭제 경로가 올바르지 않습니다: {resolved_dir}")

    shutil.rmtree(resolved_dir)
    return True


def run_command(command: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    completed = subprocess.run(
        command,
        cwd=ROOT_DIR,
        text=True,
        encoding=UTF8,
        errors="replace",
        capture_output=True,
        check=False,
        creationflags=NO_WINDOW,
    )
    if check and completed.returncode != 0:
        raise RuntimeError(
            f"명령 실패: {' '.join(command)}\n\n{completed.stdout}\n{completed.stderr}".strip()
        )
    return completed


def run_build_allowed_users() -> str:
    if not BUILD_SCRIPT.exists():
        raise RuntimeError(f"빌드 스크립트를 찾을 수 없습니다: {BUILD_SCRIPT}")

    spec = importlib.util.spec_from_file_location(
        "car_diary_build_allowed_users",
        BUILD_SCRIPT,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"빌드 스크립트를 불러올 수 없습니다: {BUILD_SCRIPT}")

    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    stdout_buffer = io.StringIO()
    stderr_buffer = io.StringIO()

    with redirect_stdout(stdout_buffer), redirect_stderr(stderr_buffer):
        spec.loader.exec_module(module)
        if not hasattr(module, "main"):
            raise RuntimeError("build_allowed_users.py 에 main() 함수가 없습니다.")
        exit_code = int(module.main())

    output = (stdout_buffer.getvalue() + "\n" + stderr_buffer.getvalue()).strip()
    if exit_code != 0:
        raise RuntimeError(
            "허용 차량번호 빌드 실패\n\n"
            + (output if output else "빌드 스크립트가 실패 코드를 반환했습니다.")
        )

    return output


def read_head_allowed_user_ids() -> set[str]:
    completed = run_command(
        ["git", "show", "HEAD:public/data/allowed_users.json"],
        check=False,
    )
    if completed.returncode != 0 or not completed.stdout.strip():
        return set()

    payload = json.loads(completed.stdout)
    return {
        str(entry.get("vehicleId", "")).strip()
        for entry in payload
        if str(entry.get("vehicleId", "")).strip()
    }


def get_new_vehicle_ids() -> list[str]:
    current_ids = load_allowed_user_ids_from_json_file()
    head_ids = read_head_allowed_user_ids()
    return sorted(current_ids - head_ids)


def get_removed_vehicle_ids() -> list[str]:
    current_ids = load_allowed_user_ids_from_json_file()
    head_ids = read_head_allowed_user_ids()
    return sorted(head_ids - current_ids)


def ensure_only_expected_removed_allowed_users(expected_removed_ids: set[str]) -> list[str]:
    removed_ids = get_removed_vehicle_ids()
    unexpected_removed_ids = sorted(set(removed_ids) - expected_removed_ids)
    if unexpected_removed_ids:
        raise RuntimeError(
            "기존 허용 차량번호가 빠져 배포가 중단되었습니다.\n"
            + "\n".join(f"- {vehicle_id}" for vehicle_id in unexpected_removed_ids)
        )
    return removed_ids


def ensure_removed_vehicle_data_deleted(removed_vehicle_ids: list[str]) -> None:
    remaining_dirs = [
        vehicle_id
        for vehicle_id in removed_vehicle_ids
        if (USER_ROOT / vehicle_id).exists()
    ]
    if remaining_dirs:
        raise RuntimeError(
            "삭제 대상 차량의 데이터 폴더가 아직 남아 있어 배포가 중단되었습니다.\n"
            + "\n".join(
                f"- public/repository-data/users/{vehicle_id}"
                for vehicle_id in remaining_dirs
            )
        )


def collect_safe_user_paths(
    new_vehicle_ids: set[str],
    removed_vehicle_ids: set[str],
) -> list[str]:
    completed = run_command(
        ["git", "status", "--porcelain", "--", "public/repository-data/users"],
        check=False,
    )
    status_lines = [line for line in completed.stdout.splitlines() if line.strip()]
    allowed_paths: set[str] = set()
    violations: list[str] = []

    for line in status_lines:
        status = line[:2]
        raw_path = line[3:].strip()
        if " -> " in raw_path:
            raw_path = raw_path.split(" -> ", 1)[1]

        parts = PurePosixPath(raw_path).parts
        if len(parts) < 4:
            violations.append(line)
            continue

        vehicle_id = parts[3]
        if status == "??" and vehicle_id in new_vehicle_ids:
            allowed_paths.add(f"public/repository-data/users/{vehicle_id}")
            continue
        if "D" in status and vehicle_id in removed_vehicle_ids:
            allowed_paths.add(f"public/repository-data/users/{vehicle_id}")
            continue

        violations.append(line)

    if violations:
        raise RuntimeError(
            "기존 차량 데이터 변경이 감지되어 배포를 중단했습니다.\n"
            "관리 프로그램은 새 차량 추가와 선택한 차량 삭제만 허용합니다.\n\n"
            + "\n".join(violations)
        )

    return sorted(allowed_paths)


def stage_changes(stage_paths: list[str]) -> None:
    run_command(
        [
            "git",
            "add",
            "-A",
            "public/data/allowed_users.json",
            "public/data/allowed_users.meta.json",
        ]
    )
    for path in stage_paths:
        run_command(["git", "add", "-A", path])


def has_staged_changes() -> bool:
    completed = run_command(["git", "diff", "--cached", "--quiet"], check=False)
    return completed.returncode == 1


def get_head_commit() -> str:
    return run_command(["git", "rev-parse", "HEAD"]).stdout.strip()


def commit_and_push(
    new_vehicle_ids: list[str],
    removed_vehicle_ids: list[str],
) -> str:
    if not has_staged_changes():
        return get_head_commit()

    if new_vehicle_ids and removed_vehicle_ids:
        commit_message = (
            "chore: sync vehicles "
            f"(+{', '.join(new_vehicle_ids)} / -{', '.join(removed_vehicle_ids)})"
        )
    elif new_vehicle_ids:
        commit_message = f"feat: register vehicle {', '.join(new_vehicle_ids)}"
    elif removed_vehicle_ids:
        commit_message = f"feat: delete vehicle {', '.join(removed_vehicle_ids)}"
    else:
        commit_message = "chore: refresh allowed users"

    run_command(["git", "commit", "-m", commit_message])
    run_command(["git", "push", "origin", "main"])
    return get_head_commit()


def fetch_actions_runs(commit_sha: str) -> dict[str, object]:
    request = urllib.request.Request(
        f"{REPO_ACTIONS_API}?head_sha={commit_sha}&per_page=10",
        headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": "CarDiaryAdmin",
        },
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode(UTF8))


def wait_for_pages_deploy(commit_sha: str, logger) -> None:
    started_at = time.time()
    last_status = ""

    while time.time() - started_at < 900:
        try:
            payload = fetch_actions_runs(commit_sha)
        except urllib.error.URLError as error:
            logger(f"[warn] 배포 상태 확인 재시도: {error}")
            time.sleep(5)
            continue

        workflow_runs = payload.get("workflow_runs", [])
        run = next(
            (
                item
                for item in workflow_runs
                if item.get("name") == "Deploy GitHub Pages"
            ),
            None,
        )

        if not run:
            logger("[info] GitHub Actions 실행이 등록되기를 기다리는 중...")
            time.sleep(5)
            continue

        status = f"{run.get('status')} / {run.get('conclusion') or '-'}"
        if status != last_status:
            logger(f"[info] Pages 배포 상태: {status}")
            last_status = status

        if run.get("status") == "completed":
            if run.get("conclusion") == "success":
                return
            raise RuntimeError(
                "GitHub Pages 배포가 실패했습니다.\n"
                f"상태: {status}\n"
                f"링크: {run.get('html_url', '')}"
            )

        time.sleep(5)

    raise RuntimeError("GitHub Pages 배포 확인 시간이 초과되었습니다.")


class CarDiaryAdminApp:
    def __init__(self) -> None:
        self.root = Tk()
        self.root.title("Car Diary Admin")
        self.root.geometry("1120x760")
        self.root.minsize(980, 680)

        self.message_queue: Queue[tuple[str, object]] = Queue()
        self.vehicle_input = StringVar()
        self.status_text = StringVar(value="준비됨")

        self.refresh_button: ttk.Button | None = None
        self.add_button: ttk.Button | None = None
        self.delete_button: ttk.Button | None = None
        self.deploy_button: ttk.Button | None = None
        self.tree: ttk.Treeview | None = None
        self.log_text: tk.Text | None = None

        self._configure_style()
        self._build_ui()
        self.refresh_vehicle_list()
        self.root.after(150, self._drain_queue)

    def _configure_style(self) -> None:
        style = ttk.Style()
        if "vista" in style.theme_names():
            style.theme_use("vista")
        style.configure("Card.TFrame", background="#eef4fb")
        style.configure("Title.TLabel", font=("Malgun Gothic", 17, "bold"))
        style.configure("Muted.TLabel", foreground="#5d6b7b")
        style.configure("Accent.TButton", font=("Malgun Gothic", 10, "bold"))

    def _build_ui(self) -> None:
        self.root.configure(bg="#eef4fb")

        container = ttk.Frame(self.root, padding=18, style="Card.TFrame")
        container.pack(fill="both", expand=True)

        header = ttk.Frame(container)
        header.pack(fill="x")
        ttk.Label(header, text="Car Diary 관리자", style="Title.TLabel").pack(anchor="w")
        ttk.Label(
            header,
            text="차량번호 추가, 차량 폴더 초기화, GitHub Pages 배포를 한 번에 관리합니다.",
            style="Muted.TLabel",
        ).pack(anchor="w", pady=(6, 0))

        body = ttk.Panedwindow(container, orient="horizontal")
        body.pack(fill="both", expand=True, pady=(18, 0))

        left = ttk.Frame(body, padding=12)
        right = ttk.Frame(body, padding=12)
        body.add(left, weight=3)
        body.add(right, weight=2)

        list_header = ttk.Frame(left)
        list_header.pack(fill="x")
        ttk.Label(list_header, text="현재 등록된 차량번호 목록", style="Title.TLabel").pack(
            side="left"
        )
        self.refresh_button = ttk.Button(
            list_header,
            text="새로고침",
            command=self.refresh_vehicle_list,
        )
        self.refresh_button.pack(side="right")

        self.tree = ttk.Treeview(
            left,
            columns=("vehicleId", "dataStatus"),
            show="headings",
            height=18,
        )
        self.tree.heading("vehicleId", text="차량번호")
        self.tree.heading("dataStatus", text="차량 폴더")
        self.tree.column("vehicleId", width=180, anchor="center")
        self.tree.column("dataStatus", width=120, anchor="center")
        self.tree.pack(fill="both", expand=True, pady=(12, 0))

        right_top = ttk.Frame(right)
        right_top.pack(fill="x")
        ttk.Label(right_top, text="새 차량번호 등록", style="Title.TLabel").pack(anchor="w")
        ttk.Label(
            right_top,
            text="등록 시 허용 목록에 추가하고 차량별 데이터 폴더를 새로 만듭니다.",
            style="Muted.TLabel",
        ).pack(anchor="w", pady=(6, 0))

        ttk.Entry(right, textvariable=self.vehicle_input, font=("Malgun Gothic", 11)).pack(
            fill="x", pady=(14, 0)
        )

        self.add_button = ttk.Button(
            right,
            text="차량번호 등록",
            style="Accent.TButton",
            command=self.add_vehicle,
        )
        self.add_button.pack(fill="x", pady=(10, 0))

        self.delete_button = ttk.Button(
            right,
            text="선택 차량번호 삭제",
            style="Accent.TButton",
            command=self.delete_vehicle,
        )
        self.delete_button.pack(fill="x", pady=(8, 0))

        self.deploy_button = ttk.Button(
            right,
            text="빌드 + GitHub Pages 배포",
            style="Accent.TButton",
            command=self.deploy_changes,
        )
        self.deploy_button.pack(fill="x", pady=(8, 0))

        guard_frame = ttk.LabelFrame(right, text="안전장치", padding=12)
        guard_frame.pack(fill="x", pady=(16, 0))
        for text in (
            "선택한 차량 삭제만 허용하며, 삭제 시 해당 차량의 모든 기록 폴더도 함께 제거합니다.",
            "선택하지 않은 다른 차량 데이터 수정/삭제가 감지되면 배포를 중단합니다.",
            "새 차량은 public/repository-data/users/{vehicleId} 아래에만 생성합니다.",
            "허용 목록에서 빠진 차량은 실제 폴더 삭제까지 확인되어야만 배포됩니다.",
        ):
            ttk.Label(guard_frame, text=f"• {text}", style="Muted.TLabel").pack(anchor="w", pady=2)

        ttk.Label(right, text="작업 로그", style="Title.TLabel").pack(anchor="w", pady=(18, 0))
        self.log_text = tk.Text(
            right,
            height=18,
            bg="#0f1722",
            fg="#dbe7f5",
            insertbackground="#dbe7f5",
            relief="flat",
            wrap="word",
            font=("Consolas", 10),
        )
        self.log_text.pack(fill="both", expand=True, pady=(10, 0))

        footer = ttk.Frame(container)
        footer.pack(fill="x", pady=(12, 0))
        ttk.Label(footer, textvariable=self.status_text, style="Muted.TLabel").pack(side="left")

    def log(self, message: str) -> None:
        self.message_queue.put(("log", message))

    def _append_log(self, message: str) -> None:
        assert self.log_text is not None
        self.log_text.insert(END, f"{message}\n")
        self.log_text.see(END)

    def _set_busy(self, is_busy: bool) -> None:
        state = "disabled" if is_busy else "normal"
        for button in (
            self.refresh_button,
            self.add_button,
            self.delete_button,
            self.deploy_button,
        ):
            if button is not None:
                button.configure(state=state)

    def _run_background(self, label: str, worker) -> None:
        self._set_busy(True)
        self.status_text.set(label)

        def wrapped() -> None:
            try:
                result = worker()
            except Exception as error:  # noqa: BLE001
                self.message_queue.put(("error", f"{error}\n\n{traceback.format_exc()}"))
            else:
                self.message_queue.put(("success", result))
            finally:
                self.message_queue.put(("done", None))

        threading.Thread(target=wrapped, daemon=True).start()

    def _drain_queue(self) -> None:
        try:
            while True:
                event, payload = self.message_queue.get_nowait()
                if event == "log":
                    self._append_log(str(payload))
                elif event == "error":
                    self._append_log(str(payload))
                    messagebox.showerror("작업 실패", str(payload))
                elif event == "success" and payload:
                    self._append_log(str(payload))
                elif event == "done":
                    self._set_busy(False)
                    self.status_text.set("준비됨")
                    self.refresh_vehicle_list()
        except Empty:
            pass
        finally:
            self.root.after(150, self._drain_queue)

    def refresh_vehicle_list(self) -> None:
        rows = [
            VehicleRow(
                vehicle_id=vehicle_id,
                has_data_dir=(USER_ROOT / vehicle_id / "profile.json").exists(),
            )
            for vehicle_id in read_vehicle_ids_from_source()
        ]

        assert self.tree is not None
        for item_id in self.tree.get_children():
            self.tree.delete(item_id)

        for row in rows:
            self.tree.insert(
                "",
                "end",
                values=(row.vehicle_id, "있음" if row.has_data_dir else "없음"),
            )

        self.status_text.set(f"{len(rows)}대 등록됨")

    def get_selected_vehicle_id(self) -> str | None:
        assert self.tree is not None
        selected_items = self.tree.selection()
        if not selected_items:
            return None

        values = self.tree.item(selected_items[0], "values")
        if not values:
            return None

        return str(values[0]).strip()

    def add_vehicle(self) -> None:
        vehicle_id = self.vehicle_input.get().strip()
        validation_error = validate_vehicle_id(vehicle_id)
        if validation_error:
            messagebox.showwarning("입력 확인", validation_error)
            return

        def worker() -> str:
            self.log(f"[run] 차량번호 등록 시작: {vehicle_id}")
            appended = append_vehicle_id(vehicle_id)
            if appended:
                self.log(f"[info] allowed_vehicle_ids.txt에 {vehicle_id} 추가")
            else:
                self.log(f"[info] {vehicle_id}는 이미 허용 목록에 있음")

            created = ensure_user_bundle(vehicle_id)
            if created:
                self.log(f"[info] 차량 데이터 폴더 생성: public/repository-data/users/{vehicle_id}")
            else:
                self.log(f"[info] 차량 데이터 폴더 이미 존재: public/repository-data/users/{vehicle_id}")

            build_output = run_build_allowed_users()
            if build_output:
                self.log(build_output)

            return f"[done] 차량번호 등록 완료: {vehicle_id}"

        self.vehicle_input.set("")
        self._run_background("차량번호 등록 중...", worker)

    def delete_vehicle(self) -> None:
        vehicle_id = self.get_selected_vehicle_id()
        if not vehicle_id:
            messagebox.showwarning("선택 확인", "삭제할 차량번호를 목록에서 먼저 선택하세요.")
            return

        def worker() -> str:
            self.log(f"[run] 차량번호 삭제 시작: {vehicle_id}")
            removed = remove_vehicle_id(vehicle_id)
            if removed:
                self.log(f"[info] allowed_vehicle_ids.txt 에서 {vehicle_id} 제거")
            else:
                self.log(f"[info] {vehicle_id} 는 허용 목록에 없어 제거할 항목이 없음")

            deleted_bundle = delete_user_bundle(vehicle_id)
            if deleted_bundle:
                self.log(
                    f"[info] 차량 데이터 폴더 삭제: public/repository-data/users/{vehicle_id}"
                )
            else:
                self.log(
                    f"[info] 삭제할 차량 데이터 폴더가 없음: public/repository-data/users/{vehicle_id}"
                )

            build_output = run_build_allowed_users()
            if build_output:
                self.log(build_output)

            return (
                f"[done] 차량번호 삭제 완료: {vehicle_id}\n"
                "[info] GitHub 반영은 빌드 + GitHub Pages 배포 버튼으로 진행됩니다."
            )

        self._run_background("차량번호 삭제 중...", worker)

    def deploy_changes(self) -> None:
        if not messagebox.askyesno(
            "배포 확인",
            "허용 차량번호와 새 차량 폴더를 빌드하고 GitHub Pages까지 배포합니다.\n계속하시겠습니까?",
        ):
            return

        def worker() -> str:
            self.log("[run] allowed users 빌드")
            build_output = run_build_allowed_users()
            if build_output:
                self.log(build_output)

            new_vehicle_ids = get_new_vehicle_ids()
            removed_vehicle_ids = ensure_only_expected_removed_allowed_users(
                set(get_removed_vehicle_ids())
            )
            ensure_removed_vehicle_data_deleted(removed_vehicle_ids)
            self.log(
                "[info] 새 차량: "
                + (", ".join(new_vehicle_ids) if new_vehicle_ids else "없음")
            )
            self.log(
                "[info] 삭제 차량: "
                + (", ".join(removed_vehicle_ids) if removed_vehicle_ids else "없음")
            )

            stage_paths = collect_safe_user_paths(
                set(new_vehicle_ids),
                set(removed_vehicle_ids),
            )
            stage_changes(stage_paths)
            if not has_staged_changes():
                return "[done] 배포할 변경 사항이 없습니다."

            commit_sha = commit_and_push(new_vehicle_ids, removed_vehicle_ids)

            self.log(f"[info] push 완료: {commit_sha}")
            self.log("[run] GitHub Pages 배포 확인")
            wait_for_pages_deploy(commit_sha, self.log)
            webbrowser.open(PAGES_URL)
            return f"[done] 배포 완료: {PAGES_URL}"

        self._run_background("GitHub Pages 배포 중...", worker)

    def run(self) -> None:
        self.root.mainloop()


def run_self_check() -> int:
    print(f"ROOT_DIR={ROOT_DIR}")
    print(f"BUILD_SCRIPT={BUILD_SCRIPT}")
    print(f"SOURCE_PATH={SOURCE_PATH}")
    output = run_build_allowed_users()
    if output:
        print(output)
    print("[done] self check passed")
    return 0


if __name__ == "__main__":
    if "--self-check" in sys.argv:
        try:
            raise SystemExit(run_self_check())
        except Exception as error:  # noqa: BLE001
            print(str(error))
            raise SystemExit(1) from error
    CarDiaryAdminApp().run()
