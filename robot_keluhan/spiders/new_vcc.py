import scrapy
import base64
import io
from PIL import Image
import pytesseract

# Jika Anda menginstall Tesseract di folder kustom Windows, definisikan path-nya di sini:
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

class NewVCCSpider(scrapy.Spider):
    name = "new_vcc"

    def start_requests(self):
        signin_url = 'https://new-vcc.pln.co.id'
        yield scrapy.Request(
            url=signin_url,
            callback=self.parse_login,
            meta={
                "playwright": True,
                "playwright_include_page": True,
            }
        )

    async def parse_login(self, response):
        page = response.meta["playwright_page"]
        self.logger.info("Membuka halaman utama...")
        
        try:
            # 1. Klik tombol LOGIN depan
            await page.click("button:has-text('Login')")
            
            # 2. Tunggu sampai field form login muncul sempurna
            await page.wait_for_selector("#email", timeout=10000)
            
            # 3. Isi form Email/Username & Password
            # Playwright memicu event ketikan keyboard fisik asli
            await page.fill("#email", "username_atau_email_anda@domain.com")
            await page.fill("#passcode", "password_rahasia_anda")
            self.logger.info("Form email dan password berhasil diisi.")
            
            # 4. AMBIL DAN EKSTRAK GAMBAR CAPTCHA (BASE64)
            # Define your exact CSS Selector for the captcha image
            captcha_img_selector = '#__next > div:nth-child(2) > div.auth-page > div > div > div.mb-4.auth-body > div > div:nth-child(3) > div > div:nth-child(1) > img'
            
            # Wait until the specific image element is fully rendered on the screen
            await page.wait_for_selector(captcha_img_selector, timeout=10000)
            
            # Extract the raw base64 string from the 'src' attribute using your exact selector
            captcha_src = await page.eval_on_selector(captcha_img_selector, "el => el.src")
            
            # Separate the base64 header from the raw image encoding
            if "," in captcha_src:
                base64_data = captcha_src.split(",")[1]
            else:
                base64_data = captcha_src
            
            # Convert the base64 string directly into a Python Image object
            img_bytes = base64.b64decode(base64_data)
            image = Image.open(io.BytesIO(img_bytes))
            
            # 5. PEMBACAAN TEKS CAPTCHA MENGGUNAKAN OCR
            # Using basic alphanumeric configuration
            custom_config = r'--oem 3 --psm 6'
            captcha_text = pytesseract.image_to_string(image, config=custom_config).strip()
            
            # Clean up the string to ensure only letters and numbers are sent
            captcha_text = "".join(c for c in captcha_text if c.isalnum())
            self.logger.info(f"Sistem mendeteksi teks Captcha: {captcha_text}")
            
            # 6. Masukkan hasil teks ke dalam field input #captcha
            await page.fill("#captcha", captcha_text)
            
            # Ambil screenshot sebelum tombol submit ditekan untuk memvalidasi isian form
            await page.screenshot(path="siap_submit.png")
            
            # 7. Klik tombol login final / submit form
            await page.click("button[type='submit'], button:has-text('Login')")
            
            # Jeda akhir untuk memuat halaman dashboard internal pasca sukses login
            await page.wait_for_timeout(8000)
            await page.screenshot(path="dashboard_vcc.png")
            self.logger.info("Proses selesai. Screenshot dashboard disimpan di dashboard_vcc.png")
                
        except Exception as e:
            self.logger.error(f"Gagal memproses form captcha: {str(e)}")
            await page.screenshot(path="error_captcha.png")
            
        finally:
            await page.close()