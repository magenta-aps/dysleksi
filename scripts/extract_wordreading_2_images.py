# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
import json
import os
import zipfile
from pathlib import Path

import cv2
import easyocr
import numpy as np

# Download this document from https://redmine.magenta.dk/documents/382
docx_path = Path("~/Downloads/Gruppetests - Ordlæsning 2.docx").expanduser()
output_dir = "../file-data/wordreading_2"


def extract_images(docx_path: str, output_dir: str) -> None:
    if not zipfile.is_zipfile(docx_path):
        raise ValueError(f"{docx_path} is not a valid .docx file")

    os.makedirs(output_dir, exist_ok=True)

    with zipfile.ZipFile(docx_path, "r") as docx:
        image_files = [
            name for name in docx.namelist() if name.startswith("word/media/")
        ]

        if not image_files:
            print("No images found.")
            return

        for image in image_files:
            filename = os.path.basename(image)
            output_path = os.path.join(output_dir, filename)

            with docx.open(image) as src, open(output_path, "wb") as dst:
                dst.write(src.read())

            print(f"Extracted: {output_path}")

    print(f"\nDone. Extracted {len(image_files)} image(s).")


def trim_whitespace(img, tol=240, top_pad=100, bottom_pad=50, left_pad=0, right_pad=0):
    """
    Trims white space around the image and optionally adds padding.

    Parameters:
        img: np.ndarray
            Input image (BGR or grayscale)
        tol: int
            Tolerance for white pixel detection (0-255). Pixels >= tol are considered
            white.
        top_pad, bottom_pad, left_pad, right_pad: int
            Number of pixels to add as padding after trimming.

    Returns:
        cropped_img: np.ndarray
            Cropped image with optional padding.
    """
    if len(img.shape) == 3:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    else:
        gray = img.copy()

    # Mask of non-white pixels
    mask = gray < tol

    if not np.any(mask):
        # Entire image is white
        return img

    # Bounding box of non-white pixels
    coords = np.argwhere(mask)
    y0, x0 = coords.min(axis=0)
    y1, x1 = coords.max(axis=0) + 1  # +1 because slicing is exclusive

    # Add padding but keep within image bounds
    y0 = max(0, y0 - top_pad)
    y1 = min(img.shape[0], y1 + bottom_pad)
    x0 = max(0, x0 - left_pad)
    x1 = min(img.shape[1], x1 + right_pad)

    cropped_img = img[y0:y1, x0:x1]
    return cropped_img


def extract_worksheet_data(
    image_path, output_path, rows=6, left_image=0.08, right_image=0.25
):
    # Initialize the OCR reader (Inuktitut/Greenlandic often uses Latin characters)
    reader = easyocr.Reader(["en"])

    # Load image
    img = cv2.imread(image_path)
    img = trim_whitespace(img)
    height, width, _ = img.shape

    # Define the vertical regions for the 6 rows (approximate percentages)
    # This divides the image into 6 horizontal bands
    row_height = height // rows
    results = []

    for i in range(rows):
        row_data = {}
        y_top = i * row_height
        y_bottom = (i + 1) * row_height

        # Crop the top
        top_trim = int(0.23 * row_height)
        y_top_trimmed = y_top + top_trim

        bottom_trim = int(0.15 * row_height)
        y_bottom_trimmed = y_bottom - bottom_trim

        # 1. Extract the Image (usually on the left side, approx first 25% of width)
        image_crop = img[
            y_top_trimmed:y_bottom_trimmed,
            int(width * left_image) : int(width * right_image),
        ]
        # image_filename = image_path.replace(".png", f"_row_{i+1}_icon.png")
        image_filename = os.path.join(
            output_path,
            os.path.basename(image_path).replace(".png", f"_row_{i+1}_icon.png"),
        )
        cv2.imwrite(image_filename, image_crop)
        row_data["image"] = image_filename.replace("../file-data/", "")

        # 2. Extract Text from the "Train Cars" (the remaining 75% of width)
        text_crop = img[y_top:y_bottom, int(width * 0.25) : width]

        # Use OCR to find words in the row
        # detail=0 returns just the text strings
        words = reader.readtext(text_crop, detail=0)

        # Filter out noise (single characters or numbers like '1')
        clean_words = [
            w.replace("]", "")
            .replace("laqerluusaasivik", "aqerluusaasivik")
            .replace("miatsiaaraq", "umiatsiaaraq")
            .replace("'pparsimmavik", "napparsimmavik")
            .replace("ermiutarsuaq", "imermiutarsuaq")
            .lower()
            for w in words
            if len(w) > 1
        ]

        row_data["wrong"] = [word for item in clean_words for word in item.split()]
        results.append(row_data)

    return results


