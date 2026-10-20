COTTON_DISPLAY_LABELS = {
    "bacterial_blight": "Cotton Bacterial Blight",
    "curl_virus": "Cotton Leaf Curl Virus",
    "fussarium_wilt": "Cotton Fusarium Wilt",
    "healthy": "Healthy Cotton",
}


def display_class_label(raw_label):
    if raw_label in COTTON_DISPLAY_LABELS:
        return COTTON_DISPLAY_LABELS[raw_label]
    return raw_label.replace("___", " - ").replace("_", " ").strip()


def crop_label(raw_label):
    if raw_label in COTTON_DISPLAY_LABELS:
        return "Cotton"
    return raw_label.split("___", maxsplit=1)[0].replace("_", " ").title()