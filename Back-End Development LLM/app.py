from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import requests
import json
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph,
    Spacer, Image as RLImage, Table, TableStyle, PageBreak
)
from reportlab.lib.units import inch
from reportlab.lib import colors
from io import BytesIO
import os
import re
import time
from together import Together
from PIL import Image as PILImage
import base64

app = Flask(__name__)
CORS(app)

# Configuration
TOGETHER_API_KEY = "28ec28257a56230f1cb31756e6a7b1e0df32edb72ccafe24e1ad0978b60dcfba"
MODEL_NAME = "mistralai/Mixtral-8x7B-Instruct-v0.1"
DOMAIN_BASE_URL = "https://satellitor.duckdns.org//"
LOGO_PATH = "AlphaV.png"
LOGO_URL = f"{DOMAIN_BASE_URL}AlphaV.png"

# Initialize Together client
together_client = Together(api_key=TOGETHER_API_KEY)

# Report sections configuration
REPORT_SECTIONS = {
    "introduction": {
        "prompt": """Create an introduction with this structure:
TITLE: Introduction
OVERVIEW: [Brief explanation of Satellitor and this report]
KEY_FINDINGS: [3-4 key points about the land]
POTENTIAL: [2-3 sentences about agricultural potential]

Data: {data}"""
    },
    "soil_analysis": {
        "prompt": """Create soil analysis with this structure:
TITLE: Soil Analysis
SOIL_TYPE_DESCRIPTION: [2-3 sentences]
NUTRIENTS_OVERVIEW: [3-4 sentences]
MOISTURE_ANALYSIS: [1-2 sentences]
FERTILIZER_RECOMMENDATION: [2-3 sentences]
CONSIDERATIONS: [2-3 sentences]

Data: {data}"""
    },
    "environmental_conditions": {
        "prompt": """Create environmental analysis with this structure:
TITLE: Environmental Conditions
TEMPERATURE_ANALYSIS: [2-3 sentences]
RAINFALL_ANALYSIS: [2-3 sentences]
HUMIDITY_ANALYSIS: [1-2 sentences]
CHALLENGES: [2-3 challenges]
ADVANTAGES: [2-3 advantages]

Data: {data}"""
    },
    "crop_analysis": {
        "prompt": """Create crop analysis with this structure:
TITLE: Crop Analysis
GENERAL_OVERVIEW: [2-3 sentence summary]

CROP_1_NAME: [Name]
CROP_1_SCIENTIFIC: [Scientific name]
CROP_1_CATEGORY: [Category]
CROP_1_TEMP: [Temp range]
CROP_1_RAINFALL: [Rainfall needs]
CROP_1_PH: [pH range]
CROP_1_SUITABILITY: [Suitability]
CROP_1_NOTES: [Notes]

[Repeat for crops 2-5]

SUMMARY: [3-4 sentence summary]

Data: {data}"""
    },
    "recommendations": {
        "prompt": """Create recommendations with this structure:
TITLE: Recommendations

REC_1_TITLE: [Title]
REC_1_DETAILS: [2-3 sentences]

[Repeat for recommendations 2-5]

Data: {data}"""
    },
    "conclusion": {
        "prompt": """Create conclusion with this structure:
TITLE: Conclusion
SUMMARY: [2-3 sentences]
POTENTIAL: [1-2 sentences]
CLOSING: [1 sentence]

Data: {data}"""
    }
}


def ensure_logo_exists():
    """Ensure logo file exists, download if missing"""
    if not os.path.exists(LOGO_PATH):
        try:
            response = requests.get(LOGO_URL, timeout=10)
            if response.status_code == 200:
                with open(LOGO_PATH, 'wb') as f:
                    f.write(response.content)
                print("Logo downloaded successfully")
            else:
                print(f"Failed to download logo: HTTP {response.status_code}")
        except Exception as e:
            print(f"Error downloading logo: {e}")


