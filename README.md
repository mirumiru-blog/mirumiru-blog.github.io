# 杏仁ミル 歌回歌單

網址：https://enderman1000456-tech.github.io/almond-milk-songlist/

可搜尋的實況主歌單網頁，功能包括：

- 關鍵字搜尋：歌名或歌手都能搜，不分大小寫、全形或半形，平假名也能搜到片假名
- 依語言篩選（日文、中文、台語），再依類別篩選（JPOP、動漫歌曲、V家）
- 一鍵複製歌名，方便貼到聊天室點歌
- 有 YouTube 連結的歌會顯示「試聽」按鈕

## 更新歌單

1. 修改 `杏仁ミル_歌回歌單.xlsx`：新歌加在「資料庫」工作表的表格內，連結加在對應分類分頁
2. 重新產生資料：

   ```bash
   python scripts/build_songs.py
   ```

   需要先安裝 openpyxl（`python -m pip install openpyxl`）。
3. 提交並推送：`git add site/data/songs.json`、`git commit`、`git push`，GitHub 會自動跑測試並更新網站

Excel 原始檔只留在本機（已加入 .gitignore），不會上傳到 GitHub。

## 本機預覽

```bash
python -m http.server 8000
```

開啟 http://localhost:8000/site/

## 測試

- 轉換程式：`python -m unittest discover -s tests`
- 搜尋與篩選邏輯：先啟動本機預覽，再開啟 http://localhost:8000/tests/filter.test.html，標題顯示 PASS 代表全部通過

## 檔案結構

- `scripts/build_songs.py`：Excel 轉 JSON
- `site/`：網頁本體（可直接部署到 GitHub Pages）
- `site/data/songs.json`：由轉換程式產生，不要手動修改
- `tests/`：測試
