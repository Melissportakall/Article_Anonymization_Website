import re
import threading
from datetime import datetime
import random
from urllib.parse import unquote
import pytesseract
import unicodedata
from PIL import Image
from cryptography.hazmat.primitives import padding
from werkzeug.utils import secure_filename
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from models import db, init_db, Reviewer, Article, Review, Log, Message, BlurData, Keyword
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
import fitz
import spacy
import base64
import os
from fpdf import FPDF
from fitz import Rect
from unidecode import unidecode  #pdfteki türkçe karakterleri ingilizceye benzetme
from rapidfuzz import fuzz  #iki string arasındaki benzerliği bulma ilgi alanı için

app = Flask(__name__)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
CORS(app, supports_credentials=True, origins=["http://localhost:3000"])
app.config["SQLALCHEMY_DATABASE_URI"] = "mysql+pymysql://root@localhost/yazlab2_1"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

init_db(app)

UPLOAD_FOLDER = 'uploads/papers'
ALLOWED_EXTENSIONS = {'pdf'}

nlp = spacy.load("en_core_web_sm")

INTEREST_CATEGORIES = {
    "Artificial Intelligence": ["derin öğrenme", "deep learning", "cnn", "rnn", "natural language processing", "NLP",
                                "nlp", "generative artificial intelligence", "computer vision", "lstm",
                                "long short-term memory", "svm", "support vector machine", "machine learning",
                                "artificial neural networks", "decision tree", "random forest"],
    "Human-Computer Interaction": ["brain-computer sharing", "bci", "accesibility", "user experience design",
                                   "ux design", "augmented and virtual reality", "feedback", "gui", "goms model",
                                   "usability", "hci", "ar/vr", "ınteraction design", "mr",
                                   "adaptive and intelligent interface"],
    "Cybersecurity": ["information security", "infosec", "encryption applications", "encryption",
                      "secure software development", "network security", "firewall", "authentication", "hashing",
                      "sha-256", "brute force", "secure software development", "security", "identity-aware systems",
                      "computer forensics"]
}


def encrypt_data(data: str):
    key = b'asdfghjklqwertyu'  # 16 BYTE UZUNLUĞUNDA ANAHTAR
    iv = os.urandom(16)  # 16 RASTGELE BİR IV

    # PADDING: VERİ UZUNLUĞUNU 16 BYTE'A TAMAMLA
    padder = padding.PKCS7(128).padder()
    padded_data = padder.update(data.encode()) + padder.finalize()

    # ŞİFRELE
    encryptor = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend()).encryptor()
    encrypted_data = encryptor.update(padded_data) + encryptor.finalize()

    # ŞİFRELİ VERİYİ BASE64'E DÖNÜŞTÜR
    return base64.b64encode(iv + encrypted_data).decode()  # IV'I DA ŞİFRELİ VERİYLE DÖNDÜR


def decrypt_data(encrypted_data: str):
    key = b'asdfghjklqwertyu'  # 16 BYTE UZUNLUĞUNDA ANAHTAR
    encrypted_data_bytes = base64.b64decode(encrypted_data)

    # IV'I BAŞINDAN AYIR
    iv = encrypted_data_bytes[:16]  # IV'IN İLK 16 BYTEINI AL
    encrypted_data_bytes = encrypted_data_bytes[16:]  # KALAN KISIM ŞİFRELİ VERİ

    # DEŞİFRE ET
    decryptor = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend()).decryptor()
    decrypted_data = decryptor.update(encrypted_data_bytes) + decryptor.finalize()

    # PADDING'İ KALDIR
    unpadder = padding.PKCS7(128).unpadder()
    data = unpadder.update(decrypted_data) + unpadder.finalize()

    return data.decode()


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def generate_tracking_code():
    while True:
        tracking_code = ''.join([str(random.randint(0, 9)) for _ in range(8)])
        existing_article = Article.query.filter_by(id=tracking_code).first()

        if not existing_article:
            return tracking_code