def get_llm_response(prompt, model_name=MODEL_NAME):
    system_prompt = """You are an agricultural expert creating a structured land report.
    Follow the exact format provided. Keep responses concise."""

    try:
        simplified_prompt = prompt[:3000] + "\n[Additional data truncated]"
        response = together_client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": simplified_prompt}
            ],
            temperature=0.3,
            max_tokens=1500
        )
        return response.choices[0].message.content if response.choices else ""
    except Exception as e:
        print(f"Error getting LLM response: {str(e)}")
        return ""


def parse_structured_content(content, section_name):
    """Parse the structured content from LLM response"""
    parsed = {}
    if not content:
        return parsed

    # Common patterns for all sections
    title_match = re.search(r"TITLE:\s*(.*?)(?:\n|$)", content)
    if title_match:
        parsed["title"] = title_match.group(1).strip()

    # Section-specific parsing
    if section_name == "introduction":
        for field in ["overview", "key_findings", "potential"]:
            match = re.search(f"{field.upper()}:\s*(.*?)(?:\n|$)", content)
            parsed[field] = match.group(1).strip() if match else ""

    elif section_name == "soil_analysis":
        for field in ["soil_type_description", "nutrients_overview",
                      "moisture_analysis", "fertilizer_recommendation", "considerations"]:
            match = re.search(f"{field.upper()}:\s*(.*?)(?:\n|$)", content)
            parsed[field] = match.group(1).strip() if match else ""

    elif section_name == "environmental_conditions":
        for field in ["temperature", "rainfall", "humidity", "challenges", "advantages"]:
            match = re.search(f"{field.upper()}_ANALYSIS:\s*(.*?)(?:\n|$)", content)
            if not match and field in ["challenges", "advantages"]:
                match = re.search(f"{field.upper()}:\s*(.*?)(?:\n|$)", content)
            parsed[field] = match.group(1).strip() if match else ""

    elif section_name == "crop_analysis":
        parsed["crops"] = []
        for i in range(1, 6):
            crop_data = {}
            for field in ["name", "scientific", "category", "temp", "rainfall", "ph", "suitability", "notes"]:
                match = re.search(f"CROP_{i}_{field.upper()}:\s*(.*?)(?:\n|$)", content)
                crop_data[field] = match.group(1).strip() if match else ""
            if any(crop_data.values()):  # Only add if we found data
                parsed["crops"].append(crop_data)

        match = re.search(r"SUMMARY:\s*(.*?)(?:\n|$)", content)
        parsed["summary"] = match.group(1).strip() if match else ""

    elif section_name == "recommendations":
        parsed["recommendations"] = []
        for i in range(1, 6):
            rec_data = {}
            title_match = re.search(f"REC_{i}_TITLE:\s*(.*?)(?:\n|$)", content)
            details_match = re.search(f"REC_{i}_DETAILS:\s*(.*?)(?:\n|$)", content)
            if title_match and details_match:
                rec_data["title"] = title_match.group(1).strip()
                rec_data["details"] = details_match.group(1).strip()
                parsed["recommendations"].append(rec_data)

    elif section_name == "conclusion":
        for field in ["summary", "potential", "closing"]:
            match = re.search(f"{field.upper()}:\s*(.*?)(?:\n|$)", content)
            parsed[field] = match.group(1).strip() if match else ""

    return parsed


def generate_report_content(data):
    """Generate all sections of the report content"""
    report_content = {}

    # Simplify data to reduce token count
    simplified_data = {
        'temperature': data.get('temperature'),
        'rainfall': data.get('rainfall'),
        'humidity': data.get('humidity'),
        'soil_type': data.get('soil_type'),
        'nitrogen': data.get('nitrogen'),
        'phosphorus': data.get('phosphorus'),
        'potassium': data.get('potassium'),
        'moisture': data.get('moisture'),
        'land_use': data.get('land_use', {}).get('primary', ''),
        'latitude': data.get('latitude'),
        'longitude': data.get('longitude')
    }

    for section_name, section_info in REPORT_SECTIONS.items():
        try:
            prompt = section_info["prompt"].format(data=json.dumps(simplified_data, indent=2))
            llm_response = get_llm_response(prompt)
            parsed_content = parse_structured_content(llm_response, section_name)
            report_content[section_name] = parsed_content
        except Exception as e:
            print(f"Error generating {section_name}: {str(e)}")
            report_content[section_name] = {"title": section_name.replace("_", " ").title()}

    return report_content


