from __future__ import annotations

import json
import sqlite3
import uuid
from io import BytesIO
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
DB_PATH = DATA_DIR / "registrations.db"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def init_db() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    with sqlite3.connect(DB_PATH) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS registration_attempts (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              attempt_uuid TEXT NOT NULL UNIQUE,
              status TEXT NOT NULL DEFAULT 'in_progress',
              current_step INTEGER NOT NULL DEFAULT 1,
              fields_json TEXT NOT NULL DEFAULT '{}',
              utm_json TEXT NOT NULL DEFAULT '{}',
              user_agent TEXT,
              referrer TEXT,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              submitted_at TEXT
            )
            """
        )
        columns = {
            row[1]
            for row in connection.execute("PRAGMA table_info(registration_attempts)").fetchall()
        }
        if "utm_json" not in columns:
            connection.execute("ALTER TABLE registration_attempts ADD COLUMN utm_json TEXT NOT NULL DEFAULT '{}'")
        connection.commit()


def row_to_dict(row: sqlite3.Row) -> dict:
    fields = {}
    if row["fields_json"]:
        try:
            fields = json.loads(row["fields_json"])
        except json.JSONDecodeError:
            fields = {}

    utm = {}
    if row["utm_json"]:
        try:
            utm = json.loads(row["utm_json"])
        except json.JSONDecodeError:
            utm = {}

    return {
        "id": row["id"],
        "attemptUuid": row["attempt_uuid"],
        "status": row["status"],
        "currentStep": row["current_step"],
        "fields": fields,
        "utm": utm,
        "userAgent": row["user_agent"],
        "referrer": row["referrer"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
        "submittedAt": row["submitted_at"],
    }


def parse_current_step(body: dict, default: int = 1) -> int:
    raw_step = body.get("currentStep")

    if raw_step is None:
        return default

    try:
        step = int(raw_step)
    except (TypeError, ValueError):
        return default

    return max(0, min(step, 3))


class PlankaHandler(SimpleHTTPRequestHandler):
    server_version = "PlankaHub/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self) -> None:
        path = urlparse(self.path).path

        if path == "/api/admin/registration-attempts/export.xlsx":
            self.handle_export_attempts()
            return

        if path == "/api/admin/registration-attempts":
            self.handle_list_attempts()
            return

        if path == "/admin":
            self.path = "/admin.html"

        super().do_GET()

    def do_POST(self) -> None:
        path = urlparse(self.path).path

        if path == "/api/registration-attempts":
            self.handle_create_attempt()
            return

        if path.startswith("/api/registration-attempts/") and path.endswith("/submit"):
            self.handle_submit_attempt(path)
            return

        self.send_json({"error": "Not found"}, HTTPStatus.NOT_FOUND)

    def do_PATCH(self) -> None:
        path = urlparse(self.path).path

        if path.startswith("/api/registration-attempts/"):
            self.handle_update_attempt(path)
            return

        self.send_json({"error": "Not found"}, HTTPStatus.NOT_FOUND)

    def do_DELETE(self) -> None:
        path = urlparse(self.path).path

        if path == "/api/admin/registration-attempts":
            self.handle_delete_attempts()
            return

        if path.startswith("/api/admin/registration-attempts/"):
            self.handle_delete_attempt(path)
            return

        self.send_json({"error": "Not found"}, HTTPStatus.NOT_FOUND)

    def read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length == 0:
            return {}

        raw_body = self.rfile.read(length).decode("utf-8")
        try:
            parsed = json.loads(raw_body)
        except json.JSONDecodeError:
            return {}

        return parsed if isinstance(parsed, dict) else {}

    def send_json(self, payload: dict | list, status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def handle_create_attempt(self) -> None:
        body = self.read_json()
        now = utc_now()
        attempt_uuid = str(uuid.uuid4())
        current_step = parse_current_step(body)
        fields = body.get("fields") if isinstance(body.get("fields"), dict) else {}
        utm = body.get("utm") if isinstance(body.get("utm"), dict) else {}

        with sqlite3.connect(DB_PATH) as connection:
            connection.row_factory = sqlite3.Row
            cursor = connection.execute(
                """
                INSERT INTO registration_attempts
                  (attempt_uuid, status, current_step, fields_json, utm_json, user_agent, referrer, created_at, updated_at)
                VALUES (?, 'in_progress', ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    attempt_uuid,
                    current_step,
                    json.dumps(fields, ensure_ascii=False),
                    json.dumps(utm, ensure_ascii=False),
                    self.headers.get("User-Agent"),
                    self.headers.get("Referer"),
                    now,
                    now,
                ),
            )
            row = connection.execute(
                "SELECT * FROM registration_attempts WHERE id = ?",
                (cursor.lastrowid,),
            ).fetchone()

        self.send_json(row_to_dict(row), HTTPStatus.CREATED)

    def handle_update_attempt(self, path: str) -> None:
        attempt_id = self.extract_attempt_id(path)
        if attempt_id is None:
            self.send_json({"error": "Invalid attempt id"}, HTTPStatus.BAD_REQUEST)
            return

        body = self.read_json()
        now = utc_now()
        current_step = parse_current_step(body)
        fields = body.get("fields") if isinstance(body.get("fields"), dict) else {}
        status = body.get("status") if body.get("status") in {"in_progress", "submitted"} else "in_progress"

        with sqlite3.connect(DB_PATH) as connection:
            connection.row_factory = sqlite3.Row
            existing = connection.execute(
                "SELECT status, current_step FROM registration_attempts WHERE id = ?",
                (attempt_id,),
            ).fetchone()

            if existing is None:
                self.send_json({"error": "Attempt not found"}, HTTPStatus.NOT_FOUND)
                return

            next_status = "submitted" if existing["status"] == "submitted" else status
            next_step = max(int(existing["current_step"] or 0), current_step)

            connection.execute(
                """
                UPDATE registration_attempts
                SET current_step = ?,
                    fields_json = ?,
                    status = ?,
                    updated_at = ?
                WHERE id = ?
                """,
                (
                    next_step,
                    json.dumps(fields, ensure_ascii=False),
                    next_status,
                    now,
                    attempt_id,
                ),
            )
            row = connection.execute(
                "SELECT * FROM registration_attempts WHERE id = ?",
                (attempt_id,),
            ).fetchone()

        if row is None:
            self.send_json({"error": "Attempt not found"}, HTTPStatus.NOT_FOUND)
            return

        self.send_json(row_to_dict(row))

    def handle_submit_attempt(self, path: str) -> None:
        attempt_id = self.extract_attempt_id(path.removesuffix("/submit"))
        if attempt_id is None:
            self.send_json({"error": "Invalid attempt id"}, HTTPStatus.BAD_REQUEST)
            return

        body = self.read_json()
        now = utc_now()
        fields = body.get("fields") if isinstance(body.get("fields"), dict) else {}

        with sqlite3.connect(DB_PATH) as connection:
            connection.row_factory = sqlite3.Row
            connection.execute(
                """
                UPDATE registration_attempts
                SET current_step = 3,
                    fields_json = ?,
                    status = 'submitted',
                    updated_at = ?,
                    submitted_at = ?
                WHERE id = ?
                """,
                (
                    json.dumps(fields, ensure_ascii=False),
                    now,
                    now,
                    attempt_id,
                ),
            )
            row = connection.execute(
                "SELECT * FROM registration_attempts WHERE id = ?",
                (attempt_id,),
            ).fetchone()

        if row is None:
            self.send_json({"error": "Attempt not found"}, HTTPStatus.NOT_FOUND)
            return

        self.send_json(row_to_dict(row))

    def handle_list_attempts(self) -> None:
        with sqlite3.connect(DB_PATH) as connection:
            connection.row_factory = sqlite3.Row
            rows = connection.execute(
                "SELECT * FROM registration_attempts ORDER BY datetime(created_at) DESC, id DESC"
            ).fetchall()

        attempts = [row_to_dict(row) for row in rows]
        stats = {
            "total": len(attempts),
            "step0": sum(1 for item in attempts if item["currentStep"] == 0 and item["status"] != "submitted"),
            "step1": sum(1 for item in attempts if item["currentStep"] == 1 and item["status"] != "submitted"),
            "step2": sum(1 for item in attempts if item["currentStep"] == 2 and item["status"] != "submitted"),
            "step3": sum(1 for item in attempts if item["currentStep"] == 3 and item["status"] != "submitted"),
            "submitted": sum(1 for item in attempts if item["status"] == "submitted"),
        }

        self.send_json({"attempts": attempts, "stats": stats})

    def handle_export_attempts(self) -> None:
        try:
            from openpyxl import Workbook
            from openpyxl.styles import Alignment, Font, PatternFill
            from openpyxl.utils import get_column_letter
        except ImportError:
            self.send_json(
                {"error": "openpyxl is required to export Excel files"},
                HTTPStatus.INTERNAL_SERVER_ERROR,
            )
            return

        with sqlite3.connect(DB_PATH) as connection:
            connection.row_factory = sqlite3.Row
            rows = connection.execute(
                "SELECT * FROM registration_attempts ORDER BY datetime(created_at) DESC, id DESC"
            ).fetchall()

        attempts = [row_to_dict(row) for row in rows]
        known_field_keys = [
            "first-name",
            "last-name",
            "role",
            "stage",
            "needs",
            "request",
            "email",
            "contact",
            "privacy",
        ]
        known_utm_keys = [
            "utm_source",
            "utm_medium",
            "utm_campaign",
            "utm_content",
            "utm_term",
            "gclid",
            "yclid",
            "fbclid",
        ]
        extra_field_keys = sorted({
            key
            for attempt in attempts
            for key in attempt["fields"].keys()
            if key not in known_field_keys
        })
        extra_utm_keys = sorted({
            key
            for attempt in attempts
            for key in attempt["utm"].keys()
            if key not in known_utm_keys
        })

        columns = [
            ("ID", lambda item: item["id"]),
            ("UUID", lambda item: item["attemptUuid"]),
            ("Статус", lambda item: "Отправлено" if item["status"] == "submitted" else "В процессе"),
            ("Шаг", lambda item: f'{item["currentStep"]} / 3'),
            ("Создано", lambda item: item["createdAt"]),
            ("Обновлено", lambda item: item["updatedAt"]),
            ("Отправлено", lambda item: item["submittedAt"]),
            ("Referrer", lambda item: item["referrer"]),
            ("User Agent", lambda item: item["userAgent"]),
        ]
        columns.extend((key, lambda item, field_key=key: item["utm"].get(field_key)) for key in known_utm_keys)
        columns.extend((key, lambda item, utm_key=key: item["utm"].get(utm_key)) for key in extra_utm_keys)
        columns.extend((key, lambda item, field_key=key: item["fields"].get(field_key)) for key in known_field_keys)
        columns.extend((key, lambda item, field_key=key: item["fields"].get(field_key)) for key in extra_field_keys)
        columns.extend([
            ("Все UTM JSON", lambda item: item["utm"]),
            ("Все поля JSON", lambda item: item["fields"]),
        ])

        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Попытки регистрации"
        sheet.append([title for title, _getter in columns])

        for attempt in attempts:
            sheet.append([self.excel_value(getter(attempt)) for _title, getter in columns])

        header_fill = PatternFill("solid", fgColor="4475F2")
        header_font = Font(color="FFFFFF", bold=True)
        for cell in sheet[1]:
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

        for row in sheet.iter_rows(min_row=2):
            for cell in row:
                cell.alignment = Alignment(vertical="top", wrap_text=True)

        sheet.freeze_panes = "A2"
        sheet.auto_filter.ref = sheet.dimensions
        sheet.row_dimensions[1].height = 28

        for column_index, column_cells in enumerate(sheet.columns, start=1):
            max_length = 0
            for cell in column_cells:
                value = "" if cell.value is None else str(cell.value)
                max_length = max(max_length, len(value))

            width = min(max(max_length + 2, 10), 42)
            sheet.column_dimensions[get_column_letter(column_index)].width = width

        output = BytesIO()
        workbook.save(output)
        body = output.getvalue()
        filename = f"registration-attempts-{datetime.now().strftime('%Y%m%d-%H%M%S')}.xlsx"

        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def handle_delete_attempt(self, path: str) -> None:
        attempt_id = self.extract_admin_attempt_id(path)
        if attempt_id is None:
            self.send_json({"error": "Invalid attempt id"}, HTTPStatus.BAD_REQUEST)
            return

        with sqlite3.connect(DB_PATH) as connection:
            cursor = connection.execute("DELETE FROM registration_attempts WHERE id = ?", (attempt_id,))
            connection.commit()

        self.send_json({"deleted": cursor.rowcount, "ids": [attempt_id]})

    def handle_delete_attempts(self) -> None:
        body = self.read_json()
        raw_ids = body.get("ids") if isinstance(body.get("ids"), list) else []
        ids = []

        for raw_id in raw_ids:
            try:
                attempt_id = int(raw_id)
            except (TypeError, ValueError):
                continue

            if attempt_id > 0 and attempt_id not in ids:
                ids.append(attempt_id)

        if not ids:
            self.send_json({"error": "No ids provided"}, HTTPStatus.BAD_REQUEST)
            return

        placeholders = ",".join("?" for _ in ids)
        with sqlite3.connect(DB_PATH) as connection:
            cursor = connection.execute(
                f"DELETE FROM registration_attempts WHERE id IN ({placeholders})",
                ids,
            )
            connection.commit()

        self.send_json({"deleted": cursor.rowcount, "ids": ids})

    @staticmethod
    def extract_attempt_id(path: str) -> int | None:
        parts = [part for part in path.split("/") if part]
        if len(parts) < 3:
            return None

        try:
            return int(parts[2])
        except ValueError:
            return None

    @staticmethod
    def extract_admin_attempt_id(path: str) -> int | None:
        parts = [part for part in path.split("/") if part]
        if len(parts) < 4:
            return None

        try:
            return int(parts[3])
        except ValueError:
            return None

    @staticmethod
    def excel_value(value) -> str | int | float:
        if value is None:
            return ""

        if isinstance(value, bool):
            return "да" if value else "нет"

        if isinstance(value, (dict, list)):
            return json.dumps(value, ensure_ascii=False)

        return value


def run() -> None:
    init_db()
    host = "127.0.0.1"
    port = 4173
    server = ThreadingHTTPServer((host, port), PlankaHandler)
    print(f"Planka Hub server: http://{host}:{port}/")
    print(f"Admin panel:       http://{host}:{port}/admin")
    server.serve_forever()


if __name__ == "__main__":
    run()