@app.route("/upload", methods=["POST"])
def upload_paper():
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)

    email = request.form.get('email')
    title = request.form.get('title')
    authors = request.form.get('authors', '')
    institution = request.form.get('institution')

    encrypted_email = encrypt_data(email)
    encrypted_title = encrypt_data(title)
    encrypted_authors = encrypt_data(authors)
    encrypted_institution = encrypt_data(institution)

    file = request.files.get('file')
    if not file or not allowed_file(file.filename):
        return jsonify({"message": "Geçersiz dosya formatı veya dosya seçilmedi!"}), 400

    filename = secure_filename(file.filename)
    file_extension = filename.rsplit('.', 1)[1].lower()

    tracking_code = generate_tracking_code()
    file_path = os.path.join(UPLOAD_FOLDER, f"{tracking_code}.{file_extension}")

    new_article = Article(
        id=tracking_code,
        email=encrypted_email,
        title=encrypted_title,
        authors=encrypted_authors,
        pdf_path=file_path,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        institution=encrypted_institution,
    )

    new_log = Log(
        article_id=tracking_code,
        event=encrypt_data(f"{tracking_code} kodlu ve {title} başlıklı bir makale yüklendi. Yazarlar: {authors}."),
    )

    try:
        db.session.add(new_article)
        db.session.add(new_log)
        db.session.commit()
        file.save(file_path)

        classification_thread = threading.Thread(target=classify_and_save_interests, args=(tracking_code,))
        classification_thread.daemon = True
        classification_thread.start()

        return jsonify({
            "message": "Makale başarıyla yüklendi!",
            "tracking_code": tracking_code
        }), 201
    except Exception as e:
        db.session.rollback()
        print(f"Hata: {e}")
        return jsonify({"message": "Makale yüklenirken bir hata oluştu!"}), 500


@app.route('/paper_status', methods=['POST'])
def paper_status():
    data = request.get_json()
    email = data.get('email')
    tracking_code = data.get('tracking_code')

    if not email or not tracking_code:
        return jsonify({'message': 'E-posta ve takip numarası gereklidir!'}), 400

    email_regex = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
    if not re.match(email_regex, email):
        return jsonify({'message': 'Geçerli bir e-posta adresi girin.'}), 400

    article = Article.query.filter_by(id=tracking_code).first()

    if article:
        try:
            decrypted_email = decrypt_data(article.email)
            decrypted_title = decrypt_data(article.title)
            decrypted_authors = decrypt_data(article.authors)
            decrypted_institution = decrypt_data(article.institution)

            if article.editor_id:
                reviewer = Reviewer.query.filter_by(id=article.editor_id).first()
                decrypted_reviewer = decrypt_data(reviewer.name)
            else:
                decrypted_reviewer = None

            review = Review.query.filter_by(article_id=article.id).first()

            if review:
                if article.is_authors_anonymous or article.is_mail_anonymous or article.is_institution_anonymous:
                    status = 'Onay Bekleniyor'
                    print(status + "1")

                else:
                    status = article.status
                    print(status + "2")

            else:
                status = article.status

            response_data = {
                'email': decrypted_email,
                'title': decrypted_title,
                'authors': decrypted_authors,
                'status': status,
                'reviewer': decrypted_reviewer,
                'institution': decrypted_institution,
            }
            return jsonify(response_data), 200
        except Exception as e:
            print(f"Hata: {e}")
            return jsonify({'message': 'Makale verisi okunurken bir hata oluştu!'}), 500
    else:
        return jsonify({'message': 'Makale bulunamadı!'}), 404