def validate_image(image_data):
    """Validate and convert image data to a format ReportLab can use"""
    try:
        if image_data is None:
            print("Image data is None")
            return None

        if isinstance(image_data, bytes):
            image_data = BytesIO(image_data)

        # Verify with PIL first
        pil_img = PILImage.open(image_data)
        pil_img.verify()

        # Reopen after verify (which closes the file)
        image_data.seek(0)
        pil_img = PILImage.open(image_data)

        # Convert to RGB if needed
        if pil_img.mode != 'RGB':
            pil_img = pil_img.convert('RGB')

        # Save to new buffer
        output = BytesIO()
        pil_img.save(output, format='JPEG')
        output.seek(0)
        return output
    except Exception as e:
        print(f"Image validation failed: {e}")
        return None


def process_image_data(image_data, caption, content, styles):
    """Process and add image to PDF content"""
    try:
        if image_data is None:
            content.append(Paragraph(f"{caption} - Image unavailable", styles['normal']))
            content.append(Spacer(1, 0.5 * inch))
            return False

        validated_image = validate_image(image_data)
        if validated_image:
            img = RLImage(validated_image, width=5 * inch, height=3 * inch)
            content.append(img)
            content.append(Paragraph(caption, styles['caption']))
            content.append(Spacer(1, 0.5 * inch))
            return True
        else:
            content.append(Paragraph(f"{caption} - Image processing failed", styles['normal']))
            content.append(Spacer(1, 0.5 * inch))
            return False
    except Exception as e:
        print(f"Error processing image: {e}")
        content.append(Paragraph(f"{caption} - Error: {str(e)}", styles['normal']))
        content.append(Spacer(1, 0.5 * inch))
        return False


def add_image(image_key, caption, data, content, styles):
    """Add an image to the report content with better error handling"""
    if image_key not in data or not data[image_key]:
        content.append(Paragraph(f"{caption} - No image data provided", styles['normal']))
        content.append(Spacer(1, 0.5 * inch))
        return

    try:
        # Check if the image path is valid
        image_path = data[image_key]

        # Handle base64 encoded images
        if isinstance(image_path, str) and image_path.startswith('data:image'):
            try:
                header, encoded = image_path.split(",", 1)
                image_bytes = base64.b64decode(encoded)
                process_image_data(image_bytes, caption, content, styles)
                return
            except Exception as e:
                print(f"Base64 image processing error: {e}")
                # Continue to URL handling if base64 fails

        # Handle URL/path images
        try:
            # Build complete URL if needed
            if not image_path.startswith(('http://', 'https://')):
                image_url = f"{DOMAIN_BASE_URL.rstrip('/')}/{image_path.lstrip('/')}"
            else:
                image_url = image_path

            print(f"Fetching image from: {image_url}")
            response = requests.get(image_url, timeout=15)

            if response.status_code == 200:
                process_image_data(response.content, caption, content, styles)
            else:
                print(f"HTTP error {response.status_code} for {image_url}")
                content.append(
                    Paragraph(f"{caption} - Image download failed (HTTP {response.status_code})", styles['normal']))
                content.append(Spacer(1, 0.5 * inch))
        except Exception as e:
            print(f"URL image processing error: {e}")
            content.append(Paragraph(f"{caption} - Image unavailable: {str(e)}", styles['normal']))
            content.append(Spacer(1, 0.5 * inch))
    except Exception as e:
        print(f"General error with {image_key}: {e}")
        content.append(Paragraph(f"{caption} - Image processing error: {str(e)}", styles['normal']))
        content.append(Spacer(1, 0.5 * inch))

