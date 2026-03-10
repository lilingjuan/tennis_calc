import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
} from "@mui/material";

const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEETS_ID;
const API_KEY = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;
const PRICE_SHEET_NAME = "PriceTable";
const DISCOUNT_SHEET_CANDIDATES = ["Discounts", "Скидки", "ClientDiscounts"];
const DISCOUNT_PER_HOUR = 100;

const parseNum = (value) => {
  if (value == null || value === "") return 0;
  const n = parseFloat(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const parseRange = (label) => {
  const nums = String(label || "").match(/\d+[.,]?\d*/g) || [];
  const parsed = nums.map((n) => parseNum(n));
  if (parsed.length >= 2) return { min: parsed[0], max: parsed[1] };
  if (parsed.length === 1) return { min: parsed[0], max: parsed[0] };
  return { min: 0, max: 0 };
};

const normalizePhone = (phone) => String(phone || "").replace(/\D/g, "");

const isTrueCell = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return ["true", "1", "да", "yes", "y", "✅", "☑", "v"].includes(normalized);
};

export default function ChildCalc() {
  const [priceRows, setPriceRows] = useState([]);
  const [discountRows, setDiscountRows] = useState([]);
  const [hours, setHours] = useState(4);
  const [phone, setPhone] = useState("");
  const [resultText, setResultText] = useState("Цена: ...");
  const [copyText, setCopyText] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  useEffect(() => {
    const run = async () => {
      try {
        const priceRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${PRICE_SHEET_NAME}?key=${API_KEY}`
        );
        const priceData = await priceRes.json();
        const [header, ...rows] = priceData.values || [];
        const parsedPrice = rows.map((row) => Object.fromEntries(header.map((k, i) => [k, row[i]])));
        setPriceRows(parsedPrice);

        for (const sheetName of DISCOUNT_SHEET_CANDIDATES) {
          const discountRes = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${sheetName}?key=${API_KEY}`
          );
          const discountData = await discountRes.json();
          if (!discountData.values?.length) continue;
          const [discountHeader, ...discountDataRows] = discountData.values;
          const parsedDiscount = discountDataRows.map((row) =>
            Object.fromEntries(discountHeader.map((k, i) => [k, row[i]]))
          );
          setDiscountRows(parsedDiscount);
          break;
        }
      } catch (e) {
        console.error(e);
        setResultText("Ошибка загрузки данных.");
      }
    };
    run();
  }, []);

  const parsedTable = useMemo(() => {
    if (!priceRows.length) return null;

    const columns = Object.keys(priceRows[0] || {});
    const totalHoursCol = columns.find((c) => c.includes("Общее кол-во"));
    const childCol = columns.find((c) => c.includes("Детские"));

    const rows = priceRows.map((r) => {
      const rawRange = r[totalHoursCol] || "";
      const { min, max } = parseRange(rawRange);
      return {
        rawRange,
        min,
        max,
        childPrice: parseNum(r[childCol]),
      };
    });

    const minPriceRow = rows.find((r) => String(r.rawRange).toLowerCase().includes("миним")) || rows[rows.length - 1];
    return { rows, minPriceRow };
  }, [priceRows]);

  useEffect(() => {
    if (!parsedTable) return;

    const band = parsedTable.rows.find((r) => {
      if (hours < 4) return String(r.rawRange).toLowerCase().includes("разов");
      return hours >= r.min && hours <= r.max;
    });

    if (!band) {
      setResultText("Нет данных для выбранного абонемента.");
      setCopyText("");
      return;
    }

    const normalizedPhone = normalizePhone(phone);
    const clientRow = discountRows.find((r) => normalizePhone(r.Phone || r.phone) === normalizedPhone);
    const discountColumns = clientRow ? Object.keys(clientRow).filter((k) => k !== "Name" && k !== "Phone") : [];
    const discountCount = discountColumns.reduce((acc, col) => acc + (isTrueCell(clientRow[col]) ? 1 : 0), 0);
    const discountValue = discountCount * DISCOUNT_PER_HOUR;
    const hourly = Math.max(parsedTable.minPriceRow.childPrice, band.childPrice - discountValue);
    const total = Math.round(hourly * hours);
    const discountFlag = discountCount > 0 ? "TRUE" : "FALSE";

    const text = `Телефон: ${phone || "не указан"}\nСкидка по телефону: ${discountFlag}\nДетский абонемент: ${hours} ч. (${total}₽, ${hourly}₽/ч)\n\nИТОГО: ${total}₽`;
    setResultText(text);
    setCopyText(text);
  }, [hours, parsedTable, discountRows, phone]);

  const handleCopy = async () => {
    if (!copyText) return;
    try {
      await navigator.clipboard.writeText(copyText);
      setCopyStatus("Скопировано в буфер обмена");
    } catch {
      setCopyStatus("Не удалось скопировать");
    }
  };

  return (
    <Box>
      <Paper elevation={0} sx={{ mb: 2, backgroundColor: "transparent", boxShadow: "none", display: "flex", justifyContent: "center", alignItems: "center" }}>
        <Typography variant="h6">Абонемент в детскую группу</Typography>
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1">Введите свой номер телефона</Typography>
        <TextField
          fullWidth
          size="small"
          placeholder="Например: 79876543210"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          sx={{ mt: 1 }}
        />
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1">Часов в месяц</Typography>
        <TextField
          fullWidth
          type="number"
          size="small"
          value={hours}
          inputProps={{ min: 0, step: 0.5 }}
          onChange={(e) => setHours(parseNum(e.target.value))}
          sx={{ mt: 1 }}
        />
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6">Итого</Typography>
        <Typography variant="body2" sx={{ whiteSpace: "pre-line", mt: 1 }}>
          {resultText}
        </Typography>
        <Button variant="contained" sx={{ mt: 2 }} onClick={handleCopy} disabled={!copyText}>
          Копировать в буфер
        </Button>
        {copyStatus && (
          <Typography variant="caption" sx={{ display: "block", mt: 1 }}>
            {copyStatus}
          </Typography>
        )}
      </Paper>
    </Box>
  );
}
