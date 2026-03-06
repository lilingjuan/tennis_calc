import React, { useState } from "react";
import {
  Box,
  Container,
  Paper,
  Tabs,
  Tab,
} from "@mui/material";

import AdultCalc from "./AdultCalc";
import ChildCalc from "./ChildCalc";

export default function App() {
  const [mode, setMode] = useState("adult");

  return (
    <Box sx={{ bgcolor: "#f6f8fa", minHeight: "100vh", pb: 12 }}>
      <Container maxWidth="sm" sx={{ py: 2 }}>
        {/* Переключатель через Tabs с Emoji */}
        <Paper elevation={2} sx={{ mb: 2 }}>
          <Tabs
            value={mode}
            onChange={(e, v) => setMode(v)}
            centered
            variant="fullWidth"
          >
            <Tab label="👨 Взрослый" value="adult" />
            <Tab label="🧒 Детский" value="child" />
          </Tabs>
        </Paper>

        {/* Калькулятор */}
        {mode === "adult" ? <AdultCalc /> : <ChildCalc />}
      </Container>
    </Box>
  );
}
