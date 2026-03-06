// src/ChildCalc.jsx
import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  TextField,
  MenuItem,
  RadioGroup,
  FormControlLabel,
  Radio,
  Button,
  Paper,
} from "@mui/material";

const SHEET_ID = "1nDB_tgqQNaM_CoElNM29EEHpsEdjLUQJH8HJTHhHT2w";
const API_KEY = "AIzaSyDxYoaJ5Xc14Day3JkM1r07D1akv-XwFbo";
const SHEET_NAME = "ChildPrice";

const HOURS = [4, 5, 6, 7, 8, 9, 10, 11, 12];

// Универсальный парсер чисел
const parseNum = (v) => {
  if (!v) return 0;
  return parseFloat(String(v).replace(",", ".").trim());
};

export default function ChildCalc() {
  const [priceList, setPriceList] = useState([]);
  const [hours, setHours] = useState(4);
  const [payMethod, setPayMethod] = useState("cash");
  const [resultText, setResultText] = useState("Цена: ...");
  const [waLink, setWaLink] = useState("");

  // Загружаем данные из Google Sheets
  useEffect(() => {
    fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}?key=${API_KEY}`
    )
      .then((res) => res.json())
      .then((data) => {
        if (!data.values) return;
        const [header, ...rows] = data.values;
        const list = rows.map((row) =>
          Object.fromEntries(header.map((k, i) => [k, row[i]]))
        );
        setPriceList(list);
      })
      .catch(() => {
        setResultText("Ошибка загрузки данных.");
      });
  }, []);

  // Поиск тарифа по часам
  const findRate = (h) => {
    return priceList.find((row) => parseNum(row["Количество, часов"]) === h);
  };

  // Пересчёт цены
  useEffect(() => {
    if (!priceList.length) return;

    const row = findRate(hours);
    if (!row) {
      setResultText("Нет данных для выбранного абонемента.");
      setWaLink("");
      return;
    }

    let hourly = parseNum(row["PriceCash"]);

    // корректировка оплаты
    if (payMethod === "online") {
      hourly = Math.round(hourly * 1.05);
    } else {
      hourly = Math.round(hourly);
    }

    const total = hourly * hours;

    const lines = [`Детский абонемент: ${hours} ч. (${total}₽, ${hourly}₽/час)`];
    const text = `Оплата составит:\n${lines.join("\n")}\n\nИТОГО: ${total}₽ (${
      payMethod === "cash" ? "наличными" : "онлайн"
    })`;
    setResultText(text);

    // WhatsApp сообщение
    const waText =
      payMethod === "cash"
        ? `Здравствуйте, Фёдор! Меня интересует детский абонемент:\n${lines.join(
            "\n"
          )}\nИТОГО: ${total}₽ (наличными можно оплатить тренеру).`
        : `Здравствуйте, Фёдор! Меня интересует детский абонемент:\n${lines.join(
            "\n"
          )}\nИТОГО: ${total}₽ (онлайн)\nПрошу выслать ссылку для оплаты.`;

    setWaLink(
      `https://wa.me/79500021816?text=${encodeURIComponent(waText)}`
    );
  }, [hours, payMethod, priceList]);

  return (
    <Box>
      {/* Заголовок */}
      <Paper
        elevation={0}
        sx={{
          mb: 2,
          backgroundColor: "transparent",
          boxShadow: "none",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Typography variant="h6">Абонемент в детскую группу</Typography>
      </Paper>

      {/* Выбор часов */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1">Детский абонемент</Typography>
        <TextField
          select
          fullWidth
          size="small"
          label="Часов в мес"
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          sx={{ mt: 1 }}
        >
          {HOURS.map((h) => (
            <MenuItem key={h} value={h}>
              {h} ч.
            </MenuItem>
          ))}
        </TextField>
      </Paper>

      {/* Способ оплаты */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1">Способ оплаты</Typography>
        <RadioGroup
          row
          value={payMethod}
          onChange={(e) => setPayMethod(e.target.value)}
          sx={{ mt: 1 }}
        >
          <FormControlLabel
            value="cash"
            control={<Radio />}
            label="💸 Наличными (-5%)"
          />
          <FormControlLabel
            value="online"
            control={<Radio />}
            label="💳 Онлайн"
          />
        </RadioGroup>
      </Paper>

      {/* Итог */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6">Итого</Typography>
        <Typography variant="body2" sx={{ whiteSpace: "pre-line", mt: 1 }}>
          {resultText}
        </Typography>
        {waLink && (
          <Button
            variant="contained"
            color="success"
            sx={{ mt: 2 }}
            href={waLink}
            target="_blank"
          >
            Переслать Админу в WhatsApp
          </Button>
        )}
      </Paper>
    </Box>
  );
}
