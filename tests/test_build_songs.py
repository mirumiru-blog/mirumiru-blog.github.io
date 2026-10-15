import json
import sys
import unittest
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from build_songs import OUTPUT, UNKNOWN, build_songs, clean, match_key, parse_date  # noqa: E402


class CleanTest(unittest.TestCase):
    def test_removes_zero_width_and_extra_spaces(self):
        self.assertEqual(clean("​​変わらないもの "), "変わらないもの")
        self.assertEqual(clean("王心凌-  月光"), "王心凌- 月光")
        self.assertEqual(clean("a\xa0b"), "a b")

    def test_none_becomes_empty(self):
        self.assertEqual(clean(None), "")

    def test_match_key_ignores_spacing_and_case(self):
        self.assertEqual(match_key("王心凌-  月光"), match_key("王心凌-月光"))
        self.assertEqual(match_key("Just Be Friends"), match_key("just be friends"))


class ParseDateTest(unittest.TestCase):
    def test_excel_datetime_and_date(self):
        self.assertEqual(parse_date(datetime(2026, 10, 12, 21, 0)), date(2026, 10, 12))
        self.assertEqual(parse_date(date(2026, 10, 12)), date(2026, 10, 12))

    def test_text_formats(self):
        for text in ["2026/10/12", "2026-10-12", "2026.10.12", "2026年10月12日", " 2026/1/2 "]:
            with self.subTest(text=text):
                self.assertIsNotNone(parse_date(text))
        self.assertEqual(parse_date("2026/1/2"), date(2026, 1, 2))

    def test_invalid(self):
        for value in [None, "", "10/12", "上週", "2026/13/40"]:
            with self.subTest(value=value):
                self.assertIsNone(parse_date(value))


class BuildSongsTest(unittest.TestCase):
    def test_basic_row(self):
        songs, warnings = build_songs([["366日", "日文", "JPOP"]])
        self.assertEqual(
            songs,
            [{"name": "366日", "language": "日文", "category": "JPOP", "count": 0, "lastSung": None}],
        )
        self.assertEqual(warnings, [])

    def test_skips_rows_without_name(self):
        rows = [[None, None, None], [None, None, "動漫歌曲"], ["WILL", "日文", "動漫歌曲"]]
        self.assertEqual([s["name"] for s in build_songs(rows)[0]], ["WILL"])

    def test_removes_exact_duplicates(self):
        rows = [["ピエロ", "日文", "V家"], ["ピエロ ", "日文", "V家"]]
        self.assertEqual(len(build_songs(rows)[0]), 1)

    def test_same_name_in_different_category_is_kept(self):
        rows = [["嘘", "日文", "動漫歌曲"], ["嘘", "日文", "JPOP"]]
        self.assertEqual(len(build_songs(rows)[0]), 2)

    def test_missing_language_or_category_is_unknown(self):
        song = build_songs([["新歌", None, None]])[0][0]
        self.assertEqual((song["language"], song["category"]), (UNKNOWN, UNKNOWN))


class HistoryTest(unittest.TestCase):
    DB = [["WILL", "日文", "動漫歌曲"], ["王心凌- 月光", "中文", "中文"], ["奏", "日文", "JPOP"]]

    def stats(self, history):
        songs, warnings = build_songs(self.DB, history)
        return {s["name"]: (s["count"], s["lastSung"]) for s in songs}, warnings

    def test_counts_and_latest_date(self):
        stats, warnings = self.stats(
            [
                [datetime(2026, 10, 12), "WILL"],
                ["2026/9/1", "WILL"],
                ["2026/11/3", "WILL"],
                [datetime(2026, 10, 12), "王心凌-月光"],
            ]
        )
        self.assertEqual(stats["WILL"], (3, "2026-11-03"))
        self.assertEqual(stats["王心凌- 月光"], (1, "2026-10-12"))
        self.assertEqual(stats["奏"], (0, None))
        self.assertEqual(warnings, [])

    def test_unknown_song_is_reported_not_counted(self):
        stats, warnings = self.stats([["2026/10/12", "不存在的歌"], ["2026/10/12", "WILL"]])
        self.assertEqual(stats["WILL"], (1, "2026-10-12"))
        self.assertEqual(len(warnings), 1)
        self.assertIn("第 2 列", warnings[0])
        self.assertIn("不存在的歌", warnings[0])

    def test_bad_date_is_reported_not_counted(self):
        stats, warnings = self.stats([["上週", "WILL"]])
        self.assertEqual(stats["WILL"], (0, None))
        self.assertEqual(len(warnings), 1)
        self.assertIn("上週", warnings[0])

    def test_blank_rows_are_ignored(self):
        _, warnings = self.stats([[None, None], [None, "  "]])
        self.assertEqual(warnings, [])


class GeneratedDataTest(unittest.TestCase):
    """檢查已產生的 songs.json 格式正確（需先執行 build_songs.py）。"""

    def test_generated_json_is_valid(self):
        songs = json.loads(OUTPUT.read_text(encoding="utf-8"))
        self.assertGreater(len(songs), 0)
        for song in songs:
            self.assertEqual(set(song), {"name", "language", "category", "count", "lastSung"})
            self.assertTrue(song["name"])
            self.assertIsInstance(song["count"], int)
            if song["count"]:
                self.assertEqual(song["lastSung"], date.fromisoformat(song["lastSung"]).isoformat())
            else:
                self.assertIsNone(song["lastSung"])


if __name__ == "__main__":
    unittest.main()
