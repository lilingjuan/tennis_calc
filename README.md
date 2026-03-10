# tennis_calc

Калькулятор теннисных абонементов (взрослый и детский) на React + Vite + MUI.

## Возможности

- Переключение между взрослым и детским калькулятором.
- Загрузка тарифов из Google Sheets.
- Расчёт итоговой стоимости по выбранным часам и способу оплаты.
- Формирование готового сообщения в WhatsApp для отправки администратору.

## Установка и запуск

```bash
npm ci
npm run dev
```

## Переменные окружения

Создайте `.env` на основе примера:

```bash
cp .env.example .env
```

Заполните значения:

- `VITE_GOOGLE_SHEETS_ID` — ID Google Spreadsheet.
- `VITE_GOOGLE_SHEETS_API_KEY` — API key для Google Sheets API.

## Проверки

```bash
npm run lint
npm run build
```