@app.route('/get_papers', methods=['GET'])
def get_papers():
    try:
        articles = Article.query.order_by(Article.authors).all()

        articles_data = []
        for article in articles:
            decrypted_title = decrypt_data(article.title)
            decrypted_authors = decrypt_data(article.authors)
            decrypted_email = decrypt_data(article.email)
            decrypted_institution = decrypt_data(article.institution)

            reviewer = Reviewer.query.filter_by(id=article.editor_id).first()

            if reviewer:
                decrypted_reviewer_name = decrypt_data(reviewer.name)
            else:
                decrypted_reviewer_name = None

            keywords = Keyword.query.filter_by(article_id=article.id).all()
            interests = [keyword.keyword for keyword in keywords]

            articles_data.append({
                'id': article.id,
                'title': decrypted_title,
                'authors': decrypted_authors,
                'email': decrypted_email,
                'status': article.status,
                'reviewer': article.editor_id,
                'created_at': article.created_at,
                'updated_at': article.updated_at,
                'is_authors_anonymous': article.is_authors_anonymous,
                'is_mail_anonymous': article.is_mail_anonymous,
                'reviewer_name': decrypted_reviewer_name,
                'institution': decrypted_institution,
                'is_institution_anonymous': article.is_institution_anonymous,
                'interests': interests,
            })

        return jsonify(articles_data), 200
    except Exception as e:
        return jsonify({'error': 'Makaleler alınırken hata oluştu.'}), 500


@app.route('/add_reviewer', methods=['POST'])
def add_reviewer():
    data = request.json
    encrypted_name = encrypt_data(data['name'])
    encrypted_interests = encrypt_data(data['interests'])

    new_reviewer = Reviewer(
        name=encrypted_name,
        interests=encrypted_interests
    )

    db.session.add(new_reviewer)
    db.session.commit()

    new_log = Log(
        reviewer_id=new_reviewer.id,
        event=encrypt_data(f"{data['name']} adlı hakem kaydı yapıldı.")
    )

    db.session.add(new_log)
    db.session.commit()

    return jsonify({'name': encrypted_name, 'interests': encrypted_interests})


@app.route('/get_reviewers', methods=['GET'])
def get_reviewers():
    reviewers = Reviewer.query.all()
    decrypted_reviewers = [
        {
            'id': reviewer.id,
            'name': decrypt_data(reviewer.name),
            'interests': decrypt_data(reviewer.interests)
        }
        for reviewer in reviewers
    ]
    return jsonify(decrypted_reviewers)


@app.route('/assign_reviewer/<int:paper_id>', methods=['POST'])
def assign_reviewer(paper_id):
    data = request.json
    reviewer_id = data['reviewerId']

    article = Article.query.get(paper_id)
    reviewer = Reviewer.query.get(reviewer_id)

    if not article or not reviewer:
        return jsonify({'error': 'Makale veya hakem bulunamadı'}), 404

    article.editor_id = reviewer.id
    article.status = 'İncelemede'
    new_log = Log(
        article_id=article.id,
        reviewer_id=reviewer.id,
        event=encrypt_data(f"{article.id} kodlu makaleye {decrypt_data(reviewer.name)} adlı hakem ataması yapıldı."),
    )
    db.session.add(new_log)

    db.session.commit()

    return jsonify({'message': 'Hakem başarıyla atandı!'})


@app.route('/update_article/<int:article_id>', methods=['PATCH'])
def update_article(article_id):
    data = request.get_json()

    article = Article.query.get(article_id)
    if not article:
        return jsonify({'error': 'Makale bulunamadı'}), 404

    if 'is_authors_anonymous' in data:
        article.is_authors_anonymous = data['is_authors_anonymous']

    if 'is_mail_anonymous' in data:
        article.is_mail_anonymous = data['is_mail_anonymous']

    if 'is_institution_anonymous' in data:
        article.is_institution_anonymous = data['is_institution_anonymous']

    new_log = Log(
        article_id=article.id,
        event=encrypt_data(f"{article.id} kodlu makalenin anonimlik bilgisi güncellendi."),
    )
    db.session.add(new_log)

    db.session.commit()
    return jsonify({'message': 'Makale anonimlik bilgisi güncellendi'}), 200