def create_pdf(report_content, data):
    buffer = BytesIO()
    page_width, page_height = letter

    # PDF Setup with logo
    doc = BaseDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=1.25 * inch,
        bottomMargin=0.75 * inch
    )

    # Enhanced styles for better text wrapping
    styles = {
        'title': ParagraphStyle('Title', fontSize=18, leading=22, alignment=1, spaceAfter=24,
                              fontName='Helvetica-Bold'),
        'heading1': ParagraphStyle('Heading1', fontSize=14, leading=18, spaceBefore=18, spaceAfter=6,
                                 fontName='Helvetica-Bold'),
        'heading2': ParagraphStyle('Heading2', fontSize=12, leading=16, spaceBefore=12, spaceAfter=4,
                                 fontName='Helvetica-Bold'),
        'normal': ParagraphStyle('Normal', fontSize=10, leading=12, spaceBefore=6, spaceAfter=6),
        'table_header': ParagraphStyle('TableHeader', fontSize=10, fontName='Helvetica-Bold',
                                     textColor=colors.white, alignment=0, leading=12),
        'table_content': ParagraphStyle('TableContent', fontSize=9, leading=11,
                                      alignment=0, wordWrap='CJK'),
        'caption': ParagraphStyle('Caption', fontSize=9, fontName='Helvetica-Oblique',
                                alignment=1, spaceBefore=4, spaceAfter=12)
    }

    # Helper function to wrap text in Paragraphs for tables
    def wrap_text_for_table(text, style_name='table_content'):
        if not text:
            return Paragraph("", styles[style_name])
        return Paragraph(str(text).replace('\n', '<br/>'), styles[style_name])

    content = []

    # Header with logo
    def add_header(canvas, doc):
        canvas.saveState()
        try:
            if os.path.exists(LOGO_PATH):
                logo = RLImage(LOGO_PATH, width=1 * inch, height=1 * inch)
                logo.drawOn(canvas, 20, page_height - inch)
        except Exception as e:
            print(f"Error drawing logo: {e}")

        canvas.setFont('Helvetica', 8)
        canvas.drawRightString(page_width - 0.75 * inch, 0.375 * inch, "Report generated by Satellitor")
        canvas.drawCentredString(page_width / 2, 0.375 * inch, f"Page {canvas.getPageNumber()}")
        canvas.restoreState()

    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height - 0.5 * inch, id='normal')
    template = PageTemplate(id='AllPages', frames=frame, onPage=add_header)
    doc.addPageTemplates([template])

    # Report title
    content.append(Paragraph("Satellitor Land Analysis Report", styles['title']))
    content.append(Spacer(1, 0.5 * inch))

    # Location info
    if 'latitude' in data and 'longitude' in data:
        content.append(
            Paragraph(f"Location: Latitude {data['latitude']}, Longitude {data['longitude']}", styles['normal']))
        content.append(Spacer(1, 0.25 * inch))

    # Add all report sections
    def add_section(section_name):
        if section_name in report_content:
            section = report_content[section_name]
            content.append(Paragraph(section.get("title", section_name.replace("_", " ").title()), styles['heading1']))

            if section_name == "introduction":
                for field in ["overview", "key_findings", "potential"]:
                    if field in section and section[field]:
                        content.append(Paragraph(field.replace("_", " ").title() + ":", styles['heading2']))
                        content.append(Paragraph(section[field], styles['normal']))
                content.append(Spacer(1, 0.5 * inch))

            elif section_name == "soil_analysis":
                # Create soil data table with paragraphs for text wrapping
                soil_data = [
                    [wrap_text_for_table("Characteristic", "table_header"),
                     wrap_text_for_table("Value", "table_header")],
                    [wrap_text_for_table("Soil Type"),
                     wrap_text_for_table(data.get('soil_type', 'N/A'))],
                    [wrap_text_for_table("Nitrogen (N)"),
                     wrap_text_for_table(f"{data.get('nitrogen', 'N/A')} ppm")],
                    [wrap_text_for_table("Phosphorus (P)"),
                     wrap_text_for_table(f"{data.get('phosphorus', 'N/A')} ppm")],
                    [wrap_text_for_table("Potassium (K)"),
                     wrap_text_for_table(f"{data.get('potassium', 'N/A')} ppm")],
                    [wrap_text_for_table("Moisture"),
                     wrap_text_for_table(f"{data.get('moisture', 'N/A')}%")]
                ]

                # Make table
                soil_table = Table(soil_data, colWidths=[2 * inch, 3 * inch])
                soil_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#4F81BD")),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),  # Vertical alignment
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black),
                    ('LEFTPADDING', (0, 0), (-1, -1), 6),  # Add padding for better readability
                    ('RIGHTPADDING', (0, 0), (-1, -1), 6),
                    ('TOPPADDING', (0, 0), (-1, -1), 3),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                ]))
                content.append(soil_table)
                content.append(Spacer(1, 0.25 * inch))

                for field in ["soil_type_description", "nutrients_overview", "moisture_analysis",
                              "fertilizer_recommendation", "considerations"]:
                    if field in section and section[field]:
                        content.append(Paragraph(field.replace("_", " ").title() + ":", styles['heading2']))
                        content.append(Paragraph(section[field], styles['normal']))
                content.append(Spacer(1, 0.5 * inch))

            elif section_name == "environmental_conditions":
                # Create environmental data table with paragraphs for text wrapping
                env_data = [
                    [wrap_text_for_table("Factor", "table_header"),
                     wrap_text_for_table("Value", "table_header"),
                     wrap_text_for_table("Analysis", "table_header")],
                    [wrap_text_for_table("Temperature"),
                     wrap_text_for_table(f"{data.get('temperature', 'N/A')}°C"),
                     wrap_text_for_table(section.get('temperature', ''))],
                    [wrap_text_for_table("Rainfall"),
                     wrap_text_for_table(f"{data.get('rainfall', 'N/A')} mm"),
                     wrap_text_for_table(section.get('rainfall', ''))],
                    [wrap_text_for_table("Humidity"),
                     wrap_text_for_table(f"{data.get('humidity', 'N/A')}%"),
                     wrap_text_for_table(section.get('humidity', ''))]
                ]

                env_table = Table(env_data, colWidths=[1.25 * inch, 1 * inch, 2.75 * inch])
                env_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#4F81BD")),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),  # Vertical alignment
                    ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black),
                    ('LEFTPADDING', (0, 0), (-1, -1), 6),  # Add padding for better readability
                    ('RIGHTPADDING', (0, 0), (-1, -1), 6),
                    ('TOPPADDING', (0, 0), (-1, -1), 3),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                ]))
                content.append(env_table)
                content.append(Spacer(1, 0.25 * inch))

                content.append(Paragraph("Challenges:", styles['heading2']))
                if 'challenges' in section and section['challenges']:
                    for challenge in section['challenges'].split('. '):
                        if challenge.strip():
                            content.append(Paragraph(f"• {challenge.strip()}", styles['normal']))
                content.append(Spacer(1, 0.25 * inch))

                content.append(Paragraph("Advantages:", styles['heading2']))
                if 'advantages' in section and section['advantages']:
                    for advantage in section['advantages'].split('. '):
                        if advantage.strip():
                            content.append(Paragraph(f"• {advantage.strip()}", styles['normal']))
                content.append(Spacer(1, 0.5 * inch))

            elif section_name == "crop_analysis":
                if 'overview' in section:
                    content.append(Paragraph(section.get('overview', ''), styles['normal']))
                    content.append(Spacer(1, 0.25 * inch))

                if 'crops' in section and section['crops']:
                    for i, crop in enumerate(section['crops'], 1):
                        content.append(Paragraph(f"Crop {i}: {crop.get('name', '')}", styles['heading2']))
                        crop_data = [
                            [wrap_text_for_table("Attribute", "table_header"),
                             wrap_text_for_table("Details", "table_header")],
                            [wrap_text_for_table("Scientific Name"),
                             wrap_text_for_table(crop.get('scientific', ''))],
                            [wrap_text_for_table("Category"),
                             wrap_text_for_table(crop.get('category', ''))],
                            [wrap_text_for_table("Temperature"),
                             wrap_text_for_table(crop.get('temp', ''))],
                            [wrap_text_for_table("Rainfall"),
                             wrap_text_for_table(crop.get('rainfall', ''))],
                            [wrap_text_for_table("pH Range"),
                             wrap_text_for_table(crop.get('ph', ''))],
                            [wrap_text_for_table("Suitability"),
                             wrap_text_for_table(crop.get('suitability', ''))],
                            [wrap_text_for_table("Notes"),
                             wrap_text_for_table(crop.get('notes', ''))]
                        ]

                        crop_table = Table(crop_data, colWidths=[1.5 * inch, 3.5 * inch])
                        crop_table.setStyle(TableStyle([
                            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#D3DFEE")),
                            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                            ('GRID', (0, 0), (-1, -1), 1, colors.black),
                            ('LEFTPADDING', (0, 0), (-1, -1), 6),
                            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
                            ('TOPPADDING', (0, 0), (-1, -1), 3),
                            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                        ]))
                        content.append(crop_table)
                        content.append(Spacer(1, 0.25 * inch))

                if 'summary' in section and section['summary']:
                    content.append(Paragraph("Summary:", styles['heading2']))
                    content.append(Paragraph(section['summary'], styles['normal']))
                content.append(Spacer(1, 0.5 * inch))

            elif section_name == "recommendations":
                if 'recommendations' in section and section['recommendations']:
                    for rec in section['recommendations']:
                        content.append(Paragraph(rec.get('title', ''), styles['heading2']))
                        content.append(Paragraph(rec.get('details', ''), styles['normal']))
                        content.append(Spacer(1, 0.25 * inch))
                content.append(Spacer(1, 0.5 * inch))

            elif section_name == "conclusion":
                for field in ["summary", "potential", "closing"]:
                    if field in section and section[field]:
                        if field == "potential":
                            content.append(Paragraph("Future Potential:", styles['heading2']))
                        content.append(Paragraph(section[field], styles['normal']))
                content.append(Spacer(1, 0.5 * inch))

    # Add all sections in order
    for section in ["introduction", "soil_analysis", "environmental_conditions",
                    "crop_analysis", "recommendations", "conclusion"]:
        add_section(section)

    # Images section with robust handling
    content.append(PageBreak())
    content.append(Paragraph("Land Visualization", styles['heading1']))
    content.append(Spacer(1, 0.25 * inch))

    # Use our improved add_image function
    add_image('normal_image', "Satellite Image", data, content, styles)
    add_image('boundaries_image', "Land Boundaries", data, content, styles)
    add_image('mask_image', "Land Classification", data, content, styles)

    doc.build(content)
    buffer.seek(0)
    return buffer

@app.route('/generate_report', methods=['POST'])
def generate_report():
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400

        # Generate report content
        print("Generating report content...")
        report_content = generate_report_content(data)

        # Create PDF
        print("Creating PDF...")
        pdf_buffer = create_pdf(report_content, data)

        # Return PDF
        response = send_file(
            pdf_buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name='land_analysis_report.pdf'
        )
        response.call_on_close(lambda: pdf_buffer.close())
        return response

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok"}), 200


if __name__ == '__main__':
    ensure_logo_exists()
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)