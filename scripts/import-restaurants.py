"""Convert https://tour.yunlin.gov.tw/XML2/Restaurant/Zh_tw to the site snapshot."""

import argparse
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET


def categories(name, description):
    normalized_name = name.casefold()
    tags = []
    if re.search(r"早餐|早午餐|brunch|breakfast", normalized_name + description):
        tags.append("brunch")
    if re.search(r"咖啡館|咖啡廳|咖啡|café|cafe|coffee", normalized_name) or re.search(
        r"咖啡館|咖啡廳", description
    ):
        tags.append("cafe")
    if re.search(r"日式|日料|日本料理|和食|定食|壽司|鮨|拉麵|丼飯|居酒屋", normalized_name) or re.search(
        r"日式料理|日本料理|日式拉麵|日式定食", description
    ):
        tags.append("japanese")
    if re.search(r"韓式|韓國料理|韓食|韓馨巧|韓國烤肉|韓式炸雞", normalized_name + description):
        tags.append("korean")
    return tags


def parse_restaurant(row):
    def field(name):
        return " ".join(row.findtext(name, default="").split())

    name = field("RestaurantName")
    address = field("PostalAddress/StreetAddress")
    town = field("PostalAddress/Town")
    if not name or not address or field("PostalAddress/City") != "雲林縣":
        return None
    try:
        latitude = float(field("PositionLat"))
        longitude = float(field("PositionLon"))
    except ValueError:
        return None
    if not (23.4 < latitude < 24 and 119.9 < longitude < 121):
        return None
    if "泡泡貓" in name or "荷苞" in name or name == "巴登咖啡專賣店":
        return None

    if not address.startswith("雲林縣"):
        address = "雲林縣" + (address if address.startswith(town) else town + address)

    description = field("Description")
    image = field("Images/Image/URL")
    return {
        "id": field("RestaurantID"),
        "name": name,
        "lat": latitude,
        "lon": longitude,
        "address": address,
        "description": description[:119] + "…" if len(description) > 120 else description,
        "hours": field("ServiceTimeInfo"),
        "image": image if image.startswith("https://") else "",
        "categories": categories(name, description),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("xml", type=Path)
    args = parser.parse_args()
    root = ET.parse(args.xml).getroot()
    for element in root.iter():
        element.tag = element.tag.rsplit("}", 1)[-1]
    entries = {}
    for row in root.findall("Restaurants/Restaurant"):
        restaurant = parse_restaurant(row)
        if restaurant:
            entries[restaurant["id"]] = restaurant
    if not entries:
        raise ValueError("The XML contains no geocoded Yunlin restaurants")
    date = root.findtext("UpdateTime", default="")[:10]
    output = Path(__file__).resolve().parents[1] / "restaurants.js"
    lines = ",\n".join("  " + json.dumps(item, ensure_ascii=False) for item in entries.values())
    output.write_text(
        "// 雲林縣政府餐飲開放資料 https://data.gov.tw/dataset/171666\n"
        + f"const restaurantDataDate = {json.dumps(date)};\n"
        + f"const restaurants = [\n{lines}\n];\n",
        encoding="utf-8",
    )
    print(f"Imported {len(entries)} restaurants ({date})")


if __name__ == "__main__":
    main()