@app.route('/get_article_pdf/<int:article_id>', methods=['GET'])
def get_article_pdf(article_id):
    article = Article.query.get(article_id)

    if not article:
        return jsonify({'error': 'Makale bulunamadı'}), 404

    try:
        return send_file(article.pdf_path, mimetype='application/pdf', as_attachment=False)

    except Exception as e:
        print(f"Hata: {e}")
        return jsonify({'message': 'Makale verisi okunurken bir hata oluştu!'}), 500


@app.route('/reviewer_articles', methods=['GET'])
def get_reviewer_articles():
    reviewer_name = request.args.get('name')
    reviewer = None

    if not reviewer_name:
        return jsonify({"error": "Hakem adı gerekli"}), 400

    reviewers = Reviewer.query.all()

    for reviewer1 in reviewers:
        if reviewer_name == decrypt_data(reviewer1.name):
            reviewer = reviewer1

    if not reviewer:
        return jsonify({"error": "Hakem bulunamadı"}), 404

    articles = Article.query.filter_by(editor_id=reviewer.id).all()

    articles_data = []
    for article in articles:
        decrypted_title = decrypt_data(article.title)
        decrypted_authors = decrypt_data(article.authors)
        decrypted_email = decrypt_data(article.email)
        decrypted_institution = decrypt_data(article.institution)

        if article.is_authors_anonymous:
            authors_list = decrypted_authors.split(',')

            authors_list = [f"{author.strip()[0]}***" for author in authors_list]

            decrypted_authors = ', '.join(authors_list)

        if article.is_mail_anonymous:
            email_parts = decrypted_email.split('@')
            username = email_parts[0]
            domain_full = email_parts[1]

            domain_parts = domain_full.split('.')
            domain_extension = '.'.join(domain_parts[1:])

            decrypted_email = f"{username[0]}***@***.{domain_extension}"

        if article.is_institution_anonymous:
            decrypted_institution = f"{decrypted_institution.strip()[0]}***"

        articles_data.append({
            'id': article.id,
            'title': decrypted_title,
            'authors': decrypted_authors,
            'email': decrypted_email,
            'status': article.status,
            'created_at': article.created_at,
            'updated_at': article.updated_at,
            'institution': decrypted_institution,
        })

    return jsonify(articles_data), 200


@app.route('/get_logs', methods=['GET'])
def get_logs():
    logs = Log.query.all()
    logs_data = []

    for log in logs:
        logs_data.append({
            'id': log.id,
            'article_id': log.article_id,
            'reviewer_id': log.reviewer_id,
            'event': decrypt_data(log.event),
            'timestamp': log.timestamp,
        })

    try:
        return jsonify(logs_data), 200

    except:
        return jsonify({"error": "Loglar alınamadı."}), 500


@app.route('/classify_and_save_interests/<int:article_id>', methods=['GET'])
def classify_and_save_interests(article_id):
    with app.app_context():
        print("classify_and_save_interests fonksiyonu çağrıldı.")

        article = Article.query.get(article_id)
        if not article:
            return jsonify({'error': 'Makale bulunamadı'}), 404

        try:
            doc = fitz.open(article.pdf_path)
            extracted_keywords = []

            def normalize_text(text):
                return unicodedata.normalize("NFKC", text)

            for page in doc:
                try:
                    text = page.get_text("text")
                    text = normalize_text(text)

                    if not text.strip():
                        print(f"Sayfa {page.number + 1} için OCR çalıştırılıyor...")
                        pix = page.get_pixmap()
                        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                        text = pytesseract.image_to_string(img)
                        text = normalize_text(text)

                    print(f"Sayfa {page.number + 1} metni: {text}")

                    spacy_doc = nlp(text)
                    for ent in spacy_doc.ents:
                        print(
                            f"Bulunan varlık: {ent.text} - Etiket: {ent.label_}")
                        if ent.label_ == "ORG":
                            extracted_keywords.append(ent.text.lower())

                except Exception as e:
                    print(f"Metin çıkarılırken hata oluştu: {e}")
                    continue

            doc.close()

            classified_interests = set()

            for keyword in extracted_keywords:
                keyword_doc = nlp(keyword)
                for category, keywords in INTEREST_CATEGORIES.items():
                    for k in keywords:
                        category_doc = nlp(k)
                        similarity = keyword_doc.similarity(category_doc)
                        if similarity > 0.9:
                            print(f"Semantik eşleşme bulundu: {keyword} -> {category} (Benzerlik: {similarity})")
                            classified_interests.add(category)

            print(f"Sınıflandırılmış ilgi alanları: {classified_interests}")

            for interest in classified_interests:
                new_keyword = Keyword(article_id=article_id, keyword=interest)
                db.session.add(new_keyword)

            db.session.commit()

            return jsonify({'classified_interests': list(classified_interests)}), 200

        except Exception as e:
            print(f"Hata: {e}")
            return jsonify({'message': 'İlgi alanları sınıflandırılırken bir hata oluştu!'}), 500