# Gemini
correct_answers = {
    "1": "iga",
    "2": "ulu",
    "3": "qui",
    "4": "aak",
    "5": "matu",
    "6": "pana",
    "7": "ameq",
    "8": "illu",
    "9": "siut",
    "10": "assi",
    "11": "kuuk",
    "12": "naat",
    "13": "pupik",
    "14": "suluk",
    "15": "kisaq",
    "16": "aquut",
    "17": "umiit",
    "18": "attat",
    "19": "assak",
    "20": "aaveq",
    "21": "agiaq",
    "22": "angut",
    "23": "orpik",
    "24": "umiaq",
    "25": "qitsuk",
    "26": "meeraq",
    "27": "saagut",
    "28": "saaneq",
    "29": "qimmeq",
    "30": "mannik",
    "31": "tarraq",
    "32": "qulleq",
    "33": "kikiak",
    "34": "palasi",
    "35": "pamioq",
    "36": "nangeq",
    "37": "qarliit",
    "38": "qamutit",
    "39": "naraseq",
    "40": "alerseq",
    "41": "inuusaq",
    "42": "puuluki",
    "43": "iipilit",
    "44": "allarut",
    "45": "aqisseq",
    "46": "kuanneq",
    "47": "igutsak",
    "48": "sialuit",
    "49": "uffarfik",
    "50": "ippernaq",
    "51": "allakkat",
    "52": "annoraaq",
    "53": "eqqaavik",
    "54": "illuigaq",
    "55": "ammassak",
    "56": "issiavik",
    "57": "niviugak",
    "58": "nerrivik",
    "59": "ulloriaq",
    "60": "saaniluk",
    "61": "pilattuut",
    "62": "sinngusit",
    "63": "kiinarpak",
    "64": "ajaappiaq",
    "65": "sanigutit",
    "66": "aalaterut",
    "67": "oqaluffik",
    "68": "kamaasiat",
    "69": "tiitorfik",
    "70": "sukkulaat",
    "71": "pakkaluaq",
    "72": "piniartoq",
    "73": "aqerluusaq",
    "74": "papikuujuk",
    "75": "assakaasoq",
    "76": "qalipaatit",
    "77": "assiliivik",
    "78": "matuersaat",
    "79": "tujuuluaraq",
    "80": "kipparissoq",
    "81": "iisartakkat",
    "82": "nagguaatsoq",
    "83": "marlulissat",
    "84": "uummataasaq",
    "85": "nalunaaqutaq",
    "86": "mamakujuttut",
    "87": "tujuulussuaq",
    "88": "umiatsiaaraq",
    "89": "pujortuleeraq",
    "90": "qupaloraarsuk",
    "91": "umiarsualivik",
    "92": "majuartarfiit",
    "93": "napparsimmavik",
    "94": "pinnguartarfik",
    "95": "imermiutarsuaq",
    "96": "ikkussortakkat",
    "97": "allattarfissuaq",
    "98": "issakatsiaarfik",
    "99": "kigutigissaatit",
    "100": "aqerluusaasivik",
}

tmp_dir = "/tmp/wordreading_2"
if not os.path.exists(tmp_dir):
    os.makedirs(tmp_dir)

extract_images(docx_path, tmp_dir)

data = []
counter = 1
for image_id in range(4, 21):

    if image_id == 20:
        rows = 4
    else:
        rows = 6

    if image_id < 13:
        left_image = 0.08
        right_image = 0.25
    else:
        left_image = 0.04
        right_image = 0.21

    data.extend(
        extract_worksheet_data(
            f"{tmp_dir}/image{image_id}.png",
            f"{output_dir}",
            rows=rows,
            left_image=left_image,
            right_image=right_image,
        )
    )

for counter in range(100):
    correct_answer = correct_answers[str(counter + 1)]
    data[counter]["correct"] = correct_answer
    data[counter]["wrong"].remove(correct_answer)


with open(f"{output_dir}/wordreading_2.json", "w", encoding="utf-8") as f:
    json.dump(data, f, indent=4, ensure_ascii=False)
