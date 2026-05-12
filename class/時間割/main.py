import json
import csv
from pathlib  import Path
import os

os.chdir(Path(__file__).resolve().parent)

def timetable(path, school_class: int):
    result = {}
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader)  # 日付,時間割,,,,

        for row in reader:
            date = row[0]

            # 空欄を除去しつつリスト化
            classes = [c for c in row[1:] if c.strip() != ""]

            result[date] = classes

        with open(Path.home() / f"Documents/GitHub/1bunkaiyu314.github.io/class/timetableFor5/assets/timetable/timetable_class-{school_class}.json", "w", encoding="utf-8") as g:
            json.dump(result, g, ensure_ascii=False, indent=4)

def events(path):
    result = {}
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader)  # 日付,時間割,,,,

        for row in reader:
            date = row[0]
            events = row[1]

            result[date] = events

        with open(Path.home() / f"Documents/GitHub/1bunkaiyu314.github.io/class/timetableFor5/assets/events.json", "w", encoding="utf-8") as g:
            json.dump(result, g, ensure_ascii=False, indent=4)
try:
    timetable("時間割 - 時間割書き出し.csv", 7)
except FileNotFoundError:
    print("時間割 - 時間割書き出し.csv が見つかりませんでした。")

try:
    events("時間割 - 行事書き出し.csv")
except FileNotFoundError:
    print("時間割 - 行事書き出し.csv が見つかりませんでした。")