def blur_sensitive_info_in_pdf(pdf_path, article_id, user_email, authors, institution=None):
    print("Blurlama işlemine başlandı.")
    email_pattern = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
    author_patterns = [re.compile(rf"\b{re.escape(author)}\b", re.IGNORECASE) for author in authors] if authors else []
    institution_pattern = re.compile(
        r'(?:[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\s(?:University of|Institute|College|Academy|Center|School|Laboratory|Foundation|Organization|Corporation|Society|Group|Association|Lab|Dept|Division|Campus|Faculty|Henley))',
        re.IGNORECASE
    )

    doc = fitz.open(pdf_path)
    blur_data = []

    for page_num in range(len(doc)):
        page = doc[page_num]
        page_text = page.get_text("text")

        normalized_text = " ".join(page_text.splitlines())

        if user_email:
            for match in email_pattern.finditer(normalized_text):
                found_email = match.group(0)
                blurred_email = "*" * len(found_email)
                rects = page.search_for(found_email)
                if not rects:
                    print(f"E-posta bulunamadı: {found_email}")
                    continue
                for rect in rects:
                    print(f"Redaksiyon uygulanıyor: {rect}")
                    page.add_redact_annot(rect, text=blurred_email, fill=(1, 1, 1))
                    blur_data.append({
                        "page": page_num,
                        "rect": str(rect),
                        "original_text": found_email,
                        "blurred_text": blurred_email
                    })
            page.apply_redactions()

        if authors:
            for author_pattern in author_patterns:
                for match in author_pattern.finditer(normalized_text):
                    found_author = match.group(0)
                    blurred_author = "*" * len(found_author)
                    rects = page.search_for(found_author)
                    if not rects:
                        print(f"Yazar adı bulunamadı: {found_author}")
                        continue
                    for rect in rects:
                        print(f"Redaksiyon uygulanıyor: {rect}")
                        page.add_redact_annot(rect, text=blurred_author, fill=(1, 1, 1))
                        blur_data.append({
                            "page": page_num,
                            "rect": str(rect),
                            "original_text": found_author,
                            "blurred_text": blurred_author
                        })
            page.apply_redactions()

        if institution:
            for match in institution_pattern.finditer(normalized_text):
                found_institution = match.group(0)
                print(f"Bulunan kurum: {found_institution}")
                blurred_institution = "*" * len(found_institution)
                rects = page.search_for(found_institution)
                if not rects:
                    print(f"Kurum adı bulunamadı: {found_institution}")
                    continue
                for rect in rects:
                    print(f"Kurum redaksiyon uygulanıyor: {rect}")
                    page.add_redact_annot(rect, text=blurred_institution, fill=(1, 1, 1))
                    blur_data.append({
                        "page": page_num,
                        "rect": str(rect),
                        "original_text": found_institution,
                        "blurred_text": blurred_institution
                    })
            page.apply_redactions()

        print("Blurlanmış veriler:", blur_data)

    try:
        for data in blur_data:
            new_blur_data = BlurData(
                article_id=article_id,
                page=data["page"],
                rect=data["rect"],
                original_text=data["original_text"],
                blurred_text=data["blurred_text"]
            )
            db.session.add(new_blur_data)

        blurred_pdf_path = pdf_path.replace(".pdf", "_blurred.pdf")
        doc.save(blurred_pdf_path)
        print(f"PDF başarıyla kaydedildi: {blurred_pdf_path}")
        doc.close()

        db.session.commit()
        print("Veritabanına kayıtlar başarıyla tamamlandı.")
    except Exception as e:
        db.session.rollback()
        print(f"PDF kaydedilirken veya veritabanına commit sırasında hata: {e}")

    return blurred_pdf_path, blur_data


