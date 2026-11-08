"""道具賣價規則：build-site-data.py 與 build-quest-data.py 共用，只該有一份。

兩支腳本各輸出一份道具彈窗資料（怪物掉落的道具、任務用到的道具），
賣價都從這裡接：裝備的在 equip-info.json（跟數值同一個 info 節點），
其他類別的在 item-price.json（tools/extract-item-price.py）。

輸出到道具資料的欄位：
    price  = 賣給商店的楓幣（消耗／其他類是 1 個的價錢）
    noSale = 1 代表不能賣給商店
兩個都沒有 = 客戶端沒寫（price 0 也算沒寫），畫面上整行不顯示。
"""

SALE_KEYS = ("price", "notSale")


def strip_sale(eq: dict) -> dict:
    """裝備數值裡拿掉賣價欄位（賣價另外放，彈窗的數值列只吃能力值）。"""
    return {k: v for k, v in eq.items() if k not in SALE_KEYS}


def sale_fields(iid, equips: dict, prices: dict) -> dict:
    src = equips.get(str(iid)) or prices.get(str(iid)) or {}
    if src.get("notSale"):
        return {"noSale": 1}
    price = src.get("price")
    if isinstance(price, int) and price > 0:
        return {"price": price}
    return {}
