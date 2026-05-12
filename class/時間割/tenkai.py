import csv
import json
from pathlib  import Path
import os
def tenkai(path):
    result = []

    with open(path, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader)

        for row in reader:
            temp = {}
            for i in range(len(header)):
                temp[header[i]] = row[i]
            result.append(temp)

    with open(Path.home() / f"Documents/GitHub/1bunkaiyu314.github.io/class/timetableFor5/assets/subjects_rooms_map.json", "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)


tenkai("時間割 - 展開教室.csv")