def get_blur_data_from_db(article_id):
    blur_data = BlurData.query.filter_by(article_id=article_id).all()
    blur_data_list = []

    for data in blur_data:
        blur_data_list.append({
            "page": data.page,
            "rect": eval(data.rect),
            "original_text": data.original_text,
            "blurred_text": data.blurred_text
        })

    return blur_data_list


@app.route('/blur_article_pdf/<int:article_id>', methods=['POST'])
def blur_article_pdf(article_id):
    data = request.get_json()
    field = data.get("field")

    if not field:
        return jsonify({'error': 'Hangi alanın blurlanacağı belirtilmedi'}), 400

    article = Article.query.get(article_id)
    if not article:
        return jsonify({'error': 'Makale bulunamadı'}), 404

    try:
        email = decrypt_data(article.email) if field == "is_mail_anonymous" else None
        authors = decrypt_data(article.authors).split(",") if field == "is_authors_anonymous" else None
        institution = decrypt_data(article.institution) if field == "is_institution_anonymous" else None

        blurred_pdf_path, replacements = blur_sensitive_info_in_pdf(article.pdf_path, article_id, email, authors,
                                                                    institution)

        article.pdf_path = blurred_pdf_path

        db.session.commit()

        with open(blurred_pdf_path, 'rb') as pdf_file:
            pdf_data = base64.b64encode(pdf_file.read()).decode('utf-8')

        return jsonify({'pdf_data': pdf_data, 'message': 'Blurlanmış PDF oluşturuldu!'}), 200

    except Exception as e:
        print(f"Hata: {e}")
        return jsonify({'message': 'Makale verisi işlenirken bir hata oluştu!'}), 500


def unblur_sensitive_info_in_pdf(pdf_path, article_id, field, email=None, authors=None, institution=None):
    try:
        doc = fitz.open(pdf_path)

        blur_data = get_blur_data_from_db(article_id)
        print("Unblur işlemi için blur_data:", blur_data)

        for data in blur_data:
            page = doc[data["page"]]
            rect = fitz.Rect(data["rect"])
            original_text = data["original_text"]

            if field == "is_mail_anonymous" and email and "@" in original_text:
                print(f"E-posta unblur işlemi: {data['blurred_text']} -> {original_text}")
                page.add_redact_annot(rect, text=original_text, fill=(1, 1, 1))
            elif field == "is_authors_anonymous" and authors and any(author in original_text for author in authors):
                print(f"Yazar unblur işlemi: {data['blurred_text']} -> {original_text}")
                page.add_redact_annot(rect, text=original_text, fill=(1, 1, 1))
            elif field == "is_institution_anonymous" and institution and institution in original_text:
                print(f"Kurum adı unblur işlemi: {data['blurred_text']} -> {original_text}")
                page.add_redact_annot(rect, text=original_text, fill=(1, 1, 1))

            page.apply_redactions()

        unblurred_pdf_path = pdf_path.replace(".pdf", "_unblurred.pdf")
        doc.save(unblurred_pdf_path, incremental=False)
        doc.close()

        print(f"Unblur işlemi tamamlandı: {unblurred_pdf_path}")
        return unblurred_pdf_path

    except Exception as e:
        print(f"Hata oluştu: {e}")
        return pdf_path


