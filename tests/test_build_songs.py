import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

from build_songs import OUTPUT, UNKNOWN, build_songs, clean, match_key  # noqa: E402


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


class BuildSongsTest(unittest.TestCase):
    def test_basic_row_with_link(self):
        songs = build_songs([["366日", "日文", "JPOP"]], {match_key("366日"): "https://youtu.be/x"})
        self.assertEqual(
            songs,
            [{"name": "366日", "language": "日文", "category": "JPOP", "link": "https://youtu.be/x"}],
        )

    def test_link_matches_despite_spacing(self):
        songs = build_songs([["王心凌-  月光", "中文", "中文"]], {match_key("王心凌- 月光"): "u"})
        self.assertEqual(songs[0]["link"], "u")

    def test_missing_link_is_none(self):
        self.assertIsNone(build_songs([["嘘", "日文", "動漫歌曲"]], {})[0]["link"])

    def test_skips_rows_without_name(self):
        rows = [[None, None, None], [None, None, "動漫歌曲"], ["WILL", "日文", "動漫歌曲"]]
        self.assertEqual([s["name"] for s in build_songs(rows, {})], ["WILL"])

    def test_removes_exact_duplicates(self):
        rows = [["ピエロ", "日文", "V家"], ["ピエロ ", "日文", "V家"]]
        self.assertEqual(len(build_songs(rows, {})), 1)

    def test_same_name_in_different_category_is_kept(self):
        rows = [["嘘", "日文", "動漫歌曲"], ["嘘", "日文", "JPOP"]]
        self.assertEqual(len(build_songs(rows, {})), 2)

    def test_missing_language_or_category_is_unknown(self):
        song = build_songs([["新歌", None, None]], {})[0]
        self.assertEqual((song["language"], song["category"]), (UNKNOWN, UNKNOWN))


class GeneratedDataTest(unittest.TestCase):
    """檢查已產生的 songs.json 格式正確（需先執行 build_songs.py）。"""

    def test_generated_json_is_valid(self):
        songs = json.loads(OUTPUT.read_text(encoding="utf-8"))
        self.assertGreater(len(songs), 0)
        for song in songs:
            self.assertEqual(set(song), {"name", "language", "category", "link"})
            self.assertTrue(song["name"])
            self.assertTrue(song["link"] is None or song["link"].startswith("http"))


if __name__ == "__main__":
    unittest.main()
