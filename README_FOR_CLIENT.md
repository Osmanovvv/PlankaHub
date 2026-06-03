# Planka Hub

## Быстрый просмотр

Откройте `index.html` в браузере, если нужен только просмотр лендинга.

## Запуск с сервером, формой и админкой

1. Установите Python 3.11 или новее.
2. В папке проекта выполните:

```bash
python -m pip install -r requirements.txt
python server.py
```

3. Откройте сайт:

```text
http://127.0.0.1:4173/
```

4. Админ-панель:

```text
http://127.0.0.1:4173/asjkfhjkqwfasf14871209asjkSA
```

Доступ к админке задан в `server.py` в переменных `ADMIN_USERNAME` и `ADMIN_PASSWORD`.

## Данные

Папка `data` с локальной базой и Excel-выгрузками не входит в архив. Сервер создаст `data/registrations.db` автоматически при первом запуске.
