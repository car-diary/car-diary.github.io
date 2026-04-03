from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT_DIR = Path(__file__).resolve().parents[1]
SOURCE_PATH = ROOT_DIR / "tools" / "allowed_vehicle_ids.txt"
OUTPUT_PATH = ROOT_DIR / "public" / "data" / "allowed_users.json"
META_PATH = ROOT_DIR / "public" / "data" / "allowed_users.meta.json"
VEHICLE_ID_PATTERN = re.compile(r"^\d{2,3}[가-힣]\d{4}$")
SAMPLE_SOURCE = """# allowed vehicle ids
68보0632
123가4567
45나8888
"""


@dataclass
class ParsedVehicleId:
    line_number: int
    vehicle_id: str


def utc_now() -> str:
    return (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def validate_vehicle_id_format(value: str) -> bool:
    return bool(VEHICLE_ID_PATTERN.fullmatch(value.strip()))


def ensure_source_file() -> None:
    if SOURCE_PATH.exists():
        return

    SOURCE_PATH.parent.mkdir(parents=True, exist_ok=True)
    SOURCE_PATH.write_text(SAMPLE_SOURCE, encoding="utf-8")
    print("[info] allowed_vehicle_ids.txt가 없어 샘플 파일을 생성했습니다.")
    print(f"[info] 샘플 경로: {SOURCE_PATH}")


def load_existing_entries() -> dict[str, dict[str, Any]]:
    if not OUTPUT_PATH.exists():
        return {}

    try:
        payload = json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        print("[warn] 기존 allowed_users.json 형식이 깨져 있어 새로 생성합니다.")
        return {}

    existing_entries: dict[str, dict[str, Any]] = {}
    for entry in payload:
        vehicle_id = str(entry.get("vehicleId", "")).strip()
        if vehicle_id:
            existing_entries[vehicle_id] = entry

    return existing_entries


def parse_source_file() -> tuple[list[ParsedVehicleId], list[tuple[int, str]], list[tuple[str, int, int]], int]:
    raw_lines = SOURCE_PATH.read_text(encoding="utf-8").splitlines()
    valid_entries: list[ParsedVehicleId] = []
    invalid_entries: list[tuple[int, str]] = []
    duplicate_entries: list[tuple[str, int, int]] = []
    first_seen_line: dict[str, int] = {}
    read_count = 0

    for line_number, raw_line in enumerate(raw_lines, start=1):
        stripped = raw_line.strip()
        if not stripped or stripped.startswith("#"):
            continue

        read_count += 1
        if not validate_vehicle_id_format(stripped):
            invalid_entries.append((line_number, stripped))
            continue

        if stripped in first_seen_line:
            duplicate_entries.append((stripped, first_seen_line[stripped], line_number))
            continue

        first_seen_line[stripped] = line_number
        valid_entries.append(ParsedVehicleId(line_number=line_number, vehicle_id=stripped))

    return valid_entries, invalid_entries, duplicate_entries, read_count


def build_entry(vehicle_id: str, existing_entry: dict[str, Any] | None) -> dict[str, Any]:
    existing_entry = existing_entry or {}
    return {
        "vehicleId": vehicle_id,
        "displayName": existing_entry.get("displayName") or vehicle_id,
        "profilePath": f"public/repository-data/users/{vehicle_id}/profile.json",
        "notes": existing_entry.get("notes"),
    }


def write_output(entries: list[dict[str, Any]]) -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(entries, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    meta_payload = {
        "generatedAt": utc_now(),
        "totalEntries": len(entries),
        "sourceDescription": "Generated from tools/allowed_vehicle_ids.txt",
    }
    META_PATH.write_text(
        json.dumps(meta_payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def print_summary(
    read_count: int,
    valid_entries: list[ParsedVehicleId],
    invalid_entries: list[tuple[int, str]],
    duplicate_entries: list[tuple[str, int, int]],
) -> None:
    print("")
    print("=== allowed users build summary ===")
    print(f"읽은 차량번호 수: {read_count}")
    print(f"유효한 차량번호 수: {len(valid_entries)}")
    print(f"형식 오류 수: {len(invalid_entries)}")
    print(f"중복 차량번호 수: {len(duplicate_entries)}")
    print(f"출력 파일: {OUTPUT_PATH}")
    print(f"메타 파일: {META_PATH}")

    if invalid_entries:
        print("")
        print("[error] 잘못된 차량번호 형식")
        for line_number, raw_value in invalid_entries:
            print(f"  - line {line_number}: {raw_value}")

    if duplicate_entries:
        print("")
        print("[error] 중복 차량번호")
        for vehicle_id, first_line, duplicate_line in duplicate_entries:
            print(
                f"  - {vehicle_id}: first line {first_line}, duplicate line {duplicate_line}"
            )


def main() -> int:
    ensure_source_file()
    existing_entries = load_existing_entries()
    valid_entries, invalid_entries, duplicate_entries, read_count = parse_source_file()
    print_summary(read_count, valid_entries, invalid_entries, duplicate_entries)

    if invalid_entries or duplicate_entries:
        print("")
        print("[fail] 오류를 수정한 뒤 다시 실행하세요.")
        return 1

    next_entries = [
        build_entry(item.vehicle_id, existing_entries.get(item.vehicle_id))
        for item in valid_entries
    ]
    write_output(next_entries)
    print("")
    print("[done] allowed_users.json 생성이 완료되었습니다.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
