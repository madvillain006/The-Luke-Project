import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import research_mancini_fbd_algo_math as math  # noqa: E402


def bar(ts, open_, high, low, close):
    return {
        "timestamp": ts,
        "open": open_,
        "high": high,
        "low": low,
        "close": close,
        "volume": 1.0,
    }


class ManciniFbdAlgoMathTest(unittest.TestCase):
    def test_reclaim_fallback_starts_after_trap(self):
        base = datetime(2026, 5, 13, 9, 0, tzinfo=timezone.utc)
        bars = [
            bar(base, 100, 101, 99, 101),
            bar(base + timedelta(minutes=1), 101, 101, 99, 99),
            bar(base + timedelta(minutes=2), 99, 101, 98, 100.25),
        ]

        metrics = math.compute_reclaim_metrics(
            bars,
            level=100,
            reclaim_time=None,
            trap_time=base + timedelta(minutes=1),
        )

        self.assertEqual(metrics["reclaim_timestamp_et"], (base + timedelta(minutes=2)).isoformat())

    def test_no_close_back_below_is_scanned_to_score_time(self):
        base = datetime(2026, 5, 13, 9, 0, tzinfo=timezone.utc)
        bars = [
            bar(base, 100, 101, 99, 100.25),
            bar(base + timedelta(minutes=1), 100.25, 101, 99, 99.75),
            bar(base + timedelta(minutes=2), 99.75, 101, 99, 100.5),
        ]

        metrics = math.compute_reclaim_metrics(
            bars,
            level=100,
            reclaim_time=base,
            trap_time=base - timedelta(minutes=1),
        )

        self.assertFalse(metrics["no_close_back_below_L_before_entry"])

    def test_first_hit_target_before_stop(self):
        base = datetime(2026, 5, 13, 9, 0, tzinfo=timezone.utc)
        bars = [
            bar(base, 100, 102, 99.5, 101),
            bar(base + timedelta(minutes=1), 101, 104, 100.5, 103),
        ]

        outcome = math.compute_first_hit_outcome(bars, base, 100, stop_points=2, target_points=3)

        self.assertEqual(outcome["first_hit_event"], "target")
        self.assertEqual(outcome["expectancy_points_slippage_0_5"], 2.5)

    def test_first_hit_stop_before_target(self):
        base = datetime(2026, 5, 13, 9, 0, tzinfo=timezone.utc)
        bars = [
            bar(base, 100, 101, 99.5, 100.5),
            bar(base + timedelta(minutes=1), 100.5, 102, 97.75, 98),
        ]

        outcome = math.compute_first_hit_outcome(bars, base, 100, stop_points=2, target_points=3)

        self.assertEqual(outcome["first_hit_event"], "stop")
        self.assertTrue(outcome["stop_first"])
        self.assertEqual(outcome["expectancy_points_slippage_0_5"], -2.5)

    def test_same_bar_is_conservative_stop_first(self):
        base = datetime(2026, 5, 13, 9, 0, tzinfo=timezone.utc)
        bars = [bar(base, 100, 103.25, 97.75, 100)]

        outcome = math.compute_first_hit_outcome(bars, base, 100, stop_points=2, target_points=3)

        self.assertEqual(outcome["first_hit_event"], "same_bar_stop_and_target")
        self.assertTrue(outcome["same_bar_stop_and_target"])
        self.assertTrue(outcome["stop_first"])

    def test_timeout_uses_close_not_max_mfe(self):
        base = datetime(2026, 5, 13, 9, 0, tzinfo=timezone.utc)
        bars = [
            bar(base, 100, 102.75, 99.5, 100.5),
            bar(base + timedelta(minutes=1), 100.5, 102, 99.75, 101),
        ]

        outcome = math.compute_first_hit_outcome(bars, base, 100, stop_points=2, target_points=3)

        self.assertEqual(outcome["first_hit_event"], "timeout")
        self.assertEqual(outcome["first_hit_points"], 1)
        self.assertEqual(outcome["expectancy_points_slippage_0_5"], 0.5)


if __name__ == "__main__":
    unittest.main()
