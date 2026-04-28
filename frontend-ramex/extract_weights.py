import pypdf
import os
import glob

def process_pdf(file_path):
    print(f"\nFile: {os.path.basename(file_path)}")
    try:
        reader = pypdf.PdfReader(file_path)
        all_text = ""
        for page in reader.pages:
            all_text += page.extract_text() + "\n"
        
        lines = [l.strip() for l in all_text.splitlines() if l.strip()]
        
        # Searching for the specific strings
        for i, line in enumerate(lines):
            # Check for 'MAIOR PESO PRESERVADO'
            if 'MAIOR PESO PRESERVADO' in line.upper():
                print(f"--- Context for MAIOR PESO PRESERVADO at line {i} ---")
                for j in range(max(0, i-2), min(len(lines), i+3)):
                    print(lines[j])
            
            # Check for 'PESO POLY-TREE FORMAL' or similar
            if 'POLY-TREE' in line.upper() or 'FORMAL' in line.upper():
                 if 'PESO' in line.upper():
                    print(f"--- Context for PESO POLY-TREE FORMAL at line {i} ---")
                    for j in range(max(0, i-2), min(len(lines), i+3)):
                        print(lines[j])
                        
    except Exception as e:
        print(f"Error: {e}")

pdf_files = glob.glob(r'generated-reports\*.pdf')
for pdf in pdf_files:
    process_pdf(pdf)
