import React, { useEffect, useMemo, useState } from "react";
import {
  Paper,
  Typography,
  Stack,
  TextField,
  Switch,
  FormControlLabel,
  Button,
  Box,
} from "@mui/material";

const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEETS_ID;
const API_KEY = import.meta.env.VITE_GOOGLE_SHEETS_API_KEY;
const PRICE_SHEET_NAME = "PriceTable";
const DISCOUNT_SHEET_CANDIDATES = ["Discounts", "Скидки", "ClientDiscounts"];

const DISCOUNT_PER_HOUR = 100;

const TYPE_MAP = {
  main: { label: "Будни вечер / Выходные", keyHint: "Вечер/Выходные" },
  day: { label: "Будни день", keyHint: "Будни день" },
  mini: { label: "Мини-группы (3 чел)", keyHint: "Мини-группа" },
};

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

function ServiceBlock({ type, enabled, hours, onToggle, onHoursChange }) {
  const meta = TYPE_MAP[type];

  return (
    <Paper elevation={1} sx={{ p: 2, borderRadius: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="subtitle1">{meta.label}</Typography>
        <FormControlLabel
          control={<Switch checked={enabled} onChange={(e) => onToggle(e.target.checked)} />}
          label=""
        />
      </Stack>

      {enabled && (
        <TextField
          fullWidth
          type="number"
          size="small"
          label="Часов в мес"
          value={hours || ""}
          inputProps={{ min: 0, step: 0.5 }}
          onChange={(e) => onHoursChange(parseNum(e.target.value))}
          sx={{ mt: 1 }}
        />
      )}
    </Paper>
  );
}

export default function AdultCalc() {
  const [priceRows, setPriceRows] = useState([]);
  const [discountRows, setDiscountRows] = useState([]);
  const [enabled, setEnabled] = useState({ main: false, day: false, mini: false });
  const [hours, setHours] = useState({ main: 0, day: 0, mini: 0 });
  const [phone, setPhone] = useState("");
  const [lines, setLines] = useState([]);
  const [total, setTotal] = useState(0);
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
      }
    };
    run();
  }, []);

  const parsedTable = useMemo(() => {
    if (!priceRows.length) return null;

    const columns = Object.keys(priceRows[0] || {});
    const totalHoursCol = columns.find((c) => c.includes("Общее кол-во"));
    const mainCol = columns.find((c) => c.includes(TYPE_MAP.main.keyHint));
    const dayCol = columns.find((c) => c.includes(TYPE_MAP.day.keyHint));
    const miniCol = columns.find((c) => c.includes(TYPE_MAP.mini.keyHint));

    const rows = priceRows.map((r) => {
      const rawRange = r[totalHoursCol] || "";
      const { min, max } = parseRange(rawRange);
      return {
        rawRange,
        min,
        max,
        prices: {
          main: parseNum(r[mainCol]),
          day: parseNum(r[dayCol]),
          mini: parseNum(r[miniCol]),
        },
      };
    });

    const minPriceRow = rows.find((r) => String(r.rawRange).toLowerCase().includes("миним")) || rows[rows.length - 1];
    return { rows, minPriceRow };
  }, [priceRows]);

  useEffect(() => {
    if (!parsedTable) return;

    const totalHours =
      (enabled.main ? hours.main : 0) +
      (enabled.day ? hours.day : 0) +
      (enabled.mini ? hours.mini : 0);

    if (!totalHours) {
      setLines([]);
      setTotal(0);
      setCopyText("");
      return;
    }

    const band = parsedTable.rows.find((r) => {
      if (totalHours < 4) return String(r.rawRange).toLowerCase().includes("разов");
      return totalHours >= r.min && totalHours <= r.max;
    });

    if (!band) {
      setLines(["Нет подходящей строки в таблице цен."]);
      setTotal(0);
      setCopyText("");
      return;
    }

    const normalizedPhone = normalizePhone(phone);
    const clientRow = discountRows.find((r) => normalizePhone(r.Phone || r.phone) === normalizedPhone);
    const discountColumns = clientRow ? Object.keys(clientRow).filter((k) => k !== "Name" && k !== "Phone") : [];
    const discountCount = discountColumns.reduce((acc, col) => acc + (isTrueCell(clientRow[col]) ? 1 : 0), 0);
    const discountValue = discountCount * DISCOUNT_PER_HOUR;
    const discountApplied = discountCount > 0;

    const newLines = [];
    let newTotal = 0;

    ["main", "day", "mini"].forEach((key) => {
      if (!enabled[key] || !hours[key]) return;
      const baseHourly = band.prices[key];
      const minHourly = parsedTable.minPriceRow.prices[key];
      const finalHourly = Math.max(minHourly, baseHourly - discountValue);
      const sum = Math.round(finalHourly * hours[key]);
      newTotal += sum;
      newLines.push(
        `— ${TYPE_MAP[key].label}: ${hours[key]} ч. (${sum}₽) ~ ${finalHourly}₽/ч`
      );
    });

    const discountFlag = discountApplied ? "TRUE" : "FALSE";
    const text = [
      `Телефон: ${phone || "не указан"}`,
      `Скидка по телефону: ${discountFlag}`,
      ...newLines,
      ``,
      `ИТОГО: ${newTotal}₽`,
    ].join("\n");

    setLines(newLines);
    setTotal(newTotal);
    setCopyText(text);
  }, [parsedTable, discountRows, enabled, hours, phone]);

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
        <Typography variant="h6">Абонемент во взрослую группу</Typography>
      </Paper>

      <Paper elevation={1} sx={{ p: 2, borderRadius: 2, mb: 2 }}>
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

      <Stack spacing={2}>
        <ServiceBlock type="main" enabled={enabled.main} hours={hours.main} onToggle={(v) => setEnabled((s) => ({ ...s, main: v }))} onHoursChange={(v) => setHours((s) => ({ ...s, main: v }))} />
        <ServiceBlock type="day" enabled={enabled.day} hours={hours.day} onToggle={(v) => setEnabled((s) => ({ ...s, day: v }))} onHoursChange={(v) => setHours((s) => ({ ...s, day: v }))} />
        <ServiceBlock type="mini" enabled={enabled.mini} hours={hours.mini} onToggle={(v) => setEnabled((s) => ({ ...s, mini: v }))} onHoursChange={(v) => setHours((s) => ({ ...s, mini: v }))} />
      </Stack>

      <Paper elevation={2} sx={{ p: 2, borderRadius: 2, mt: 2 }}>
        <Typography variant="h6">Итого</Typography>
        <Typography variant="body2" sx={{ mt: 1, whiteSpace: "pre-line" }}>
          {lines.length ? `Оплата составит:\n${lines.join("\n")}\n\nИТОГО: ${total}₽` : "Выберите абонемент."}
        </Typography>
        <Button variant="contained" sx={{ mt: 2 }} disabled={!copyText} onClick={handleCopy}>
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