@app.route('/unblur_article_pdf/<int:article_id>', methods=['POST'])
def unblur_article_pdf(article_id):
    data = request.get_json()
    field = data.get("field")

    if not field:
        return jsonify({'error': 'Hangi alanın unblurlanacağı belirtilmedi'}), 400

    article = Article.query.get(article_id)
    if not article:
        return jsonify({'error': 'Makale bulunamadı'}), 404

    try:
        email = decrypt_data(article.email) if field == "is_mail_anonymous" else None
        authors = decrypt_data(article.authors).split(",") if field == "is_authors_anonymous" else None
        institution = decrypt_data(article.institution) if field == "is_institution_anonymous" else None

        unblurred_pdf_path = unblur_sensitive_info_in_pdf(article.pdf_path, article_id, field, email, authors,
                                                          institution)

        article.pdf_path = unblurred_pdf_path
        db.session.commit()

        with open(unblurred_pdf_path, 'rb') as pdf_file:
            pdf_data = base64.b64encode(pdf_file.read()).decode('utf-8')

        return jsonify({'pdf_data': pdf_data, 'message': 'Unblurlanmış PDF oluşturuldu!'}), 200

    except Exception as e:
        print(f"Hata: {e}")
        return jsonify({'message': 'Makale verisi işlenirken bir hata oluştu!'}), 500


@app.route('/get_messages/<int:article_id>', methods=['GET'])
def get_messages(article_id):
    article = Article.query.filter_by(id=article_id).first()
    if not article:
        return jsonify({"message": "Makale bulunamadı!"}), 404

    reviewer_name = Reviewer.query.filter_by(id=article.editor_id).first().name

    messages = Message.query.filter_by(article_id=article.id).order_by(Message.created_at.asc()).all()

    for msg in messages:
        if decrypt_data(msg.sender_email) == decrypt_data(reviewer_name):
            msg.is_read = True
            db.session.commit()

    messages_data = [{
        "id": msg.id,
        "sender": decrypt_data(msg.sender_email),
        "text": decrypt_data(msg.message),
        "created_at": msg.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        "is_read": msg.is_read
    } for msg in messages]

    return jsonify({"messages": messages_data})


@app.route('/send_message', methods=['POST'])
def send_message():
    data = request.json
    tracking_code = data.get("tracking_code")
    sender_email = data.get("sender")
    text = data.get("text")

    if not tracking_code or not sender_email or not text:
        return jsonify({"message": "Eksik veri!"}), 400

    article = Article.query.filter_by(id=tracking_code).first()
    if not article:
        return jsonify({"message": "Makale bulunamadı!"}), 404

    reviewer = Reviewer.query.filter_by(id=article.editor_id).first()
    if not reviewer:
        return jsonify({"message": "Makale için hakem atanmadı!"}), 404

    new_message = Message(
        article_id=article.id,
        reviewer_id=reviewer.id,
        sender_email=encrypt_data(sender_email),
        message=encrypt_data(text),
        created_at=datetime.utcnow(),
        is_read=False
    )

    db.session.add(new_message)

    new_log = Log(
        article_id=article.id,
        reviewer_id=article.editor_id,
        event=encrypt_data(f"Mesaj gönderildi."),
        timestamp=datetime.utcnow()
    )
    db.session.add(new_log)

    db.session.commit()

    return jsonify({"message": "Mesaj başarıyla kaydedildi!"}), 201


@app.route('/get_messages_for_reviewer/<int:article_id>', methods=['GET'])
def get_messages_for_reviewer(article_id):
    article = Article.query.filter_by(id=article_id).first()
    if not article:
        return jsonify({"message": "Makale bulunamadı!"}), 404

    messages = Message.query.filter_by(article_id=article.id).order_by(Message.created_at.asc()).all()

    for msg in messages:
        if decrypt_data(msg.sender_email) == decrypt_data(article.email):
            msg.is_read = True
            db.session.commit()

    messages_data = [{
        "id": msg.id,
        "sender": decrypt_data(msg.sender_email),
        "text": decrypt_data(msg.message),
        "created_at": msg.created_at.strftime("%Y-%m-%d %H:%M:%S"),
        "is_read": msg.is_read
    } for msg in messages]

    return jsonify({"messages": messages_data})


