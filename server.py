from __future__ import annotations

import hashlib
import hmac
import json
import posixpath
import sqlite3
import uuid
from io import BytesIO
from http.cookies import CookieError, SimpleCookie
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse


ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
DB_PATH = DATA_DIR / "registrations.db"
ADMIN_USERNAME = "Vladimir"
ADMIN_PASSWORD = "Planka2026!"
ADMIN_COOKIE_NAME = "planka_admin"
PUBLIC_STATIC_FILES = {
    "/",
    "/index.html",
    "/styles.css",
    "/script.js",
    "/admin.html",
    "/admin-login.html",
}


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

        if path in {"/admin", "/admin/"}:
            self.path = "/admin.html" if self.is_admin_authenticated() else "/admin-login.html"
            super().do_GET()
            return

        if path == "/admin/logout":
            self.handle_admin_logout()
            return

        if self.is_protected_admin_path(path) and not self.require_admin_auth(path):
            return

        if path == "/api/admin/registration-attempts/export.xlsx":
            self.handle_export_attempts()
            return

        if path == "/api/admin/registration-attempts":
            self.handle_list_attempts()
            return

        if not self.is_allowed_static_path(path):
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        super().do_GET()

    def do_POST(self) -> None:
        path = urlparse(self.path).path

        if path == "/admin/login":
            self.handle_admin_login()
            return

        if path == "/admin/logout":
            self.handle_admin_logout()
            return

        if self.is_protected_admin_path(path) and not self.require_admin_auth(path):
            return

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

        if self.is_protected_admin_path(path) and not self.require_admin_auth(path):
            return

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

    def read_form(self) -> dict[str, str]:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length == 0:
            return {}

        raw_body = self.rfile.read(length).decode("utf-8")
        parsed = parse_qs(raw_body, keep_blank_values=True)
        return {key: values[0] for key, values in parsed.items() if values}

    def send_json(self, payload: dict | list, status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    @staticmethod
    def is_protected_admin_path(path: str) -> bool:
        return path == "/admin.html" or path.startswith("/api/admin/")

    @staticmethod
    def normalized_static_path(path: str) -> str:
        decoded_path = unquote(path).replace("\\", "/")
        normalized = posixpath.normpath(decoded_path)

        if not normalized.startswith("/"):
            normalized = f"/{normalized}"

        return normalized

    @classmethod
    def is_allowed_static_path(cls, path: str) -> bool:
        normalized = cls.normalized_static_path(path)

        if normalized in PUBLIC_STATIC_FILES:
            return True

        if not normalized.startswith("/assets/"):
            return False

        asset_root = (ROOT / "assets").resolve()
        target = (ROOT / normalized.lstrip("/")).resolve()

        try:
            target.relative_to(asset_root)
        except ValueError:
            return False

        return target.is_file()

    @staticmethod
    def admin_auth_token() -> str:
        return hmac.new(
            ADMIN_PASSWORD.encode("utf-8"),
            ADMIN_USERNAME.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

    def is_admin_authenticated(self) -> bool:
        try:
            cookie = SimpleCookie(self.headers.get("Cookie", ""))
        except CookieError:
            return False

        auth_cookie = cookie.get(ADMIN_COOKIE_NAME)
        if auth_cookie is None:
            return False

        return hmac.compare_digest(auth_cookie.value, self.admin_auth_token())

    def require_admin_auth(self, path: str) -> bool:
        if self.is_admin_authenticated():
            return True

        if path.startswith("/api/admin/"):
            self.send_json({"error": "Unauthorized"}, HTTPStatus.UNAUTHORIZED)
        else:
            self.redirect("/admin")

        return False

    def redirect(self, location: str, status: HTTPStatus = HTTPStatus.SEE_OTHER) -> None:
        self.send_response(status)
        self.send_header("Location", location)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def handle_admin_login(self) -> None:
        form = self.read_form()
        username = form.get("username", "")
        password = form.get("password", "")

        if (
            hmac.compare_digest(username, ADMIN_USERNAME)
            and hmac.compare_digest(password, ADMIN_PASSWORD)
        ):
            self.send_response(HTTPStatus.SEE_OTHER)
            self.send_header("Location", "/admin")
            self.send_header(
                "Set-Cookie",
                f"{ADMIN_COOKIE_NAME}={self.admin_auth_token()}; Path=/; HttpOnly; SameSite=Lax",
            )
            self.send_header("Content-Length", "0")
            self.end_headers()
            return

        self.redirect("/admin?error=1")

    def handle_admin_logout(self) -> None:
        self.send_response(HTTPStatus.SEE_OTHER)
        self.send_header("Location", "/admin")
        self.send_header(
            "Set-Cookie",
            f"{ADMIN_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax",
        )
        self.send_header("Content-Length", "0")
        self.end_headers()

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
            from openpyxl.chart import BarChart, PieChart, Reference
            from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
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
            "utm_region",
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
            ("id", "ID", lambda item: item["id"]),
            ("uuid", "UUID", lambda item: item["attemptUuid"]),
            ("status", "Статус", lambda item: "Отправлено" if item["status"] == "submitted" else "В процессе"),
            ("step", "Шаг", lambda item: f'{item["currentStep"]} / 3'),
            ("created_at", "Создано", lambda item: item["createdAt"]),
            ("updated_at", "Обновлено", lambda item: item["updatedAt"]),
            ("submitted_at", "Отправлено", lambda item: item["submittedAt"]),
            ("referrer", "Referrer", lambda item: item["referrer"]),
            ("user_agent", "User Agent", lambda item: item["userAgent"]),
        ]
        columns.extend((key, key, lambda item, field_key=key: item["utm"].get(field_key)) for key in known_utm_keys)
        columns.extend((key, key, lambda item, utm_key=key: item["utm"].get(utm_key)) for key in extra_utm_keys)
        columns.extend((key, key, lambda item, field_key=key: item["fields"].get(field_key)) for key in known_field_keys)
        columns.extend((key, key, lambda item, field_key=key: item["fields"].get(field_key)) for key in extra_field_keys)
        columns.extend([
            ("utm_json", "Все UTM JSON", lambda item: item["utm"]),
            ("fields_json", "Все поля JSON", lambda item: item["fields"]),
            ("source_norm", "ИсточникНорм", self.normalized_source),
            ("step_num", "ШагNum", lambda item: item["currentStep"]),
        ])

        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Попытки регистрации"
        sheet.append([title for _key, title, _getter in columns])

        for attempt in attempts:
            sheet.append([self.excel_value(getter(attempt)) for _key, _title, getter in columns])

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

        column_letters = {
            key: get_column_letter(index)
            for index, (key, _title, _getter) in enumerate(columns, start=1)
        }
        self.add_analytics_sheet(
            workbook,
            attempts,
            column_letters,
            Alignment,
            BarChart,
            Border,
            Font,
            PatternFill,
            PieChart,
            Reference,
            Side,
        )

        if hasattr(workbook, "calculation"):
            workbook.calculation.fullCalcOnLoad = True
            workbook.calculation.forceFullCalc = True

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
    def normalized_source(item: dict) -> str:
        utm = item.get("utm") if isinstance(item.get("utm"), dict) else {}
        referrer = str(item.get("referrer") or "").lower()
        values = [
            utm.get("utm_region"),
            utm.get("utm_source"),
            utm.get("utm_medium"),
            utm.get("utm_campaign"),
        ]
        source_text = " ".join(str(value).lower() for value in values if value)
        combined = f"{source_text} {referrer}"

        if "yandex" in combined or utm.get("yclid"):
            return "yandex"

        if "telegram" in combined or "t.me" in combined or "tg" in combined:
            return "telegram"

        if "google" in combined or utm.get("gclid"):
            return "google"

        if "vk" in combined:
            return "vk"

        if source_text or referrer:
            return "прямой"

        return "не указан"

    @staticmethod
    def add_analytics_sheet(
        workbook,
        attempts: list[dict],
        column_letters: dict[str, str],
        Alignment,
        BarChart,
        Border,
        Font,
        PatternFill,
        PieChart,
        Reference,
        Side,
    ) -> None:
        sheet = workbook.create_sheet("Аналитика")
        chart_data = workbook.create_sheet("_Данные диаграмм")
        chart_data.sheet_state = "hidden"
        attempts_sheet = "'Попытки регистрации'"
        status_col = column_letters["status"]
        source_col = column_letters["source_norm"]
        step_col = column_letters["step_num"]

        def range_ref(column_key: str) -> str:
            column = column_letters[column_key]
            return f"{attempts_sheet}!${column}$2:${column}$5000"

        def source_count(source: str) -> str:
            return f'=COUNTIF({range_ref("source_norm")},"{source}")'

        def source_status_count(source: str, status: str) -> str:
            return (
                f'=COUNTIFS({attempts_sheet}!${source_col}$2:${source_col}$5000,"{source}",'
                f'{attempts_sheet}!${status_col}$2:${status_col}$5000,"{status}")'
            )

        def step_count(step: int) -> str:
            return f'=COUNTIF({attempts_sheet}!${step_col}$2:${step_col}$5000,">={step}")'

        rows = [
            ["Аналитика по попыткам регистрации"],
            ["Всего попыток:", f'=COUNTA({range_ref("id")})'],
            [],
            ["1. Источники трафика"],
            ["Источник", "Кол-во", "Доля"],
        ]

        sources = ["yandex", "telegram", "google", "vk", "прямой", "не указан"]
        for row_index, source in enumerate(sources, start=6):
            rows.append([source, source_count(source), f"=IFERROR(B{row_index}/SUM($B$6:$B$11),0)"])

        rows.extend([
            ["Итого", "=SUM(B6:B11)", "=SUM(C6:C11)"],
            [],
            [],
            ["2. Источники × Статус заявки"],
            ["Источник", "В процессе", "Отправлено"],
        ])

        for source in sources:
            rows.append([
                source,
                source_status_count(source, "В процессе"),
                source_status_count(source, "Отправлено"),
            ])

        rows.extend([
            [],
            [],
            ["3. Воронка по шагам"],
            ["Этап", "Пользователей", "Конверсия от старта"],
            ["Открыли форму (шаг 0+)", f'=COUNTA({range_ref("id")})', "=IFERROR(B27/$B$27,0)"],
            ["Дошли до шага 1", step_count(1), "=IFERROR(B28/$B$27,0)"],
            ["Дошли до шага 2", step_count(2), "=IFERROR(B29/$B$27,0)"],
            ["Дошли до шага 3", step_count(3), "=IFERROR(B30/$B$27,0)"],
            ["Отправили заявку", f'=COUNTIF({range_ref("status")},"Отправлено")', "=IFERROR(B31/$B$27,0)"],
            [],
            [],
            ["4. Отвалы на каждом шаге"],
            ["Переход", "Отвалилось", "% отвала"],
            ["На шаге 0 → 1", "=B27-B28", "=IFERROR(B36/B27,0)"],
            ["На шаге 1 → 2", "=B28-B29", "=IFERROR(B37/B28,0)"],
            ["На шаге 2 → 3", "=B29-B30", "=IFERROR(B38/B29,0)"],
            ["При отправке", "=B30-B31", "=IFERROR(B39/B30,0)"],
            [],
            [],
            ["5. Заполняемость полей"],
            ["Поле", "Заполнили", "% заполнения"],
        ])

        fill_rows = [
            ("Имя", "first-name", 44),
            ("Фамилия", "last-name", 45),
            ("Роль", "role", 46),
            ("Стадия проекта", "stage", 47),
            ("Потребности", "needs", 48),
            ("Сумма запроса", "request", 49),
            ("Email", "email", 50),
            ("Контакт", "contact", 51),
            ("Согласие (privacy)", "privacy", 52),
        ]
        for title, column_key, row_index in fill_rows:
            rows.append([title, f'=COUNTA({range_ref(column_key)})', f"=IFERROR(B{row_index}/$B$2,0)"])

        for row in rows:
            sheet.append(row)

        sources = ["yandex", "telegram", "google", "vk", "прямой", "не указан"]
        source_values = {
            source: sum(1 for item in attempts if PlankaHandler.normalized_source(item) == source)
            for source in sources
        }
        total_attempts = len(attempts)
        status_values = {
            source: {
                "В процессе": sum(
                    1
                    for item in attempts
                    if PlankaHandler.normalized_source(item) == source and item["status"] != "submitted"
                ),
                "Отправлено": sum(
                    1
                    for item in attempts
                    if PlankaHandler.normalized_source(item) == source and item["status"] == "submitted"
                ),
            }
            for source in sources
        }
        funnel_values = [
            ("Открыли форму (шаг 0+)", total_attempts),
            ("Дошли до шага 1", sum(1 for item in attempts if int(item["currentStep"] or 0) >= 1)),
            ("Дошли до шага 2", sum(1 for item in attempts if int(item["currentStep"] or 0) >= 2)),
            ("Дошли до шага 3", sum(1 for item in attempts if int(item["currentStep"] or 0) >= 3)),
            ("Отправили заявку", sum(1 for item in attempts if item["status"] == "submitted")),
        ]
        dropoff_values = [
            ("На шаге 0 → 1", funnel_values[0][1] - funnel_values[1][1]),
            ("На шаге 1 → 2", funnel_values[1][1] - funnel_values[2][1]),
            ("На шаге 2 → 3", funnel_values[2][1] - funnel_values[3][1]),
            ("При отправке", funnel_values[3][1] - funnel_values[4][1]),
        ]
        field_values = [
            ("Имя", "first-name"),
            ("Фамилия", "last-name"),
            ("Роль", "role"),
            ("Стадия проекта", "stage"),
            ("Потребности", "needs"),
            ("Сумма запроса", "request"),
            ("Email", "email"),
            ("Контакт", "contact"),
            ("Согласие (privacy)", "privacy"),
        ]

        chart_data.append(["Источник", "Кол-во", "Доля"])
        for source in sources:
            count = source_values[source]
            chart_data.append([source, count, count / total_attempts if total_attempts else 0])

        chart_data["E1"] = "Источник"
        chart_data["F1"] = "В процессе"
        chart_data["G1"] = "Отправлено"
        for index, source in enumerate(sources, start=2):
            chart_data.cell(index, 5, source)
            chart_data.cell(index, 6, status_values[source]["В процессе"])
            chart_data.cell(index, 7, status_values[source]["Отправлено"])

        chart_data["I1"] = "Этап"
        chart_data["J1"] = "Пользователей"
        for index, (title, value) in enumerate(funnel_values, start=2):
            chart_data.cell(index, 9, title)
            chart_data.cell(index, 10, value)

        chart_data["L1"] = "Переход"
        chart_data["M1"] = "Отвалилось"
        for index, (title, value) in enumerate(dropoff_values, start=2):
            chart_data.cell(index, 12, title)
            chart_data.cell(index, 13, value)

        chart_data["O1"] = "Поле"
        chart_data["P1"] = "Заполнили"
        for index, (title, key) in enumerate(field_values, start=2):
            chart_data.cell(index, 15, title)
            chart_data.cell(index, 16, sum(1 for item in attempts if PlankaHandler.field_is_filled(item, key)))

        blue = "1F4E79"
        light_blue = "D9EAF7"
        border_side = Side(style="thin", color="BFBFBF")
        table_border = Border(left=border_side, right=border_side, top=border_side, bottom=border_side)
        header_fill = PatternFill("solid", fgColor=blue)
        total_fill = PatternFill("solid", fgColor=light_blue)

        sheet["A1"].font = Font(name="Arial", size=14, bold=True, color=blue)
        sheet["A2"].font = Font(name="Arial", bold=True)
        sheet["B2"].font = Font(name="Arial", size=11, bold=True, color=blue)

        section_rows = [4, 15, 25, 34, 42]
        header_rows = [5, 16, 26, 35, 43]
        for row_index in section_rows:
            sheet.cell(row_index, 1).font = Font(name="Arial", size=11, bold=True)

        for row_index in header_rows:
            for column_index in range(1, 4):
                cell = sheet.cell(row_index, column_index)
                cell.fill = header_fill
                cell.font = Font(name="Arial", size=11, bold=True, color="FFFFFF")
                cell.alignment = Alignment(horizontal="center", vertical="center")
                cell.border = table_border

        table_ranges = [(6, 12), (17, 22), (27, 31), (36, 39), (44, 52)]
        for first_row, last_row in table_ranges:
            for row in sheet.iter_rows(min_row=first_row, max_row=last_row, min_col=1, max_col=3):
                for cell in row:
                    cell.border = table_border
                    cell.font = Font(name="Arial", size=10)
                    cell.alignment = Alignment(
                        horizontal="center" if cell.column > 1 else "left",
                        vertical="center",
                        wrap_text=True,
                    )

        for cell in sheet[12]:
            cell.fill = total_fill
            cell.font = Font(name="Arial", size=10, bold=True)

        for row_index in [6, 7, 8, 9, 10, 11, 12, 27, 28, 29, 30, 31, 36, 37, 38, 39, 44, 45, 46, 47, 48, 49, 50, 51, 52]:
            sheet.cell(row_index, 3).number_format = "0.0%"

        sheet.column_dimensions["A"].width = 28
        sheet.column_dimensions["B"].width = 15
        sheet.column_dimensions["C"].width = 20
        sheet.column_dimensions["E"].width = 24
        sheet.column_dimensions["F"].width = 16
        sheet.column_dimensions["G"].width = 16
        sheet.freeze_panes = "A5"

        pie = PieChart()
        pie.title = "Источники трафика"
        pie.add_data(Reference(chart_data, min_col=2, min_row=1, max_row=7), titles_from_data=True)
        pie.set_categories(Reference(chart_data, min_col=1, min_row=2, max_row=7))
        pie.legend.position = "r"
        pie.height = 9
        pie.width = 14
        sheet.add_chart(pie, "E4")

        status_chart = BarChart()
        status_chart.title = "Источники × Статус заявки"
        status_chart.y_axis.title = "Кол-во"
        status_chart.x_axis.title = "Источник"
        status_chart.add_data(Reference(chart_data, min_col=6, max_col=7, min_row=1, max_row=7), titles_from_data=True)
        status_chart.set_categories(Reference(chart_data, min_col=5, min_row=2, max_row=7))
        status_chart.legend.position = "r"
        status_chart.height = 8.5
        status_chart.width = 14
        sheet.add_chart(status_chart, "E23")

        funnel_chart = BarChart()
        funnel_chart.type = "bar"
        funnel_chart.title = "Воронка по шагам"
        funnel_chart.y_axis.title = "Показатели"
        funnel_chart.x_axis.title = "Пользователей"
        funnel_chart.add_data(Reference(chart_data, min_col=10, min_row=1, max_row=6), titles_from_data=True)
        funnel_chart.set_categories(Reference(chart_data, min_col=9, min_row=2, max_row=6))
        funnel_chart.legend = None
        funnel_chart.height = 9
        funnel_chart.width = 14
        sheet.add_chart(funnel_chart, "K4")

        dropoff_chart = BarChart()
        dropoff_chart.title = "Отвалы на каждом шаге"
        dropoff_chart.y_axis.title = "Отвалилось"
        dropoff_chart.add_data(Reference(chart_data, min_col=13, min_row=1, max_row=5), titles_from_data=True)
        dropoff_chart.set_categories(Reference(chart_data, min_col=12, min_row=2, max_row=5))
        dropoff_chart.legend = None
        dropoff_chart.height = 8.5
        dropoff_chart.width = 14
        sheet.add_chart(dropoff_chart, "K23")

        fields_chart = BarChart()
        fields_chart.type = "bar"
        fields_chart.title = "Заполняемость полей"
        fields_chart.x_axis.title = "Кол-во"
        fields_chart.add_data(Reference(chart_data, min_col=16, min_row=1, max_row=10), titles_from_data=True)
        fields_chart.set_categories(Reference(chart_data, min_col=15, min_row=2, max_row=10))
        fields_chart.legend = None
        fields_chart.height = 9.5
        fields_chart.width = 14
        sheet.add_chart(fields_chart, "E42")

    @staticmethod
    def field_is_filled(item: dict, key: str) -> bool:
        fields = item.get("fields") if isinstance(item.get("fields"), dict) else {}
        value = fields.get(key)

        if value is None or value == "":
            return False

        if isinstance(value, list):
            return len(value) > 0

        return True

    @staticmethod
    def excel_value(value) -> str | int | float:
        if value is None or value == "":
            return None

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
