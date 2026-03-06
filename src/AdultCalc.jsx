// src/AdultCalc.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Paper,
  Typography,
  Stack,
  TextField,
  MenuItem,
  Switch,
  FormControlLabel,
  RadioGroup,
  Radio,
  Button,
  Box,
  Checkbox,
  Link,
} from "@mui/material";

// ========================
// ГЛОБАЛЬНЫЕ КОНСТАНТЫ
// ========================
const SHEET_ID = "1nDB_tgqQNaM_CoElNM29EEHpsEdjLUQJH8HJTHhHT2w";
const API_KEY = "AIzaSyDxYoaJ5Xc14Day3JkM1r07D1akv-XwFbo";
const SHEET_NAME = "PriceList";

const MIN_INTENSE_HOURS = 20;
const MIN_INTENSE_DAY = 12;
const MIN_INTENSE_MINI = 4;

const DISCOUNT_NTRP = 100;
const ONLINE_UPLIFT = 0.05;

const MIN_PRICE_MAIN = 1600;
const MIN_PRICE_DAY = 1500;
const MIN_PRICE_MINI = 2500;

const parseNum = (v) => {
  if (!v) return 0;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const roundTo50 = (num) => Math.round(num / 50) * 50;
const roundTo1 = (num) => Math.round(num);

// ========================
// MAP
// ========================
const TYPE_MAP = {
  main: { label: "Будни вечер / Выходные", minPrice: MIN_PRICE_MAIN },
  day:  { label: "Будни день",              minPrice: MIN_PRICE_DAY  },
  mini: { label: "Мини-группы (3 чел)",     minPrice: MIN_PRICE_MINI },
};

// Названия абонементов в прайсе
const NAME_MAP = {
  main: ["Минимум", "Базовый", "Стандарт", "Интенсив", "Максимум"],
  day:  ["Будни день", "Будни день Интенсив"],
  mini: ["Мини-группа"],
};

// ========================
// Компонент блока
// ========================
function ServiceBlock({ type, enabled, hours, onToggle, onHoursChange, options, bonusMsg }) {
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
        <Stack spacing={1} sx={{ mt: 1 }}>
          <TextField
            select
            fullWidth
            size="small"
            label="Часов в мес"
            value={hours || ""}
            onChange={(e) => onHoursChange(parseNum(e.target.value))}
          >
            {options.map((opt) => (
              <MenuItem key={opt.hours} value={opt.hours}>
                {opt.name} — {opt.hours} ч.
              </MenuItem>
            ))}
          </TextField>

          {bonusMsg && (
            <Typography
              variant="caption"
              color={bonusMsg.type === "success" ? "green" : "text.secondary"}
            >
              {bonusMsg.text}
            </Typography>
          )}
        </Stack>
      )}
    </Paper>
  );
}

