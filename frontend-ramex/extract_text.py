import pypdf
import os

files = ["relatorio_ramex_dataset01.pdf", "relatorio_ramex_dataset02.pdf", "relatorio_ramex_dataset03.pdf"]
folder = "generated-reports"

for file in files:
    path = os.path.join(folder, file)
    print(f"--- Processing {file} ---")
    try:
        reader = pypdf.PdfReader(path)
        text = ""
        for page in reader.pages:
            text += page.extract_text()
        print(text)
    except Exception as e:
        print(f"Error reading {file}: {e}")
    print("--- End of File ---")
