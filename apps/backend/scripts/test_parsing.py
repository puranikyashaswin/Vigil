import os
import sys
import time
import argparse
import logging
from dotenv import load_dotenv

# Ensure apps/backend is in the Python search path to import parsers
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import parsers

# Set up logging to console
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("vigil.test_parsing")


def parse_args():
    parser = argparse.ArgumentParser(
        description="Vigil Document Ingestion Parser Test Suite"
    )
    parser.add_argument(
        "--input-dir",
        default="test_documents",
        help="Path to directory containing test documents",
    )
    parser.add_argument(
        "--output-dir",
        default="results",
        help="Path to directory where results will be written",
    )
    return parser.parse_args()


def main():
    # Load environment variables
    load_dotenv()
    api_key = os.getenv("OPENROUTER_API_KEY")

    args = parse_args()
    input_dir = args.input_dir
    output_dir = args.output_dir

    if not os.path.exists(input_dir):
        logger.error(f"Input directory does not exist: {input_dir}")
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)

    files = [
        f for f in os.listdir(input_dir) if os.path.isfile(os.path.join(input_dir, f))
    ]
    files = [f for f in files if not f.startswith(".")]  # skip hidden files

    if not files:
        logger.warning(f"No test files found in input directory: {input_dir}")
        sys.exit(0)

    logger.info(f"Starting test parsing on {len(files)} files from {input_dir}...")
    logger.info(f"Results will be saved in: {output_dir}\n")

    results = []

    for filename in sorted(files):
        file_path = os.path.join(input_dir, filename)
        file_size = os.path.getsize(file_path)
        logger.info(f"--- Processing: {filename} ({file_size} bytes) ---")

        start_time = time.time()
        status = "FAIL"
        error_msg = ""
        route = "unknown"
        details = ""
        parsed_text = ""

        try:
            # 1. Detect Category
            category, ext = parsers.detect_document_type(file_path)
            logger.info(f"Detected category: {category} (Extension: {ext})")

            # 2. Route to appropriate parser
            if category == "image" or category == "scanned_pdf":
                route = "OpenRouter OCR"
                if not api_key:
                    raise Exception("Missing OPENROUTER_API_KEY in .env. OCR required.")
                logger.info(f"Routing to OpenRouter OCR fallback chain...")
                parsed_text, model_used = parsers.parse_via_openrouter_ocr(
                    file_path, api_key
                )
                details = f"Model: {model_used}"

            elif category == "text_native_pdf":
                route = "Local (pdfplumber)"
                logger.info(f"Routing to pdfplumber...")
                parsed_text = parsers.parse_pdf_local(file_path)

            elif category == "text_native_docx":
                route = "Local (python-docx)"
                logger.info(f"Routing to python-docx...")
                parsed_text = parsers.parse_docx_local(file_path)

            elif category == "spreadsheet":
                if ext == ".xlsx":
                    route = "Local (openpyxl)"
                    logger.info(f"Routing to openpyxl...")
                    parsed_text = parsers.parse_xlsx_local(file_path)
                elif ext == ".xls":
                    route = "Local (xlrd)"
                    logger.info(f"Routing to xlrd...")
                    parsed_text = parsers.parse_xls_local(file_path)
                elif ext == ".csv":
                    route = "Local (csv)"
                    logger.info(f"Routing to CSV parser...")
                    parsed_text = parsers.parse_csv_local(file_path)
            else:
                # Unknown category fallback to Unstructured layout
                route = "Local (unstructured fallback)"
                logger.info(f"Routing to unstructured layout parser...")
                parsed_text = parsers.parse_unstructured_local(file_path)

            # Check for empty output
            if not parsed_text or len(parsed_text.strip()) < 10:
                parsed_text = (
                    f"[EMPTY DOCUMENT] No extractable text found in {filename}."
                )
                logger.warning(
                    f"Document {filename} has no extractable text. Writing placeholder."
                )

            # 3. Save output
            output_file = os.path.join(output_dir, f"{filename}.txt")
            with open(output_file, "w", encoding="utf-8") as out_f:
                out_f.write(parsed_text)

            status = "PASS"
            logger.info(
                f"Successfully parsed {filename}. Output written to {output_file}"
            )

        except Exception as e:
            status = "FAIL"
            error_msg = str(e)
            logger.error(f"Failed parsing {filename}: {error_msg}")

        elapsed = time.time() - start_time
        logger.info(f"Completed in {elapsed:.2f}s with status: {status}\n")

        results.append(
            {
                "file": filename,
                "size": file_size,
                "route": route,
                "status": status,
                "time": elapsed,
                "details": details if status == "PASS" else error_msg,
            }
        )

    # Print execution summary table
    print("\n" + "=" * 80)
    print("PARSING PROCESS SUMMARY")
    print("=" * 80)
    print(
        f"{'File Name':<35} | {'Route':<20} | {'Status':<6} | {'Time (s)':<8} | {'Details / Error':<20}"
    )
    print("-" * 110)
    for res in results:
        details_col = res["details"]
        if len(details_col) > 40:
            details_col = details_col[:37] + "..."
        print(
            f"{res['file'][:35]:<35} | {res['route']:<20} | {res['status']:<6} | {res['time']:<8.2f} | {details_col}"
        )
    print("=" * 80 + "\n")


if __name__ == "__main__":
    main()