// ========================
// AdultCalc
// ========================
export default function AdultCalc() {
  const [priceList, setPriceList] = useState([]);
  const [enabled, setEnabled] = useState({ main: false, day: false, mini: false });
  const [hours, setHours] = useState({ main: 0, day: 0, mini: 0 });
  const [ntrp, setNtrp] = useState(false);
  const [payMethod, setPayMethod] = useState("cash");
  const [lines, setLines] = useState([]);
  const [total, setTotal] = useState(0);
  const [waText, setWaText] = useState(null);
  const [waHref, setWaHref] = useState("#");

  // загрузка цен
  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}?key=${API_KEY}`
        );
        const data = await res.json();
        const [header, ...rows] = data.values || [];
        const list = rows.map((row) =>
          Object.fromEntries(header.map((k, i) => [k, row[i]]))
        );
        setPriceList(list);
      } catch (e) {
        console.error(e);
      }
    };
    run();
  }, []);

  // опции из таблицы
  const options = useMemo(() => {
    const build = (names) =>
      priceList
        .filter((r) => names.includes((r["Название абонемента"] || "").trim()))
        .map((r) => ({
          hours: parseNum(r["Количество, часов"]),
          name: r["Название абонемента"],
        }))
        .filter((o) => o.hours > 0)
        .sort((a, b) => a.hours - b.hours);
    return {
      main: build(NAME_MAP.main),
      day:  build(NAME_MAP.day),
      mini: build(NAME_MAP.mini),
    };
  }, [priceList]);

  // бонусные сообщения (как у вас)
  const bonusMessages = useMemo(() => {
    const totalHours =
      (enabled.main ? hours.main : 0) +
      (enabled.day  ? hours.day  : 0) +
      (enabled.mini ? hours.mini : 0);

    if (totalHours >= MIN_INTENSE_HOURS) {
      return {
        main: { text: `🎾 Мин. цены на все занятия (${MIN_INTENSE_HOURS}+ ч/мес)`, type: "success" },
        day:  { text: `🎾 Мин. цены на все занятия (${MIN_INTENSE_HOURS}+ ч/мес)`, type: "success" },
        mini: { text: `🎾 Мин. цены на все занятия (${MIN_INTENSE_HOURS}+ ч/мес)`, type: "success" },
      };
    }
    return {
      main: { text: `🎾 Мин. цена при посещении ${MIN_INTENSE_HOURS}+ ч/мес`, type: "info" },
      day:  { text: `🌞 Мин. цена при посещении ${MIN_INTENSE_DAY}+ ч/мес`, type: hours.day  >= MIN_INTENSE_DAY  ? "success" : "info" },
      mini: { text: `👥 Мин. цена при посещении ${MIN_INTENSE_MINI}+ ч/мес`, type: hours.mini >= MIN_INTENSE_MINI ? "success" : "info" },
    };
  }, [enabled, hours]);

  // перерасчёт + сборка итогового текста и WhatsApp
  useEffect(() => {
    if (!priceList.length) return;

    const svcList = [
      { key: "main", min: MIN_PRICE_MAIN },
      { key: "day",  min: MIN_PRICE_DAY  },
      { key: "mini", min: MIN_PRICE_MINI },
    ];

    const totalHours =
      (enabled.main ? hours.main : 0) +
      (enabled.day  ? hours.day  : 0) +
      (enabled.mini ? hours.mini : 0);

    let newLines = [];
    let newTotal = 0;

    for (const svc of svcList) {
      if (!enabled[svc.key] || !hours[svc.key]) continue;

      const row = priceList.find(r =>
        NAME_MAP[svc.key].includes((r["Название абонемента"] || "").trim()) &&
        parseNum(r["Количество, часов"]) === hours[svc.key]
      );
      if (!row) continue;

      let baseHourly = parseNum(row["PriceCash"]);
      let hourly = baseHourly;

      // скидка NTRP — только для main и day
      let ntrpApplied = false;
      if (ntrp && svc.key !== "mini") {
        hourly -= DISCOUNT_NTRP;
        ntrpApplied = true;
      }

      // минимальные цены
      let minApplied = false;
      if (totalHours >= MIN_INTENSE_HOURS) {
        hourly = svc.min; minApplied = true;
      } else {
        if (svc.key === "day"  && hours.day  >= MIN_INTENSE_DAY)  { hourly = svc.min; minApplied = true; }
        if (svc.key === "mini" && hours.mini >= MIN_INTENSE_MINI) { hourly = svc.min; minApplied = true; }
        if (hourly < svc.min) { hourly = svc.min; minApplied = true; }
      }

      // онлайн +5%
      let onlineApplied = false;
      if (payMethod === "online") {
        hourly *= 1 + ONLINE_UPLIFT;
        onlineApplied = true;
      }

      const hourlyOut = payMethod === "cash" ? roundTo50(hourly) : roundTo1(hourly);
      const final = Math.round(hourly * hours[svc.key]);

      newTotal += final;

      // Метки применённых правил
      const tags = [];
      if (ntrpApplied && svc.key !== "mini") tags.push("NTRP −100₽");
      if (minApplied)                        tags.push("мин. цена");
      if (onlineApplied)                     tags.push("+5% онлайн");
      const tagStr = tags.length ? ` [${tags.join("; ")}]` : "";

      newLines.push(
        `— ${TYPE_MAP[svc.key].label}: ${hours[svc.key]} ч. (${final}₽) ~ ${hourlyOut}₽/ч${tagStr}`
      );
    }

    setLines(newLines);
    setTotal(newTotal);

    if (newLines.length) {
      const payText = payMethod === "cash" ? "наличными" : "онлайн";
      const msg = `Здравствуйте, Фёдор! Мне подходит абонемент:\n${newLines.join("\n")}\n\nИТОГО: ${newTotal}₽ (${payText})`;
      setWaText(msg);
      setWaHref(`https://wa.me/79500021816?text=${encodeURIComponent(msg)}`);
    } else {
      setWaText(null);
      setWaHref("#");
    }
  }, [priceList, enabled, hours, ntrp, payMethod]);

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
        <Typography variant="h6">Абонемент во взрослую группу</Typography>
      </Paper>

      {/* Блок со скидкой NTRP */}
      <Paper elevation={1} sx={{ p: 2, borderRadius: 2, mb: 2 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={ntrp}
              onChange={(e) => setNtrp(e.target.checked)}
            />
          }
          label={
            <Typography variant="body2">              
              Скидка за уровень (кроме Мини-групп)<br />
            NTRP 4.0+{" "}
              <Link
                href="https://rutube.ru/video/4d9f46a66e5b5515d617548f694ae9e9/?r=wd"
                target="_blank"
                rel="noopener"
              >
                видео 
              </Link>     
              &nbsp;/ до 18 лет NTRP 3.5+
            </Typography>
          }
        />
      </Paper>

      {/* Блоки услуг */}
      <Stack spacing={2}>
        <ServiceBlock
          type="main"
          enabled={enabled.main}
          hours={hours.main}
          onToggle={(v) => setEnabled((s) => ({ ...s, main: v }))}
          onHoursChange={(v) => setHours((s) => ({ ...s, main: v }))}
          options={options.main}
          bonusMsg={bonusMessages.main}
        />
        <ServiceBlock
          type="day"
          enabled={enabled.day}
          hours={hours.day}
          onToggle={(v) => setEnabled((s) => ({ ...s, day: v }))}
          onHoursChange={(v) => setHours((s) => ({ ...s, day: v }))}
          options={options.day}
          bonusMsg={bonusMessages.day}
        />
        <ServiceBlock
          type="mini"
          enabled={enabled.mini}
          hours={hours.mini}
          onToggle={(v) => setEnabled((s) => ({ ...s, mini: v }))}
          onHoursChange={(v) => setHours((s) => ({ ...s, mini: v }))}
          options={options.mini}
          bonusMsg={bonusMessages.mini}
        />
      </Stack>

      {/* Способ оплаты */}
      <Paper elevation={1} sx={{ p: 2, borderRadius: 2, mt: 2 }}>
        <Typography variant="subtitle1">Способ оплаты</Typography>
        <RadioGroup row value={payMethod} onChange={(e) => setPayMethod(e.target.value)} sx={{ mt: 1 }}>
          <FormControlLabel value="cash" control={<Radio />} label="💸 Наличными (-5%)" />
          <FormControlLabel value="online" control={<Radio />} label="💳 Онлайн" />
        </RadioGroup>
      </Paper>

      {/* Итог */}
      <Paper elevation={2} sx={{ p: 2, borderRadius: 2, mt: 2 }}>
        <Typography variant="h6">Итого</Typography>
        <Typography variant="body2" sx={{ mt: 1, whiteSpace: "pre-line" }}>
          {lines.length
            ? `Оплата составит:\n${lines.join("\n")}\n\nИТОГО: ${total}₽ (${payMethod === "cash" ? "наличными" : "онлайн"})`
            : "Выберите абонемент."}
        </Typography>
        <Button
          variant="contained"
          color="success"
          sx={{ mt: 1 }}
          disabled={!waText}
          href={waHref}
          target="_blank"
        >
          Переслать Админу в WhatsApp
        </Button>
      </Paper>
    </Box>
  );
}
