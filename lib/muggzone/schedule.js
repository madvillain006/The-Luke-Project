"use strict";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function minutes(value) {
  if (!/^\d{2}:\d{2}$/.test(value || "")) throw new Error("Schedule times must use HH:MM");
  const [h, m] = value.split(":").map(Number);
  if (h > 23 || m > 59) throw new Error("Invalid schedule time");
  return h * 60 + m;
}

function validateSchedule(schedule = {}) {
  const result = {
    timezone: schedule.timezone || "America/New_York",
    start: schedule.start || "08:00",
    end: schedule.end || "17:00",
    weekdays: schedule.weekdays || [1, 2, 3, 4, 5],
    closed_dates: schedule.closed_dates || [],
    poll_interval_ms: schedule.poll_interval_ms ?? 240000,
  };
  new Intl.DateTimeFormat("en-US", { timeZone: result.timezone }).format();
  if (minutes(result.start) >= minutes(result.end)) throw new Error("Schedule start must precede end");
  if (!Array.isArray(result.weekdays) || !result.weekdays.length || result.weekdays.some(day => !Number.isInteger(day) || day < 0 || day > 6)) throw new Error("Invalid schedule weekdays");
  if (!Array.isArray(result.closed_dates) || result.closed_dates.some(date => !/^\d{4}-\d{2}-\d{2}$/.test(date))) throw new Error("Invalid explicit closed_dates");
  if (!Number.isInteger(result.poll_interval_ms) || result.poll_interval_ms < 180000 || result.poll_interval_ms > 300000) throw new Error("Poll interval must be 3–5 minutes");
  return result;
}

function scheduleState(now, schedule = {}) {
  const value = validateSchedule(schedule);
  const date = new Date(now);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid observation time");
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: value.timezone, year: "numeric", month: "2-digit", day: "2-digit",
    weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  const local_date = `${parts.year}-${parts.month}-${parts.day}`;
  const minute = Number(parts.hour) * 60 + Number(parts.minute);
  let reason = null;
  if (value.closed_dates.includes(local_date)) reason = "explicit_closed_date";
  else if (!value.weekdays.includes(DAY_NAMES.indexOf(parts.weekday))) reason = "outside_weekdays";
  else if (minute < minutes(value.start) || minute >= minutes(value.end)) reason = "outside_window";
  return { active: reason === null, reason, local_date, local_time: `${parts.hour}:${parts.minute}`, timezone: value.timezone };
}

module.exports = { validateSchedule, scheduleState };