@app.route('/submit_review', methods=['POST'])
def submit_review():
    data = request.json
    article_id = data.get('article_id')
    comments = data.get('comments')
    status = data.get('status')

    if not article_id or not comments:
        return jsonify({"message": "Eksik veri!"}), 400

    article = Article.query.get(article_id)
    if not article:
        return jsonify({"message": "Makale bulunamadı!"}), 404

    reviewer_id = article.editor_id
    if not reviewer_id:
        return jsonify({"message": "Makale için atanmış bir hakem bulunamadı!"}), 404

    try:
        new_review = Review(
            article_id=article_id,
            reviewer_id=reviewer_id,
            comments=encrypt_data(comments),
            created_at=datetime.utcnow()
        )
        db.session.add(new_review)


        doc = fitz.open(article.pdf_path)
        doc.insert_page(-1,text=f"Hakem Yorumları:\n\n{comments}")


        updated_pdf_path = article.pdf_path.replace(".pdf", "_reviewed.pdf")
        doc.save(updated_pdf_path)
        doc.close()


        article.pdf_path = updated_pdf_path
        article.status = status

        new_log = Log(
            article_id=article.id,
            reviewer_id=reviewer_id,
            event=encrypt_data(f"{article.id} kodlu makalenin değerlendirmesi tamamlandı."),
            timestamp=datetime.utcnow()
        )
        db.session.add(new_log)

        db.session.commit()

        return jsonify({"message": "Yorum başarıyla kaydedildi, PDF güncellendi ve durum güncellendi!"}), 200
    except Exception as e:
        db.session.rollback()
        print(f"Hata: {e}")
        return jsonify({"message": "Yorum kaydedilirken bir hata oluştu!"}), 500


@app.route('/get_reviews/<int:article_id>', methods=['GET'])
def get_reviews(article_id):
    review = Review.query.filter_by(article_id=article_id).first()
    reviewer = Reviewer.query.filter_by(id=review.reviewer_id).first()

    if not review:
        return jsonify({"message": "No reviews found"}), 404

    review = [{
        "id": review.id,
        "reviewer": decrypt_data(reviewer.name),
        "comments": decrypt_data(review.comments),
        "created_at": review.created_at}]

    return jsonify(review), 200


@app.route("/revise_article/<int:article_id>", methods=["PATCH"])
def revise_article(article_id):
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)

    article = Article.query.get(article_id)
    if not article:
        return jsonify({"message": "Makale bulunamadı!"}), 404

    title = request.form.get('title')
    file = request.files.get('file')

    if title:
        article.title = encrypt_data(title)

    if file and allowed_file(file.filename):
        try:
            if os.path.exists(article.pdf_path):
                os.remove(article.pdf_path)
        except Exception as e:
            return jsonify({"message": "Eski dosya silinirken hata oluştu!"}), 500

        filename = secure_filename(file.filename)
        file_extension = filename.rsplit('.', 1)[1].lower()

        new_file_path = os.path.join(UPLOAD_FOLDER, f"{article.id}.{file_extension}")
        file.save(new_file_path)

        article.pdf_path = new_file_path
        article.status = 'İncelemede'
        article.updated_at = datetime.utcnow()

        new_log = Log(
            article_id=article.id,
            reviewer_id=article.editor_id,
            event=encrypt_data(f"{article.id} kodlu makalenin revizesi yapıldı."),
            timestamp=datetime.utcnow()
        )
        db.session.add(new_log)

    try:
        db.session.commit()
        return jsonify({"message": "Makale başarıyla revize edildi!"}), 200
    except Exception as e:
        db.session.rollback()
        print(f"Hata: {e}")
        return jsonify({"message": "Makale revize edilirken bir hata oluştu!"}), 500


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True, host="0.0.0.0", port=3000)
